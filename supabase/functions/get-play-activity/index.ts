import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      userMap[u.id] = u.display_name || u.user_name || 'Someone';
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
        text: `${leaderName} is leading the leaderboard ${timeLabel} with ${leaderScore} pts — play Trivia to compete`,
        link: '/leaderboard?tab=engagement',
      });
    } else {
      items.push({
        id: 'lb-leader-you',
        icon: 'trophy',
        text: `You're leading the leaderboard ${timeLabel} with ${leaderScore} pts — keep playing to hold your spot`,
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

    // --- Card: Trivia call-to-action using #2 or #3 as benchmark ---
    if (leaderboard.length >= 2) {
      const benchmark = leader.userId !== user.id ? leader : leaderboard[1];
      const benchName = userMap[benchmark.userId] || 'Someone';
      const triviaCategories = ['Movies', 'TV', 'Music', 'Books'];
      const category = triviaCategories[Math.floor(Math.random() * triviaCategories.length)];
      items.push({
        id: 'lb-trivia-cta',
        icon: 'play',
        text: `${benchName} is winning ${timeLabel} — beat them with ${category} Trivia`,
        link: '/play/trivia',
      });
    }

    // Pick 2 at random (not all 3 — keeps it from feeling spammy)
    const shuffled = items.sort(() => Math.random() - 0.5).slice(0, 2);

    return new Response(JSON.stringify({ items: shuffled }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ items: [], error: String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
