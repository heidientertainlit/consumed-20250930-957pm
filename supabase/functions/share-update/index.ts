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
          user_name: user.email.split('@')[0] || 'user'
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
      const body = await req.json();
      const { content, media_title, media_type, media_creator, media_image_url, rating } = body;

      console.log('Creating post for user:', appUser.id);

      const { data: post, error } = await supabase
        .from('social_posts')
        .insert({
          user_id: appUser.id,
          thoughts: content,
          media_title,
          media_type,
          media_creator,
          media_image: media_image_url,
          rating
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