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
      
      // Query prediction_pools with featured_date = today — any type (trivia, poll, predict, vote, opinion)
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

      // Also fetch streak info if they've responded
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

      const todayDate = params.localDate || new Date().toISOString().split('T')[0];
      const yesterdayDate = new Date(new Date(todayDate + 'T12:00:00Z').getTime() - 86400000).toISOString().split('T')[0];
      console.log(`[update_streak] user=${user.id} todayDate=${todayDate} yesterdayDate=${yesterdayDate}`);

      try {
        const { data: existing, error: fetchErr } = await supabaseAdmin
          .from('login_streaks')
          .select('*')
          .eq('user_id', user.id)
          .single();

        console.log(`[update_streak] existing row:`, existing ? `current_streak=${existing.current_streak} last_login=${existing.last_login}` : 'none', fetchErr ? `err=${fetchErr.code}` : '');

        let currentStreak = 1;
        let longestStreak = 1;

        if (fetchErr && fetchErr.code !== 'PGRST116') {
          // Unexpected error — still return gracefully
          console.log('[update_streak] Unexpected fetch error:', fetchErr.message);
          return new Response(JSON.stringify({ currentStreak: 1 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const streakMilestones = [
          { days: 3, points: 25 },
          { days: 7, points: 75 },
          { days: 14, points: 150 },
          { days: 30, points: 500 },
        ];
        let bonusPoints = 0;

        if (existing) {
          // Normalise: last_login may be a full timestamp ("2026-05-07T00:00:00+00:00")
          // or a plain date ("2026-05-07"). Slice to first 10 chars for safe comparison.
          const lastLogin = (existing.last_login || '').slice(0, 10);
          console.log(`[update_streak] comparison: lastLogin="${lastLogin}" todayDate="${todayDate}" yesterdayDate="${yesterdayDate}"`);
          if (lastLogin === todayDate) {
            // Already updated today — just return current value
            console.log(`[update_streak] already updated today → returning existing streak ${existing.current_streak}`);
            return new Response(JSON.stringify({
              currentStreak: existing.current_streak,
              longestStreak: existing.longest_streak,
              bonusPoints: 0,
              alreadyUpdated: true
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          } else if (lastLogin === yesterdayDate) {
            currentStreak = (existing.current_streak || 0) + 1;
            longestStreak = Math.max(currentStreak, existing.longest_streak || 1);
            console.log(`[update_streak] consecutive day → incrementing to ${currentStreak}`);
            const milestone = streakMilestones.find(m => m.days === currentStreak);
            bonusPoints = milestone?.points || 0;
          } else {
            currentStreak = 1;
            longestStreak = existing.longest_streak || 1;
            console.log(`[update_streak] streak broken (lastLogin="${lastLogin}" is not yesterday "${yesterdayDate}") → resetting to 1`);
          }
          // Try with play_completed_date first; fall back without if column is missing
          const { error: upErr } = await supabaseAdmin.from('login_streaks').update({
            current_streak: currentStreak,
            longest_streak: longestStreak,
            last_login: todayDate,
            play_completed_date: todayDate
          }).eq('user_id', user.id);
          if (upErr) {
            await supabaseAdmin.from('login_streaks').update({
              current_streak: currentStreak,
              longest_streak: longestStreak,
              last_login: todayDate,
            }).eq('user_id', user.id);
          }
        } else {
          // Try with play_completed_date first; fall back without if column is missing
          const { error: insErr } = await supabaseAdmin.from('login_streaks').insert({
            user_id: user.id,
            current_streak: 1,
            longest_streak: 1,
            last_login: todayDate,
            play_completed_date: todayDate
          });
          if (insErr) {
            await supabaseAdmin.from('login_streaks').insert({
              user_id: user.id,
              current_streak: 1,
              longest_streak: 1,
              last_login: todayDate,
            });
          }
        }

        // Award bonus points for streak milestones
        if (bonusPoints > 0) {
          const { data: currentUser } = await supabaseAdmin
            .from('users').select('points').eq('id', user.id).single();
          if (currentUser) {
            await supabaseAdmin.from('users')
              .update({ points: (currentUser.points || 0) + bonusPoints })
              .eq('id', user.id);
          }
        }

        const milestoneDays = [3, 7, 14, 30];
        const nextMilestone = milestoneDays.find(m => m > currentStreak) || 30;

        return new Response(JSON.stringify({ currentStreak, longestStreak, bonusPoints, nextMilestone }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ currentStreak: 1, error: e.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
      // Use client's local date if provided, otherwise fall back to UTC
      const today = localDate || new Date().toISOString().split('T')[0];
      console.log('[daily-challenge] submit - looking for challenge:', challengeId, 'on date:', today);

      // Query prediction_pools using featured_date (Daily Call field)
      // Only poll/predict/vote types are valid Daily Calls
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
        // Use client's local date for streak calculation (consistent with challenge lookup)
        const todayDate = localDate || new Date().toISOString().split('T')[0];
        // Calculate yesterday using UTC-safe arithmetic (avoids timezone-induced off-by-one)
        const yesterdayDate = new Date(new Date(todayDate + 'T12:00:00Z').getTime() - 86400000).toISOString().split('T')[0];
        console.log(`[submit/streak] user=${user.id} todayDate=${todayDate} yesterdayDate=${yesterdayDate}`);
        runInfo = { currentRun: 1, bonusPoints: 0, nextMilestone: 3, longestRun: 1 };
        
        // Get or create streak record using login_streaks table
        const { data: existingStreak, error: streakQueryError } = await supabaseAdmin
          .from('login_streaks')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        // If table doesn't exist, skip streak tracking
        if (streakQueryError && streakQueryError.code === '42P01') {
          console.log('login_streaks table does not exist, skipping streak tracking');
          runInfo = null;
        } else if (existingStreak) {
          // Normalise: last_login may be a full timestamp ("2026-05-07T00:00:00+00:00")
          // or a plain date ("2026-05-07"). Slice to first 10 chars for safe comparison.
          const lastLoginStr = (existingStreak.last_login || '').slice(0, 10);
          console.log(`[submit/streak] comparison: lastLoginStr="${lastLoginStr}" todayDate="${todayDate}" yesterdayDate="${yesterdayDate}" existing_streak=${existingStreak.current_streak}`);
          
          if (lastLoginStr === todayDate) {
            // Already played today - return existing streak info
            console.log(`[submit/streak] already played today → returning existing streak ${existingStreak.current_streak}`);
            runInfo.currentRun = existingStreak.current_streak;
            runInfo.longestRun = existingStreak.longest_streak;
          } else if (lastLoginStr === yesterdayDate) {
            // Consecutive day! Increment streak
            console.log(`[submit/streak] consecutive day → incrementing from ${existingStreak.current_streak}`);
            const newStreak = existingStreak.current_streak + 1;
            const newLongest = Math.max(newStreak, existingStreak.longest_streak);
            
            // Calculate bonus points at milestones
            const milestones = [
              { days: 3, points: 25 },
              { days: 7, points: 75 },
              { days: 14, points: 150 },
              { days: 30, points: 500 }
            ];
            
            const milestone = milestones.find(m => m.days === newStreak);
            const bonusPoints = milestone?.points || 0;
            
            const { error: upErr1 } = await supabaseAdmin
              .from('login_streaks')
              .update({
                current_streak: newStreak,
                longest_streak: newLongest,
                last_login: todayDate,
                play_completed_date: todayDate
              })
              .eq('user_id', user.id);
            if (upErr1) {
              await supabaseAdmin.from('login_streaks').update({
                current_streak: newStreak,
                longest_streak: newLongest,
                last_login: todayDate,
              }).eq('user_id', user.id);
            }
            runInfo.currentRun = newStreak;
            runInfo.longestRun = newLongest;
            runInfo.bonusPoints = bonusPoints;
            pointsEarned += bonusPoints;
          } else {
            // Streak broken - reset to 1
            console.log(`[submit/streak] streak broken (lastLogin="${lastLoginStr}" is not yesterday "${yesterdayDate}") → resetting to 1`);
            const { error: upErr2 } = await supabaseAdmin
              .from('login_streaks')
              .update({
                current_streak: 1,
                last_login: todayDate,
                play_completed_date: todayDate
              })
              .eq('user_id', user.id);
            if (upErr2) {
              await supabaseAdmin.from('login_streaks').update({
                current_streak: 1,
                last_login: todayDate,
              }).eq('user_id', user.id);
            }
            runInfo.currentRun = 1;
            runInfo.longestRun = existingStreak.longest_streak;
          }
        } else if (!streakQueryError || streakQueryError.code === 'PGRST116') {
          // No record found (PGRST116) - first time playing, create record
          const { error: insErr } = await supabaseAdmin
            .from('login_streaks')
            .insert({
              user_id: user.id,
              current_streak: 1,
              longest_streak: 1,
              last_login: todayDate,
              play_completed_date: todayDate
            });
          if (insErr) {
            await supabaseAdmin.from('login_streaks').insert({
              user_id: user.id,
              current_streak: 1,
              longest_streak: 1,
              last_login: todayDate,
            });
          }
        }
        
        // Find next milestone
        if (runInfo) {
          const milestoneDays = [3, 7, 14, 30];
          runInfo.nextMilestone = milestoneDays.find(m => m > runInfo!.currentRun) || 30;
        }
      } catch (streakTrackingError) {
        console.log('Error tracking streak:', streakTrackingError);
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
