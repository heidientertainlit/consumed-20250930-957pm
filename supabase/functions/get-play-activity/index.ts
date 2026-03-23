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

    // --- Build a mini leaderboard from social_posts engagement ---
    // Points: 10 per post + 2 per like received + 3 per comment received
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: posts } = await adminClient
      .from('social_posts')
      .select('user_id, likes_count, comments_count')
      .gte('created_at', weekAgo);

    const scoreMap: Record<string, number> = {};
    for (const p of posts || []) {
      const uid = p.user_id;
      scoreMap[uid] = (scoreMap[uid] || 0) + 10 + (p.likes_count || 0) * 2 + (p.comments_count || 0) * 3;
    }

    // If no weekly data, try all-time
    if (Object.keys(scoreMap).length === 0) {
      const { data: allPosts } = await adminClient
        .from('social_posts')
        .select('user_id, likes_count, comments_count');
      for (const p of allPosts || []) {
        const uid = p.user_id;
        scoreMap[uid] = (scoreMap[uid] || 0) + 10 + (p.likes_count || 0) * 2 + (p.comments_count || 0) * 3;
      }
    }

    const leaderboard = Object.entries(scoreMap)
      .map(([userId, score]) => ({ userId, score }))
      .sort((a, b) => b.score - a.score);

    if (leaderboard.length === 0) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch user display names for everyone on the leaderboard
    const allUserIds = [...new Set([...leaderboard.map(e => e.userId)])];
    const { data: users } = await adminClient
      .from('users')
      .select('id, user_name, display_name')
      .in('id', allUserIds);

    const userMap: Record<string, string> = {};
    for (const u of users || []) {
      userMap[u.id] = u.display_name || u.user_name || 'Someone';
    }

    const items: any[] = [];
    const currentUserRank = leaderboard.findIndex(e => e.userId === user.id);
    const leader = leaderboard[0];
    const leaderName = userMap[leader.userId] || 'Someone';
    const leaderScore = leader.score;

    // Card 1: Who's leading
    if (leader.userId !== user.id) {
      items.push({
        id: 'lb-leader',
        type: 'leaderboard',
        icon: 'trophy',
        text: `${leaderName} is leading this week with ${leaderScore} pts — play Trivia to take the top spot`,
      });
    } else {
      items.push({
        id: 'lb-leader-you',
        type: 'leaderboard',
        icon: 'trophy',
        text: `You're leading the leaderboard this week — keep playing to stay at the top`,
      });
    }

    // Card 2: Current user's rank vs the person just above them
    if (currentUserRank > 1) {
      const above = leaderboard[currentUserRank - 1];
      const aboveName = userMap[above.userId] || 'Someone';
      const gap = above.score - (scoreMap[user.id] || 0);
      items.push({
        id: 'lb-rank',
        type: 'leaderboard',
        icon: 'bar-chart',
        text: `You're ranked #${currentUserRank + 1} — just ${gap} pts behind ${aboveName}. Play Trivia to climb`,
      });
    } else if (currentUserRank === 1) {
      items.push({
        id: 'lb-rank-2',
        type: 'leaderboard',
        icon: 'bar-chart',
        text: `You're in 2nd place — just ${leaderScore - (scoreMap[user.id] || 0)} pts behind ${leaderName}. Play Trivia to take #1`,
      });
    }

    // Card 3: A friend's leaderboard position (most-engaged friend)
    const friendOnBoard = leaderboard.find(e => friendIds.includes(e.userId) && e.userId !== user.id);
    if (friendOnBoard) {
      const friendRank = leaderboard.indexOf(friendOnBoard) + 1;
      const friendName = userMap[friendOnBoard.userId] || 'Someone';
      items.push({
        id: `lb-friend-${friendOnBoard.userId}`,
        type: 'leaderboard',
        icon: 'users',
        text: `${friendName} is ranked #${friendRank} this week with ${friendOnBoard.score} pts`,
      });
    }

    // Shuffle lightly and return up to 3
    const shuffled = items.sort(() => Math.random() - 0.5).slice(0, 3);

    return new Response(JSON.stringify({ items: shuffled }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ items: [], error: String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
