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

    if (action === 'getToday') {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: challenge, error } = await supabaseAdmin
        .from('daily_challenges')
        .select('id, scheduled_date, challenge_type, title, description, options, points_reward, status, category, icon, created_at')
        .eq('scheduled_date', today)
        .single();

      if (error) {
        return new Response(JSON.stringify({ challenge: null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ challenge }), {
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
        .from('daily_challenge_responses')
        .select('*')
        .eq('challenge_id', challengeId)
        .eq('user_id', user.id)
        .single();

      return new Response(JSON.stringify({ 
        hasResponded: !!response && !error,
        response: response 
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

      const { data: challenge, error: challengeError } = await supabaseAdmin
        .from('daily_challenges')
        .select('*')
        .eq('id', challengeId)
        .eq('scheduled_date', today)
        .single();

      if (challengeError || !challenge) {
        return new Response(JSON.stringify({ error: 'Challenge not available or not for today' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let pointsEarned = 0;
      let isCorrect = false;

      if (challenge.challenge_type === 'trivia' && challenge.correct_answer) {
        isCorrect = response.answer === challenge.correct_answer;
        pointsEarned = isCorrect ? challenge.points_reward : 0;
      } else {
        pointsEarned = challenge.points_reward;
      }

      const { error: insertError } = await supabaseAdmin
        .from('daily_challenge_responses')
        .insert({
          challenge_id: challengeId,
          user_id: user.id,
          response: response,
          points_earned: pointsEarned
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
        correctAnswer: challenge.challenge_type === 'trivia' ? challenge.correct_answer : null
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
