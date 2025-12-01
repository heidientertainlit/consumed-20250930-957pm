import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

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
        content,
        type,
        visibility = 'public',
        contains_spoilers = false,
        rating,
        media_title,
        media_type,
        media_creator,
        media_image_url,
        media_external_id,
        media_external_source,
        prediction_question,
        prediction_options,
        poll_question,
        poll_options
      } = body;

      console.log('Inline post type:', type);
      console.log('User:', appUser.id);

      // Handle predictions
      if (type === 'prediction' && prediction_question && Array.isArray(prediction_options) && prediction_options.length >= 2) {
        const poolId = crypto.randomUUID();
        // Use admin client to bypass RLS for user-created predictions
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        // Use direct SQL connection to bypass schema cache
        const dbUrl = Deno.env.get('DATABASE_URL');
        const client = new Client(dbUrl);
        
        try {
          await client.connect();
          
          // Insert prediction pool
          await client.queryArray(
            `INSERT INTO prediction_pools (
              id, title, description, type, status, category, icon, options, 
              points_reward, origin_type, origin_user_id, media_external_id, 
              media_external_source, likes_count, comments_count, participants
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
            )`,
            [
              poolId,
              prediction_question.substring(0, 100),
              prediction_question,
              'predict',
              'open',
              'movie',
              '🎯',
              prediction_options,
              20,
              'user',
              appUser.id,
              media_external_id || null,
              media_external_source || null,
              0,
              0,
              0
            ]
          );

          console.log('Prediction pool created:', { poolId });

          // Insert social post
          await client.queryArray(
            `INSERT INTO social_posts (
              user_id, content, post_type, prediction_pool_id, media_title, media_type,
              media_external_id, media_external_source, visibility, contains_spoilers
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
            )`,
            [
              appUser.id,
              prediction_question,
              'predict',
              poolId,
              prediction_question.substring(0, 100),
              'Movie',
              media_external_id || null,
              media_external_source || null,
              visibility,
              contains_spoilers
            ]
          );
          
          console.log('Social post created for prediction');
        } catch (err) {
          console.error('Database error:', err);
          return new Response(JSON.stringify({ error: 'Failed to create prediction', details: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } finally {
          await client.end();
        }
        
        const post = { prediction_pool_id: poolId };

        return new Response(JSON.stringify({ pool, post }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle polls
      if (type === 'poll' && poll_question && Array.isArray(poll_options) && poll_options.length >= 2) {
        const poolId = crypto.randomUUID();
        // Use admin client to bypass RLS for user-created polls
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        // Use direct SQL connection to bypass schema cache
        const dbUrl = Deno.env.get('DATABASE_URL');
        const client = new Client(dbUrl);
        
        try {
          await client.connect();
          
          // Insert poll pool
          await client.queryArray(
            `INSERT INTO prediction_pools (
              id, title, description, type, status, category, icon, options, 
              points_reward, origin_type, origin_user_id, media_external_id, 
              media_external_source, likes_count, comments_count, participants
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
            )`,
            [
              poolId,
              poll_question.substring(0, 100),
              poll_question,
              'vote',
              'open',
              'movie',
              '🗳️',
              poll_options,
              10,
              'user',
              appUser.id,
              media_external_id || null,
              media_external_source || null,
              0,
              0,
              0
            ]
          );

          console.log('Poll pool created:', { poolId });

          // Insert social post
          await client.queryArray(
            `INSERT INTO social_posts (
              user_id, content, post_type, prediction_pool_id, media_title, media_type,
              media_external_id, media_external_source, visibility, contains_spoilers
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
            )`,
            [
              appUser.id,
              poll_question,
              'poll',
              poolId,
              poll_question.substring(0, 100),
              'Movie',
              media_external_id || null,
              media_external_source || null,
              visibility,
              contains_spoilers
            ]
          );
          
          console.log('Social post created for poll');
        } catch (err) {
          console.error('Database error:', err);
          return new Response(JSON.stringify({ error: 'Failed to create poll', details: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } finally {
          await client.end();
        }
        
        const post = { prediction_pool_id: poolId };

        return new Response(JSON.stringify({ pool, post }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle all other post types (thought, rate-review, add-media)
      const { data: post, error: postError } = await supabase
        .from('social_posts')
        .insert({
          user_id: appUser.id,
          content,
          post_type: type || 'update',
          rating: rating || null,
          media_title: media_title || null,
          media_type: media_type || null,
          media_creator: media_creator || null,
          image_url: media_image_url || null,
          media_external_id: media_external_id || null,
          media_external_source: media_external_source || null,
          visibility,
          contains_spoilers
        })
        .select()
        .single();

      if (postError) {
        console.error('Post creation error:', postError);
        return new Response(JSON.stringify({ error: postError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(post), {
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
