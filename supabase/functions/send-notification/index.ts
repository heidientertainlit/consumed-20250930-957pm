import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID') || 'f3e5ce59-cb78-4f05-8d7b-511c45dc2c76';

interface NotificationRequest {
  userId: string;
  type: 'comment' | 'comment_reply' | 'like' | 'post_like' | 'comment_like' | 'friend_request' | 'friend_accepted' | 'follow' | 'mention' | 'inner_circle' | 'collaborator_added' | 'cast' | 'room_added' | 'room_joined' | 'room_new_question' | 'hot_take_pass' | 'hot_take_vote';
  triggeredByUserId: string;
  message: string;
  postId?: string;
  commentId?: string;
  listId?: string;
  friendCastId?: string;
}

// Maps notification type to the deep-link route the user should land on when they tap the push.
function routeForType(type: string, postId?: string): string {
  switch (type) {
    case 'friend_request':
    case 'friend_accepted':
      return '/friends';
    case 'comment':
    case 'comment_reply':
    case 'like':
    case 'post_like':
    case 'comment_like':
    case 'mention':
      return postId ? `/activity?post=${postId}` : '/activity';
    case 'collaborator_added':
      return '/library';
    case 'room_added':
    case 'room_joined':
    case 'room_new_question':
      return '/play';
    case 'cast':
    case 'hot_take_pass':
    case 'hot_take_vote':
      return postId ? `/activity?post=${postId}` : '/activity';
    case 'follow':
    case 'inner_circle':
      return '/friends';
    default:
      return '/activity';
  }
}

async function sendOneSignalPush(userId: string, message: string, route: string): Promise<void> {
  const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY') || Deno.env.get('ONESIGNAL_API_KEY');
  if (!apiKey) {
    console.log('ONESIGNAL_REST_API_KEY not set — skipping push');
    return;
  }

  const body = {
    app_id: ONESIGNAL_APP_ID,
    include_aliases: { external_id: [userId] },
    target_channel: 'push',
    headings: { en: 'Consumed' },
    contents: { en: message },
    data: { route },
    ios_badgeType: 'Increase',
    ios_badgeCount: 1,
  };

  try {
    const res = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!res.ok) {
      console.error('OneSignal push failed:', json);
    } else {
      console.log('OneSignal push sent, id:', json.id);
    }
  } catch (e) {
    console.error('OneSignal fetch error:', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { userId, type, triggeredByUserId, message, postId, commentId, listId, friendCastId }: NotificationRequest = await req.json();

    if (userId === triggeredByUserId) {
      return new Response(
        JSON.stringify({ success: true, message: 'No self-notification sent' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const notificationData: Record<string, unknown> = {
      user_id: userId,
      type,
      triggered_by_user_id: triggeredByUserId,
      message,
      post_id: postId || null,
      comment_id: commentId || null,
      list_id: listId || null,
      read: false,
    };

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      return new Response(
        JSON.stringify({ error: error.message, details: error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const route = routeForType(type, postId);
    await sendOneSignalPush(userId, message, route);

    return new Response(
      JSON.stringify({ success: true, notification: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
