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
    // Get auth token from header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No auth header');
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_ANON_KEY') ?? '', 
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('Auth check:', { user_id: user?.id, userError });
    
    if (userError || !user) {
      console.error('Auth failed:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: ' + (userError?.message || 'No user') }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse body
    const body = await req.json();
    const { question, options } = body;
    console.log('Input:', { question, options });
    
    const filledOptions = options && Array.isArray(options) ? options.filter((o: string) => o && o.trim()) : ['Yes', 'No'];
    console.log('Processed options:', filledOptions);

    if (!question) {
      console.error('No question provided');
      return new Response(JSON.stringify({ error: 'Question is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (filledOptions.length < 2) {
      console.error('Not enough options:', filledOptions.length);
      return new Response(JSON.stringify({ error: 'At least 2 options required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create poll
    const poolId = crypto.randomUUID();
    console.log('Creating pool:', poolId);
    
    const { data: pool, error: poolError } = await supabase
      .from('prediction_pools')
      .insert({
        id: poolId,
        title: question.substring(0, 100),
        description: question,
        type: 'vote',
        status: 'open',
        category: 'movie',
        icon: '🗳️',
        points_reward: 10,
        options: filledOptions,
        origin_type: 'user',
        origin_user_id: user.id,
        likes_count: 0,
        comments_count: 0,
        participants: 0
      })
      .select()
      .single();

    if (poolError) {
      console.error('Pool insert error:', poolError);
      return new Response(JSON.stringify({ error: 'Pool creation failed: ' + poolError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Pool created:', pool?.id);

    // Create social post
    const { data: post, error: postError } = await supabase
      .from('social_posts')
      .insert({
        user_id: user.id,
        content: question,
        post_type: 'poll',
        prediction_pool_id: pool.id,
        media_title: question.substring(0, 100),
        media_type: 'Movie',
        contains_spoilers: false
      })
      .select()
      .single();

    if (postError) {
      console.error('Post insert error:', postError);
      return new Response(JSON.stringify({ error: 'Post creation failed: ' + postError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Post created:', post?.id);

    return new Response(JSON.stringify({ success: true, pool, post }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Exception:', error);
    return new Response(JSON.stringify({ error: 'Server error: ' + error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
