import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

    // Get or create app user
    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, email, user_name')
      .eq('email', user.email)
      .single();

    if (appUserError && appUserError.code === 'PGRST116') {
      // User doesn't exist, create them
      console.log('Creating new user:', user.email);
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          user_name: user.user_metadata?.user_name || user.email.split('@')[0] || 'user',
          display_name: user.user_metadata?.display_name || user.email.split('@')[0] || 'User',
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || ''
        })
        .select('id, email, user_name')
        .single();

      if (createError) {
        console.error('Failed to create user:', createError);
        return new Response(JSON.stringify({ error: 'Failed to create user' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      appUser = newUser;
    } else if (appUserError) {
      console.error('App user error:', appUserError);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      let body;
      try {
        body = await req.json();
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        return new Response(JSON.stringify({ error: 'Invalid request body' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const {
        question,
        options,
        visibility = 'public',
        contains_spoilers = false,
        media_title = null,
        media_type = null,
        media_external_id = null,
        media_external_source = null,
        media_image_url = null
      } = body;

      console.log('Creating poll:', { question, options, media_title, media_external_id });

      // Validate inputs
      if (!question || !Array.isArray(options) || options.length < 2) {
        console.error('Invalid poll input:', { question, options });
        return new Response(JSON.stringify({ error: 'Question and at least 2 options required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Use admin client for inserts to bypass RLS
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const poolId = crypto.randomUUID();
      console.log('Creating pool with id:', poolId);
      
      const { data: pool, error: poolError } = await supabaseAdmin
        .from('prediction_pools')
        .insert({
          id: poolId,
          title: question.substring(0, 100),
          description: question,
          type: 'vote',
          status: 'open',
          category: 'movie',
          icon: '🗳️',
          options: options,
          points_reward: 10,
          origin_type: 'user',
          origin_user_id: appUser.id,
          media_external_id: media_external_id,
          media_external_source: media_external_source,
          media_title: media_title,
          likes_count: 0,
          comments_count: 0,
          participants: 0
        })
        .select()
        .single();

      if (poolError) {
        console.error('Poll pool creation error:', JSON.stringify(poolError));
        return new Response(JSON.stringify({ error: 'Failed to create poll', details: poolError }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Pool created successfully:', pool.id);

      // Create associated social post
      const { data: post, error: postError } = await supabaseAdmin
        .from('social_posts')
        .insert({
          user_id: appUser.id,
          content: question,
          post_type: 'poll',
          prediction_pool_id: pool.id,
          media_title: media_title || null,
          media_type: media_type || null,
          media_external_id: media_external_id,
          media_external_source: media_external_source,
          image_url: media_image_url,
          visibility,
          contains_spoilers
        })
        .select()
        .single();

      if (postError) {
        console.error('Social post creation error:', JSON.stringify(postError));
        return new Response(JSON.stringify({ error: 'Failed to create social post', details: postError }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Social post created successfully:', post.id);

      return new Response(JSON.stringify({ success: true, pool, post }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
