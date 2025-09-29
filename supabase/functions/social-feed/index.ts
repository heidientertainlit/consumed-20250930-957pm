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
      console.log('Getting social posts with media items...');
      
      // Query with proper join to media_items
      const { data: posts, error } = await supabase
        .from('social_posts')
        .select(`
          id,
          user_id,
          thoughts,
          likes,
          comments,
          created_at,
          media_items (
            id,
            title,
            media_type,
            creator,
            image_url,
            external_id,
            external_source,
            description,
            year
          )
        `)
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

      // Get user data separately to avoid complex joins
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
        
        return {
          id: post.id,
          type: 'consumption',
          user: {
            id: post.user_id,
            username: postUser?.user_name || 'Unknown',
            displayName: postUser?.display_name || postUser?.user_name || 'Unknown',
            avatar: postUser?.avatar || ''
          },
          content: post.thoughts || '',
          timestamp: post.created_at,
          likes: post.likes || 0,
          comments: post.comments || 0,
          shares: 0,
          mediaItems: post.media_items ? [{
            id: post.media_items.id,
            title: post.media_items.title,
            creator: post.media_items.creator || '',
            mediaType: post.media_items.media_type || '',
            imageUrl: post.media_items.image_url || '',
            rating: undefined,
            externalId: post.media_items.external_id || '',
            externalSource: post.media_items.external_source || ''
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
      const { content, media_title, media_type, media_creator, media_image_url, rating } = body;

      console.log('Creating post with media:', { content, media_title, media_type, media_creator, media_image_url, rating });

      let mediaId = null;
      
      // First create media item if media data provided
      if (media_title) {
        const { data: mediaItem, error: mediaError } = await supabase
          .from('media_items')
          .insert({
            title: media_title,
            media_type: media_type || 'unknown',
            creator: media_creator || '',
            image_url: media_image_url || '',
            external_id: '',
            external_source: ''
          })
          .select('id')
          .single();

        if (mediaError) {
          console.log('Failed to create media item:', mediaError);
          return new Response(JSON.stringify({ error: 'Failed to create media: ' + mediaError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        mediaId = mediaItem.id;
      }

      // Then create social post with reference to media item
      const { data: post, error } = await supabase
        .from('social_posts')
        .insert({
          user_id: user.id,
          media_id: mediaId,
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