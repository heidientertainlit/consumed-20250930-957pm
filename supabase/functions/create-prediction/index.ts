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

    console.log('DEBUG: create-prediction input:', { question, invited_user_id, option_1_label, option_2_label });

    if (!question || !option_1_label || !option_2_label) {
      return new Response(JSON.stringify({ 
        error: 'question, option_1_label, and option_2_label are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify invited user exists if provided (but don't fail if they don't - make it optional)
    let invitedUser = null;
    if (invited_user_id) {
      const { data: user, error: invitedUserError } = await supabase
        .from('users')
        .select('id, user_name')
        .eq('id', invited_user_id)
        .single();

      if (invitedUserError) {
        console.warn('Invited user not found:', invitedUserError);
        // Don't fail - just proceed without invited user
      } else if (user) {
        invitedUser = user;
        console.log('Invited user found:', user.user_name);
      }
    }

    // Use admin client to create prediction
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('DEBUG: Admin client init - URL exists:', !!supabaseUrl, 'Key exists:', !!serviceRoleKey);
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('ERROR: Missing environment variables for admin client');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Generate pool ID
    const poolId = `user-${appUser.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    console.log('DEBUG: Creating pool with ID:', poolId);

    const insertData = {
      id: poolId,
      title: question,
      description: question,
      type: 'predict',
      status: 'open',
      category: 'user-prediction',
      icon: '🎯',
      points_reward: points_reward,
      options: [option_1_label, option_2_label],
      origin_type: 'user',
      origin_user_id: appUser.id,
      invited_user_id: invited_user_id || null,
      media_external_id: media_external_id || null,
      media_external_source: media_external_source || null,
      deadline: null,
      likes_count: 0,
      comments_count: 0,
      participants: 0,
      created_at: new Date().toISOString()
    };

    console.log('DEBUG: Insert data:', JSON.stringify(insertData));

    // Create prediction pool with explicit select to confirm insert
    const { data: pool, error: poolError } = await supabaseAdmin
      .from('prediction_pools')
      .insert(insertData)
      .select('id, title, origin_type, origin_user_id');

    if (poolError) {
      console.error('ERROR: Failed to insert prediction pool');
      console.error('Error code:', poolError.code);
      console.error('Error message:', poolError.message);
      console.error('Error full:', JSON.stringify(poolError));
      return new Response(JSON.stringify({ error: poolError.message, code: poolError.code }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!pool) {
      console.error('ERROR: No data returned after insert - possible RLS or trigger issue');
      return new Response(JSON.stringify({ error: 'Insert failed - no confirmation' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('SUCCESS: Pool created in database:', JSON.stringify(pool));

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
