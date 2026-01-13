import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_NUDGES_PER_WEEK = 2;
const MAX_CONSECUTIVE_NUDGES = 3;
const INACTIVITY_HOURS = 8;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'batch';
    const targetUserId = body.user_id;

    const usersToProcess: string[] = [];
    const now = new Date();
    const inactivityThreshold = new Date(now.getTime() - INACTIVITY_HOURS * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    if (mode === 'single' && targetUserId) {
      usersToProcess.push(targetUserId);
    } else {
      // Get users who had their last session more than 8 hours ago
      // First get the most recent session per user
      const { data: recentSessions } = await supabaseAdmin
        .from('user_sessions')
        .select('user_id, started_at')
        .order('started_at', { ascending: false });

      // Build map of most recent session per user
      const lastSessionByUser = new Map<string, Date>();
      if (recentSessions) {
        for (const session of recentSessions) {
          if (!lastSessionByUser.has(session.user_id)) {
            lastSessionByUser.set(session.user_id, new Date(session.started_at));
          }
        }
      }

      // Find users who are inactive (last session > 8 hours ago)
      for (const [userId, lastSession] of lastSessionByUser) {
        if (lastSession < inactivityThreshold) {
          usersToProcess.push(userId);
        }
      }

      // Limit batch size
      usersToProcess.splice(100);
    }

    let notificationsCreated = 0;
    let usersSkipped = 0;

    for (const userId of usersToProcess) {
      // Get or create notification settings
      let { data: settings } = await supabaseAdmin
        .from('user_notification_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!settings) {
        const { data: newSettings, error: createError } = await supabaseAdmin
          .from('user_notification_settings')
          .insert({ user_id: userId })
          .select()
          .single();

        if (createError) {
          console.error('Error creating settings for user', userId, createError);
          continue;
        }
        settings = newSettings;
      }

      if (!settings.engagement_nudges_enabled) {
        usersSkipped++;
        continue;
      }

      if (settings.nudges_sent_since_active >= MAX_CONSECUTIVE_NUDGES) {
        usersSkipped++;
        continue;
      }

      // Count nudges sent in the past week
      const { count: weeklyNudgeCount } = await supabaseAdmin
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('type', ['leaderboard_position', 'points_to_rank', 'friend_activity', 'poll_nudge', 'trivia_rank', 'tracking_milestone', 'dna_recommendation'])
        .gte('created_at', oneWeekAgo.toISOString());

      if ((weeklyNudgeCount || 0) >= MAX_NUDGES_PER_WEEK) {
        usersSkipped++;
        continue;
      }

      const notification = await generateBestNotification(supabaseAdmin, userId);

      if (notification) {
        const { error: insertError } = await supabaseAdmin
          .from('notifications')
          .insert({
            user_id: notification.user_id,
            type: notification.type,
            message: notification.message,
            action_url: notification.action_url,
            read: false,
            metadata: {
              email_subject: notification.email_subject,
              email_body: notification.email_body,
              delivery_channels: ['in_app'],
              generated_at: now.toISOString(),
            }
          });

        if (!insertError) {
          notificationsCreated++;

          await supabaseAdmin
            .from('user_notification_settings')
            .update({
              nudges_sent_since_active: (settings.nudges_sent_since_active || 0) + 1,
              last_nudge_at: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq('user_id', userId);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        usersProcessed: usersToProcess.length,
        usersSkipped,
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

interface NotificationData {
  user_id: string;
  type: string;
  message: string;
  action_url: string;
  email_subject: string;
  email_body: string;
}

async function generateBestNotification(supabase: any, userId: string): Promise<NotificationData | null> {
  const notifications: Array<{ priority: number; notification: NotificationData }> = [];

  // Check leaderboard position
  try {
    const { data: userPoints } = await supabase
      .from('user_points')
      .select('total_points')
      .eq('user_id', userId)
      .single();

    if (userPoints?.total_points) {
      const { count } = await supabase
        .from('user_points')
        .select('total_points', { count: 'exact', head: true })
        .gt('total_points', userPoints.total_points);

      const position = (count || 0) + 1;
      
      if (position <= 10) {
        notifications.push({
          priority: 10,
          notification: {
            user_id: userId,
            type: 'leaderboard_position',
            message: `You're ranked #${position} - Top 10! Don't let someone take your spot.`,
            action_url: '/leaderboard',
            email_subject: `You're #${position} on the leaderboard!`,
            email_body: `You're currently ranked #${position} on Consumed. Log in to defend your position!`,
          }
        });
      } else if (position <= 25) {
        notifications.push({
          priority: 8,
          notification: {
            user_id: userId,
            type: 'leaderboard_position',
            message: `You're ranked #${position} - Top 25! Keep climbing.`,
            action_url: '/leaderboard',
            email_subject: `You're in the Top 25!`,
            email_body: `You're ranked #${position} on Consumed. A few more points could move you up!`,
          }
        });
      } else if (position <= 50) {
        notifications.push({
          priority: 5,
          notification: {
            user_id: userId,
            type: 'leaderboard_position',
            message: `You're ranked #${position} - Top 50! You're so close to the Top 25.`,
            action_url: '/leaderboard',
            email_subject: `You're in the Top 50!`,
            email_body: `You're ranked #${position} on Consumed. Track some media to climb higher!`,
          }
        });
      }

      const { data: nextUser } = await supabase
        .from('user_points')
        .select('total_points')
        .gt('total_points', userPoints.total_points)
        .order('total_points', { ascending: true })
        .limit(1)
        .single();

      if (nextUser) {
        const pointsNeeded = nextUser.total_points - userPoints.total_points;
        if (pointsNeeded <= 30) {
          notifications.push({
            priority: 9,
            notification: {
              user_id: userId,
              type: 'points_to_rank',
              message: `Only ${pointsNeeded} points to move up! Play trivia or vote on a poll.`,
              action_url: '/',
              email_subject: `Just ${pointsNeeded} points to rank up!`,
              email_body: `You're so close to moving up on the leaderboard. Log in and earn ${pointsNeeded} more points!`,
            }
          });
        }
      }
    }
  } catch (e) {
    console.error('Leaderboard check error:', e);
  }

  // Check friend activity
  try {
    const { data: friendships } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq('status', 'accepted');

    const friendIds = (friendships || []).map((f: any) =>
      f.user_id === userId ? f.friend_id : f.user_id
    ).filter((id: string) => id !== userId);

    if (friendIds.length > 0) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentPosts } = await supabase
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
        notifications.push({
          priority: 7,
          notification: {
            user_id: userId,
            type: 'friend_activity',
            message: `${friendName} posted about "${post.media_title}". See what they thought!`,
            action_url: `/post/${post.id}`,
            email_subject: `${friendName} is watching something new`,
            email_body: `${friendName} just posted about "${post.media_title}" on Consumed. Check out their thoughts!`,
          }
        });
      }
    }
  } catch (e) {
    console.error('Friend activity check error:', e);
  }

  // Check active polls
  try {
    const { data: openPolls, count: pollCount } = await supabase
      .from('prediction_pools')
      .select('id, title', { count: 'exact' })
      .eq('type', 'vote')
      .eq('status', 'open')
      .limit(1);

    if (pollCount && pollCount > 0 && openPolls && openPolls.length > 0) {
      notifications.push({
        priority: 4,
        notification: {
          user_id: userId,
          type: 'poll_nudge',
          message: `${pollCount} active poll${pollCount > 1 ? 's' : ''} waiting for your vote!`,
          action_url: '/',
          email_subject: `New polls are waiting for your vote`,
          email_body: `There are ${pollCount} active polls on Consumed. Share your opinion!`,
        }
      });
    }
  } catch (e) {
    console.error('Poll nudge error:', e);
  }

  // Check trivia ranking
  try {
    const { data: triviaStats } = await supabase
      .from('trivia_stats')
      .select('correct_answers')
      .eq('user_id', userId)
      .single();

    if (triviaStats?.correct_answers) {
      const { count: betterPlayers } = await supabase
        .from('trivia_stats')
        .select('correct_answers', { count: 'exact', head: true })
        .gt('correct_answers', triviaStats.correct_answers);

      const triviaRank = (betterPlayers || 0) + 1;
      if (triviaRank <= 20) {
        notifications.push({
          priority: 6,
          notification: {
            user_id: userId,
            type: 'trivia_rank',
            message: `You're #${triviaRank} in trivia! Can you hold your spot?`,
            action_url: '/',
            email_subject: `You're a trivia champion!`,
            email_body: `You're ranked #${triviaRank} in trivia on Consumed. Play to keep your position!`,
          }
        });
      }
    }
  } catch (e) {
    console.error('Trivia rank error:', e);
  }

  // Check tracking milestones
  try {
    const { count: itemCount } = await supabase
      .from('list_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (itemCount !== null && itemCount > 0) {
      const milestones = [10, 25, 50, 100, 250, 500];
      for (const milestone of milestones) {
        if (itemCount >= milestone && itemCount < milestone + 10) {
          notifications.push({
            priority: 3,
            notification: {
              user_id: userId,
              type: 'tracking_milestone',
              message: `You've tracked ${itemCount} items! Keep the streak going.`,
              action_url: '/collections',
              email_subject: `Milestone: ${itemCount} items tracked!`,
              email_body: `You've tracked ${itemCount} items on Consumed. What will you add next?`,
            }
          });
          break;
        }
      }
    }
  } catch (e) {
    console.error('Tracking milestone error:', e);
  }

  if (notifications.length === 0) return null;

  notifications.sort((a, b) => b.priority - a.priority);
  return notifications[0].notification;
}
