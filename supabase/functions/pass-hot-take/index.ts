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
          headers: { Authorization: req.headers.get('Authorization')! }
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
    const { postId, targetUserId } = body;

    if (!postId || !targetUserId) {
      return new Response(JSON.stringify({ error: 'Missing postId or targetUserId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the original hot take post
    const { data: post, error: postError } = await serviceSupabase
      .from('social_posts')
      .select('id, content, user_id, type')
      .eq('id', postId)
      .single();

    if (postError || !post) {
      return new Response(JSON.stringify({ error: 'Post not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (post.type !== 'hot_take') {
      return new Response(JSON.stringify({ error: 'Can only pass hot takes' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get the sender's info
    const { data: sender } = await serviceSupabase
      .from('users')
      .select('user_name, display_name')
      .eq('id', user.id)
      .single();

    const senderName = sender?.display_name || sender?.user_name || 'Someone';

    // Record the pass
    const { error: passError } = await serviceSupabase
      .from('hot_take_passes')
      .insert({
        post_id: postId,
        from_user_id: user.id,
        to_user_id: targetUserId,
        status: 'pending'
      });

    if (passError) {
      console.error('Pass error:', passError);
      // If table doesn't exist, just log it and continue with notification
    }

    // Send notification to the target user
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        userId: targetUserId,
        type: 'hot_take_pass',
        triggeredByUserId: user.id,
        message: `🔥 ${senderName} passed you a Hot Take: "${post.content?.substring(0, 50)}..."`,
        postId: postId
      })
    });

    // Award points for passing (5 points)
    try {
      await serviceSupabase.rpc('add_user_points', {
        p_user_id: user.id,
        p_points: 5,
        p_reason: 'hot_take_pass'
      });
    } catch (e) {
      console.error('Points error:', e);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
