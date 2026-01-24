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
    const { invite_code } = body;

    if (!invite_code || invite_code.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Invite code is required' }), {
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
      .eq('invite_code', invite_code.toUpperCase().trim())
      .single();

    if (poolError || !pool) {
      return new Response(JSON.stringify({ error: 'Pool not found. Check your invite code.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (pool.status === 'completed') {
      return new Response(JSON.stringify({ error: 'This pool has already ended' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: existingMember } = await serviceSupabase
      .from('pool_members')
      .select('id')
      .eq('pool_id', pool.id)
      .eq('user_id', appUser.id)
      .single();

    if (existingMember) {
      return new Response(JSON.stringify({
        success: true,
        already_member: true,
        pool: {
          id: pool.id,
          name: pool.name,
          description: pool.description,
          status: pool.status
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { error: memberError } = await serviceSupabase
      .from('pool_members')
      .insert({
        pool_id: pool.id,
        user_id: appUser.id,
        role: 'member',
        total_points: 0
      });

    if (memberError) {
      console.error('Member creation error:', memberError);
      return new Response(JSON.stringify({ error: memberError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (pool.list_id) {
      const { data: existingCollab } = await serviceSupabase
        .from('list_collaborators')
        .select('id')
        .eq('list_id', pool.list_id)
        .eq('user_id', appUser.id)
        .single();

      if (!existingCollab) {
        await serviceSupabase
          .from('list_collaborators')
          .insert({
            list_id: pool.list_id,
            user_id: appUser.id,
            role: 'editor'
          });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      pool: {
        id: pool.id,
        name: pool.name,
        description: pool.description,
        status: pool.status,
        category: pool.category
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
