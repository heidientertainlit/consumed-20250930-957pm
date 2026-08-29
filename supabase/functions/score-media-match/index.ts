import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getOrResolveGenres } from '../_shared/genre-cache.ts';
import { canonicalizeMany } from '../_shared/genre-taxonomy.ts';
import { buildPrompt } from './prompt.mjs';
import { scoreMediaMatchV2 } from './v2.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const CACHE_DAYS = 14;

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

    // Deterministic v2 is opt-in while it is evaluated. Its cache is namespaced
    // from v1 so the client can roll back without losing previous AI scores.
    if (scorer_version === 'v2') {
      const source = String(external_source);
      const id = String(external_id);
      const v2CacheSource = `v2.2:${source}`;
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
          scorer_version: 'v2',
          cached: false,
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const readV2Cache = async () => {
        const { data } = await admin
          .from('media_match_scores')
          .select('score, reason, created_at')
          .eq('user_id', user.id)
          .eq('external_source', v2CacheSource)
          .eq('external_id', id)
          .maybeSingle();
        return data;
      };
      const cachedV2 = await readV2Cache();
      const v2Age = cachedV2 ? Date.now() - new Date(cachedV2.created_at).getTime() : Infinity;
      if (cachedV2?.score >= 0 && v2Age < 24 * 60 * 60 * 1000) {
        let metadata: any = {};
        try { metadata = JSON.parse(cachedV2.reason || '{}'); } catch { metadata = { reason: cachedV2.reason }; }
        return new Response(JSON.stringify({
          score: cachedV2.score,
          ...metadata,
          scorer_version: 'v2',
          cached: true,
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (cachedV2?.score < 0 && v2Age < 2 * 60 * 1000) {
        return new Response(JSON.stringify({ score: null, pending: true, scorer_version: 'v2' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const leaseToken = new Date().toISOString();
      const reservation = {
        user_id: user.id,
        external_source: v2CacheSource,
        external_id: id,
        media_type: media_type || null,
        score: -1,
        reason: 'pending',
        created_at: leaseToken,
      };
      let acquiredLease = false;
      if (!cachedV2) {
        const { error } = await admin.from('media_match_scores').insert(reservation);
        if (!error) acquiredLease = true;
        else if (error.code !== '23505') console.error('Failed to reserve v2 score slot:', error);
      } else {
        const { data, error } = await admin
          .from('media_match_scores')
          .update(reservation)
          .eq('user_id', user.id)
          .eq('external_source', v2CacheSource)
          .eq('external_id', id)
          .eq('score', cachedV2.score)
          .eq('created_at', cachedV2.created_at)
          .select('created_at');
        if (error) console.error('Failed to renew v2 score lease:', error);
        acquiredLease = Array.isArray(data) && data.length === 1;
      }
      if (!acquiredLease) {
        return new Response(JSON.stringify({ score: null, pending: true, scorer_version: 'v2' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const releaseV2Reservation = async () => {
        await admin.from('media_match_scores').delete()
          .eq('user_id', user.id)
          .eq('external_source', v2CacheSource)
          .eq('external_id', id)
          .eq('score', -1)
          .eq('created_at', leaseToken);
      };

      try {
        const [{ data: ratingRows, error: ratingsError }, resolvedGenres] = await Promise.all([
          admin
            .from('media_ratings')
            .select('media_external_id, media_external_source, media_title, media_type, rating, updated_at')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(200),
          getOrResolveGenres(admin, source, id, media_type ? String(media_type) : null),
        ]);
        if (ratingsError) throw ratingsError;

        const ratings = ratingRows || [];
        const ratingIds = [...new Set(ratings.map((rating: any) => String(rating.media_external_id || '')).filter(Boolean))];
        let genreRows: any[] = [];
        if (ratingIds.length > 0) {
          const { data, error } = await admin
            .from('media_genres')
            .select('external_source, external_id, canonical_genres')
            .in('external_id', ratingIds);
          if (error) console.error('Failed to load rating genres for v2 scorer:', error);
          genreRows = data || [];
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
        const result = scoreMediaMatchV2({
          ratings: ratingsWithGenres,
          mediaGenres: targetGenres,
          mediaType: media_type,
        });
        if (typeof result.score !== 'number') {
          await releaseV2Reservation();
          return new Response(JSON.stringify({
            ...result,
            scorer_version: 'v2',
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
          .eq('external_source', v2CacheSource)
          .eq('external_id', id)
          .eq('score', -1)
          .eq('created_at', leaseToken)
          .select('score');
        if (finalizeError) throw finalizeError;
        if (!Array.isArray(finalized) || finalized.length !== 1) {
          return new Response(JSON.stringify({ score: null, pending: true, scorer_version: 'v2' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          ...result,
          scorer_version: 'v2',
          cached: false,
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        await releaseV2Reservation();
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
