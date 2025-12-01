import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Helper to make REST API calls to Supabase
async function restApiCall(method: string, table: string, data?: Record<string, any>) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method,
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: data ? JSON.stringify(data) : undefined
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`REST API error: ${response.status} - ${error}`);
  }

  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      supabaseUrl, 
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
      // User doesn't exist, create them using REST API
      console.log('Creating new user:', user.email);
      
      const newUserData = {
        id: user.id,
        email: user.email,
        user_name: user.user_metadata?.user_name || user.email.split('@')[0] || 'user',
        display_name: user.user_metadata?.display_name || user.email.split('@')[0] || 'User',
        first_name: user.user_metadata?.first_name || '',
        last_name: user.user_metadata?.last_name || ''
      };

      try {
        const [newUser] = await restApiCall('POST', 'users', newUserData);
        appUser = newUser;
      } catch (createError) {
        console.error('Failed to create user:', createError);
        return new Response(JSON.stringify({ error: 'Failed to create user' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
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
        
        try {
          // Create prediction pool using REST API
          const poolData = {
            id: poolId,
            title: prediction_question.substring(0, 100),
            description: prediction_question,
            type: 'predict',
            status: 'open',
            category: 'movie',
            icon: '🎯',
            options: prediction_options,
            points_reward: 20,
            origin_type: 'user',
            origin_user_id: appUser.id,
            media_external_id: media_external_id || null,
            media_external_source: media_external_source || null,
            likes_count: 0,
            comments_count: 0,
            participants: 0
          };

          await restApiCall('POST', 'prediction_pools', poolData);
          console.log('Prediction pool created:', { poolId });

          // Create associated social post using REST API
          const postData = {
            user_id: appUser.id,
            content: prediction_question,
            post_type: 'predict',
            prediction_pool_id: poolId,
            media_title: prediction_question.substring(0, 100),
            media_type: 'Movie',
            media_external_id: media_external_id || null,
            media_external_source: media_external_source || null,
            visibility,
            contains_spoilers
          };

          const [post] = await restApiCall('POST', 'social_posts', postData);
          console.log('Social post created for prediction:', post);

          return new Response(JSON.stringify({ pool: poolData, post }), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (err) {
          console.error('Prediction creation error:', err);
          return new Response(JSON.stringify({ error: 'Failed to create prediction', details: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Handle polls
      if (type === 'poll' && poll_question && Array.isArray(poll_options) && poll_options.length >= 2) {
        const poolId = crypto.randomUUID();
        
        try {
          // Create poll pool using REST API
          const poolData = {
            id: poolId,
            title: poll_question.substring(0, 100),
            description: poll_question,
            type: 'vote',
            status: 'open',
            category: 'movie',
            icon: '🗳️',
            options: poll_options,
            points_reward: 10,
            origin_type: 'user',
            origin_user_id: appUser.id,
            media_external_id: media_external_id || null,
            media_external_source: media_external_source || null,
            likes_count: 0,
            comments_count: 0,
            participants: 0
          };

          await restApiCall('POST', 'prediction_pools', poolData);
          console.log('Poll pool created:', { poolId });

          // Create associated social post using REST API
          const postData = {
            user_id: appUser.id,
            content: poll_question,
            post_type: 'poll',
            prediction_pool_id: poolId,
            media_title: poll_question.substring(0, 100),
            media_type: 'Movie',
            media_external_id: media_external_id || null,
            media_external_source: media_external_source || null,
            visibility,
            contains_spoilers
          };

          const [post] = await restApiCall('POST', 'social_posts', postData);
          console.log('Social post created for poll:', post);

          return new Response(JSON.stringify({ pool: poolData, post }), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (err) {
          console.error('Poll creation error:', err);
          return new Response(JSON.stringify({ error: 'Failed to create poll', details: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Handle all other post types (thought, rate-review, add-media)
      try {
        const postData = {
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
        };

        const [post] = await restApiCall('POST', 'social_posts', postData);
        console.log('Post created:', post);

        return new Response(JSON.stringify(post), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        console.error('Post creation error:', err);
        return new Response(JSON.stringify({ error: 'Failed to create post', details: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
