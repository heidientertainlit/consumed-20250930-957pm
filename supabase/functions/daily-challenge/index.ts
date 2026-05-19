import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Returns today's date as YYYY-MM-DD in US Pacific Time (Hollywood clock).
const getPacificDateStr = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

// Shared helper: calls the update_user_streak DB function (atomic, single source of truth).
// Returns { currentStreak, longestStreak, bonusPoints, nextMilestone } or throws.
async function runStreakUpdate(supabaseAdmin: ReturnType<typeof createClient>, userId: string, todayDate: string) {
  const { data: result, error } = await supabaseAdmin.rpc('update_user_streak', {
    p_user_id: userId,
    p_today: todayDate,
  });
  if (error) throw new Error(`streak RPC error: ${error.message}`);

  const currentStreak: number = result.currentStreak;
  const longestStreak: number = result.longestStreak;
  const wasUpdated: boolean = result.wasUpdated;

  const streakMilestones = [
    { days: 3, points: 25 },
    { days: 7, points: 75 },
    { days: 14, points: 150 },
    { days: 30, points: 500 },
  ];
  const bonusPoints = wasUpdated ? (streakMilestones.find(m => m.days === currentStreak)?.points || 0) : 0;
  const milestoneDays = [3, 7, 14, 30];
  const nextMilestone = milestoneDays.find(m => m > currentStreak) || 30;

  console.log(`[streak] user=${userId} today=${todayDate} currentStreak=${currentStreak} wasUpdated=${wasUpdated} bonus=${bonusPoints}`);
  return { currentStreak, longestStreak, bonusPoints, nextMilestone, wasUpdated };
}

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

    // Ensure daily_runs table exists
    if (action === 'ensureTable') {
      try {
        const { error: checkError } = await supabaseAdmin
          .from('daily_runs')
          .select('id')
          .limit(1);
        
        if (checkError && checkError.code === '42P01') {
          return new Response(JSON.stringify({ 
            exists: false, 
            message: 'Table does not exist. Please create it in Supabase dashboard.' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({ exists: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (action === 'getToday') {
      const today = params.localDate || getPacificDateStr();
      console.log('[daily-challenge] getToday - params received:', JSON.stringify(params));
      console.log('[daily-challenge] getToday - looking for featured_date:', today, params.localDate ? '(from client)' : '(Pacific fallback)');
      
      const { data: challenge, error } = await supabaseAdmin
        .from('prediction_pools')
        .select('id, featured_date, type, title, options, points_reward, status, category, icon, correct_answer, media_title')
        .eq('featured_date', today)
        .eq('status', 'open')
        .limit(1)
        .single();

      console.log('[daily-challenge] query result:', { challenge: challenge?.id, error: error?.message });

      if (error) {
        console.log('[daily-challenge] returning null due to error:', error.message);
        return new Response(JSON.stringify({ challenge: null, debug: { today, error: error.message } }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const mappedChallenge = challenge ? {
        ...challenge,
        challenge_type: challenge.type,
        scheduled_date: challenge.featured_date
      } : null;

      return new Response(JSON.stringify({ challenge: mappedChallenge }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'checkResponse') {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { challengeId } = params;
      
      const { data: response, error } = await supabaseAdmin
        .from('user_predictions')
        .select('*')
        .eq('pool_id', challengeId)
        .eq('user_id', user.id)
        .single();

      let runInfo = null;
      if (response && !error) {
        const { data: streakData } = await supabaseAdmin
          .from('login_streaks')
          .select('current_streak, longest_streak')
          .eq('user_id', user.id)
          .single();
        
        if (streakData) {
          const milestones = [3, 7, 14, 30];
          const nextMilestone = milestones.find(m => m > streakData.current_streak) || 30;
          runInfo = {
            currentRun: streakData.current_streak,
            longestRun: streakData.longest_streak,
            bonusPoints: 0,
            nextMilestone
          };
        }
      }

      return new Response(JSON.stringify({ 
        hasResponded: !!response && !error,
        response: response,
        run: runInfo
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── update_streak: called after Today's Play trivia completes ──
    if (action === 'update_streak') {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.log('[update_streak] Unauthorized:', userError?.message);
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const todayDate = params.localDate || getPacificDateStr();

      try {
        const { currentStreak, longestStreak, bonusPoints, nextMilestone } = await runStreakUpdate(supabaseAdmin, user.id, todayDate);
        return new Response(JSON.stringify({ currentStreak, longestStreak, bonusPoints, nextMilestone }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        console.log('[update_streak] error:', e.message);
        return new Response(JSON.stringify({ error: e.message, currentStreak: 1 }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (action === 'submit') {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { challengeId, response, localDate } = params;
      const today = localDate || getPacificDateStr();
      console.log('[daily-challenge] submit - looking for challenge:', challengeId, 'on date:', today);

      const { data: challenge, error: challengeError } = await supabaseAdmin
        .from('prediction_pools')
        .select('*')
        .eq('id', challengeId)
        .eq('featured_date', today)
        .eq('status', 'open')
        .in('type', ['predict', 'poll', 'vote'])
        .single();

      console.log('[daily-challenge] submit - challenge found:', challenge?.id, 'error:', challengeError?.message);

      if (challengeError || !challenge) {
        return new Response(JSON.stringify({ error: 'Challenge not available or not for today', debug: { challengeId, today, errorMsg: challengeError?.message } }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let pointsEarned = 0;
      let isCorrect = false;

      if (challenge.type === 'trivia' && challenge.correct_answer) {
        isCorrect = response.answer === challenge.correct_answer;
        pointsEarned = isCorrect ? challenge.points_reward : 0;
      } else {
        pointsEarned = challenge.points_reward;
      }

      const { error: insertError } = await supabaseAdmin
        .from('user_predictions')
        .insert({
          pool_id: challengeId,
          user_id: user.id,
          prediction: response.answer || response,
          points_earned: pointsEarned,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        if (insertError.message?.includes('duplicate') || insertError.code === '23505') {
          return new Response(JSON.stringify({ error: 'Already submitted' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update streak via shared DB function
      let runInfo: { currentRun: number; bonusPoints: number; nextMilestone: number; longestRun: number } | null = null;
      try {
        const todayDate = localDate || getPacificDateStr();
        const { currentStreak, longestStreak, bonusPoints, nextMilestone } = await runStreakUpdate(supabaseAdmin, user.id, todayDate);
        pointsEarned += bonusPoints;
        runInfo = { currentRun: currentStreak, longestRun: longestStreak, bonusPoints, nextMilestone };
      } catch (streakErr) {
        console.log('[submit] streak update failed:', streakErr.message);
      }

      if (pointsEarned > 0) {
        const { data: currentUser } = await supabaseAdmin
          .from('users')
          .select('points')
          .eq('id', user.id)
          .single();

        if (currentUser) {
          await supabaseAdmin
            .from('users')
            .update({ points: (currentUser.points || 0) + pointsEarned })
            .eq('id', user.id);
        }
      }

      return new Response(JSON.stringify({ 
        success: true,
        pointsEarned,
        isCorrect,
        correctAnswer: challenge.type === 'trivia' ? challenge.correct_answer : null,
        run: runInfo
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
