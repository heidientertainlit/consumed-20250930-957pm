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
      options,
      poll_type = "yes-no",
      type = "predict",
      invited_user_id,
      option_1_label,
      option_2_label,
      media_external_id,
      media_external_source,
      deadline,
      points_reward = 20
    } = await req.json();

    console.log('DEBUG: create-prediction input:', { question, options, poll_type, type });

    // Support both new format (options array) and old format (option_1_label, option_2_label)
    let finalOptions: string[] = [];
    if (options && Array.isArray(options) && options.length > 0) {
      finalOptions = options;
    } else if (option_1_label && option_2_label) {
      finalOptions = [option_1_label, option_2_label];
    } else {
      return new Response(JSON.stringify({ 
        error: 'Either options array or (option_1_label and option_2_label) are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!question || finalOptions.length < 2) {
      return new Response(JSON.stringify({ 
        error: 'question and at least 2 options are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate pool ID
    const poolId = `user-${appUser.id}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    console.log('DEBUG: Creating pool with ID:', poolId);

    // Use admin client with explicit RLS bypass
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      }
    );

    // Insert directly without modifiers first
    console.log('DEBUG: Attempting insert for ID:', poolId);
    
    // Determine icon and category based on type
    let icon = '🎯';
    let category = 'user-prediction';
    if (type === 'vote') {
      icon = '🗳️';
      category = 'user-poll';
    }

    const { error: poolError, status: insertStatus } = await supabaseAdmin
      .from('prediction_pools')
      .insert({
        id: poolId,
        title: question,
        description: question,
        type: type,
        status: 'open',
        category: category,
        icon: icon,
        points_reward: points_reward,
        options: finalOptions,
        origin_type: 'user',
        origin_user_id: appUser.id,
        invited_user_id: invited_user_id || null,
        media_external_id: media_external_id || null,
        media_external_source: media_external_source || null,
        deadline: null,
        likes_count: 0,
        comments_count: 0,
        participants: 0
      });

    if (poolError) {
      console.error('ERROR: Insert failed');
      console.error('Status:', insertStatus);
      console.error('Error:', JSON.stringify(poolError));
      return new Response(JSON.stringify({ error: poolError.message, code: poolError.code }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('DEBUG: Insert returned status:', insertStatus);

    // Now select to confirm it's there
    const { data: confirmData, error: confirmError } = await supabaseAdmin
      .from('prediction_pools')
      .select('id, title, origin_type')
      .eq('id', poolId)
      .single();

    if (confirmError) {
      console.error('ERROR: Could not confirm insert');
      console.error('Confirm error:', JSON.stringify(confirmError));
      return new Response(JSON.stringify({ error: 'Insert confirmed but select failed', details: confirmError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('SUCCESS: Pool confirmed in database:', JSON.stringify(confirmData));

    return new Response(JSON.stringify({ 
      success: true,
      pool: confirmData
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
