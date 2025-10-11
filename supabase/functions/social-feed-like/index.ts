
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

    const body = await req.json();
    const { post_id } = body;

    if (!post_id) {
      return new Response(JSON.stringify({ error: 'Missing post_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      // Add like
      const { data: existingLike } = await supabase
        .from('social_post_likes')
        .select('id')
        .eq('social_post_id', post_id)
        .eq('user_id', user.id)
        .single();

      if (existingLike) {
        return new Response(JSON.stringify({ error: 'Already liked' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { error } = await supabase
        .from('social_post_likes')
        .insert({ social_post_id: post_id, user_id: user.id });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Increment likes_count on the post and get post owner
      const serviceSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '', 
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', 
      );

      const { data: post } = await serviceSupabase
        .from('social_posts')
        .select('user_id, likes_count')
        .eq('id', post_id)
        .single();

      // Increment likes_count
      if (post) {
        await serviceSupabase
          .from('social_posts')
          .update({ likes_count: (post.likes_count || 0) + 1 })
          .eq('id', post_id);
      }

      const { data: liker } = await serviceSupabase
        .from('users')
        .select('user_name, email')
        .eq('id', user.id)
        .single();

      if (post && post.user_id !== user.id && liker) {
        // Send notification to post owner
        const likerName = liker.user_name || liker.email?.split('@')[0] || 'Someone';
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({
            userId: post.user_id,
            type: 'like',
            triggeredByUserId: user.id,
            message: `${likerName} liked your post`,
            postId: post_id
          })
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'DELETE') {
      // Remove like
      const { error } = await supabase
        .from('social_post_likes')
        .delete()
        .eq('social_post_id', post_id)
        .eq('user_id', user.id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Decrement likes_count on the post
      const serviceSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '', 
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', 
      );

      const { data: post } = await serviceSupabase
        .from('social_posts')
        .select('likes_count')
        .eq('id', post_id)
        .single();

      if (post && post.likes_count > 0) {
        await serviceSupabase
          .from('social_posts')
          .update({ likes_count: post.likes_count - 1 })
          .eq('id', post_id);
      }

      return new Response(JSON.stringify({ success: true }), {
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
