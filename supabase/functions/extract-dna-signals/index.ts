/**
 * extract-dna-signals
 *
 * Aggregates behavioral signals from every user action into user_dna_signals.
 * Sources, each weighted by signal quality:
 *
 *   Source                  Table(s)                            Weight
 *   ──────────────────────  ──────────────────────────────────  ──────
 *   Tracked media           list_items                          1.0
 *   Ratings ≥ 4★            media_ratings                       1.5
 *   Trivia (correct)        user_predictions+prediction_pools   1.4
 *   Trivia (attempt)        user_predictions+prediction_pools   1.0
 *   Poll votes              user_predictions+prediction_pools   0.9
 *   Genre polls (explicit)  user_predictions (show_tag=Genres)  1.3
 *   TMDB genre lookup       TMDB API (movies/TV tracked items)  1.0
 *   DNA Moments             dna_moment_responses+dna_moments    0.8
 *   Hot Take reaction       post_reactions (reaction=hot_take)  1.0
 *   Disagree reaction       post_reactions (reaction=disagree)  0.6
 *
 * Reaction semantics:
 *   hot_take  = "wow, interesting" — strong engagement signal regardless of
 *               agreement. Shows the user cares about this topic/media type.
 *   disagree  = "not my take / meh" — weak signal; still shows interaction
 *               with the topic but doesn't confirm positive taste affinity.
 *   agree     = handled by social_post_likes (existing like system).
 *
 * Genre polls: pools tagged show_tag='Genres' are explicit genre preference
 * questions (e.g. "Your default book genre?"). The user's answer IS the genre.
 * These produce signal_type='genre' rows covering Books, Music, TV, Movies.
 * TMDB lookup adds additional implicit genre signals from everything tracked.
 *
 * Every row in user_dna_signals includes a `sources` JSONB column that
 * breaks down exactly how many events from each source drove that signal.
 *
 * Call pattern:
 *   POST with JWT header  → extracts for the authenticated user
 *   POST with { user_id } body + service-role key → extracts for any user
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getOrResolveGenres, SUPPORTED_GENRE_SOURCES } from '../_shared/genre-cache.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const ok = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const err = (msg: string, status = 400) =>
  new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Map a raw category string to a normalised media_type value
function categoryToMediaType(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (s === 'movies' || s === 'movie') return 'movie';
  if (s === 'tv' || s === 'tv show' || s === 'tv shows' || s === 'television') return 'tv';
  if (s === 'books' || s === 'book') return 'book';
  if (s === 'music') return 'music';
  if (s === 'podcast' || s === 'podcasts') return 'podcast';
  if (s === 'games' || s === 'game') return 'game';
  return null; // unknown — skip
}

// Normalise a poll genre answer to a clean, lowercase signal value.
// Handles multi-word answers like "Comedy or sitcoms" → "comedy"
function normalizeGenreAnswer(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  // Take only the first meaningful word/phrase before "or", "/", "&"
  const first = s.split(/\s+or\s+|\s*\/\s*|\s*&\s*/)[0].trim();
  if (!first || first.length < 2) return null;
  return first;
}

interface SignalAccum {
  type: string;
  value: string;
  weightedCount: number;
  sources: {
    tracked: number;
    rated: number;
    rated_high: number;
    trivia_attempts: number;
    trivia_correct: number;
    polls: number;
    genre_polls: number;
    moments: number;
    reactions_hot_take: number;
    reactions_disagree: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const svc = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── Resolve target user ──────────────────────────────────────────────────
    let userId: string | null = null;

    const bodyText = await req.text().catch(() => '');
    if (bodyText) {
      try {
        const body = JSON.parse(bodyText);
        if (body.user_id) userId = body.user_id;
      } catch (_) { /* ok */ }
    }

    if (!userId) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) return err('Missing authorization header', 401);
      const { data: { user }, error: authErr } = await svc.auth.getUser(authHeader.replace('Bearer ', ''));
      if (authErr || !user) return err('Unauthorized', 401);
      userId = user.id;
    }

    // ── Fetch all raw data in parallel ───────────────────────────────────────
    const [
      { data: userLists },
      { data: ratings },
      { data: rawPredictions },
      { data: momentResponses },
      { data: rawReactions },
    ] = await Promise.all([
      svc.from('lists').select('id').eq('user_id', userId),
      svc.from('media_ratings')
        .select('media_type, media_title, media_external_id, media_external_source, rating')
        .eq('user_id', userId),
      svc.from('user_predictions')
        .select('pool_id, points_earned, prediction')
        .eq('user_id', userId),
      svc.from('dna_moment_responses')
        .select('moment_id, answer')
        .eq('user_id', userId),
      svc.from('post_reactions')
        .select('reaction, social_post_id')
        .eq('user_id', userId),
    ]);

    // Fetch the social posts associated with the user's reactions to get media context
    let reactionPostMap: Record<string, { media_type?: string; category?: string; show_tag?: string }> = {};
    if (rawReactions?.length) {
      const postIds = [...new Set(rawReactions.map((r: any) => r.social_post_id))];
      const { data: reactionPosts } = await svc.from('social_posts')
        .select('id, media_type, category, show_tag')
        .in('id', postIds);
      (reactionPosts ?? []).forEach((p: any) => { reactionPostMap[p.id] = p; });
    }

    // List items need the list IDs first
    let listItems: any[] = [];
    if (userLists?.length) {
      const { data } = await svc.from('list_items')
        .select('title, media_type, type, creator, external_id, external_source')
        .in('list_id', userLists.map((l: any) => l.id));
      listItems = data ?? [];
    }

    // Pool details for predictions
    let poolMap: Record<string, any> = {};
    if (rawPredictions?.length) {
      const poolIds = [...new Set(rawPredictions.map((p: any) => p.pool_id))];
      const { data: pools } = await svc.from('prediction_pools')
        .select('id, type, category, media_type, show_tag')
        .in('id', poolIds);
      (pools ?? []).forEach((p: any) => { poolMap[p.id] = p; });
    }

    // Moment categories
    let momentCategoryMap: Record<string, string> = {};
    if (momentResponses?.length) {
      const momentIds = [...new Set(momentResponses.map((r: any) => r.moment_id))];
      const { data: moments } = await svc.from('dna_moments')
        .select('id, category')
        .in('id', momentIds);
      (moments ?? []).forEach((m: any) => { if (m.category) momentCategoryMap[m.id] = m.category; });
    }

    // ── Build signal accumulator ─────────────────────────────────────────────
    const signals = new Map<string, SignalAccum>();

    const touch = (type: string, rawValue: string) => {
      const value = rawValue.toLowerCase().trim();
      if (!value || value === 'unknown' || value === 'null') return null;
      const key = `${type}::${value}`;
      if (!signals.has(key)) {
        signals.set(key, {
          type,
          value,
          weightedCount: 0,
          sources: {
            tracked: 0, rated: 0, rated_high: 0,
            trivia_attempts: 0, trivia_correct: 0,
            polls: 0, genre_polls: 0, moments: 0,
            reactions_hot_take: 0, reactions_disagree: 0,
          }
        });
      }
      return signals.get(key)!;
    };

    // ── Source 1: Tracked media (list_items) — weight 1.0 ────────────────────
    for (const item of listItems) {
      const mediaType = (item.media_type || item.type || '').toLowerCase().trim();
      if (mediaType) {
        const s = touch('media_type', mediaType);
        if (s) { s.weightedCount += 1.0; s.sources.tracked += 1; }
      }
      if (item.creator && item.creator.trim().length > 1 && item.creator !== 'TV Show') {
        const s = touch('creator', item.creator.trim());
        if (s) { s.weightedCount += 1.0; s.sources.tracked += 1; }
      }
    }

    // ── Genre signals via the shared media_genres cache (cache-first + write-back)
    // Covers movies/TV (tmdb), books (googlebooks/openlibrary) and music/podcasts
    // (itunes). Cached lookups make repeat runs cheap; a miss hits the source API
    // once and is stored for everyone. Generic/noise genres are filtered by the
    // shared taxonomy. The dedicated backfill-genres function warms this cache for
    // the whole library; here we only need to read it (with on-miss write-back).
    const genreItems = listItems
      .filter((item: any) => item.external_id && SUPPORTED_GENRE_SOURCES.includes(item.external_source))
      .slice(0, 60);

    for (const item of genreItems) {
      const mt = item.media_type || item.type || null;
      const canonical = await getOrResolveGenres(svc, item.external_source, item.external_id, mt);
      for (const genre of canonical) {
        const s = touch('genre', genre);
        if (s) { s.weightedCount += 1.0; s.sources.tracked += 1; }
      }
    }

    // ── Source 2: Ratings — weight 1.5 for ≥4★, 1.0 for others ──────────────
    for (const rating of (ratings ?? [])) {
      const isHigh = Number(rating.rating) >= 4;
      const weight = isHigh ? 1.5 : 1.0;
      const mediaType = categoryToMediaType(rating.media_type);
      if (mediaType) {
        const s = touch('media_type', mediaType);
        if (s) {
          s.weightedCount += weight;
          s.sources.rated += 1;
          if (isHigh) s.sources.rated_high += 1;
        }
      }
    }

    // ── Source 3: Trivia & Poll predictions ───────────────────────────────────
    for (const pred of (rawPredictions ?? [])) {
      const pool = poolMap[pred.pool_id];
      if (!pool) continue;

      const isTrivia = pool.type === 'trivia';
      const isPoll = pool.type === 'vote';
      if (!isTrivia && !isPoll) continue;

      const isCorrect = isTrivia && Number(pred.points_earned) > 0;
      const weight = isCorrect ? 1.4 : isTrivia ? 1.0 : 0.9;

      // Media type from pool's category
      const poolMediaType = categoryToMediaType(pool.category) ?? categoryToMediaType(pool.media_type);
      if (poolMediaType) {
        const s = touch('media_type', poolMediaType);
        if (s) {
          s.weightedCount += weight;
          if (isTrivia) {
            s.sources.trivia_attempts += 1;
            if (isCorrect) s.sources.trivia_correct += 1;
          } else {
            s.sources.polls += 1;
          }
        }
      }

      // Genre polls — explicit self-reported genre preference (weight 1.3)
      // Pools tagged show_tag='Genres' have the user's answer as the genre itself.
      if (isPoll && pool.show_tag === 'Genres') {
        const genre = normalizeGenreAnswer(pred.prediction);
        if (genre) {
          const s = touch('genre', genre);
          if (s) { s.weightedCount += 1.3; s.sources.genre_polls += 1; }
        }
        // Don't also record 'Genres' as a show signal — it's not a show name
      } else if (pool.show_tag) {
        // Show/franchise as a named engagement signal
        const s = touch('show', pool.show_tag);
        if (s) {
          s.weightedCount += weight * 0.8;
          if (isTrivia) {
            s.sources.trivia_attempts += 1;
            if (isCorrect) s.sources.trivia_correct += 1;
          } else {
            s.sources.polls += 1;
          }
        }
      }
    }

    // ── Source 4: DNA Moments — weight 0.8 ───────────────────────────────────
    for (const response of (momentResponses ?? [])) {
      const category = momentCategoryMap[response.moment_id];
      if (!category) continue;
      const mediaType = categoryToMediaType(category);
      if (mediaType) {
        const s = touch('media_type', mediaType);
        if (s) { s.weightedCount += 0.8; s.sources.moments += 1; }
      }
    }

    // ── Source 5: Post reactions ──────────────────────────────────────────────
    // hot_take = 1.0 (strong engagement — user found it interesting/surprising)
    // disagree = 0.6 (weak signal — still shows interaction with this topic)
    for (const reaction of (rawReactions ?? [])) {
      const post = reactionPostMap[reaction.social_post_id];
      if (!post) continue;
      const isHotTake = reaction.reaction === 'hot_take';
      const weight = isHotTake ? 1.0 : 0.6;
      // Media type signal from the post's media_type or category
      const rawMediaType = post.media_type || post.category || '';
      const mediaType = categoryToMediaType(rawMediaType);
      if (mediaType) {
        const s = touch('media_type', mediaType);
        if (s) {
          s.weightedCount += weight;
          if (isHotTake) s.sources.reactions_hot_take += 1;
          else s.sources.reactions_disagree += 1;
        }
      }
      // Show/franchise signal if the post has a show_tag
      if (post.show_tag) {
        const s = touch('show', post.show_tag);
        if (s) {
          s.weightedCount += weight * 0.8;
          if (isHotTake) s.sources.reactions_hot_take += 1;
          else s.sources.reactions_disagree += 1;
        }
      }
    }

    // ── Normalise strength 0.0–1.0 ───────────────────────────────────────────
    const allSignals = Array.from(signals.values());
    const maxWeight = Math.max(...allSignals.map(s => s.weightedCount), 1);

    // ── Engagement aggregate rows (for export / partner queries) ─────────────
    // These give a per-user activity summary in a single scannable set of rows.
    const triviaAttempts = (rawPredictions ?? [])
      .filter((p: any) => poolMap[p.pool_id]?.type === 'trivia').length;
    const triviaCorrect = (rawPredictions ?? [])
      .filter((p: any) => poolMap[p.pool_id]?.type === 'trivia' && Number(p.points_earned) > 0).length;
    const pollVotes = (rawPredictions ?? [])
      .filter((p: any) => poolMap[p.pool_id]?.type === 'vote').length;
    const ratingsGiven = (ratings ?? []).length;
    const highRatings = (ratings ?? []).filter((r: any) => Number(r.rating) >= 4).length;
    const momentAnswers = (momentResponses ?? []).length;
    const trackedItems = listItems.length;
    const hotTakeCount = (rawReactions ?? []).filter((r: any) => r.reaction === 'hot_take').length;
    const disagreeCount = (rawReactions ?? []).filter((r: any) => r.reaction === 'disagree').length;
    const totalReactions = hotTakeCount + disagreeCount;

    const engagementRows = [
      { signal_type: 'engagement', signal_value: 'trivia_attempts',   strength: Math.min(1, triviaAttempts / 50),   source_count: triviaAttempts,   sources: { trivia_attempts: triviaAttempts } },
      { signal_type: 'engagement', signal_value: 'trivia_correct',    strength: Math.min(1, triviaCorrect / 40),    source_count: triviaCorrect,    sources: { trivia_correct: triviaCorrect } },
      { signal_type: 'engagement', signal_value: 'poll_votes',        strength: Math.min(1, pollVotes / 30),        source_count: pollVotes,        sources: { polls: pollVotes } },
      { signal_type: 'engagement', signal_value: 'ratings_given',     strength: Math.min(1, ratingsGiven / 50),     source_count: ratingsGiven,     sources: { rated: ratingsGiven, rated_high: highRatings } },
      { signal_type: 'engagement', signal_value: 'items_tracked',     strength: Math.min(1, trackedItems / 50),     source_count: trackedItems,     sources: { tracked: trackedItems } },
      { signal_type: 'engagement', signal_value: 'dna_moments',       strength: Math.min(1, momentAnswers / 20),    source_count: momentAnswers,    sources: { moments: momentAnswers } },
      { signal_type: 'engagement', signal_value: 'post_reactions',    strength: Math.min(1, totalReactions / 30),   source_count: totalReactions,   sources: { reactions_hot_take: hotTakeCount, reactions_disagree: disagreeCount } },
    ];

    // ── Write to database ────────────────────────────────────────────────────
    // Delete existing signals for this user, then bulk insert fresh ones.
    await svc.from('user_dna_signals').delete().eq('user_id', userId);

    const now = new Date().toISOString();

    const signalRows = allSignals.map(s => ({
      user_id: userId,
      signal_type: s.type,
      signal_value: s.value,
      strength: Math.min(1.0, parseFloat((s.weightedCount / maxWeight).toFixed(4))),
      source_count: Object.values(s.sources).reduce((a, b) => a + b, 0),
      sources: s.sources,
      last_signal_at: now,
      updated_at: now,
    }));

    const engRows = engagementRows.map(r => ({
      user_id: userId,
      signal_type: r.signal_type,
      signal_value: r.signal_value,
      strength: parseFloat(r.strength.toFixed(4)),
      source_count: r.source_count,
      sources: r.sources,
      last_signal_at: now,
      updated_at: now,
    }));

    const toInsert = [...signalRows, ...engRows];

    if (toInsert.length > 0) {
      const { error: insertErr } = await svc.from('user_dna_signals').insert(toInsert);
      if (insertErr) throw insertErr;
    }

    return ok({
      success: true,
      user_id: userId,
      signals_written: toInsert.length,
      breakdown: {
        behavioral_signals: signalRows.length,
        engagement_aggregates: engRows.length,
        sources: {
          tracked_items: trackedItems,
          ratings_given: ratingsGiven,
          ratings_high: highRatings,
          trivia_attempts: triviaAttempts,
          trivia_correct: triviaCorrect,
          poll_votes: pollVotes,
          dna_moments: momentAnswers,
          reactions_hot_take: hotTakeCount,
          reactions_disagree: disagreeCount,
        }
      }
    });

  } catch (e: any) {
    console.error('extract-dna-signals error:', e);
    return err('Internal server error: ' + e.message, 500);
  }
});
