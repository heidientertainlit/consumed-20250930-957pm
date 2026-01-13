import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EngagementNotification {
  type: string;
  message: string;
  action_url?: string;
  metadata?: Record<string, any>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const notifications: EngagementNotification[] = [];
    const userId = user.id;

    // 1. LEADERBOARD POSITION NOTIFICATIONS
    try {
      const { data: userPoints } = await supabaseAdmin
        .from('user_points')
        .select('total_points')
        .eq('user_id', userId)
        .single();

      if (userPoints?.total_points) {
        const { data: higherUsers, count } = await supabaseAdmin
          .from('user_points')
          .select('total_points', { count: 'exact' })
          .gt('total_points', userPoints.total_points);

        const position = (count || 0) + 1;
        const tier = position <= 10 ? 'gold' : position <= 50 ? 'silver' : position <= 100 ? 'bronze' : null;
        
        if (tier) {
          notifications.push({
            type: 'leaderboard_position',
            message: `You're #${position} on the ${tier} leaderboard! Keep climbing! 🏆`,
            action_url: '/leaderboard',
            metadata: { position, tier, points: userPoints.total_points }
          });
        }

        // Points to next rank
        if (higherUsers && higherUsers.length > 0) {
          const nextUserPoints = Math.min(...higherUsers.map((u: any) => u.total_points));
          const pointsNeeded = nextUserPoints - userPoints.total_points;
          if (pointsNeeded <= 50) {
            notifications.push({
              type: 'points_to_rank',
              message: `Just ${pointsNeeded} points to move up! Play a quick trivia or rate some media! ⚡`,
              action_url: '/',
              metadata: { pointsNeeded, currentPoints: userPoints.total_points }
            });
          }
        }
      }
    } catch (e) {
      console.error('Leaderboard check error:', e);
    }

    // 2. FRIEND ACTIVITY NOTIFICATIONS
    try {
      const { data: friendships } = await supabaseAdmin
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted');

      const friendIds = (friendships || []).map((f: any) => 
        f.user_id === userId ? f.friend_id : f.user_id
      ).filter((id: string) => id !== userId);

      if (friendIds.length > 0) {
        // Get recent friend posts (last 24 hours)
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        const { data: recentPosts } = await supabaseAdmin
          .from('social_posts')
          .select('id, user_id, content, media_title, rating, created_at, profiles!social_posts_user_id_fkey(user_name)')
          .in('user_id', friendIds)
          .gte('created_at', yesterday)
          .not('media_title', 'is', null)
          .order('created_at', { ascending: false })
          .limit(3);

        for (const post of (recentPosts || [])) {
          const friendName = (post as any).profiles?.user_name || 'A friend';
          const rating = post.rating ? ` and rated it ${post.rating}/5` : '';
          notifications.push({
            type: 'friend_activity',
            message: `${friendName} just posted about "${post.media_title}"${rating}. Want to share your take? 💬`,
            action_url: `/post/${post.id}`,
            metadata: { postId: post.id, mediaTitle: post.media_title, friendName }
          });
        }
      }
    } catch (e) {
      console.error('Friend activity check error:', e);
    }

    // 3. TRIVIA RANKING NOTIFICATIONS
    try {
      const { data: triviaStats } = await supabaseAdmin
        .from('user_predictions')
        .select('pool_id')
        .eq('user_id', userId)
        .limit(100);

      const triviaCount = (triviaStats || []).length;
      
      // Get user's trivia rank
      const { data: allTriviaUsers, count: totalPlayers } = await supabaseAdmin
        .from('user_predictions')
        .select('user_id', { count: 'exact' })
        .limit(1000);

      const userCounts: Record<string, number> = {};
      (allTriviaUsers || []).forEach((p: any) => {
        userCounts[p.user_id] = (userCounts[p.user_id] || 0) + 1;
      });

      const sortedUsers = Object.entries(userCounts).sort((a, b) => b[1] - a[1]);
      const userRank = sortedUsers.findIndex(([id]) => id === userId) + 1;

      if (userRank > 0 && userRank <= 20) {
        notifications.push({
          type: 'trivia_rank',
          message: `You're #${userRank} in trivia! Prove you know your stuff by playing more! 🧠`,
          action_url: '/',
          metadata: { rank: userRank, gamesPlayed: triviaCount }
        });
      }
    } catch (e) {
      console.error('Trivia ranking check error:', e);
    }

    // 4. MEDIA TRACKING CHALLENGE
    try {
      const thisWeekStart = new Date();
      thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
      thisWeekStart.setHours(0, 0, 0, 0);

      const { data: weeklyTracking, count: weeklyCount } = await supabaseAdmin
        .from('list_items')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .gte('created_at', thisWeekStart.toISOString());

      // Check if user is close to a milestone
      const milestones = [5, 10, 25, 50];
      const nextMilestone = milestones.find(m => (weeklyCount || 0) < m);
      
      if (nextMilestone && (weeklyCount || 0) >= nextMilestone - 2) {
        const remaining = nextMilestone - (weeklyCount || 0);
        notifications.push({
          type: 'tracking_milestone',
          message: `${remaining} more item${remaining > 1 ? 's' : ''} to hit ${nextMilestone} tracked this week! You got this! 📚`,
          action_url: '/',
          metadata: { currentCount: weeklyCount, milestone: nextMilestone }
        });
      }

      // Compare with top trackers
      const { data: topTrackers } = await supabaseAdmin
        .from('list_items')
        .select('user_id')
        .gte('created_at', thisWeekStart.toISOString())
        .limit(1000);

      const trackerCounts: Record<string, number> = {};
      (topTrackers || []).forEach((t: any) => {
        trackerCounts[t.user_id] = (trackerCounts[t.user_id] || 0) + 1;
      });

      const sortedTrackers = Object.entries(trackerCounts).sort((a, b) => b[1] - a[1]);
      const userTrackRank = sortedTrackers.findIndex(([id]) => id === userId) + 1;
      const topCount = sortedTrackers[0]?.[1] || 0;

      if (userTrackRank <= 10 && topCount - (weeklyCount || 0) <= 5) {
        notifications.push({
          type: 'tracking_competition',
          message: `You're #${userTrackRank} in tracking this week! Only ${topCount - (weeklyCount || 0)} behind the leader! 🔥`,
          action_url: '/',
          metadata: { rank: userTrackRank, gap: topCount - (weeklyCount || 0) }
        });
      }
    } catch (e) {
      console.error('Tracking challenge check error:', e);
    }

    // 5. DNA-BASED RECOMMENDATIONS
    try {
      const { data: dnaProfile } = await supabaseAdmin
        .from('user_dna_profiles')
        .select('favorite_genres, personality_type')
        .eq('user_id', userId)
        .single();

      if (dnaProfile?.favorite_genres?.length > 0) {
        const topGenre = dnaProfile.favorite_genres[0];
        notifications.push({
          type: 'dna_recommendation',
          message: `Based on your love for ${topGenre}, we have new recommendations waiting! 🧬`,
          action_url: '/discover',
          metadata: { genre: topGenre, personalityType: dnaProfile.personality_type }
        });
      }
    } catch (e) {
      console.error('DNA recommendation check error:', e);
    }

    // 6. POLL/PREDICTION ENGAGEMENT
    try {
      const { data: openPolls, count: pollCount } = await supabaseAdmin
        .from('prediction_pools')
        .select('id, title', { count: 'exact' })
        .eq('type', 'vote')
        .eq('status', 'open')
        .limit(1);

      const { data: userVotes } = await supabaseAdmin
        .from('user_predictions')
        .select('pool_id')
        .eq('user_id', userId);

      const votedPoolIds = new Set((userVotes || []).map((v: any) => v.pool_id));
      
      if (openPolls && openPolls[0] && !votedPoolIds.has(openPolls[0].id)) {
        notifications.push({
          type: 'poll_nudge',
          message: `${pollCount || 'Many'} polls need your vote! Share your opinion on "${openPolls[0].title.slice(0, 40)}..." 🗳️`,
          action_url: '/',
          metadata: { pollId: openPolls[0].id, totalPolls: pollCount }
        });
      }
    } catch (e) {
      console.error('Poll engagement check error:', e);
    }

    // Return top 5 most relevant notifications (prioritize variety)
    const seenTypes = new Set<string>();
    const uniqueNotifications = notifications.filter(n => {
      if (seenTypes.has(n.type)) return false;
      seenTypes.add(n.type);
      return true;
    }).slice(0, 5);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notifications: uniqueNotifications,
        total_generated: notifications.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
