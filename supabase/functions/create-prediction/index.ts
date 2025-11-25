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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_ANON_KEY') ?? '', 
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') }
        }
      }
    );

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Look up app user by email
    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, user_name')
      .eq('email', user.email)
      .single();

    if (appUserError || !appUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { 
      question,
      invited_user_id,
      option_1_label,
      option_2_label,
      media_external_id,
      media_external_source,
      deadline,
      points_reward = 20
    } = await req.json();

    if (!question || !invited_user_id || !option_1_label || !option_2_label) {
      return new Response(JSON.stringify({ 
        error: 'question, invited_user_id, option_1_label, and option_2_label are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify invited user exists
    const { data: invitedUser, error: invitedUserError } = await supabase
      .from('users')
      .select('id, user_name')
      .eq('id', invited_user_id)
      .single();

    if (invitedUserError || !invitedUser) {
      return new Response(JSON.stringify({ error: 'Invited user not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use admin client to create prediction
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Generate pool ID
    const poolId = `user-${appUser.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Create prediction pool
    const { data: pool, error: poolError } = await supabaseAdmin
      .from('prediction_pools')
      .insert({
        id: poolId,
        title: question,
        description: '',
        type: 'predict',
        status: 'open',
        category: 'user-prediction',
        icon: '🎯',
        points_reward: points_reward,
        options: [option_1_label, option_2_label],
        origin_type: 'user',
        origin_user_id: appUser.id,
        invited_user_id: invited_user_id,
        media_external_id: media_external_id || null,
        media_external_source: media_external_source || null,
        deadline: deadline || null,
        likes_count: 0,
        comments_count: 0,
        participants: 0,
        created_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (poolError) {
      console.error('Error creating prediction pool:', poolError);
      return new Response(JSON.stringify({ error: poolError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      pool: pool
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Create prediction error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
