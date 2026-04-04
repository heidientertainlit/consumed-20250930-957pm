import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Clean up usernames that look like email aliases (e.g. thinkhp+riner1428 → thinkhp)
function cleanName(displayName: string | null, userName: string | null): string {
  if (displayName) return displayName;
  if (!userName) return 'Someone';
  // Strip email alias part (everything after +)
  if (userName.includes('+')) return userName.split('+')[0];
  // Strip email domain if present
  if (userName.includes('@')) return userName.split('@')[0];
  return userName;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') } } }
    );

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { friendIds = [] } = await req.json().catch(() => ({ friendIds: [] }));

    // Build leaderboard from social_posts engagement
    // Points: 10 per post + 2 per like received + 3 per comment received
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    let { data: posts } = await adminClient
      .from('social_posts')
      .select('user_id, likes_count, comments_count, created_at')
      .gte('created_at', weekAgo);

    let isWeekly = true;
    if (!posts || posts.length === 0) {
      const result = await adminClient
        .from('social_posts')
        .select('user_id, likes_count, comments_count, created_at');
      posts = result.data;
      isWeekly = false;
    }

    const scoreMap: Record<string, number> = {};
    const postCountMap: Record<string, number> = {};
    for (const p of posts || []) {
      const uid = p.user_id;
      scoreMap[uid] = (scoreMap[uid] || 0) + 10 + (p.likes_count || 0) * 2 + (p.comments_count || 0) * 3;
      postCountMap[uid] = (postCountMap[uid] || 0) + 1;
    }

    const leaderboard = Object.entries(scoreMap)
      .map(([userId, score]) => ({ userId, score }))
      .sort((a, b) => b.score - a.score);

    if (leaderboard.length === 0) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch names
    const allUserIds = leaderboard.map(e => e.userId);
    const { data: users } = await adminClient
      .from('users')
      .select('id, user_name, display_name')
      .in('id', allUserIds);

    const userMap: Record<string, string> = {};
    for (const u of users || []) {
      userMap[u.id] = cleanName(u.display_name, u.user_name);
    }

    const timeLabel = isWeekly ? 'this week' : 'overall';
    const items: any[] = [];
    const currentUserRank = leaderboard.findIndex(e => e.userId === user.id);
    const leader = leaderboard[0];
    const leaderName = userMap[leader.userId] || 'Someone';
    const leaderScore = leader.score;

    // --- Card: Who is leading ---
    if (leader.userId !== user.id) {
      items.push({
        id: 'lb-leader',
        icon: 'trophy',
        text: `${leaderName} is leading the Overall Engagement leaderboard ${timeLabel} with ${leaderScore} pts — play Trivia to compete`,
        link: '/leaderboard?tab=engagement',
      });
    } else {
      items.push({
        id: 'lb-leader-you',
        icon: 'trophy',
        text: `You're leading the Overall Engagement leaderboard ${timeLabel} with ${leaderScore} pts — keep playing to hold your spot`,
        link: '/leaderboard?tab=engagement',
      });
    }

    // --- Card: Your rank vs person above ---
    if (currentUserRank > 0) {
      const myScore = scoreMap[user.id] || 0;
      const above = leaderboard[currentUserRank - 1];
      const aboveName = userMap[above.userId] || 'Someone';
      const gap = above.score - myScore;
      const rank = currentUserRank + 1;
      items.push({
        id: 'lb-your-rank',
        icon: 'bar-chart',
        text: `You're ranked #${rank} ${timeLabel} — just ${gap} pts behind ${aboveName}. Play Trivia to move up`,
        link: '/leaderboard?tab=engagement',
      });
    } else if (currentUserRank === 0 && leaderboard.length > 1) {
      // You're #1, show who's chasing you
      const second = leaderboard[1];
      const secondName = userMap[second.userId] || 'Someone';
      const gap = leaderScore - second.score;
      items.push({
        id: 'lb-chaser',
        icon: 'bar-chart',
        text: `${secondName} is ${gap} pts behind you ${timeLabel} — stay active to hold #1`,
        link: '/leaderboard?tab=engagement',
      });
    }

    // --- Card: Top friend on leaderboard ---
    const friendOnBoard = leaderboard.find(e => friendIds.includes(e.userId) && e.userId !== user.id);
    if (friendOnBoard) {
      const friendRank = leaderboard.indexOf(friendOnBoard) + 1;
      const friendName = userMap[friendOnBoard.userId] || 'Someone';
      const friendScore = friendOnBoard.score;
      items.push({
        id: `lb-friend-${friendOnBoard.userId}`,
        icon: 'users',
        text: `${friendName} is ranked #${friendRank} ${timeLabel} with ${friendScore} pts — answer Trivia to pass them`,
        link: '/leaderboard?tab=engagement',
      });
    }

    // --- Trivia cards: who played what, now it's your turn ---

    // Get trivia pools to know real category names
    const { data: triviaPools } = await adminClient
      .from('prediction_pools')
      .select('id, title, category')
      .eq('type', 'trivia')
      .limit(20);

    // Get trivia answers from friends (and self) on those pools
    const triviaPoolIds = (triviaPools || []).map((p: any) => p.id);
    let friendTriviaAnswers: any[] = [];
    if (triviaPoolIds.length > 0 && friendIds.length > 0) {
      const { data: answers } = await adminClient
        .from('user_predictions')
        .select('user_id, pool_id, created_at')
        .in('user_id', friendIds)
        .in('pool_id', triviaPoolIds)
        .order('created_at', { ascending: false })
        .limit(10);
      friendTriviaAnswers = answers || [];
    }

    // Fetch names for anyone not already in userMap
    const missingIds = friendIds.filter((id: string) => !userMap[id]);
    if (missingIds.length > 0) {
      const { data: extraUsers } = await adminClient
        .from('users')
        .select('id, user_name, display_name')
        .in('id', missingIds);
      for (const u of extraUsers || []) {
        userMap[u.id] = cleanName(u.display_name, u.user_name);
      }
    }

    const triviaCategories = ['Movies', 'TV', 'Music', 'Books', 'Sports'];

    if (friendTriviaAnswers.length > 0) {
      // Use real data — a friend actually played trivia
      const seen = new Set<string>();
      for (const ans of friendTriviaAnswers) {
        if (seen.has(ans.user_id)) continue;
        seen.add(ans.user_id);
        const pool = (triviaPools || []).find((p: any) => p.id === ans.pool_id);
        const category = pool?.category || triviaCategories[Math.floor(Math.random() * triviaCategories.length)];
        const friendName = userMap[ans.user_id] || 'Someone';
        items.push({
          id: `trivia-friend-${ans.user_id}`,
          icon: 'play',
          text: `${friendName} just played ${category} Trivia — now it's your turn`,
          link: '/play/trivia',
        });
        if (seen.size >= 2) break;
      }
    } else {
      // No friend trivia data — use available categories with friend names as social nudge
      const shuffledFriendIds = [...friendIds].sort(() => Math.random() - 0.5);
      const categories = [...triviaCategories].sort(() => Math.random() - 0.5);

      for (let i = 0; i < Math.min(2, categories.length); i++) {
        const category = categories[i];
        const friendId = shuffledFriendIds[i % shuffledFriendIds.length];
        const friendName = friendId ? (userMap[friendId] || 'Someone in your circle') : 'Someone in your circle';
        items.push({
          id: `trivia-cta-${category}`,
          icon: 'play',
          text: `${friendName} hasn't tried ${category} Trivia yet — be the first to score`,
          link: '/play/trivia',
        });
      }
    }

    // --- Rating comparison cards ---
    // Find media rated by the current user, compare with friends who rated the same media
    if (friendIds.length > 0) {
      const { data: myRatedPosts } = await adminClient
        .from('social_posts')
        .select('media_external_id, media_title, rating, media_type')
        .eq('user_id', user.id)
        .not('rating', 'is', null)
        .not('media_external_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(30);

      if (myRatedPosts && myRatedPosts.length > 0) {
        const myRatingMap: Record<string, { rating: number; title: string; mediaType: string }> = {};
        for (const p of myRatedPosts) {
          if (!myRatingMap[p.media_external_id]) {
            myRatingMap[p.media_external_id] = { rating: p.rating, title: p.media_title, mediaType: p.media_type || '' };
          }
        }

        const myExternalIds = Object.keys(myRatingMap);
        const { data: friendRatedPosts } = await adminClient
          .from('social_posts')
          .select('user_id, media_external_id, media_title, rating')
          .in('user_id', friendIds)
          .in('media_external_id', myExternalIds)
          .not('rating', 'is', null)
          .order('created_at', { ascending: false })
          .limit(50);

        if (friendRatedPosts && friendRatedPosts.length > 0) {
          // Find disagreements (rating difference >= 1 star)
          const disagreements: Array<{ friendId: string; friendName: string; mediaTitle: string; friendRating: number; myRating: number; mediaId: string }> = [];
          const agreements: Array<{ friendId: string; friendName: string; mediaTitle: string; rating: number; mediaId: string }> = [];
          const seenMedia = new Set<string>();

          for (const fp of friendRatedPosts) {
            const myData = myRatingMap[fp.media_external_id];
            if (!myData) continue;
            const key = `${fp.user_id}-${fp.media_external_id}`;
            if (seenMedia.has(key)) continue;
            seenMedia.add(key);

            const diff = Math.abs(fp.rating - myData.rating);
            const friendName = userMap[fp.user_id] || 'Someone';
            const mediaTitle = myData.title || fp.media_title || 'this';

            if (diff >= 1.5) {
              // Big disagreement — great for engagement
              disagreements.push({
                friendId: fp.user_id,
                friendName,
                mediaTitle,
                friendRating: fp.rating,
                myRating: myData.rating,
                mediaId: fp.media_external_id,
              });
            } else if (diff === 0 && fp.rating >= 4) {
              // Strong agreement on a high-rated title
              agreements.push({
                friendId: fp.user_id,
                friendName,
                mediaTitle,
                rating: fp.rating,
                mediaId: fp.media_external_id,
              });
            }
          }

          // Add up to 2 disagreement cards
          const shuffledDisagreements = disagreements.sort(() => Math.random() - 0.5);
          for (const d of shuffledDisagreements.slice(0, 2)) {
            const theyHigher = d.friendRating > d.myRating;
            const friendStars = d.friendRating % 1 === 0 ? d.friendRating.toFixed(0) : d.friendRating.toFixed(1);
            const myStars = d.myRating % 1 === 0 ? d.myRating.toFixed(0) : d.myRating.toFixed(1);
            items.push({
              id: `rating-clash-${d.friendId}-${d.mediaId}`,
              icon: 'flame',
              text: `${d.friendName} rated ${d.mediaTitle} ${friendStars} stars — you gave it ${myStars}. Who's right?`,
              link: '/play/polls',
            });
          }

          // Add up to 1 agreement card
          const shuffledAgreements = agreements.sort(() => Math.random() - 0.5);
          for (const a of shuffledAgreements.slice(0, 1)) {
            const stars = a.rating % 1 === 0 ? a.rating.toFixed(0) : a.rating.toFixed(1);
            items.push({
              id: `rating-agree-${a.friendId}-${a.mediaId}`,
              icon: 'users',
              text: `You and ${a.friendName} both gave ${a.mediaTitle} ${stars} stars — great taste`,
              link: '/leaderboard',
            });
          }
        }
      }
    }

    // Pick up to 4 — enough to sprinkle throughout the feed without repeating
    const shuffled = items.sort(() => Math.random() - 0.5).slice(0, 4);

    return new Response(JSON.stringify({ items: shuffled }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ items: [], error: String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
