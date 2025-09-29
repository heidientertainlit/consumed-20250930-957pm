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
      // Explicit column selection to avoid auto-join issues
      const { data: posts, error } = await supabase
        .from('social_posts')
        .select(`
          id,
          user_id,
          media_title,
          media_type,
          media_creator,
          media_image,
          media_external_id,
          media_external_source,
          media_description,
          rating,
          thoughts,
          audience,
          likes,
          comments,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.log('Query error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Raw posts from database:', posts?.length || 0, 'posts');

      // Get user data separately to avoid join issues
      const userIds = [...new Set(posts?.map(post => post.user_id) || [])];
      
      // Use service role for better access
      const serviceSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '', 
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', 
      );
      
      const { data: users, error: usersError } = await serviceSupabase
        .from('users')
        .select('id, user_name, display_name, email, avatar')
        .in('id', userIds);

      const userMap = new Map(users?.map(user => [user.id, user]) || []);

      // Find missing user IDs and fetch from auth.users as fallback
      const missingUserIds = userIds.filter(id => !userMap.has(id));

      if (missingUserIds.length > 0) {
        const { data: authUsers, error: authError } = await serviceSupabase.auth.admin.listUsers();
        
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

      // Transform posts to match frontend SocialPost interface
      const transformedPosts = posts?.map(post => {
        const postUser = userMap.get(post.user_id) || { user_name: 'Unknown', display_name: 'Unknown', email: '', avatar: '' };
        
        console.log('Processing post:', {
          id: post.id,
          media_title: post.media_title,
          media_image: post.media_image,
          has_media: !!post.media_title
        });
        
        return {
          id: post.id,
          type: 'consumption',
          user: {
            id: post.user_id,
            username: postUser?.user_name || 'Unknown',
            displayName: postUser?.user_name || 'Unknown',
            avatar: postUser?.avatar || ''
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
        };
      });

      console.log('Transformed posts:', transformedPosts?.length || 0, 'posts');
      console.log('Posts with media:', transformedPosts?.filter(p => p.mediaItems.length > 0).length || 0);

      return new Response(JSON.stringify(transformedPosts), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      // Create new post with full media data
      const body = await req.json();
      const { content, media_title, media_type, media_creator, media_image_url, rating } = body;

      console.log('Creating post with data:', { content, media_title, media_type, media_creator, media_image_url, rating });

      // Direct insert with all media data
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
        .select()
        .single();

      if (error) {
        console.log('Failed to create post:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Successfully created post:', post);
      return new Response(JSON.stringify({ post }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.log('Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});