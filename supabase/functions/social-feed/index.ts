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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') || ''
    );
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'GET') {
      console.log('Getting social posts...');
      
      // First, reload schema cache to clear stale relationships
      try {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/?reload=true`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` }
        });
        console.log('Schema cache reloaded');
      } catch (reloadError) {
        console.log('Schema reload failed:', reloadError);
      }
      
      // Simple direct query - only social_posts table
      const { data: posts, error } = await supabase
        .from('social_posts')
        .select('id, user_id, media_title, media_type, media_creator, media_image, rating, thoughts, likes, comments, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.log('Query failed:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Found posts:', posts?.length || 0);

      // Transform posts for frontend (simple version)
      const transformedPosts = posts?.map(post => ({
        id: post.id,
        type: 'consumption',
        user: {
          id: post.user_id,
          username: 'User',
          displayName: 'User',
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
      })) || [];

      console.log('Returning posts:', transformedPosts.length);
      console.log('Posts with media:', transformedPosts.filter(p => p.mediaItems.length > 0).length);

      return new Response(JSON.stringify(transformedPosts), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { content, media_title, media_type, media_creator, media_image_url, rating } = body;

      console.log('Creating post:', { content, media_title, media_type, media_creator, media_image_url, rating });

      const { data: post, error } = await supabase
        .from('social_posts')
        .insert({
          user_id: user.id,
          media_title: media_title || '',
          media_type: media_type || '',
          media_creator: media_creator || '',
          media_image: media_image_url || '',
          rating: rating || null,
          thoughts: content || '',
          audience: 'all',
          likes: 0,
          comments: 0
        })
        .select('id')
        .single();

      if (error) {
        console.log('Failed to create post:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Created post:', post);
      return new Response(JSON.stringify({ post }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.log('Function error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});