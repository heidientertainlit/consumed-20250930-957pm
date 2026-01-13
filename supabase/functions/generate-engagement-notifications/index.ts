import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const targetUserId = body.user_id;

    const usersToProcess: string[] = [];

    if (targetUserId) {
      usersToProcess.push(targetUserId);
    } else {
      const { data: activeUsers } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .not('id', 'is', null)
        .limit(100);

      if (activeUsers) {
        usersToProcess.push(...activeUsers.map((u: any) => u.id));
      }
    }

    let notificationsCreated = 0;

    for (const userId of usersToProcess) {
      const notificationsToInsert: any[] = [];

      const existingNotifCheck = async (type: string, since: Date) => {
        const { count } = await supabaseAdmin
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('type', type)
          .gte('created_at', since.toISOString());
        return (count || 0) > 0;
      };

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      try {
        const { data: userPoints } = await supabaseAdmin
          .from('user_points')
          .select('total_points')
          .eq('user_id', userId)
          .single();

        if (userPoints?.total_points) {
          const { count } = await supabaseAdmin
            .from('user_points')
            .select('total_points', { count: 'exact', head: true })
            .gt('total_points', userPoints.total_points);

          const position = (count || 0) + 1;
          const tier = position <= 10 ? 'Top 10' : position <= 25 ? 'Top 25' : position <= 50 ? 'Top 50' : null;

          if (tier && !(await existingNotifCheck('leaderboard_position', threeDaysAgo))) {
            notificationsToInsert.push({
              user_id: userId,
              type: 'leaderboard_position',
              message: `You're ranked #${position} in the ${tier}! Keep climbing the leaderboard.`,
              action_url: '/leaderboard',
              read: false,
            });
          }

          const { data: nextUser } = await supabaseAdmin
            .from('user_points')
            .select('total_points')
            .gt('total_points', userPoints.total_points)
            .order('total_points', { ascending: true })
            .limit(1)
            .single();

          if (nextUser) {
            const pointsNeeded = nextUser.total_points - userPoints.total_points;
            if (pointsNeeded <= 30 && !(await existingNotifCheck('points_to_rank', oneDayAgo))) {
              notificationsToInsert.push({
                user_id: userId,
                type: 'points_to_rank',
                message: `Only ${pointsNeeded} points to move up in rank! Play trivia or vote on a poll.`,
                action_url: '/',
                read: false,
              });
            }
          }
        }
      } catch (e) {
        console.error('Leaderboard check error for user', userId, e);
      }

      try {
        const { data: friendships } = await supabaseAdmin
          .from('friendships')
          .select('user_id, friend_id')
          .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
          .eq('status', 'accepted');

        const friendIds = (friendships || []).map((f: any) =>
          f.user_id === userId ? f.friend_id : f.user_id
        ).filter((id: string) => id !== userId);

        if (friendIds.length > 0 && !(await existingNotifCheck('friend_activity', oneDayAgo))) {
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

          const { data: recentPosts } = await supabaseAdmin
            .from('social_posts')
            .select('id, user_id, media_title, profiles!social_posts_user_id_fkey(user_name)')
            .in('user_id', friendIds)
            .gte('created_at', yesterday)
            .not('media_title', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1);

          if (recentPosts && recentPosts.length > 0) {
            const post = recentPosts[0];
            const friendName = (post as any).profiles?.user_name || 'A friend';
            notificationsToInsert.push({
              user_id: userId,
              type: 'friend_activity',
              message: `${friendName} posted about "${post.media_title}". Check it out!`,
              action_url: `/post/${post.id}`,
              read: false,
            });
          }
        }
      } catch (e) {
        console.error('Friend activity check error:', e);
      }

      try {
        if (!(await existingNotifCheck('poll_nudge', oneDayAgo))) {
          const { data: openPolls, count: pollCount } = await supabaseAdmin
            .from('prediction_pools')
            .select('id, title', { count: 'exact' })
            .eq('type', 'vote')
            .eq('status', 'open')
            .limit(1);

          if (pollCount && pollCount > 0 && openPolls && openPolls.length > 0) {
            notificationsToInsert.push({
              user_id: userId,
              type: 'poll_nudge',
              message: `${pollCount} active poll${pollCount > 1 ? 's' : ''} waiting for your vote. Share your opinion!`,
              action_url: '/',
              read: false,
            });
          }
        }
      } catch (e) {
        console.error('Poll nudge error:', e);
      }

      try {
        const { data: triviaStats } = await supabaseAdmin
          .from('trivia_stats')
          .select('correct_answers')
          .eq('user_id', userId)
          .single();

        if (triviaStats?.correct_answers && !(await existingNotifCheck('trivia_rank', threeDaysAgo))) {
          const { count: betterPlayers } = await supabaseAdmin
            .from('trivia_stats')
            .select('correct_answers', { count: 'exact', head: true })
            .gt('correct_answers', triviaStats.correct_answers);

          const triviaRank = (betterPlayers || 0) + 1;
          if (triviaRank <= 20) {
            notificationsToInsert.push({
              user_id: userId,
              type: 'trivia_rank',
              message: `You're #${triviaRank} in trivia! Can you hold your spot?`,
              action_url: '/',
              read: false,
            });
          }
        }
      } catch (e) {
        console.error('Trivia rank error:', e);
      }

      try {
        const { data: listItems, count: itemCount } = await supabaseAdmin
          .from('list_items')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId);

        if (itemCount !== null && itemCount > 0 && !(await existingNotifCheck('tracking_milestone', threeDaysAgo))) {
          const milestones = [10, 25, 50, 100, 250, 500];
          for (const milestone of milestones) {
            if (itemCount >= milestone && itemCount < milestone + 5) {
              notificationsToInsert.push({
                user_id: userId,
                type: 'tracking_milestone',
                message: `You've tracked ${itemCount} items! That's a great milestone.`,
                action_url: '/collections',
                read: false,
              });
              break;
            }
          }
        }
      } catch (e) {
        console.error('Tracking milestone error:', e);
      }

      if (notificationsToInsert.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from('notifications')
          .insert(notificationsToInsert);

        if (insertError) {
          console.error('Error inserting notifications:', insertError);
        } else {
          notificationsCreated += notificationsToInsert.length;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        usersProcessed: usersToProcess.length,
        notificationsCreated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating engagement notifications:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate notifications' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
