import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'OPTIONS, POST'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { prompt_id, correct_answer } = body;

    if (!prompt_id) {
      return new Response(JSON.stringify({ error: 'Prompt ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!correct_answer || correct_answer.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Correct answer is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: appUser } = await serviceSupabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .single();

    if (!appUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: prompt, error: promptError } = await serviceSupabase
      .from('pool_prompts')
      .select('id, pool_id, points_value, status')
      .eq('id', prompt_id)
      .single();

    if (promptError || !prompt) {
      return new Response(JSON.stringify({ error: 'Prompt not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: pool } = await serviceSupabase
      .from('pools')
      .select('host_id')
      .eq('id', prompt.pool_id)
      .single();

    if (!pool || pool.host_id !== appUser.id) {
      return new Response(JSON.stringify({ error: 'Only the pool host can resolve prompts' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (prompt.status === 'resolved') {
      return new Response(JSON.stringify({ error: 'This prompt has already been resolved' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { error: updatePromptError } = await serviceSupabase
      .from('pool_prompts')
      .update({
        correct_answer: correct_answer.trim(),
        status: 'resolved',
        resolved_at: new Date().toISOString()
      })
      .eq('id', prompt_id);

    if (updatePromptError) {
      return new Response(JSON.stringify({ error: updatePromptError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: answers } = await serviceSupabase
      .from('pool_answers')
      .select('id, user_id, answer')
      .eq('prompt_id', prompt_id);

    const normalizedCorrect = correct_answer.trim().toLowerCase();
    let winnersCount = 0;

    if (answers && answers.length > 0) {
      for (const ans of answers) {
        const isCorrect = ans.answer.trim().toLowerCase() === normalizedCorrect;
        const pointsEarned = isCorrect ? prompt.points_value : 0;

        await serviceSupabase
          .from('pool_answers')
          .update({
            is_correct: isCorrect,
            points_earned: pointsEarned
          })
          .eq('id', ans.id);

        if (isCorrect) {
          winnersCount++;

          await serviceSupabase.rpc('increment_pool_member_points', {
            p_pool_id: prompt.pool_id,
            p_user_id: ans.user_id,
            p_points: pointsEarned
          }).catch(() => {
            serviceSupabase
              .from('pool_members')
              .update({ total_points: serviceSupabase.rpc('add', { x: prompt.points_value }) })
              .eq('pool_id', prompt.pool_id)
              .eq('user_id', ans.user_id);
          });

          await serviceSupabase
            .from('users')
            .update({ points: serviceSupabase.rpc('add', { x: pointsEarned }) })
            .eq('id', ans.user_id)
            .catch(() => {});
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      correct_answer: correct_answer.trim(),
      total_answers: answers?.length || 0,
      winners_count: winnersCount,
      points_awarded: winnersCount * prompt.points_value
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
