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

    // Look up app user by email, CREATE if doesn't exist
    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, email, user_name')
      .eq('email', user.email)
      .single();

    console.log('User lookup result:', { appUser, appUserError });

    // If user doesn't exist, create them
    if (appUserError && appUserError.code === 'PGRST116') {
      console.log('User not found, creating new user:', user.email);
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          user_name: user.email.split('@')[0] || 'user'
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

    const body = await req.json();
    const { media, rating, thoughts, audience } = body;

    console.log('Share update request:', { media, rating, thoughts, audience, userId: appUser.id });

    // Create social post entry
    const { data: post, error: postError } = await supabase
      .from('social_posts')
      .insert({
        user_id: appUser.id,
        media_title: media.title,
        media_type: media.type,
        media_creator: media.creator,
        media_image: media.image,
        media_external_id: media.external_id,
        media_external_source: media.external_source,
        media_description: media.description,
        rating: rating,
        thoughts: thoughts,
        audience: audience || 'all',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (postError) {
      console.error('Failed to create social post:', postError);
      return new Response(JSON.stringify({ 
        error: 'Failed to share update: ' + postError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Social post created successfully:', post);

    return new Response(JSON.stringify({ 
      success: true, 
      post: post 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Share update error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});