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

    console.log('Auth user:', user.email);

    // Look up app user by email
    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, email, user_name')
      .eq('email', user.email)
      .single();

    console.log('User lookup result:', { appUser, appUserError });

    // If user doesn't exist, create them
    if (appUserError && appUserError.code === 'PGRST116') {
      console.log('User not found, creating new user:', user.email);
      
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
        return new Response(JSON.stringify({ 
          error: 'Failed to create user: ' + createError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      appUser = newUser;
      console.log('Created new user:', appUser);
    } else if (appUserError) {
      console.error('User lookup error:', appUserError);
      return new Response(JSON.stringify({ 
        error: 'User lookup failed: ' + appUserError.message 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse the request body
    const body = await req.json();
    const { 
      media_external_id,
      media_external_source,
      media_title,
      media_type,
      rating,
      skip_social_post
    } = body;

    console.log('Rating request:', {
      userId: appUser.id,
      mediaExternalId: media_external_id,
      mediaExternalSource: media_external_source,
      mediaTitle: media_title,
      mediaType: media_type,
      rating
    });

    // Validate input
    if (!media_external_id || !media_external_source || !media_title || !media_type || !rating) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: media_external_id, media_external_source, media_title, media_type, rating' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (rating < 1 || rating > 5) {
      return new Response(JSON.stringify({ 
        error: 'Rating must be between 1 and 5' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user has already rated this media
    const { data: existingRating, error: checkError } = await supabase
      .from('media_ratings')
      .select('id')
      .eq('user_id', appUser.id)
      .eq('media_external_id', media_external_id)
      .eq('media_external_source', media_external_source)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing rating:', checkError);
      return new Response(JSON.stringify({ 
        error: 'Failed to check existing rating: ' + checkError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let result;
    if (existingRating) {
      // Update existing rating
      console.log('Updating existing rating:', existingRating.id);
      const { data, error } = await supabase
        .from('media_ratings')
        .update({
          rating,
          media_title,
          media_type,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRating.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating rating:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to update rating: ' + error.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      result = data;
    } else {
      // Create new rating
      console.log('Creating new rating');
      const { data, error } = await supabase
        .from('media_ratings')
        .insert({
          user_id: appUser.id,
          media_external_id,
          media_external_source,
          media_title,
          media_type,
          rating
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating rating:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to create rating: ' + error.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      result = data;
    }

    console.log('Rating saved successfully:', result);

    // Create a social post for this rating (skip if user chose private mode)
    if (!skip_social_post) {
      try {
        const { error: postError } = await supabase
          .from('social_posts')
          .insert({
            user_id: appUser.id,
            post_type: 'rate-review',
            content: `Rated ${media_title}`,
            media_title: media_title,
            media_type: media_type,
            media_external_id: media_external_id,
            media_external_source: media_external_source,
            image_url: body.media_image_url || null,
            rating: rating,
            visibility: 'public',
            contains_spoilers: false
          });
        
        if (postError) {
          console.error('Failed to create social post for rating:', postError);
        } else {
          console.log('Created social post for rating');
        }
      } catch (postCreateError) {
        console.error('Error creating social post:', postCreateError);
      }
    } else {
      console.log('Skipping social post creation (skip_social_post=true, private mode)');
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      rating: result
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error: ' + error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
