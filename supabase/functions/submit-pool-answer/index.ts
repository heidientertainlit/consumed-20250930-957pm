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
    const { prompt_id, answer } = body;

    if (!prompt_id) {
      return new Response(JSON.stringify({ error: 'Prompt ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!answer || answer.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Answer is required' }), {
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
      .select('id, pool_id, status, deadline')
      .eq('id', prompt_id)
      .single();

    if (promptError || !prompt) {
      return new Response(JSON.stringify({ error: 'Prompt not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (prompt.status !== 'open') {
      return new Response(JSON.stringify({ error: 'This prompt is no longer accepting answers' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (prompt.deadline && new Date(prompt.deadline) < new Date()) {
      return new Response(JSON.stringify({ error: 'The deadline for this prompt has passed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: membership } = await serviceSupabase
      .from('pool_members')
      .select('id')
      .eq('pool_id', prompt.pool_id)
      .eq('user_id', appUser.id)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'You must join this pool to submit answers' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: existingAnswer } = await serviceSupabase
      .from('pool_answers')
      .select('id')
      .eq('prompt_id', prompt_id)
      .eq('user_id', appUser.id)
      .single();

    if (existingAnswer) {
      const { data: updatedAnswer, error: updateError } = await serviceSupabase
        .from('pool_answers')
        .update({ answer: answer.trim(), submitted_at: new Date().toISOString() })
        .eq('id', existingAnswer.id)
        .select()
        .single();

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        updated: true,
        answer: updatedAnswer
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: newAnswer, error: answerError } = await serviceSupabase
      .from('pool_answers')
      .insert({
        prompt_id,
        user_id: appUser.id,
        answer: answer.trim()
      })
      .select()
      .single();

    if (answerError) {
      console.error('Answer submission error:', answerError);
      return new Response(JSON.stringify({ error: answerError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      answer: newAnswer
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
