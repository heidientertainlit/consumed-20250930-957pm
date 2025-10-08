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

    if (req.method === 'GET') {
      console.log('Getting social posts...');
      
      // Query social_posts with embedded media fields (matching share-update pattern)
      const { data: posts, error } = await supabase
        .from('social_posts')
        .select('id, user_id, thoughts, content, media_title, media_type, media_creator, media_image, media_external_id, media_external_source, rating, likes, comments, created_at')
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

      // Get user data separately (same pattern as track-media)
      const userIds = [...new Set(posts?.map(post => post.user_id) || [])];
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, user_name, display_name, email, avatar')
        .in('id', userIds);

      const userMap = new Map(users?.map(user => [user.id, user]) || []);

      // Find missing user IDs and fetch from auth.users as fallback
      const missingUserIds = userIds.filter(id => !userMap.has(id));
      if (missingUserIds.length > 0) {
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
        
        if (authUsers?.users) {
          authUsers.users.forEach(authUser => {
            if (missingUserIds.includes(authUser.id)) {
              userMap.set(authUser.id, {
                id: authUser.id,
                user_name: authUser.user_metadata?.user_name || authUser.email?.split('@')[0] || 'Unknown',
                display_name: authUser.user_metadata?.display_name || authUser.user_metadata?.user_name || authUser.email?.split('@')[0] || 'Unknown',
                email: authUser.email || '',
                avatar: authUser.user_metadata?.avatar || ''
              });
            }
          });
        }
      }

      // Transform posts for frontend
      const transformedPosts = posts?.map(post => {
        const postUser = userMap.get(post.user_id) || { user_name: 'Unknown', display_name: 'Unknown', email: '', avatar: '' };
        
        // Use embedded media fields (like share-update creates them)
        const hasMedia = post.media_title && post.media_title.trim() !== '';
        
        return {
          id: post.id,
          type: 'consumption',
          user: {
            id: post.user_id,
            username: postUser?.user_name || 'Unknown',
            displayName: postUser?.display_name || postUser?.user_name || 'Unknown',
            avatar: postUser?.avatar || ''
          },
          content: post.thoughts || post.content || '',
          timestamp: post.created_at,
          likes: post.likes || 0,
          comments: post.comments || 0,
          shares: 0,
          mediaItems: hasMedia ? [{
            id: `embedded_${post.id}`,
            title: post.media_title,
            creator: post.media_creator || '',
            mediaType: post.media_type || '',
            imageUrl: post.media_image || '',
            rating: post.rating,
            externalId: post.media_external_id || '',
            externalSource: post.media_external_source || ''
          }] : []
        };
      }) || [];

      console.log('Returning posts:', transformedPosts.length);
      console.log('Posts with media:', transformedPosts.filter(p => p.mediaItems.length > 0).length);

      return new Response(JSON.stringify(transformedPosts), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { content, media_title, media_type, media_creator, media_image, rating } = body;

      console.log('Creating post with embedded media:', { content, media_title, media_type, media_creator, media_image, rating });

      // Create social post with embedded media fields (matching share-update pattern)
      const { data: post, error } = await supabase
        .from('social_posts')
        .insert({
          user_id: user.id,
          thoughts: content || '',
          content: content || '',
          media_title,
          media_type,
          media_creator,
          media_image,
          rating,
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
