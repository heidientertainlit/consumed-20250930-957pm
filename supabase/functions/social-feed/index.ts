import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
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

    console.log('Auth user:', user.email);

    // Get or create app user
    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, email, user_name')
      .eq('email', user.email)
      .single();

    if (appUserError && appUserError.code === 'PGRST116') {
      // User doesn't exist, create them using service role client (bypass RLS)
      console.log('Creating new user:', user.email);
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '', 
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .upsert({
          id: user.id,
          email: user.email,
          user_name: user.user_metadata?.user_name || user.email.split('@')[0] || 'user',
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || '',
          display_name: user.user_metadata?.user_name || user.email.split('@')[0] || 'user'
        }, {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select('id, email, user_name')
        .single();

      if (createError) {
        console.error('Failed to create/update user:', createError);
        // Try to fetch existing user instead
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('id, email, user_name')
          .eq('id', user.id)
          .single();
        appUser = existingUser || null;
      } else {
        appUser = newUser;
      }
      
      if (!appUser) {
        return new Response(JSON.stringify({ error: 'Failed to initialize user' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else if (appUserError) {
      console.error('App user error:', appUserError);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'GET') {
      console.log('Getting social posts...');
      
      // Get pagination params from query string
      const url = new URL(req.url);
      const limit = parseInt(url.searchParams.get('limit') || '15', 10);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      
      console.log('Pagination:', { limit, offset });
      
      const { data: posts, error } = await supabase
        .from('social_posts')
        .select(`
          id, 
          user_id, 
          content, 
          post_type, 
          rating, 
          progress, 
          created_at, 
          updated_at, 
          likes_count, 
          comments_count, 
          media_title, 
          media_type, 
          media_creator, 
          image_url, 
          media_external_id, 
          media_external_source, 
          media_description,
          contains_spoilers
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.log('Query failed:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Found posts:', posts?.length || 0);

      const userIds = [...new Set(posts?.map(post => post.user_id) || [])];
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, user_name, display_name, email, avatar')
        .in('id', userIds);

      console.log('User lookup result:', { users: users?.length, usersError });

      // Get posts that the current user has liked
      const postIds = posts?.map(post => post.id) || [];
      const { data: userLikes, error: likesError } = await supabase
        .from('social_post_likes')
        .select('social_post_id')
        .eq('user_id', appUser.id)
        .in('social_post_id', postIds);

      console.log('User likes lookup:', { likes: userLikes?.length, likesError });

      const likedPostIds = new Set(userLikes?.map(like => like.social_post_id) || []);
      const userMap = new Map(users?.map(user => [user.id, user]) || []);

      const transformedPosts = posts?.map(post => {
        const postUser = userMap.get(post.user_id) || { user_name: 'Unknown', display_name: 'Unknown', email: '', avatar: '' };
        
        const hasMedia = post.media_title && post.media_title.trim() !== '';
        
        return {
          id: post.id,
          type: post.post_type || 'update',
          user: {
            id: post.user_id,
            username: postUser.user_name || 'Unknown',
            displayName: postUser.display_name || postUser.user_name || 'Unknown',
            avatar: postUser.avatar || ''
          },
          content: post.content || '',
          timestamp: post.created_at,
          likes: post.likes_count || 0,
          comments: post.comments_count || 0,
          shares: 0,
          likedByCurrentUser: likedPostIds.has(post.id),
          containsSpoilers: post.contains_spoilers || false,
          rating: post.rating,
          progress: post.progress,
          mediaItems: hasMedia ? [{
            id: `embedded_${post.id}`,
            title: post.media_title,
            creator: post.media_creator || '',
            mediaType: post.media_type || '',
            imageUrl: post.image_url || '',
            rating: post.rating,
            externalId: post.media_external_id || '',
            externalSource: post.media_external_source || '',
            description: post.media_description || ''
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
      const { content, media_title, media_type, media_creator, media_image_url, rating, progress, post_type } = body;

      console.log('Creating post:', { content, media_title, media_type, media_creator, media_image_url, rating, progress, post_type });

      const { data: post, error } = await supabase
        .from('social_posts')
        .insert({
          user_id: user.id,
          content: content || '',
          post_type: post_type || 'update',
          rating: rating || null,
          progress: progress || null,
          likes_count: 0,
          comments_count: 0,
          media_title: media_title || null,
          media_type: media_type || null,
          media_creator: media_creator || null,
          image_url: media_image_url || null,
          media_external_id: null,
          media_external_source: null,
          media_description: null
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
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
