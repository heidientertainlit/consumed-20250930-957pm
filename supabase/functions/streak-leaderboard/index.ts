import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! }
        }
      }
    );

    const { action, ...params } = await req.json();

    if (action === 'getLeaderboard') {
      const { limit = 10, friendIds } = params;
      
      // Get top streaks globally
      const { data: globalStreaks, error: globalError } = await supabaseAdmin
        .from('daily_runs')
        .select(`
          user_id,
          current_run,
          longest_run,
          total_days_played,
          last_play_date
        `)
        .order('current_run', { ascending: false })
        .limit(limit);

      if (globalError) {
        console.log('[streak-leaderboard] Error fetching global streaks:', globalError.message);
        return new Response(JSON.stringify({ error: globalError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get user info for the streak leaders
      const userIds = globalStreaks?.map(s => s.user_id) || [];
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, display_name, user_name, avatar')
        .in('id', userIds);

      const userMap = new Map(users?.map(u => [u.id, u]) || []);

      const globalLeaderboard = globalStreaks?.map((streak, index) => {
        const user = userMap.get(streak.user_id);
        return {
          rank: index + 1,
          userId: streak.user_id,
          displayName: user?.display_name || user?.user_name || 'User',
          userName: user?.user_name,
          avatar: user?.avatar,
          currentStreak: streak.current_run,
          longestStreak: streak.longest_run,
          totalDays: streak.total_days_played,
          lastPlayDate: streak.last_play_date
        };
      }) || [];

      // Get friends' streaks if friendIds provided
      let friendsLeaderboard: any[] = [];
      if (friendIds && friendIds.length > 0) {
        const { data: friendStreaks } = await supabaseAdmin
          .from('daily_runs')
          .select(`
            user_id,
            current_run,
            longest_run,
            total_days_played,
            last_play_date
          `)
          .in('user_id', friendIds)
          .order('current_run', { ascending: false })
          .limit(limit);

        const friendUserIds = friendStreaks?.map(s => s.user_id) || [];
        const { data: friendUsers } = await supabaseAdmin
          .from('users')
          .select('id, display_name, user_name, avatar')
          .in('id', friendUserIds);

        const friendUserMap = new Map(friendUsers?.map(u => [u.id, u]) || []);

        friendsLeaderboard = friendStreaks?.map((streak, index) => {
          const user = friendUserMap.get(streak.user_id);
          return {
            rank: index + 1,
            userId: streak.user_id,
            displayName: user?.display_name || user?.user_name || 'User',
            userName: user?.user_name,
            avatar: user?.avatar,
            currentStreak: streak.current_run,
            longestStreak: streak.longest_run,
            totalDays: streak.total_days_played,
            lastPlayDate: streak.last_play_date
          };
        }) || [];
      }

      // Get all-time best streaks
      const { data: allTimeStreaks } = await supabaseAdmin
        .from('daily_runs')
        .select(`
          user_id,
          longest_run,
          total_days_played
        `)
        .order('longest_run', { ascending: false })
        .limit(limit);

      const allTimeUserIds = allTimeStreaks?.map(s => s.user_id) || [];
      const { data: allTimeUsers } = await supabaseAdmin
        .from('users')
        .select('id, display_name, user_name, avatar')
        .in('id', allTimeUserIds);

      const allTimeUserMap = new Map(allTimeUsers?.map(u => [u.id, u]) || []);

      const allTimeLeaderboard = allTimeStreaks?.map((streak, index) => {
        const user = allTimeUserMap.get(streak.user_id);
        return {
          rank: index + 1,
          userId: streak.user_id,
          displayName: user?.display_name || user?.user_name || 'User',
          userName: user?.user_name,
          avatar: user?.avatar,
          longestStreak: streak.longest_run,
          totalDays: streak.total_days_played
        };
      }) || [];

      return new Response(JSON.stringify({ 
        global: globalLeaderboard,
        friends: friendsLeaderboard,
        allTime: allTimeLeaderboard
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'getUserStreak') {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: streak } = await supabaseAdmin
        .from('daily_runs')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // Calculate streak badge
      let badge = null;
      if (streak) {
        if (streak.current_run >= 30) badge = { icon: '🌟', label: '30 Day Legend' };
        else if (streak.current_run >= 14) badge = { icon: '🔥🔥🔥', label: '14 Day Fire' };
        else if (streak.current_run >= 7) badge = { icon: '🔥🔥', label: '7 Day Hot' };
        else if (streak.current_run >= 3) badge = { icon: '🔥', label: '3 Day Streak' };
      }

      return new Response(JSON.stringify({ 
        streak: streak || { current_run: 0, longest_run: 0, total_days_played: 0 },
        badge
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
