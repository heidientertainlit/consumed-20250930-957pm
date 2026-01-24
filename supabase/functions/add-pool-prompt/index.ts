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
    const { pool_id, prompt_text, prompt_type, options, points_value, deadline } = body;

    if (!pool_id) {
      return new Response(JSON.stringify({ error: 'Pool ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!prompt_text || prompt_text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Prompt text is required' }), {
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

    const { data: pool, error: poolError } = await serviceSupabase
      .from('pools')
      .select('id, host_id, status')
      .eq('id', pool_id)
      .single();

    if (poolError || !pool) {
      return new Response(JSON.stringify({ error: 'Pool not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (pool.host_id !== appUser.id) {
      return new Response(JSON.stringify({ error: 'Only the pool host can add prompts' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (pool.status === 'completed') {
      return new Response(JSON.stringify({ error: 'Cannot add prompts to a completed pool' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: prompt, error: promptError } = await serviceSupabase
      .from('pool_prompts')
      .insert({
        pool_id,
        prompt_text: prompt_text.trim(),
        prompt_type: prompt_type || 'prediction',
        options: options || null,
        points_value: points_value || 10,
        deadline: deadline || null,
        created_by: appUser.id,
        status: 'open'
      })
      .select()
      .single();

    if (promptError) {
      console.error('Prompt creation error:', promptError);
      return new Response(JSON.stringify({ error: promptError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      prompt: {
        id: prompt.id,
        pool_id: prompt.pool_id,
        prompt_text: prompt.prompt_text,
        prompt_type: prompt.prompt_type,
        options: prompt.options,
        points_value: prompt.points_value,
        deadline: prompt.deadline,
        status: prompt.status,
        created_at: prompt.created_at
      }
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
