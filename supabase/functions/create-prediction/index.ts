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
      console.error('Auth error:', userError);
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
      console.error('App user error:', appUserError);
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    console.log('DEBUG: Received body:', JSON.stringify(body));
    
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
    } = body;

    // Support both new format (options array) and old format (option_1_label, option_2_label)
    let finalOptions: string[] = [];
    if (options && Array.isArray(options) && options.length > 0) {
      finalOptions = options.filter((o: string) => o && o.trim());
    } else if (option_1_label && option_2_label) {
      finalOptions = [option_1_label, option_2_label];
    }

    // For yes-no polls, provide default options
    if (poll_type === 'yes-no' && finalOptions.length === 0) {
      finalOptions = ['Yes', 'No'];
    }

    console.log('DEBUG: Final options:', finalOptions);

    if (!question) {
      return new Response(JSON.stringify({ error: 'Question is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (finalOptions.length < 2) {
      return new Response(JSON.stringify({ error: 'At least 2 options are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use database-compatible type values: 'vote' for polls, 'predict' for predictions
    const isPoll = type === 'vote';
    const poolType = isPoll ? 'vote' : 'predict';
    const poolCategory = 'movie'; // Use a valid existing category
    const poolIcon = isPoll ? '🗳️' : '🎯';
    const poolPoints = isPoll ? 10 : points_reward;

    // Generate a unique ID for the pool
    const poolId = crypto.randomUUID();
    
    console.log('DEBUG: Creating pool with id:', poolId, 'type:', poolType, 'category:', poolCategory);

    // Insert into prediction_pools with CORRECT values matching existing data
    const { data: pool, error: poolError } = await supabase
      .from('prediction_pools')
      .insert({
        id: poolId,
        title: question.substring(0, 100),
        description: question,
        type: poolType,
        status: 'open',
        category: poolCategory,
        icon: poolIcon,
        points_reward: poolPoints,
        options: finalOptions,
        origin_type: 'user',
        origin_user_id: appUser.id,
        invited_user_id: invited_user_id || null,
        media_external_id: media_external_id || null,
        media_external_source: media_external_source || null,
        deadline: deadline || null,
        likes_count: 0,
        comments_count: 0,
        participants: 0
      })
      .select()
      .single();

    if (poolError) {
      console.error('ERROR: Pool creation failed:', JSON.stringify(poolError));
      return new Response(JSON.stringify({ error: poolError.message || 'Failed to create pool', details: poolError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('SUCCESS: Pool created:', pool.id);

    // Create associated social post with CORRECT values matching existing data
    // post_type should be 'post' and media_type should be a real media type like 'Movie'
    const { data: post, error: postError } = await supabase
      .from('social_posts')
      .insert({
        user_id: appUser.id,
        content: question,
        post_type: 'post',
        prediction_pool_id: pool.id,
        media_title: question.substring(0, 100),
        media_type: 'Movie',
        media_external_id: media_external_id || null,
        media_external_source: media_external_source || null,
        contains_spoilers: false
      })
      .select()
      .single();

    if (postError) {
      console.error('ERROR: Social post creation failed:', JSON.stringify(postError));
      return new Response(JSON.stringify({ error: 'Pool created but social post failed: ' + postError.message, details: postError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('SUCCESS: Social post created:', post.id);

    return new Response(JSON.stringify({ 
      success: true,
      pool,
      post
    }), {
      status: 201,
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
