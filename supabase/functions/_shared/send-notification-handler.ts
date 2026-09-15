export type NotificationClient = any;

type NotificationRequest = {
  userId: string;
  type: string;
  // System/platform notifications have no user actor. The notifications table
  // permits a null actor for those notifications.
  triggeredByUserId?: string | null;
  message: string;
  postId?: string;
  commentId?: string;
  listId?: string;
  friendCastId?: string;
};

type ServiceAuthorization =
  | { authorized: true; caller: string; userId?: string }
  | { authorized: false; status: number; error: string };

type LiveUserResult = {
  allowed: boolean;
  reason?: string;
};

export interface SendNotificationDependencies {
  createClient: (url: string, key: string) => NotificationClient;
  authorize: (request: Request) => ServiceAuthorization;
  loadLiveUser: (
    client: NotificationClient,
    userId: unknown,
    columns?: string,
  ) => Promise<LiveUserResult>;
  checkBlockingRelationship: (
    client: NotificationClient,
    actorId: string,
    targetId: string,
  ) => Promise<boolean>;
  sendPush: (userId: string, message: string, route: string) => Promise<void>;
  supabaseUrl: string;
  serviceRoleKey: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

async function removeInsertedNotification(
  supabaseAdmin: NotificationClient,
  notificationId: string | undefined,
): Promise<unknown | null> {
  if (!notificationId) {
    const error = new Error('Created notification did not include an id for cleanup');
    console.error(error.message);
    return error;
  }

  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', notificationId);
    if (error) {
      console.error('Error removing blocked notification:', error);
      return error;
    }
    return null;
  } catch (error) {
    console.error('Unexpected error removing blocked notification:', error);
    return error;
  }
}

function blockLookupFailureResponse(): Response {
  return jsonResponse({ error: 'Blocking relationship status unavailable' }, 503);
}

export async function handleSendNotificationRequest(
  req: Request,
  dependencies: SendNotificationDependencies,
): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authorization = dependencies.authorize(req);
    if (authorization.authorized === false) {
      return jsonResponse({ error: authorization.error }, authorization.status);
    }

    const supabaseAdmin = dependencies.createClient(
      dependencies.supabaseUrl,
      dependencies.serviceRoleKey,
    );
    const { userId, type, triggeredByUserId, message, postId, commentId, listId }: NotificationRequest =
      await req.json();
    const hasActor = typeof triggeredByUserId === 'string' && triggeredByUserId.length > 0;

    // Require the recipient and, for user-triggered events, the actor to
    // exist before writing or sending anything so deleted UUIDs cannot be
    // recreated or targeted by late notifications.
    const [recipient, actor] = await Promise.all([
      dependencies.loadLiveUser(supabaseAdmin, userId, 'id'),
      hasActor
        ? dependencies.loadLiveUser(supabaseAdmin, triggeredByUserId!, 'id')
        : Promise.resolve(null),
    ]);
    const lookupFailed = !recipient.allowed
      ? recipient.reason === 'account_lookup_failed'
      : !!actor && !actor.allowed && actor.reason === 'account_lookup_failed';
    if (!recipient.allowed || (actor && !actor.allowed)) {
      return jsonResponse(
        { error: lookupFailed ? 'Account status unavailable' : 'Account not found' },
        lookupFailed ? 503 : 404,
      );
    }

    if (hasActor && userId === triggeredByUserId) {
      return jsonResponse({ success: true, message: 'No self-notification sent' });
    }

    // A user must never receive an event generated by someone either side has
    // blocked. Lookup failures deny delivery rather than permitting it.
    if (hasActor) {
      try {
        if (await dependencies.checkBlockingRelationship(supabaseAdmin, triggeredByUserId!, userId)) {
          return jsonResponse({ error: 'Notification blocked by user relationship' }, 403);
        }
      } catch (error) {
        console.error('Unable to verify notification blocking relationship:', error);
        return blockLookupFailureResponse();
      }
    }

    const notificationData: Record<string, unknown> = {
      user_id: userId,
      type,
      triggered_by_user_id: hasActor ? triggeredByUserId : null,
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
      return jsonResponse({ error: error.message, details: error }, 500);
    }

    const route = routeForType(type, postId);

    // Retain the account-deletion race guard immediately before the provider
    // request, then repeat the block check for the insert/push race.
    const [recipientBeforePush, actorBeforePush] = await Promise.all([
      dependencies.loadLiveUser(supabaseAdmin, userId, 'id'),
      hasActor
        ? dependencies.loadLiveUser(supabaseAdmin, triggeredByUserId!, 'id')
        : Promise.resolve(null),
    ]);
    if (!recipientBeforePush.allowed || (actorBeforePush && !actorBeforePush.allowed)) {
      const lookupFailedBeforePush = !recipientBeforePush.allowed
        ? recipientBeforePush.reason === 'account_lookup_failed'
        : actorBeforePush?.reason === 'account_lookup_failed';
      return jsonResponse(
        {
          error: lookupFailedBeforePush
            ? 'Account status unavailable'
            : 'Account not found',
        },
        lookupFailedBeforePush ? 503 : 404,
      );
    }

    if (hasActor) {
      try {
        if (await dependencies.checkBlockingRelationship(supabaseAdmin, triggeredByUserId!, userId)) {
          const cleanupError = await removeInsertedNotification(supabaseAdmin, data?.id);
          if (cleanupError) {
            return jsonResponse(
              { error: 'Notification blocked by user relationship and cleanup failed' },
              500,
            );
          }
          return jsonResponse({ error: 'Notification blocked by user relationship' }, 403);
        }
      } catch (error) {
        console.error('Unable to reverify notification blocking relationship:', error);
        const cleanupError = await removeInsertedNotification(supabaseAdmin, data?.id);
        if (cleanupError) {
          return jsonResponse(
            { error: 'Blocking relationship status unavailable and notification cleanup failed' },
            500,
          );
        }
        return blockLookupFailureResponse();
      }
    }

    await dependencies.sendPush(userId, message, route);
    return jsonResponse({ success: true, notification: data });
  } catch (error) {
    console.error('Unexpected error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
}