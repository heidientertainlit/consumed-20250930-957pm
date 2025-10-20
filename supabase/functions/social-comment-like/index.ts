
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
    const { comment_id } = body;

    if (!comment_id) {
      return new Response(JSON.stringify({ error: 'Missing comment_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      // Add like
      const { data: existingLike } = await supabase
        .from('social_comment_likes')
        .select('id')
        .eq('comment_id', comment_id)
        .eq('user_id', user.id)
        .single();

      if (existingLike) {
        return new Response(JSON.stringify({ error: 'Already liked' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { error } = await supabase
        .from('social_comment_likes')
        .insert({ comment_id, user_id: user.id });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Increment likes_count on the comment and get comment owner
      const serviceSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '', 
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', 
      );

      const { data: comment } = await serviceSupabase
        .from('social_post_comments')
        .select('user_id, likes_count, post_id')
        .eq('id', comment_id)
        .single();

      // Increment likes_count
      if (comment) {
        await serviceSupabase
          .from('social_post_comments')
          .update({ likes_count: (comment.likes_count || 0) + 1 })
          .eq('id', comment_id);
      }

      const { data: liker } = await serviceSupabase
        .from('users')
        .select('user_name, email')
        .eq('id', user.id)
        .single();

      if (comment && comment.user_id !== user.id && liker) {
        // Send notification to comment owner
        const likerName = liker.user_name || liker.email?.split('@')[0] || 'Someone';
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({
            userId: comment.user_id,
            type: 'comment_like',
            triggeredByUserId: user.id,
            message: `${likerName} liked your comment`,
            postId: comment.post_id,
            commentId: comment_id
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
        .from('social_comment_likes')
        .delete()
        .eq('comment_id', comment_id)
        .eq('user_id', user.id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Decrement likes_count on the comment
      const serviceSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '', 
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', 
      );

      const { data: comment } = await serviceSupabase
        .from('social_post_comments')
        .select('likes_count')
        .eq('id', comment_id)
        .single();

      if (comment && comment.likes_count > 0) {
        await serviceSupabase
          .from('social_post_comments')
          .update({ likes_count: comment.likes_count - 1 })
          .eq('id', comment_id);
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
