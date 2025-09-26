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
      // Simplified query to avoid schema cache issues
      const { data: posts, error } = await supabase
        .from('social_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Debug logging
      console.log('Raw posts from database:', JSON.stringify(posts, null, 2));

      // Get user data separately to avoid join issues
      const userIds = [...new Set(posts?.map(post => post.user_id) || [])];
      console.log('Looking up user IDs:', userIds);
      
      // Try using service role for better access
      const serviceSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '', 
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', 
      );
      
      // First try public.users table with service role
      const { data: users, error: usersError } = await serviceSupabase
        .from('users')
        .select('id, user_name, display_name, email, avatar')
        .in('id', userIds);

      console.log('Public users query error:', usersError);
      console.log('Public users found:', users?.length || 0);
      console.log('Public users data:', JSON.stringify(users, null, 2));
      const userMap = new Map(users?.map(user => [user.id, user]) || []);

      // Find missing user IDs and fetch from auth.users as fallback
      const missingUserIds = userIds.filter(id => !userMap.has(id));
      console.log('Missing user IDs from public.users:', missingUserIds);

      if (missingUserIds.length > 0) {
        // Use service role to access auth.users
        const { data: authUsers, error: authError } = await serviceSupabase.auth.admin.listUsers();
        console.log('Auth users query error:', authError);
        console.log('Auth users fetched:', authUsers?.users?.length || 0);
        
        if (authUsers?.users) {
          authUsers.users.forEach(authUser => {
            if (missingUserIds.includes(authUser.id)) {
              console.log('Processing auth user:', JSON.stringify({
                id: authUser.id,
                email: authUser.email,
                user_metadata: authUser.user_metadata
              }, null, 2));
              
              userMap.set(authUser.id, {
                id: authUser.id,
                user_name: authUser.user_metadata?.user_name || authUser.email?.split('@')[0] || 'Unknown',
                display_name: authUser.user_metadata?.display_name || authUser.user_metadata?.user_name || authUser.email?.split('@')[0] || 'Unknown',
                email: authUser.email || '',
                avatar: authUser.user_metadata?.avatar || ''
              });
            }
          });
          console.log('Total users after auth fallback:', userMap.size);
        }
      }

      // Transform posts to match frontend SocialPost interface
      const transformedPosts = posts?.map(post => {
        const postUser = userMap.get(post.user_id) || { user_name: 'Unknown', display_name: 'Unknown', email: '', avatar: '' };
        
        return {
          id: post.id,
          type: 'consumption',
          user: {
            id: post.user_id,
            username: (postUser as any)?.user_name || 'Unknown',
            displayName: (postUser as any)?.user_name || 'Unknown',
            avatar: (postUser as any)?.avatar || ''
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

      console.log('Transformed posts:', JSON.stringify(transformedPosts, null, 2));

      return new Response(JSON.stringify(transformedPosts), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      // Simplified post creation
      const body = await req.json();
      const { content, media_title, media_type, media_creator, media_image_url, rating } = body;

      // Use raw SQL insert to bypass schema cache
      const { data: post, error } = await supabase.rpc('create_social_post', {
        p_user_id: user.id,
        p_thoughts: content || '',
        p_media_title: media_title || '',
        p_media_type: media_type || '',
        p_media_creator: media_creator || '',
        p_media_image: media_image_url || '',
        p_rating: rating || null
      });

      if (error) {
        // Fallback: try direct insert with minimal data
        const { data: fallbackPost, error: fallbackError } = await supabase
          .from('social_posts')
          .insert({
            user_id: user.id,
            thoughts: content || ''
          })
          .select()
          .single();

        if (fallbackError) {
          return new Response(JSON.stringify({ error: fallbackError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ post: fallbackPost }), {
          status: 201,
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