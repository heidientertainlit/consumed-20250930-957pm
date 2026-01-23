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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { 
      targetFriendId, 
      targetFriendName, 
      prompt, 
      celebId, 
      celebName, 
      celebImage 
    } = await req.json();

    if (!celebId || !celebName) {
      return new Response(JSON.stringify({ error: 'Celebrity selection required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!targetFriendId && !targetFriendName) {
      return new Response(JSON.stringify({ error: 'Friend selection required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: friendCast, error: insertError } = await supabase
      .from('friend_casts')
      .insert({
        creator_id: user.id,
        target_friend_id: targetFriendId || null,
        target_friend_name: targetFriendName || null,
        prompt: prompt || 'Who would play them in a movie?',
        creator_pick_celeb_id: celebId,
        creator_pick_celeb_name: celebName,
        creator_pick_celeb_image: celebImage
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: userData } = await supabase.from('users').select('points').eq('id', user.id).single();
    if (userData) {
      await supabase.from('users').update({ points: (userData.points || 0) + 15 }).eq('id', user.id);
    }

    // Send notification to target friend if they have an account
    if (targetFriendId) {
      console.log('Sending notification to target friend:', targetFriendId);
      
      const { data: creatorData } = await supabase
        .from('users')
        .select('user_name')
        .eq('id', user.id)
        .single();
      
      const creatorName = creatorData?.user_name || 'Someone';
      console.log('Creator name:', creatorName);
      
      // Call send-notification edge function
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      
      try {
        const notifResponse = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: targetFriendId,
            type: 'cast',
            triggeredByUserId: user.id,
            message: `${creatorName} cast you as ${celebName} in their movie! 🎬`,
            friendCastId: friendCast.id
          })
        });
        const notifResult = await notifResponse.json();
        console.log('Notification response:', notifResult);
      } catch (notifError) {
        console.error('Failed to send notification:', notifError);
      }
    }

    return new Response(JSON.stringify({ success: true, friendCast }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Create friend cast error:', error);
    return new Response(JSON.stringify({ error: 'Failed to create cast' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
