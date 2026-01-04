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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    const { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, user_name')
      .eq('email', user.email)
      .single();

    if (appUserError || !appUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { 
      post_id,
      target_user_id,
      media_title,
      media_type,
      external_id,
      external_source,
      prediction
    } = body;

    console.log('Place bet request:', {
      userId: appUser.id,
      postId: post_id,
      targetUserId: target_user_id,
      mediaTitle: media_title,
      prediction
    });

    if (!post_id || !target_user_id || !media_title || !prediction) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: post_id, target_user_id, media_title, prediction' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!['will_like', 'will_dislike'].includes(prediction)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid prediction. Must be will_like or will_dislike' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (appUser.id === target_user_id) {
      return new Response(JSON.stringify({ 
        error: 'Cannot bet on your own posts' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate the post exists and belongs to target user
    const { data: post, error: postError } = await supabaseAdmin
      .from('social_posts')
      .select('id, user_id')
      .eq('id', post_id)
      .single();

    if (postError || !post) {
      console.error('Post not found:', postError);
      return new Response(JSON.stringify({ 
        error: 'Post not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (post.user_id !== target_user_id) {
      console.error('Post ownership mismatch:', { postUserId: post.user_id, targetUserId: target_user_id });
      return new Response(JSON.stringify({ 
        error: 'Invalid target user for this post' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // external_id and external_source are optional but helpful for bet resolution
    // Bets can still work without them

    const { data: existingBet, error: checkError } = await supabaseAdmin
      .from('bets')
      .select('id')
      .eq('user_id', appUser.id)
      .eq('post_id', post_id)
      .maybeSingle();

    if (existingBet) {
      return new Response(JSON.stringify({ 
        error: 'You already placed a bet on this post' 
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: bet, error: insertError } = await supabaseAdmin
      .from('bets')
      .insert({
        user_id: appUser.id,
        target_user_id,
        post_id,
        media_title,
        media_type: media_type || null,
        external_id: external_id || null,
        external_source: external_source || null,
        prediction,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error placing bet:', insertError);
      return new Response(JSON.stringify({ 
        error: 'Failed to place bet: ' + insertError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Bet placed successfully:', bet);

    return new Response(JSON.stringify({ 
      success: true,
      bet
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error: ' + error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
