import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Helper function to fetch image URL from TMDB when not provided by client
async function fetchTmdbPosterUrl(externalId: string | null, externalSource: string | null): Promise<string | null> {
  if (!externalId || externalSource !== 'tmdb') return null;
  
  const tmdbApiKey = Deno.env.get('TMDB_API_KEY');
  if (!tmdbApiKey) return null;
  
  try {
    // Try as movie first
    let response = await fetch(`https://api.themoviedb.org/3/movie/${externalId}?api_key=${tmdbApiKey}`);
    if (response.ok) {
      const data = await response.json();
      if (data.poster_path) {
        return `https://image.tmdb.org/t/p/w300${data.poster_path}`;
      }
    }
    
    // Try as TV show
    response = await fetch(`https://api.themoviedb.org/3/tv/${externalId}?api_key=${tmdbApiKey}`);
    if (response.ok) {
      const data = await response.json();
      if (data.poster_path) {
        return `https://image.tmdb.org/t/p/w300${data.poster_path}`;
      }
    }
  } catch (error) {
    console.error('Error fetching TMDB poster:', error);
  }
  
  return null;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Validate that service key is available
if (!supabaseServiceKey) {
  console.error('CRITICAL: SUPABASE_SERVICE_ROLE_KEY is not set!');
}

// Create admin client with service role key for database operations
const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

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
      // User doesn't exist, create them using admin client
      console.log('Creating new user:', user.email);
      
      const newUserData = {
        id: user.id,
        email: user.email,
        user_name: user.user_metadata?.user_name || user.email.split('@')[0] || 'user',
        display_name: user.user_metadata?.display_name || user.email.split('@')[0] || 'User',
        first_name: user.user_metadata?.first_name || '',
        last_name: user.user_metadata?.last_name || ''
      };

      const { data: newUser, error: createError } = await adminClient
        .from('users')
        .insert(newUserData)
        .select()
        .single();

      if (createError) {
        console.error('Failed to create user:', createError);
        return new Response(JSON.stringify({ error: 'Failed to create user', details: createError.message }), {
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
        console.log('Creating prediction with poolId:', poolId);
        console.log('Options:', prediction_options);
        
        // Create prediction pool using admin client
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

        const { data: pool, error: poolError } = await adminClient
          .from('prediction_pools')
          .insert(poolData)
          .select()
          .single();

        if (poolError) {
          console.error('Prediction pool creation error:', poolError);
          return new Response(JSON.stringify({ error: 'Failed to create prediction pool', details: poolError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        console.log('Prediction pool created:', pool);

        // Ensure we have an image URL - fetch from TMDB if not provided
        let finalImageUrl = media_image_url || null;
        if (!finalImageUrl && media_external_id && media_external_source === 'tmdb') {
          console.log('Fetching TMDB poster for prediction post...');
          finalImageUrl = await fetchTmdbPosterUrl(media_external_id, media_external_source);
        }

        // Create associated social post using admin client
        const postData = {
          user_id: appUser.id,
          content: prediction_question,
          post_type: 'prediction',
          prediction_pool_id: poolId,
          media_title: media_title || prediction_question.substring(0, 100),
          media_type: media_type || 'Movie',
          media_creator: media_creator || null,
          media_external_id: media_external_id || null,
          media_external_source: media_external_source || null,
          visibility,
          contains_spoilers,
          image_url: finalImageUrl
        };

        const { data: post, error: postError } = await adminClient
          .from('social_posts')
          .insert(postData)
          .select()
          .single();

        if (postError) {
          console.error('Social post creation error:', postError);
          return new Response(JSON.stringify({ error: 'Failed to create social post', details: postError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        console.log('Social post created for prediction:', post);

        return new Response(JSON.stringify({ pool, post }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle polls
      if (type === 'poll' && poll_question && Array.isArray(poll_options) && poll_options.length >= 2) {
        const poolId = crypto.randomUUID();
        console.log('Creating poll with poolId:', poolId);
        
        // Create poll pool using admin client
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

        const { data: pool, error: poolError } = await adminClient
          .from('prediction_pools')
          .insert(poolData)
          .select()
          .single();

        if (poolError) {
          console.error('Poll pool creation error:', poolError);
          return new Response(JSON.stringify({ error: 'Failed to create poll pool', details: poolError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        console.log('Poll pool created:', pool);

        // Ensure we have an image URL - fetch from TMDB if not provided
        let pollImageUrl = media_image_url || null;
        if (!pollImageUrl && media_external_id && media_external_source === 'tmdb') {
          console.log('Fetching TMDB poster for poll post...');
          pollImageUrl = await fetchTmdbPosterUrl(media_external_id, media_external_source);
        }

        // Create associated social post using admin client
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
          contains_spoilers,
          image_url: pollImageUrl
        };

        const { data: post, error: postError } = await adminClient
          .from('social_posts')
          .insert(postData)
          .select()
          .single();

        if (postError) {
          console.error('Poll social post creation error:', postError);
          return new Response(JSON.stringify({ error: 'Failed to create poll post', details: postError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        console.log('Social post created for poll:', post);

        return new Response(JSON.stringify({ pool, post }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle all other post types (thought, rate-review, add-media)
      // Ensure we have an image URL - fetch from TMDB if not provided
      let regularPostImageUrl = media_image_url || null;
      if (!regularPostImageUrl && media_external_id && media_external_source === 'tmdb') {
        console.log('Fetching TMDB poster for regular post...');
        regularPostImageUrl = await fetchTmdbPosterUrl(media_external_id, media_external_source);
      }

      const postData = {
        user_id: appUser.id,
        content,
        post_type: type || 'update',
        rating: rating || null,
        media_title: media_title || null,
        media_type: media_type || null,
        media_creator: media_creator || null,
        image_url: regularPostImageUrl,
        media_external_id: media_external_id || null,
        media_external_source: media_external_source || null,
        visibility,
        contains_spoilers
      };

      const { data: post, error: postError } = await adminClient
        .from('social_posts')
        .insert(postData)
        .select()
        .single();

      if (postError) {
        console.error('Post creation error:', postError);
        return new Response(JSON.stringify({ error: 'Failed to create post', details: postError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      console.log('Post created:', post);

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
