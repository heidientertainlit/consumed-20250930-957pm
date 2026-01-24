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

    const { data: pool } = await serviceSupabase
      .from('pools')
      .select('id, name, is_public')
      .eq('id', poolId)
      .single();

    if (!pool) {
      return new Response(JSON.stringify({ error: 'Pool not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: membership } = await serviceSupabase
      .from('pool_members')
      .select('id')
      .eq('pool_id', poolId)
      .eq('user_id', appUser.id)
      .single();

    if (!pool.is_public && !membership) {
      return new Response(JSON.stringify({ error: 'You do not have access to this pool' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: leaderboard } = await serviceSupabase
      .from('pool_members')
      .select(`
        user_id,
        total_points,
        role,
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

    const rankedLeaderboard = leaderboard?.map((entry, index) => ({
      rank: index + 1,
      user_id: entry.user_id,
      username: entry.users?.user_name || 'Unknown',
      display_name: entry.users?.display_name || entry.users?.user_name || 'Unknown',
      avatar_url: entry.users?.avatar_url,
      total_points: entry.total_points,
      role: entry.role,
      is_current_user: entry.user_id === appUser.id
    })) || [];

    const currentUserRank = rankedLeaderboard.find(e => e.is_current_user);

    return new Response(JSON.stringify({
      pool_id: poolId,
      pool_name: pool.name,
      leaderboard: rankedLeaderboard,
      current_user_rank: currentUserRank?.rank || null,
      current_user_points: currentUserRank?.total_points || 0,
      total_participants: rankedLeaderboard.length
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
