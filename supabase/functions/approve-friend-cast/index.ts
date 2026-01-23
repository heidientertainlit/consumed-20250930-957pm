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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const authClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { 
      friendCastId, 
      action,
      counterCelebId,
      counterCelebName,
      counterCelebImage
    } = await req.json();

    console.log('Approve friend cast request:', { friendCastId, action, userId: user.id });

    if (!friendCastId || !action) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!['approve', 'decline', 'counter'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: friendCast, error: fetchError } = await supabase
      .from('friend_casts')
      .select('*')
      .eq('id', friendCastId)
      .single();

    if (fetchError || !friendCast) {
      return new Response(JSON.stringify({ error: 'Cast not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (friendCast.target_friend_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Not authorized to respond to this cast' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (friendCast.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'Cast already responded to' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const updateData: Record<string, unknown> = {
      status: action === 'approve' ? 'approved' : action === 'decline' ? 'declined' : 'counter'
    };

    if (action === 'approve') {
      updateData.approved_at = new Date().toISOString();
    }

    if (action === 'counter') {
      if (!counterCelebId || !counterCelebName) {
        return new Response(JSON.stringify({ error: 'Counter celebrity required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      updateData.counter_celeb_id = counterCelebId;
      updateData.counter_celeb_name = counterCelebName;
      updateData.counter_celeb_image = counterCelebImage;
    }

    const { data: updatedCast, error: updateError } = await supabase
      .from('friend_casts')
      .update(updateData)
      .eq('id', friendCastId)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: targetUserData } = await supabase
      .from('users')
      .select('user_name')
      .eq('id', user.id)
      .single();

    const targetName = targetUserData?.user_name || 'Your friend';

    if (action === 'approve') {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      
      const { data: feedPost, error: postError } = await supabaseAdmin
        .from('social_posts')
        .insert({
          user_id: friendCast.creator_id,
          content: `🎬 Cast approved! ${targetName} will be played by ${friendCast.creator_pick_celeb_name} in their movie!`,
          post_type: 'cast_approved',
          is_consumed_content: false,
          metadata: {
            friend_cast_id: friendCastId,
            target_user_id: user.id,
            target_user_name: targetName,
            celeb_id: friendCast.creator_pick_celeb_id,
            celeb_name: friendCast.creator_pick_celeb_name,
            celeb_image: friendCast.creator_pick_celeb_image
          }
        })
        .select()
        .single();

      if (!postError && feedPost) {
        await supabase
          .from('friend_casts')
          .update({ feed_post_id: feedPost.id })
          .eq('id', friendCastId);
      }

      await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: friendCast.creator_id,
          type: 'cast',
          triggeredByUserId: user.id,
          message: `${targetName} approved your casting! They'll be played by ${friendCast.creator_pick_celeb_name} 🎬`,
          friendCastId: friendCastId
        })
      });

      const { data: userData } = await supabase.from('users').select('points').eq('id', user.id).single();
      if (userData) {
        await supabase.from('users').update({ points: (userData.points || 0) + 10 }).eq('id', user.id);
      }
    } else if (action === 'counter') {
      await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: friendCast.creator_id,
          type: 'cast',
          triggeredByUserId: user.id,
          message: `${targetName} counter-suggested ${counterCelebName} instead of ${friendCast.creator_pick_celeb_name}! 🎭`,
          friendCastId: friendCastId
        })
      });
    } else if (action === 'decline') {
      await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: friendCast.creator_id,
          type: 'cast',
          triggeredByUserId: user.id,
          message: `${targetName} declined the casting of ${friendCast.creator_pick_celeb_name} 😅`,
          friendCastId: friendCastId
        })
      });
    }

    return new Response(JSON.stringify({ success: true, friendCast: updatedCast }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Approve friend cast error:', error);
    return new Response(JSON.stringify({ error: 'Failed to respond to cast' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
