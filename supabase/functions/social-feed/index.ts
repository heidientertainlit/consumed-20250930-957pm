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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'GET') {
      // Get social feed posts
      const { data: posts, error } = await supabase
        .from('social_posts')
        .select(`
          id,
          user_id,
          content,
          media_title,
          media_type,
          media_creator,
          media_image_url,
          rating,
          created_at,
          users!inner(username, email),
          social_post_likes(count),
          social_post_comments(count)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Transform posts to include like/comment counts
      const transformedPosts = posts?.map(post => ({
        ...post,
        username: post.users?.username || post.users?.email?.split('@')[0],
        like_count: post.social_post_likes?.[0]?.count || 0,
        comment_count: post.social_post_comments?.[0]?.count || 0
      }));

      return new Response(JSON.stringify({ posts: transformedPosts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      // Create a new social feed post
      const body = await req.json();
      const { content, media_title, media_type, media_creator, media_image_url, rating } = body;

      const { data: post, error } = await supabase
        .from('social_posts')
        .insert({
          user_id: user.id,
          content,
          media_title,
          media_type,
          media_creator,
          media_image_url,
          rating
        })
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ post }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});