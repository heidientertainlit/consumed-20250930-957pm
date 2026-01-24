import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'OPTIONS, GET, POST'
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

    const url = new URL(req.url);
    let poolId = url.searchParams.get('pool_id');

    if (!poolId && req.method === 'POST') {
      const body = await req.json();
      poolId = body.pool_id;
    }

    if (!poolId) {
      return new Response(JSON.stringify({ error: 'Pool ID is required' }), {
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
      .select('*')
      .eq('id', poolId)
      .single();

    if (poolError || !pool) {
      return new Response(JSON.stringify({ error: 'Pool not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: membership } = await serviceSupabase
      .from('pool_members')
      .select('role')
      .eq('pool_id', poolId)
      .eq('user_id', appUser.id)
      .single();

    const isHost = pool.host_id === appUser.id;
    const isMember = !!membership;

    if (!pool.is_public && !isMember) {
      return new Response(JSON.stringify({ error: 'You do not have access to this pool' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: members } = await serviceSupabase
      .from('pool_members')
      .select(`
        user_id,
        role,
        total_points,
        joined_at,
        users:user_id (
          id,
          user_name,
          display_name,
          avatar_url
        )
      `)
      .eq('pool_id', poolId)
      .order('total_points', { ascending: false });

    const { data: prompts } = await serviceSupabase
      .from('pool_prompts')
      .select('*')
      .eq('pool_id', poolId)
      .order('order', { ascending: true });

    let userAnswers: Record<string, any> = {};
    if (isMember && prompts) {
      const { data: answers } = await serviceSupabase
        .from('pool_answers')
        .select('prompt_id, answer, is_correct, points_earned, submitted_at')
        .eq('user_id', appUser.id)
        .in('prompt_id', prompts.map(p => p.id));

      if (answers) {
        userAnswers = answers.reduce((acc, ans) => {
          acc[ans.prompt_id] = ans;
          return acc;
        }, {} as Record<string, any>);
      }
    }

    const promptsWithAnswers = prompts?.map(p => ({
      ...p,
      user_answer: userAnswers[p.id] || null
    })) || [];

    const { data: hostUser } = await serviceSupabase
      .from('users')
      .select('id, user_name, display_name, avatar_url')
      .eq('id', pool.host_id)
      .single();

    return new Response(JSON.stringify({
      pool: {
        ...pool,
        host: hostUser
      },
      prompts: promptsWithAnswers,
      members: members || [],
      user_role: membership?.role || null,
      is_host: isHost,
      is_member: isMember
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
