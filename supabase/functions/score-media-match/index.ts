import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getOrResolveGenres } from '../_shared/genre-cache.ts';
import { canonicalizeMany } from '../_shared/genre-taxonomy.ts';
import { FINGERPRINT_VERSION, getOrResolveMediaFingerprint } from '../_shared/media-fingerprint.ts';
import { buildPrompt } from './prompt.mjs';
import { scoreMediaMatchV2 } from './v2.mjs';
import { scoreMediaMatchV3 } from './v3.mjs';
import { chunkValues, fingerprintKey, planFingerprintCoverage } from './coverage.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const CACHE_DAYS = 14;
const V3_SCORER_REVISION = 7;
const HISTORY_PAGE_SIZE = 1000;
const IN_QUERY_CHUNK_SIZE = 100;
const BACKFILL_LEASE_STALE_MS = 2 * 60 * 1000;
const normalizeMatchText = (value: unknown) => String(value || '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const canonicalMediaType = (value: unknown) => {
  const normalized = normalizeMatchText(value);
  if (normalized.includes('book')) return 'book';
  if (normalized.includes('movie') || normalized.includes('film')) return 'movie';
  if (normalized.includes('tv') || normalized.includes('show') || normalized.includes('series')) return 'tv';
  if (normalized.includes('music') || normalized.includes('track') || normalized.includes('album')) return 'music';
  if (normalized.includes('podcast')) return 'podcast';
  if (normalized.includes('youtube') || normalized.includes('video') || normalized.includes('channel')) return 'youtube';
  if (normalized.includes('game')) return 'game';
  return normalized;
};

const fingerprintForScoring = (
  fingerprint: any,
  fallback: { title?: unknown; mediaType?: unknown; creator?: unknown; genres?: unknown[] },
) => {
  const metadata = fingerprint?.source_metadata || {};
  const creatorValues = [
    metadata.creator,
  ].flatMap((value) => typeof value === 'string' ? value.split(/\s*,\s*/) : []).filter(Boolean);
  return {
    source_verified: fingerprint?.source_verified === true,
    title: metadata.title || fallback.title || '',
    media_type: fallback.mediaType || '',
    creators: [...new Set(creatorValues)],
    genres: canonicalizeMany([
      ...(Array.isArray(fallback.genres) ? fallback.genres : []),
      ...(Array.isArray(metadata.subjects) ? metadata.subjects : []),
    ]),
    themes: Array.isArray(fingerprint?.themes) ? fingerprint.themes : [],
    tones: Array.isArray(fingerprint?.tones) ? fingerprint.tones : [],
    audience: Array.isArray(fingerprint?.audience) ? fingerprint.audience : [],
    styles: Array.isArray(fingerprint?.styles) ? fingerprint.styles : [],
    pacing: Array.isArray(fingerprint?.pacing) ? fingerprint.pacing : [],
    embedding: Array.isArray(fingerprint?.embedding) ? fingerprint.embedding : [],
    keywords: Array.isArray(metadata.keywords) ? metadata.keywords : [],
    franchise: fingerprint?.franchise || metadata.collection || null,
    story_key: fingerprint?.story_key || null,
  };
};

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      output[index] = await mapper(values[index]);
    }
  });
  await Promise.all(workers);
  return output;
}

async function loadAllRatings(admin: any, userId: string): Promise<any[]> {
  const ratings: any[] = [];
  for (let from = 0; ; from += HISTORY_PAGE_SIZE) {
    const { data, error } = await admin
      .from('media_ratings')
      .select('id, media_external_id, media_external_source, media_title, media_type, rating, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .order('media_external_source', { ascending: true })
      .order('media_external_id', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + HISTORY_PAGE_SIZE - 1);
    if (error) throw error;
    const page = data || [];
    ratings.push(...page);
    if (page.length < HISTORY_PAGE_SIZE) return ratings;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const cap = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : v == null ? v : String(v).slice(0, n));
    const external_source = cap(body?.external_source, 50);
    const external_id = cap(body?.external_id, 100);
    const media_type = cap(body?.media_type, 30);
    const title = cap(body?.title, 300);
    const creator = cap(body?.creator, 200);
    const description = cap(body?.description, 1000);
    const genres = Array.isArray(body?.genres) ? body.genres.slice(0, 8).map((g: unknown) => String(g).slice(0, 50)) : [];
    const scorer_version = cap(body?.scorer_version, 10);
    if (!external_source || !external_id || !title) {
      return new Response(JSON.stringify({ error: 'external_source, external_id and title are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Deterministic scorers are opt-in and version-namespaced so either can be
    // rolled back without overwriting the legacy AI scorer or one another.
    if (scorer_version === 'v2' || scorer_version === 'v3') {
      const deterministicVersion = String(scorer_version);
      const isV3 = deterministicVersion === 'v3';
      const source = String(external_source);
      const id = String(external_id);
      const deterministicCacheSource = isV3
        ? `v3.${FINGERPRINT_VERSION}.${V3_SCORER_REVISION}:${source}`
        : `v2.2:${source}`;
      const { data: ownRating, error: ownRatingError } = await admin
        .from('media_ratings')
        .select('rating')
        .eq('user_id', user.id)
        .eq('media_external_source', source)
        .eq('media_external_id', id)
        .maybeSingle();
      if (ownRatingError) throw ownRatingError;
      if (ownRating) {
        return new Response(JSON.stringify({
          score: null,
          rated: true,
          rating: Number(ownRating.rating),
          reason: 'Your actual rating replaces a predicted match.',
          scorer_version: deterministicVersion,
          cached: false,
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const readDeterministicCache = async () => {
        const { data } = await admin
          .from('media_match_scores')
          .select('score, reason, created_at')
          .eq('user_id', user.id)
          .eq('external_source', deterministicCacheSource)
          .eq('external_id', id)
          .maybeSingle();
        return data;
      };
      const cachedDeterministic = await readDeterministicCache();
      const deterministicAge = cachedDeterministic ? Date.now() - new Date(cachedDeterministic.created_at).getTime() : Infinity;
      if (cachedDeterministic?.score >= 0 && deterministicAge < 24 * 60 * 60 * 1000) {
        let metadata: any = {};
        try { metadata = JSON.parse(cachedDeterministic.reason || '{}'); } catch { metadata = { reason: cachedDeterministic.reason }; }
        return new Response(JSON.stringify({
          score: cachedDeterministic.score,
          ...metadata,
          scorer_version: deterministicVersion,
          cached: true,
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (cachedDeterministic?.score < 0 && deterministicAge < 2 * 60 * 1000) {
        return new Response(JSON.stringify({ score: null, pending: true, scorer_version: deterministicVersion }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const leaseToken = new Date().toISOString();
      const reservation = {
        user_id: user.id,
        external_source: deterministicCacheSource,
        external_id: id,
        media_type: media_type || null,
        score: -1,
        reason: 'pending',
        created_at: leaseToken,
      };
      let acquiredLease = false;
      if (!cachedDeterministic) {
        const { error } = await admin.from('media_match_scores').insert(reservation);
        if (!error) acquiredLease = true;
        else if (error.code !== '23505') console.error('Failed to reserve deterministic score slot:', error);
      } else {
        const { data, error } = await admin
          .from('media_match_scores')
          .update(reservation)
          .eq('user_id', user.id)
          .eq('external_source', deterministicCacheSource)
          .eq('external_id', id)
          .eq('score', cachedDeterministic.score)
          .eq('created_at', cachedDeterministic.created_at)
          .select('created_at');
        if (error) console.error('Failed to renew deterministic score lease:', error);
        acquiredLease = Array.isArray(data) && data.length === 1;
      }
      if (!acquiredLease) {
        return new Response(JSON.stringify({ score: null, pending: true, scorer_version: deterministicVersion }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const releaseDeterministicReservation = async () => {
        await admin.from('media_match_scores').delete()
          .eq('user_id', user.id)
          .eq('external_source', deterministicCacheSource)
          .eq('external_id', id)
          .eq('score', -1)
          .eq('created_at', leaseToken);
      };

      try {
        const ratingsPromise = isV3
          ? loadAllRatings(admin, user.id)
          : (async () => {
              const { data, error } = await admin
                .from('media_ratings')
                .select('media_external_id, media_external_source, media_title, media_type, rating, updated_at')
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false })
                .limit(200);
              if (error) throw error;
              return data || [];
            })();
        const [ratingRows, resolvedGenres] = await Promise.all([
          ratingsPromise,
          getOrResolveGenres(admin, source, id, media_type ? String(media_type) : null),
        ]);

        const ratings = ratingRows || [];
        const equivalentOwnRating = ratings.find((rating: any) =>
          normalizeMatchText(rating.media_title) === normalizeMatchText(title)
          && canonicalMediaType(rating.media_type) === canonicalMediaType(media_type)
        );
        if (equivalentOwnRating) {
          await releaseDeterministicReservation();
          return new Response(JSON.stringify({
            score: null,
            rated: true,
            rating: Number(equivalentOwnRating.rating),
            reason: 'Your actual rating replaces a predicted match.',
            scorer_version: deterministicVersion,
            cached: false,
          }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const ratingIds = [...new Set(ratings.map((rating: any) => String(rating.media_external_id || '')).filter(Boolean))];
        let genreRows: any[] = [];
        for (const idChunk of chunkValues(ratingIds, IN_QUERY_CHUNK_SIZE)) {
          const { data, error } = await admin
            .from('media_genres')
            .select('external_source, external_id, canonical_genres')
            .in('external_id', idChunk);
          if (error) console.error('Failed to load rating genres for v2 scorer:', error);
          genreRows.push(...(data || []));
        }
        const genreMap = new Map(
          genreRows.map((row: any) => [
            `${row.external_source}:${row.external_id}`,
            Array.isArray(row.canonical_genres) ? row.canonical_genres : [],
          ])
        );
        const ratingsWithGenres = ratings.map((rating: any) => ({
          ...rating,
          genres: genreMap.get(`${rating.media_external_source}:${rating.media_external_id}`) || [],
        }));
        const targetGenres = resolvedGenres.length > 0 ? resolvedGenres : canonicalizeMany(genres);
        let result: any;
        if (!isV3) {
          result = scoreMediaMatchV2({
            ratings: ratingsWithGenres,
            mediaGenres: targetGenres,
            mediaType: media_type,
          });
        } else {
          const targetFingerprint = await getOrResolveMediaFingerprint(admin, {
            externalSource: source,
            externalId: id,
            mediaType: String(media_type || ''),
            title: String(title),
            creator: creator ? String(creator) : null,
            description: description ? String(description) : null,
            genres: targetGenres,
          });
          const candidate = fingerprintForScoring(targetFingerprint, {
            title,
            mediaType: media_type,
            creator,
            genres: targetGenres,
          });

          let cachedFingerprintRows: any[] = [];
          for (const idChunk of chunkValues(ratingIds, IN_QUERY_CHUNK_SIZE)) {
            const { data, error } = await admin
              .from('media_fingerprints')
              .select('external_source,external_id,fingerprint,fingerprint_version,status,resolved_at')
              .eq('fingerprint_version', FINGERPRINT_VERSION)
              .in('external_id', idChunk);
            if (error) throw error;
            cachedFingerprintRows.push(...(data || []));
          }
          const now = Date.now();
          const fingerprintMap = new Map(
            cachedFingerprintRows
              .filter((row: any) => {
                const age = now - new Date(row.resolved_at).getTime();
                const ttl = row.status === 'ready' ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
                return row.fingerprint_version === FINGERPRINT_VERSION
                  && row.fingerprint
                  && typeof row.fingerprint.source_verified === 'boolean'
                  && age >= 0
                  && age < ttl;
              })
              .map((row: any) => [fingerprintKey(row), row.fingerprint])
          );
          const coveragePlan = planFingerprintCoverage(ratingsWithGenres, new Set(fingerprintMap.keys()));
          if (coveragePlan.missingCount > 0) {
            const backfillLeaseToken = crypto.randomUUID();
            const leasedAt = new Date().toISOString();
            const leaseRow = {
              user_id: user.id,
              fingerprint_version: FINGERPRINT_VERSION,
              lease_token: backfillLeaseToken,
              leased_at: leasedAt,
            };
            let ownsBackfillLease = false;
            const { error: insertLeaseError } = await admin
              .from('media_fingerprint_backfill_leases')
              .insert(leaseRow);
            if (!insertLeaseError) {
              ownsBackfillLease = true;
            } else if (insertLeaseError.code === '23505') {
              const { data: claimed, error: claimError } = await admin
                .from('media_fingerprint_backfill_leases')
                .update({ lease_token: backfillLeaseToken, leased_at: leasedAt })
                .eq('user_id', user.id)
                .eq('fingerprint_version', FINGERPRINT_VERSION)
                .is('lease_token', null)
                .select('lease_token');
              if (claimError) throw claimError;
              ownsBackfillLease = Array.isArray(claimed)
                && claimed.length === 1
                && claimed[0].lease_token === backfillLeaseToken;
              if (!ownsBackfillLease) {
                const staleBefore = new Date(Date.now() - BACKFILL_LEASE_STALE_MS).toISOString();
                const { data: takenOver, error: takeoverError } = await admin
                  .from('media_fingerprint_backfill_leases')
                  .update({ lease_token: backfillLeaseToken, leased_at: leasedAt })
                  .eq('user_id', user.id)
                  .eq('fingerprint_version', FINGERPRINT_VERSION)
                  .not('lease_token', 'is', null)
                  .lt('leased_at', staleBefore)
                  .select('lease_token');
                if (takeoverError) throw takeoverError;
                ownsBackfillLease = Array.isArray(takenOver)
                  && takenOver.length === 1
                  && takenOver[0].lease_token === backfillLeaseToken;
              }
            } else {
              throw insertLeaseError;
            }
            if (!ownsBackfillLease) {
              await releaseDeterministicReservation();
              return new Response(JSON.stringify({ score: null, pending: true, scorer_version: deterministicVersion }), {
                status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }

            try {
              const enriched = await mapWithConcurrency(coveragePlan.batch, 6, async (rating: any) => {
                const heartbeat = await admin
                  .from('media_fingerprint_backfill_leases')
                  .update({ leased_at: new Date().toISOString() })
                  .eq('user_id', user.id)
                  .eq('fingerprint_version', FINGERPRINT_VERSION)
                  .eq('lease_token', backfillLeaseToken)
                  .select('lease_token');
                if (heartbeat.error) throw heartbeat.error;
                if (!Array.isArray(heartbeat.data) || heartbeat.data.length !== 1) {
                  throw new Error('Media fingerprint backfill lease was lost');
                }
                const fingerprint = await getOrResolveMediaFingerprint(admin, {
                  externalSource: String(rating.media_external_source),
                  externalId: String(rating.media_external_id),
                  mediaType: String(rating.media_type || ''),
                  title: String(rating.media_title || ''),
                  genres: rating.genres || [],
                });
                return { key: fingerprintKey(rating), fingerprint };
              });
              for (const entry of enriched) fingerprintMap.set(entry.key, entry.fingerprint);

              const batchIds = [...new Set(coveragePlan.batch.map((rating: any) => String(rating.media_external_id)))];
              const { data: persistedRows, error: persistedError } = await admin
                .from('media_fingerprints')
                .select('external_source,external_id,fingerprint,fingerprint_version,status,resolved_at')
                .eq('fingerprint_version', FINGERPRINT_VERSION)
                .in('external_id', batchIds);
              if (persistedError) throw persistedError;
              const persistedNow = Date.now();
              const persistedKeys = new Set((persistedRows || [])
                .filter((row: any) => {
                  const age = persistedNow - new Date(row.resolved_at).getTime();
                  const ttl = row.status === 'ready' ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
                  return row.fingerprint
                    && typeof row.fingerprint.source_verified === 'boolean'
                    && age >= 0
                    && age < ttl;
                })
                .map((row: any) => fingerprintKey(row)));
              const stillMissing = coveragePlan.batch.some((rating: any) => !persistedKeys.has(fingerprintKey(rating)));
              if (stillMissing) {
                const { error: releaseError } = await admin
                  .from('media_fingerprint_backfill_leases')
                  .update({ lease_token: null, leased_at: new Date().toISOString() })
                  .eq('user_id', user.id)
                  .eq('fingerprint_version', FINGERPRINT_VERSION)
                  .eq('lease_token', backfillLeaseToken);
                if (releaseError) throw releaseError;
                await releaseDeterministicReservation();
                return new Response(JSON.stringify({ score: null, pending: true, scorer_version: deterministicVersion }), {
                  status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              }

              if (!coveragePlan.completeAfterBatch) {
                const { data: released, error: releaseError } = await admin
                  .from('media_fingerprint_backfill_leases')
                  .update({ lease_token: null, leased_at: new Date().toISOString() })
                  .eq('user_id', user.id)
                  .eq('fingerprint_version', FINGERPRINT_VERSION)
                  .eq('lease_token', backfillLeaseToken)
                  .select('fingerprint_version');
                if (releaseError) throw releaseError;
                if (!Array.isArray(released) || released.length !== 1) {
                  throw new Error('Media fingerprint backfill lease was lost');
                }
                await releaseDeterministicReservation();
                return new Response(JSON.stringify({ score: null, pending: true, scorer_version: deterministicVersion }), {
                  status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              }

              const finalFingerprintRows: any[] = [];
              for (const idChunk of chunkValues(ratingIds, IN_QUERY_CHUNK_SIZE)) {
                const { data, error } = await admin
                  .from('media_fingerprints')
                  .select('external_source,external_id,fingerprint,fingerprint_version,status,resolved_at')
                  .eq('fingerprint_version', FINGERPRINT_VERSION)
                  .in('external_id', idChunk);
                if (error) throw error;
                finalFingerprintRows.push(...(data || []));
              }
              const finalNow = Date.now();
              const finalFingerprintMap = new Map(finalFingerprintRows
                .filter((row: any) => {
                  const age = finalNow - new Date(row.resolved_at).getTime();
                  const ttl = row.status === 'ready' ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
                  return row.fingerprint
                    && typeof row.fingerprint.source_verified === 'boolean'
                    && age >= 0
                    && age < ttl;
                })
                .map((row: any) => [fingerprintKey(row), row.fingerprint]));
              const finalCoveragePlan = planFingerprintCoverage(
                ratingsWithGenres,
                new Set(finalFingerprintMap.keys()),
              );
              if (finalCoveragePlan.missingCount > 0) {
                const { data: released, error: releaseError } = await admin
                  .from('media_fingerprint_backfill_leases')
                  .update({ lease_token: null, leased_at: new Date().toISOString() })
                  .eq('user_id', user.id)
                  .eq('fingerprint_version', FINGERPRINT_VERSION)
                  .eq('lease_token', backfillLeaseToken)
                  .select('fingerprint_version');
                if (releaseError) throw releaseError;
                if (!Array.isArray(released) || released.length !== 1) {
                  throw new Error('Media fingerprint backfill lease was lost');
                }
                await releaseDeterministicReservation();
                return new Response(JSON.stringify({ score: null, pending: true, scorer_version: deterministicVersion }), {
                  status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              }
              for (const [key, fingerprint] of finalFingerprintMap) fingerprintMap.set(key, fingerprint);

              const { data: completed, error: completeError } = await admin
                .from('media_fingerprint_backfill_leases')
                .delete()
                .eq('user_id', user.id)
                .eq('fingerprint_version', FINGERPRINT_VERSION)
                .eq('lease_token', backfillLeaseToken)
                .select('fingerprint_version');
              if (completeError) throw completeError;
              if (!Array.isArray(completed) || completed.length !== 1) {
                throw new Error('Media fingerprint backfill lease was lost');
              }
            } catch (error) {
              await admin.from('media_fingerprint_backfill_leases')
                .update({ lease_token: null, leased_at: new Date().toISOString() })
                .eq('user_id', user.id)
                .eq('fingerprint_version', FINGERPRINT_VERSION)
                .eq('lease_token', backfillLeaseToken);
              throw error;
            }
          } else {
            // A previous continuation may have completed between polls. Remove
            // its now-idle marker once the full-history recheck is clean.
            await admin.from('media_fingerprint_backfill_leases')
              .delete()
              .eq('user_id', user.id)
              .eq('fingerprint_version', FINGERPRINT_VERSION)
              .is('lease_token', null);
          }

          const ratingsWithFingerprints = ratingsWithGenres.map((rating: any) => {
            const fingerprint = fingerprintMap.get(`${rating.media_external_source}:${rating.media_external_id}`);
            return {
              ...rating,
              ...fingerprintForScoring(fingerprint, {
                title: rating.media_title,
                mediaType: rating.media_type,
                genres: rating.genres,
              }),
              rating: Number(rating.rating),
            };
          });
          const [{ data: dnaSignalRows, error: dnaSignalError }, { data: followedRows, error: followedError }] = await Promise.all([
            admin.from('user_dna_signals')
              .select('signal_type,signal_value,strength,sources')
              .eq('user_id', user.id)
              .neq('signal_type', 'engagement')
              .order('strength', { ascending: false })
              .limit(40),
            admin.from('followed_creators')
              .select('creator_name')
              .eq('user_id', user.id)
              .limit(100),
          ]);
          if (dnaSignalError) console.error('Failed to load source-backed DNA signals for v3:', dnaSignalError);
          if (followedError) console.error('Failed to load followed creators for v3:', followedError);
          const dnaSignals = (dnaSignalRows || []).flatMap((signal: any) => {
            const sources = signal.sources || {};
            if (Number(sources.followed || 0) > 0) {
              return [{ ...signal, source: 'followed creator', direction: 'positive' }];
            }
            if (Number(sources.genre_polls || 0) > 0) {
              return [{ ...signal, source: 'explicit', direction: 'positive' }];
            }
            const rated = Number(sources.rated || 0);
            const ratedHigh = Number(sources.rated_high || 0);
            if (rated >= 2 && ratedHigh / rated >= 0.7) {
              return [{ ...signal, source: 'rated', preference: Math.min(0.6, ratedHigh / rated) }];
            }
            return [];
          });
          result = scoreMediaMatchV3({
            ratings: ratingsWithFingerprints,
            candidate,
            dnaSignals,
            followedCreators: (followedRows || []).map((row: any) => row.creator_name).filter(Boolean),
          });
        }
        if (typeof result.score !== 'number') {
          await releaseDeterministicReservation();
          return new Response(JSON.stringify({
            ...result,
            scorer_version: deterministicVersion,
            cached: false,
          }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const cacheMetadata = JSON.stringify({
          reason: result.reason,
          confidence: result.confidence,
          evidence: result.evidence,
        });
        const { data: finalized, error: finalizeError } = await admin
          .from('media_match_scores')
          .update({
          media_type: media_type || null,
          score: result.score,
          reason: cacheMetadata,
          created_at: new Date().toISOString(),
        })
          .eq('user_id', user.id)
          .eq('external_source', deterministicCacheSource)
          .eq('external_id', id)
          .eq('score', -1)
          .eq('created_at', leaseToken)
          .select('score');
        if (finalizeError) throw finalizeError;
        if (!Array.isArray(finalized) || finalized.length !== 1) {
          return new Response(JSON.stringify({ score: null, pending: true, scorer_version: deterministicVersion }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          ...result,
          scorer_version: deterministicVersion,
          cached: false,
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        await releaseDeterministicReservation();
        throw error;
      }
    }

    // Cache hit? (score = -1 means another request is generating right now)
    const readCache = async () => {
      const { data } = await admin
        .from('media_match_scores')
        .select('score, reason, created_at')
        .eq('user_id', user.id)
        .eq('external_source', String(external_source))
        .eq('external_id', String(external_id))
        .maybeSingle();
      return data;
    };
    const isFresh = (row: any) => Date.now() - new Date(row.created_at).getTime() < CACHE_DAYS * 24 * 60 * 60 * 1000;
    const isPendingFresh = (row: any) => row.score < 0 && Date.now() - new Date(row.created_at).getTime() < 2 * 60 * 1000;

    let cached = await readCache();
    if (cached) {
      if (cached.score >= 0 && isFresh(cached)) {
        return new Response(JSON.stringify({ score: cached.score, reason: cached.reason, cached: true }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (isPendingFresh(cached)) {
        // Another request is already paying for this AI call — don't duplicate it
        return new Response(JSON.stringify({ score: null, pending: true }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Reserve the slot so concurrent requests don't each call the AI
    const { error: reserveErr } = await admin.from('media_match_scores').upsert({
      user_id: user.id,
      external_source: String(external_source),
      external_id: String(external_id),
      media_type: media_type || null,
      score: -1,
      reason: 'pending',
      created_at: new Date().toISOString(),
    }, { onConflict: 'user_id,external_source,external_id' });
    if (reserveErr) {
      console.error('Failed to reserve score slot:', reserveErr);
    }

    // Compile a compact taste profile
    const [{ data: dnaProfile }, { data: highRatings }, { data: lowRatings }, { data: dnaSignals }] = await Promise.all([
      admin.from('dna_profiles').select('label, tagline, profile_text, favorite_genres, favorite_media_types').eq('user_id', user.id).maybeSingle(),
      admin.from('media_ratings').select('media_title, media_type, rating').eq('user_id', user.id).gte('rating', 4).order('rating', { ascending: false }).limit(20),
      admin.from('media_ratings').select('media_title, media_type, rating').eq('user_id', user.id).lte('rating', 2).order('rating', { ascending: true }).limit(10),
      admin.from('user_dna_signals').select('signal_type, signal_value, strength').eq('user_id', user.id).neq('signal_type', 'engagement').order('strength', { ascending: false }).limit(25),
    ]);

    const releaseReservation = async () => {
      await admin.from('media_match_scores').delete()
        .eq('user_id', user.id)
        .eq('external_source', String(external_source))
        .eq('external_id', String(external_id))
        .lt('score', 0);
    };

    const hasTasteData = !!dnaProfile || (highRatings?.length ?? 0) > 0 || (dnaSignals?.length ?? 0) > 0;
    if (!hasTasteData) {
      await releaseReservation();
      return new Response(JSON.stringify({ score: null, reason: 'Not enough taste data yet' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const prompt = buildPrompt({ dnaProfile, highRatings, lowRatings, dnaSignals, title, creator, media_type, genres, description });

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) throw new Error('OPENAI_API_KEY not configured');

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 150,
      }),
    });
    let score: number;
    let reason: string;
    try {
      if (!aiRes.ok) throw new Error(`OpenAI error ${aiRes.status}: ${await aiRes.text()}`);
      const aiJson = await aiRes.json();
      const parsed = JSON.parse(aiJson.choices[0].message.content);
      score = Math.max(0, Math.min(100, Math.round(Number(parsed.score))));
      reason = String(parsed.reason || '').slice(0, 300);
      if (!Number.isFinite(score)) throw new Error('AI returned invalid score');
    } catch (aiErr) {
      await releaseReservation();
      throw aiErr;
    }

    const { error: upsertErr } = await admin.from('media_match_scores').upsert({
      user_id: user.id,
      external_source: String(external_source),
      external_id: String(external_id),
      media_type: media_type || null,
      score,
      reason,
      created_at: new Date().toISOString(),
    }, { onConflict: 'user_id,external_source,external_id' });
    if (upsertErr) console.error('Failed to cache score:', upsertErr);

    return new Response(JSON.stringify({ score, reason, cached: false }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('score-media-match error:', err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
