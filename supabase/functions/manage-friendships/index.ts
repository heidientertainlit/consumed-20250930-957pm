
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  isValidFriendshipUuid,
  normalizeFriendshipSearchQuery,
} from "../_shared/friendship-policy.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function databaseErrorResponse() {
  return new Response(JSON.stringify({ error: 'Unable to complete friendship request' }), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function transitionErrorResponse(error: { code?: string; message?: string }, action: 'send' | 'accept' | 'reject') {
  const allowedMessages = new Set([
    'Already friends',
    'Friend request already sent',
    'Friend request not found or already processed',
    'Unable to send friend request',
    'Unable to manage friend request',
  ]);
  const message = error.code === 'P0001' && error.message && allowedMessages.has(error.message)
    ? error.message
    : action === 'send'
      ? 'Unable to send friend request'
      : action === 'accept'
        ? 'Friend request not found or already processed'
        : 'Unable to reject friend request';
  return new Response(JSON.stringify({ error: message }), {
    status: error.code === 'P0001' || error.code === '22023' ? 400 : 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

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

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Load private self data through the owner-only account RPC.
    let { data: appUser, error: appUserError } = await supabase
      .rpc('get_my_account_profile');
    appUser = Array.isArray(appUser) ? appUser[0] : appUser;

    if (!appUser && !appUserError) {
      // Authenticated initialization is a trusted write and remains service-role.
      const { data: newUser, error: createError } = await supabaseAdmin
          .from('users')
          .upsert({
            id: user.id,
            email: user.email,
            user_name: user.user_metadata?.user_name || user.email.split('@')[0] || 'user',
            first_name: user.user_metadata?.first_name || '',
            last_name: user.user_metadata?.last_name || ''
          }, { onConflict: 'id' })
          .select('id, email, user_name')
          .single();

      if (createError) {
        return databaseErrorResponse();
      }
      appUser = newUser;
    } else if (appUserError) {
      return new Response(JSON.stringify({ 
        error: 'User lookup failed'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!isValidFriendshipUuid(appUser?.id)) {
      return new Response(JSON.stringify({ error: 'Invalid authenticated user identity' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      const { action, query, friendId } = await req.json();

      switch (action) {
        case 'getFriends': {
          const [{ data: friendships, error: friendshipsError }, { data: blockRows, error: blocksError }] = await Promise.all([
            supabase
            .from('friendships')
            .select('id, friend_id, created_at')
            .eq('user_id', appUser.id)
            .eq('status', 'accepted')
            .order('created_at', { ascending: false }),
            supabaseAdmin
              .from('user_blocks')
              .select('blocker_id, blocked_id')
              .or(`blocker_id.eq.${appUser.id},blocked_id.eq.${appUser.id}`)
          ]);

          if (friendshipsError || blocksError) return databaseErrorResponse();

          const blockedIds = new Set((blockRows || []).map((row) =>
            row.blocker_id === appUser.id ? row.blocked_id : row.blocker_id
          ));
          const visibleFriendships = (friendships || []).filter((friendship) => !blockedIds.has(friendship.friend_id));
          if (visibleFriendships.length === 0) {
            return new Response(JSON.stringify({ friends: [] }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Fetch user data for each friendship
          const friendIds = visibleFriendships.map(f => f.friend_id);
          const { data: users, error: usersError } = await supabase
            .from('public_user_profiles')
            .select('id, user_name, first_name, last_name, display_name, avatar')
            .in('id', friendIds);

          if (usersError) return databaseErrorResponse();

          // Combine friendships with user data
          const friends = visibleFriendships.map(friendship => ({
            id: friendship.id,
            created_at: friendship.created_at,
            friend: users?.find(u => u.id === friendship.friend_id) || null
          }));

          return new Response(JSON.stringify({ friends }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case 'getPendingRequests': {
          const [{ data: friendships, error: friendshipsError }, { data: blockRows, error: blocksError }] = await Promise.all([
            supabase
            .from('friendships')
            .select('id, user_id, created_at')
            .eq('friend_id', appUser.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false }),
            supabaseAdmin
              .from('user_blocks')
              .select('blocker_id, blocked_id')
              .or(`blocker_id.eq.${appUser.id},blocked_id.eq.${appUser.id}`)
          ]);

          if (friendshipsError || blocksError) return databaseErrorResponse();

          const blockedIds = new Set((blockRows || []).map((row) =>
            row.blocker_id === appUser.id ? row.blocked_id : row.blocker_id
          ));
          const visibleFriendships = (friendships || []).filter((friendship) => !blockedIds.has(friendship.user_id));
          if (visibleFriendships.length === 0) {
            return new Response(JSON.stringify({ requests: [] }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Fetch user data for each friendship
          const userIds = visibleFriendships.map(f => f.user_id);
          const { data: users, error: usersError } = await supabase
            .from('public_user_profiles')
            .select('id, user_name, first_name, last_name, display_name, avatar')
            .in('id', userIds);

          if (usersError) return databaseErrorResponse();

          // Combine friendships with user data
          const requests = visibleFriendships.map(friendship => ({
            id: friendship.id,
            user_id: friendship.user_id,
            created_at: friendship.created_at,
            users: users?.find(u => u.id === friendship.user_id) || null
          }));

          return new Response(JSON.stringify({ requests }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case 'searchUsers': {
          const searchQuery = normalizeFriendshipSearchQuery(query);
          if (!searchQuery) {
            return new Response(JSON.stringify({ users: [] }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const { data: users, error } = await supabaseAdmin.rpc('search_friendship_users', {
            p_actor_id: appUser.id,
            p_query: searchQuery,
            p_limit: 20,
          });

          if (error) {
            return new Response(JSON.stringify({ error: 'Failed to search users' }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          return new Response(JSON.stringify({ users: users || [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case 'sendRequest': {
          if (!isValidFriendshipUuid(friendId)) {
            return new Response(JSON.stringify({ error: 'friendId is required' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          if (friendId === appUser.id) {
            return new Response(JSON.stringify({ error: 'Cannot send a friend request to yourself' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const { data, error } = await supabaseAdmin.rpc('transition_friendship', {
            p_action: 'send',
            p_actor_id: appUser.id,
            p_target_id: friendId,
          });

          if (error) {
            return transitionErrorResponse(error, 'send');
          }

          // Send notification to the friend
          const requesterName = appUser.user_name || 'Someone';
          await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              userId: friendId,
              type: 'friend_request',
              triggeredByUserId: appUser.id,
              message: `${requesterName} sent you a friend request`
            })
          });

          return new Response(JSON.stringify({ friendship: data?.friendship ?? null }), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case 'acceptRequest': {
          if (!isValidFriendshipUuid(friendId)) {
            return new Response(JSON.stringify({ error: 'friendId is required' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const { error } = await supabaseAdmin.rpc('transition_friendship', {
            p_action: 'accept',
            p_actor_id: appUser.id,
            p_target_id: friendId,
          });

          if (error) {
            return transitionErrorResponse(error, 'accept');
          }

          // Send notification to the friend that request was accepted
          const accepterName = appUser.user_name || 'Someone';
          await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              userId: friendId,
              type: 'friend_accepted',
              triggeredByUserId: appUser.id,
              message: `${accepterName} accepted your friend request`
            })
          });

          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case 'rejectRequest': {
          if (!isValidFriendshipUuid(friendId)) {
            return new Response(JSON.stringify({ error: 'friendId is required' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const { error } = await supabaseAdmin.rpc('transition_friendship', {
            p_action: 'reject',
            p_actor_id: appUser.id,
            p_target_id: friendId,
          });

          if (error) {
            return transitionErrorResponse(error, 'reject');
          }

          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        default:
          return new Response(JSON.stringify({ error: 'Invalid action' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
      }
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Friendship management error:', error);
    return databaseErrorResponse();
  }
});
