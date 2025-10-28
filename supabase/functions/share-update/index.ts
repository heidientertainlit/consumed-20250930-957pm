import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight
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
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          user_name: user.user_metadata?.user_name || user.email.split('@')[0] || 'user',
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || '',
          display_name: user.user_metadata?.user_name || user.email.split('@')[0] || 'user'
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
      // Create a new social feed post
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

      const { content, media_title, media_type, media_creator, media_image_url, rating, media_external_id, media_external_source, contains_spoilers } = body;

      console.log('Creating post for user:', appUser.id);
      console.log('Request body:', body);

      const { data: post, error } = await supabase
        .from('social_posts')
        .insert({
          user_id: appUser.id,
          content,
          media_title,
          media_type,
          media_creator,
          image_url: media_image_url,
          rating,
          media_external_id: media_external_id || null,
          media_external_source: media_external_source || null,
          contains_spoilers: contains_spoilers || false
        })
        .select()
        .single();

      if (error) {
        console.error('Post creation error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Post created successfully:', post.id);

      // Also save rating to unified media_ratings table for Entertainment DNA
      if (rating && media_external_id && media_external_source && media_title && media_type) {
        console.log('Saving rating to media_ratings table...');
        
        // Check if rating already exists
        const { data: existingRating } = await supabase
          .from('media_ratings')
          .select('id')
          .eq('user_id', appUser.id)
          .eq('media_external_id', media_external_id)
          .eq('media_external_source', media_external_source)
          .maybeSingle();

        if (existingRating) {
          // Update existing rating
          const { error: updateError } = await supabase
            .from('media_ratings')
            .update({
              rating,
              media_title,
              media_type,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingRating.id);

          if (updateError) {
            console.error('Failed to update media_ratings:', updateError);
          } else {
            console.log('Updated existing rating in media_ratings');
          }
        } else {
          // Create new rating
          const { error: insertError } = await supabase
            .from('media_ratings')
            .insert({
              user_id: appUser.id,
              media_external_id,
              media_external_source,
              media_title,
              media_type,
              rating
            });

          if (insertError) {
            console.error('Failed to insert into media_ratings:', insertError);
          } else {
            console.log('Created new rating in media_ratings');
          }
        }
      }
      return new Response(JSON.stringify({ post }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Share update function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});