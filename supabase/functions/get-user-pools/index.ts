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

    const { data: memberships } = await serviceSupabase
      .from('pool_members')
      .select(`
        pool_id,
        role,
        total_points,
        joined_at,
        pools:pool_id (
          id,
          name,
          description,
          host_id,
          invite_code,
          status,
          deadline,
          category,
          is_public,
          created_at
        )
      `)
      .eq('user_id', appUser.id)
      .order('joined_at', { ascending: false });

    const poolsWithDetails = await Promise.all((memberships || []).map(async (m) => {
      const pool = m.pools;
      if (!pool) return null;

      const { count: memberCount } = await serviceSupabase
        .from('pool_members')
        .select('*', { count: 'exact', head: true })
        .eq('pool_id', pool.id);

      const { count: promptCount } = await serviceSupabase
        .from('pool_prompts')
        .select('*', { count: 'exact', head: true })
        .eq('pool_id', pool.id);

      const { count: resolvedCount } = await serviceSupabase
        .from('pool_prompts')
        .select('*', { count: 'exact', head: true })
        .eq('pool_id', pool.id)
        .eq('status', 'resolved');

      const { data: hostUser } = await serviceSupabase
        .from('users')
        .select('user_name, display_name, avatar_url')
        .eq('id', pool.host_id)
        .single();

      return {
        ...pool,
        role: m.role,
        user_points: m.total_points,
        member_count: memberCount || 0,
        prompt_count: promptCount || 0,
        resolved_count: resolvedCount || 0,
        host: hostUser,
        is_host: pool.host_id === appUser.id
      };
    }));

    const validPools = poolsWithDetails.filter(p => p !== null);

    return new Response(JSON.stringify({
      pools: validPools,
      total: validPools.length
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
