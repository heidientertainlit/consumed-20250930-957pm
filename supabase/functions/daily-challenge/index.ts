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

    // Ensure daily_runs table exists
    if (action === 'ensureTable') {
      try {
        // Try to query the table first
        const { error: checkError } = await supabaseAdmin
          .from('daily_runs')
          .select('id')
          .limit(1);
        
        if (checkError && checkError.code === '42P01') {
          // Table doesn't exist - inform caller
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
      // Use client's local date if provided, otherwise fall back to UTC
      const today = params.localDate || new Date().toISOString().split('T')[0];
      console.log('[daily-challenge] getToday - params received:', JSON.stringify(params));
      console.log('[daily-challenge] getToday - looking for featured_date:', today, params.localDate ? '(from client)' : '(UTC fallback)');
      
      // Query prediction_pools with featured_date = today (Daily Call)
      const { data: challenge, error } = await supabaseAdmin
        .from('prediction_pools')
        .select('id, featured_date, type, title, description, options, points_reward, status, category, icon, correct_answer')
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

      // Map to expected format (challenge_type -> type)
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
      
      // Check user_predictions (unified with Play page)
      const { data: response, error } = await supabaseAdmin
        .from('user_predictions')
        .select('*')
        .eq('pool_id', challengeId)
        .eq('user_id', user.id)
        .single();

      // Also fetch run info if they've responded
      let runInfo = null;
      if (response && !error) {
        const { data: runData } = await supabaseAdmin
          .from('daily_runs')
          .select('current_run, longest_run')
          .eq('user_id', user.id)
          .single();
        
        if (runData) {
          const milestones = [3, 7, 14, 30];
          const nextMilestone = milestones.find(m => m > runData.current_run) || 30;
          runInfo = {
            currentRun: runData.current_run,
            longestRun: runData.longest_run,
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

    if (action === 'submit') {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { challengeId, response } = params;
      const today = new Date().toISOString().split('T')[0];

      // Query prediction_pools instead of daily_challenges
      const { data: challenge, error: challengeError } = await supabaseAdmin
        .from('prediction_pools')
        .select('*')
        .eq('id', challengeId)
        .gte('publish_at', `${today}T00:00:00`)
        .lt('publish_at', `${today}T23:59:59`)
        .eq('status', 'open')
        .single();

      if (challengeError || !challenge) {
        return new Response(JSON.stringify({ error: 'Challenge not available or not for today' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let pointsEarned = 0;
      let isCorrect = false;

      // Use 'type' instead of 'challenge_type'
      if (challenge.type === 'trivia' && challenge.correct_answer) {
        isCorrect = response.answer === challenge.correct_answer;
        pointsEarned = isCorrect ? challenge.points_reward : 0;
      } else {
        pointsEarned = challenge.points_reward;
      }

      // Insert into user_predictions (unified with Play page)
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

      // Track daily run (gracefully handle if table doesn't exist)
      let runInfo: { currentRun: number; bonusPoints: number; nextMilestone: number; longestRun: number } | null = null;
      
      try {
        const todayDate = new Date().toISOString().split('T')[0];
        const yesterdayDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        runInfo = { currentRun: 1, bonusPoints: 0, nextMilestone: 3, longestRun: 1 };
        
        // Get or create daily run record
        const { data: existingRun, error: runQueryError } = await supabaseAdmin
          .from('daily_runs')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        // If table doesn't exist, skip run tracking
        if (runQueryError && runQueryError.code === '42P01') {
          console.log('daily_runs table does not exist, skipping run tracking');
          runInfo = null;
        } else if (existingRun) {
          const lastPlayStr = existingRun.last_play_date ? 
            new Date(existingRun.last_play_date).toISOString().split('T')[0] : null;
          
          if (lastPlayStr === todayDate) {
            // Already played today - return existing run info
            runInfo.currentRun = existingRun.current_run;
            runInfo.longestRun = existingRun.longest_run;
          } else if (lastPlayStr === yesterdayDate) {
            // Consecutive day! Increment run
            const newRun = existingRun.current_run + 1;
            const newLongest = Math.max(newRun, existingRun.longest_run);
            
            // Calculate bonus points at milestones
            const milestones = [
              { days: 3, points: 25 },
              { days: 7, points: 75 },
              { days: 14, points: 150 },
              { days: 30, points: 500 }
            ];
            
            const milestone = milestones.find(m => m.days === newRun);
            const bonusPoints = milestone?.points || 0;
            
            await supabaseAdmin
              .from('daily_runs')
              .update({
                current_run: newRun,
                longest_run: newLongest,
                last_play_date: new Date().toISOString(),
                total_days_played: existingRun.total_days_played + 1,
                bonus_points_earned: existingRun.bonus_points_earned + bonusPoints,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', user.id);
            
            runInfo.currentRun = newRun;
            runInfo.longestRun = newLongest;
            runInfo.bonusPoints = bonusPoints;
            pointsEarned += bonusPoints;
          } else {
            // Streak broken - reset to 1
            await supabaseAdmin
              .from('daily_runs')
              .update({
                current_run: 1,
                last_play_date: new Date().toISOString(),
                total_days_played: existingRun.total_days_played + 1,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', user.id);
            
            runInfo.currentRun = 1;
            runInfo.longestRun = existingRun.longest_run;
          }
        } else if (!runQueryError || runQueryError.code === 'PGRST116') {
          // No record found (PGRST116) - first time playing, create record
          await supabaseAdmin
            .from('daily_runs')
            .insert({
              user_id: user.id,
              current_run: 1,
              longest_run: 1,
              last_play_date: new Date().toISOString(),
              total_days_played: 1,
              bonus_points_earned: 0
            });
        }
        
        // Find next milestone
        if (runInfo) {
          const milestoneDays = [3, 7, 14, 30];
          runInfo.nextMilestone = milestoneDays.find(m => m > runInfo!.currentRun) || 30;
        }
      } catch (runTrackingError) {
        console.log('Error tracking daily run:', runTrackingError);
        runInfo = null;
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
