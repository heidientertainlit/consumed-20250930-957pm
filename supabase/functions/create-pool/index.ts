import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'OPTIONS, POST'
};

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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
    const { name, description, category, deadline, points_per_correct, is_public } = body;

    if (!name || name.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Pool name is required' }), {
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

    let pool = null;
    let poolError = null;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const inviteCode = generateInviteCode();
      const result = await serviceSupabase
        .from('pools')
        .insert({
          name: name.trim(),
          description: description?.trim() || null,
          host_id: appUser.id,
          invite_code: inviteCode,
          category: category || 'custom',
          deadline: deadline || null,
          points_per_correct: points_per_correct || 10,
          is_public: is_public || false,
          status: 'open'
        })
        .select()
        .single();

      if (result.error?.code === '23505') {
        attempts++;
        continue;
      }
      
      pool = result.data;
      poolError = result.error;
      break;
    }

    if (poolError || !pool) {
      console.error('Pool creation error:', poolError);
      return new Response(JSON.stringify({ error: poolError?.message || 'Failed to create pool after multiple attempts' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { error: memberError } = await serviceSupabase
      .from('pool_members')
      .insert({
        pool_id: pool.id,
        user_id: appUser.id,
        role: 'host',
        total_points: 0
      });

    if (memberError) {
      console.error('Member creation error:', memberError);
    }

    return new Response(JSON.stringify({
      success: true,
      pool: {
        id: pool.id,
        name: pool.name,
        description: pool.description,
        invite_code: pool.invite_code,
        status: pool.status,
        category: pool.category,
        deadline: pool.deadline,
        points_per_correct: pool.points_per_correct,
        is_public: pool.is_public,
        created_at: pool.created_at
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
