import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { REPUTATION_TITLES } from "../_shared/dna-taxonomy.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

// ── Tier assignment helper ───────────────────────────────────────────────────
interface TierThresholds { bronze: number; silver: number; gold: number; elite: number }

function assignTier(score: number, t: TierThresholds, secondaryOk = true) {
  if (score >= t.elite  && secondaryOk) return { tier: 'elite',  progress: 100 };
  if (score >= t.gold   && secondaryOk) return { tier: 'gold',   progress: pct(score, t.gold,   t.elite)  };
  if (score >= t.silver && secondaryOk) return { tier: 'silver', progress: pct(score, t.silver, t.gold)   };
  if (score >= t.bronze)                return { tier: 'bronze', progress: pct(score, t.bronze, t.silver) };
  return { tier: null, progress: pct(score, 0, t.bronze) };
}

function pct(val: number, lo: number, hi: number) {
  if (hi <= lo) return 100;
  return Math.min(100, Math.round(((val - lo) / (hi - lo)) * 100));
}

// ── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Accept user JWT (self-calculate) or service-role + ?user_id= (admin sweep)
    let userId: string | null = null;

    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const jwt = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseClient.auth.getUser(jwt);
      userId = user?.id ?? null;
    }

    // Allow service-role callers to pass user_id directly
    if (!userId) {
      const url = new URL(req.url);
      userId = url.searchParams.get('user_id');
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── Fetch all data in parallel ───────────────────────────────────────────
    const [
      { data: predictionStats },
      { data: engagementSignals },
      { data: genreSignals },
      { data: showSignals },
      { data: postStats },
      { data: commentCount },
      { data: reactionsReceived },
      { data: ratingPostLikes },
    ] = await Promise.all([
      // Prediction accuracy (type = 'predict')
      supabaseClient.rpc('get_user_prediction_stats', { p_user_id: userId }).maybeSingle()
        .then(() => ({ data: null })) // fallback — use raw query below
        .catch(() => ({ data: null })),

      // Engagement signals (trivia, polls, items)
      supabaseClient
        .from('user_dna_signals')
        .select('signal_value, source_count, strength')
        .eq('user_id', userId)
        .eq('signal_type', 'engagement'),

      // Genre signals (for genre_expert)
      supabaseClient
        .from('user_dna_signals')
        .select('signal_value, strength, source_count, sources')
        .eq('user_id', userId)
        .eq('signal_type', 'genre')
        .order('strength', { ascending: false })
        .limit(5),

      // Show signals (for deep_cut_finder + first_to_know)
      supabaseClient
        .from('user_dna_signals')
        .select('signal_value, strength, source_count')
        .eq('user_id', userId)
        .eq('signal_type', 'show'),

      // Post aggregates (likes, comments, upvotes, downvotes, fire)
      supabaseClient
        .from('social_posts')
        .select('likes_count, comments_count, upvotes_count, downvotes_count, fire_votes, post_type')
        .eq('user_id', userId),

      // Comments the user has written (conversation_starter)
      supabaseClient
        .from('social_post_comments')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),

      // Reactions received on user's posts (hot_take_magnet)
      supabaseClient
        .from('post_reactions')
        .select('reaction, social_post_id')
        .in('social_post_id',
          await supabaseClient
            .from('social_posts')
            .select('id')
            .eq('user_id', userId)
            .then(({ data }) => (data || []).map((p: any) => p.id))
        ),

      // Likes on rating/review posts (trusted_recommender proxy)
      supabaseClient
        .from('social_posts')
        .select('likes_count, upvotes_count')
        .eq('user_id', userId)
        .in('post_type', ['rate-review', 'rating', 'review', 'rate_review']),
    ]);

    // Also run prediction stats directly since RPC may not exist
    const { data: rawPredictions } = await supabaseClient
      .from('user_predictions')
      .select('pool_id, points_earned, is_winner')
      .eq('user_id', userId);

    // Join with prediction_pools to get type='predict' only
    let predTotal = 0, predCorrect = 0;
    if (rawPredictions && rawPredictions.length > 0) {
      const poolIds = rawPredictions.map((p: any) => p.pool_id);
      const { data: pools } = await supabaseClient
        .from('prediction_pools')
        .select('id, type')
        .in('id', poolIds)
        .eq('type', 'predict');

      const predictPoolIds = new Set((pools || []).map((p: any) => p.id));
      const predRows = rawPredictions.filter((p: any) => predictPoolIds.has(p.pool_id));
      predTotal   = predRows.length;
      predCorrect = predRows.filter((p: any) => p.is_winner === true || p.points_earned > 0).length;
    }

    // ── Extract engagement signal values ─────────────────────────────────────
    const eng = (val: string) =>
      (engagementSignals || []).find((s: any) => s.signal_value === val)?.source_count || 0;

    const triviaCorrect  = eng('trivia_correct');
    const triviaAttempts = eng('trivia_attempts');
    const triviaAccuracy = triviaAttempts > 0 ? triviaCorrect / triviaAttempts : 0;
    const itemsTracked   = eng('items_tracked');
    const ratingsGiven   = eng('ratings_given');

    // ── Post aggregates ──────────────────────────────────────────────────────
    const posts = postStats || [];
    const totalPosts        = posts.length;
    const totalLikes        = posts.reduce((s: number, p: any) => s + (p.likes_count || 0), 0);
    const totalUpvotes      = posts.reduce((s: number, p: any) => s + (p.upvotes_count || 0), 0);
    const totalDownvotes    = posts.reduce((s: number, p: any) => s + (p.downvotes_count || 0), 0);
    const totalFireVotes    = posts.reduce((s: number, p: any) => s + (p.fire_votes || 0), 0);
    const totalComments     = posts.reduce((s: number, p: any) => s + (p.comments_count || 0), 0);
    const postsWithComments = posts.filter((p: any) => (p.comments_count || 0) >= 3).length;
    const postsWithEngagement = posts.filter((p: any) =>
      (p.likes_count || 0) + (p.upvotes_count || 0) + (p.fire_votes || 0) > 0
    ).length;

    const commentsMade   = (commentCount as any)?.count || 0;
    const reactionsCount = (reactionsReceived || []).length;

    const totalUpdown    = totalUpvotes + totalDownvotes;
    const upvoteRatio    = totalUpdown > 0 ? totalUpvotes / totalUpdown : 0;

    const ratingLikesTotal = (ratingPostLikes || [])
      .reduce((s: number, p: any) => s + (p.likes_count || 0) + (p.upvotes_count || 0), 0);

    // ── Genre expert data ────────────────────────────────────────────────────
    const topGenreSignal = (genreSignals || [])[0];
    const topGenreName   = topGenreSignal?.signal_value || null;
    const topGenreStrength = topGenreSignal?.strength || 0;
    // Estimate genre depth: strength * 100 as a score proxy
    const genreScore = topGenreStrength > 0
      ? Math.round(topGenreStrength * 100)
      : 0;
    // Genre expert secondary: trivia accuracy (already computed globally)

    // ── Show signal variety ──────────────────────────────────────────────────
    const showVariety = (showSignals || []).length;

    // ── Build results for all 12 titles ─────────────────────────────────────
    const predAccuracyOk60 = predTotal >= 10 && (predCorrect / predTotal) >= 0.60;
    const predAccuracyOk70 = predTotal >= 20 && (predCorrect / predTotal) >= 0.70;

    const results: Array<{
      user_id: string;
      title_key: string;
      tier: string | null;
      score: number;
      secondary_score: number;
      progress_pct: number;
      genre_context: string | null;
    }> = [
      // 1. master_predictor
      (() => {
        const t = { bronze: 5, silver: 15, gold: 30, elite: 50 };
        const secondary = predAccuracyOk60 || predAccuracyOk70;
        const { tier, progress } = assignTier(predCorrect, t,
          predCorrect < t.silver || secondary
        );
        return {
          user_id: userId!, title_key: 'master_predictor',
          tier, score: predCorrect,
          secondary_score: predTotal > 0 ? Math.round((predCorrect / predTotal) * 100) : 0,
          progress_pct: progress, genre_context: null
        };
      })(),

      // 2. theory_crafter_rep
      (() => {
        const t = { bronze: 10, silver: 25, gold: 50, elite: 100 };
        const accuracyOk = triviaAttempts >= 10 && triviaAccuracy >= 0.65;
        const { tier, progress } = assignTier(triviaCorrect, t,
          triviaCorrect < t.silver || accuracyOk
        );
        return {
          user_id: userId!, title_key: 'theory_crafter_rep',
          tier, score: triviaCorrect,
          secondary_score: Math.round(triviaAccuracy * 100),
          progress_pct: progress, genre_context: null
        };
      })(),

      // 3. hot_take_magnet
      (() => {
        const t = { bronze: 5, silver: 15, gold: 30, elite: 75 };
        const { tier, progress } = assignTier(postsWithEngagement, t);
        return {
          user_id: userId!, title_key: 'hot_take_magnet',
          tier, score: postsWithEngagement,
          secondary_score: reactionsCount + totalFireVotes,
          progress_pct: progress, genre_context: null
        };
      })(),

      // 4. trusted_recommender (proxy: likes on rating/review posts)
      (() => {
        const t = { bronze: 10, silver: 30, gold: 75, elite: 200 };
        const { tier, progress } = assignTier(ratingLikesTotal, t);
        return {
          user_id: userId!, title_key: 'trusted_recommender',
          tier, score: ratingLikesTotal,
          secondary_score: ratingsGiven,
          progress_pct: progress, genre_context: null
        };
      })(),

      // 5. crowd_favorite (upvote ratio + total positive engagement)
      (() => {
        const t = { bronze: 10, silver: 25, gold: 50, elite: 100 };
        const positiveEngagement = totalLikes + totalUpvotes;
        const ratioOk = totalUpdown >= 10 && upvoteRatio >= 0.70;
        const { tier, progress } = assignTier(positiveEngagement, t,
          positiveEngagement < t.silver || ratioOk
        );
        return {
          user_id: userId!, title_key: 'crowd_favorite',
          tier, score: positiveEngagement,
          secondary_score: Math.round(upvoteRatio * 100),
          progress_pct: progress, genre_context: null
        };
      })(),

      // 6. debate_starter (posts with 3+ comments)
      (() => {
        const t = { bronze: 5, silver: 15, gold: 30, elite: 75 };
        const { tier, progress } = assignTier(postsWithComments, t);
        return {
          user_id: userId!, title_key: 'debate_starter',
          tier, score: postsWithComments,
          secondary_score: totalComments,
          progress_pct: progress, genre_context: null
        };
      })(),

      // 7. first_to_know (show signal variety as discovery proxy)
      (() => {
        const t = { bronze: 5, silver: 10, gold: 20, elite: 35 };
        const { tier, progress } = assignTier(showVariety, t);
        return {
          user_id: userId!, title_key: 'first_to_know',
          tier, score: showVariety,
          secondary_score: 0,
          progress_pct: progress, genre_context: null
        };
      })(),

      // 8. genre_expert (top genre concentration + trivia accuracy)
      (() => {
        const t = { bronze: 20, silver: 45, gold: 70, elite: 90 };
        const accuracyOk = triviaAttempts >= 10 && triviaAccuracy >= 0.70;
        const { tier, progress } = assignTier(genreScore, t,
          genreScore < t.silver || accuracyOk
        );
        return {
          user_id: userId!, title_key: 'genre_expert',
          tier, score: genreScore,
          secondary_score: Math.round(triviaAccuracy * 100),
          progress_pct: progress, genre_context: topGenreName
        };
      })(),

      // 9. completionist_rep (items tracked)
      (() => {
        const t = { bronze: 10, silver: 25, gold: 50, elite: 100 };
        const { tier, progress } = assignTier(itemsTracked, t);
        return {
          user_id: userId!, title_key: 'completionist_rep',
          tier, score: itemsTracked,
          secondary_score: 0,
          progress_pct: progress, genre_context: null
        };
      })(),

      // 10. taste_twin_finder (placeholder — needs friend graph, will improve later)
      {
        user_id: userId!, title_key: 'taste_twin_finder',
        tier: null, score: 0, secondary_score: 0,
        progress_pct: 0, genre_context: null
      },

      // 11. conversation_starter (posts created + comments made)
      (() => {
        const t = { bronze: 20, silver: 75, gold: 200, elite: 500 };
        const totalContributions = totalPosts + commentsMade;
        const { tier, progress } = assignTier(totalContributions, t);
        return {
          user_id: userId!, title_key: 'conversation_starter',
          tier, score: totalContributions,
          secondary_score: commentsMade,
          progress_pct: progress, genre_context: null
        };
      })(),

      // 12. deep_cut_finder (show variety = niche discovery)
      (() => {
        const t = { bronze: 5, silver: 15, gold: 30, elite: 50 };
        const { tier, progress } = assignTier(showVariety, t);
        return {
          user_id: userId!, title_key: 'deep_cut_finder',
          tier, score: showVariety,
          secondary_score: 0,
          progress_pct: progress, genre_context: null
        };
      })(),
    ];

    // ── Upsert all 12 titles ─────────────────────────────────────────────────
    const { error: upsertError } = await supabaseClient
      .from('user_reputation_titles')
      .upsert(
        results.map(r => ({ ...r, calculated_at: new Date().toISOString() })),
        { onConflict: 'user_id,title_key' }
      );

    if (upsertError) throw upsertError;

    // ── Return earned titles with display names ───────────────────────────────
    const earned = results
      .filter(r => r.tier !== null)
      .map(r => {
        const def = REPUTATION_TITLES.find(t => t.key === r.title_key);
        return {
          key:          r.title_key,
          display_name: def?.displayName ?? r.title_key,
          meaning:      def?.meaning ?? '',
          tier:         r.tier,
          score:        r.score,
          progress_pct: r.progress_pct,
          genre_context: r.genre_context
        };
      });

    return new Response(JSON.stringify({
      user_id:        userId,
      titles_earned:  earned.length,
      titles:         earned,
      all_titles:     results.map(r => ({
        key:          r.title_key,
        tier:         r.tier,
        score:        r.score,
        progress_pct: r.progress_pct,
        genre_context: r.genre_context
      })),
      calculated_at:  new Date().toISOString()
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in calculate-reputation-titles:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error', details: error.message
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
