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
          thoughts,
          media_title,
          media_type,
          media_creator,
          media_image,
          rating,
          created_at,
          users!inner(username, email),
          likes,
          comments
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Transform posts to match frontend SocialPost interface
      const transformedPosts = posts?.map(post => ({
        id: post.id,
        type: 'consumption',
        user: {
          id: post.user_id,
          username: post.users?.username || post.users?.email?.split('@')[0] || 'Unknown',
          displayName: post.users?.username || post.users?.email?.split('@')[0] || 'Unknown',
          avatar: ''
        },
        content: post.thoughts || '',
        timestamp: post.created_at,
        likes: post.likes || 0,
        comments: post.comments || 0,
        shares: 0,
        mediaItems: post.media_title ? [{
          id: post.id + '_media',
          title: post.media_title,
          creator: post.media_creator || '',
          mediaType: post.media_type || '',
          imageUrl: post.media_image || '',
          rating: post.rating || undefined,
          externalId: '',
          externalSource: ''
        }] : []
      }));

      return new Response(JSON.stringify(transformedPosts), {
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