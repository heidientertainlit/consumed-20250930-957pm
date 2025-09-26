
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
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

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Look up app user by email
    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, email, user_name')
      .eq('email', user.email)
      .single();

    if (appUserError && appUserError.code === 'PGRST116') {
      // Create user if doesn't exist
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          user_name: user.email.split('@')[0] || 'user'
        })
        .select('id, email, user_name')
        .single();

      if (createError) {
        return new Response(JSON.stringify({ error: 'Failed to create user' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      appUser = newUser;
    } else if (appUserError) {
      return new Response(JSON.stringify({ error: 'User lookup failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const requestBody = await req.json();
    const { action, friendId, query } = requestBody;

    switch (action) {
      case 'sendRequest':
        // Check if friendship already exists
        const { data: existing } = await supabase
          .from('friendships')
          .select('*')
          .or(`and(user_id.eq.${appUser.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${appUser.id})`);

        if (existing && existing.length > 0) {
          return new Response(JSON.stringify({ error: 'Friendship already exists' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data, error } = await supabase
          .from('friendships')
          .insert({
            user_id: appUser.id,
            friend_id: friendId,
            status: 'pending'
          })
          .select();

        if (error) throw error;

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'acceptRequest':
        const { error: acceptError } = await supabase
          .from('friendships')
          .update({
            status: 'accepted',
            accepted_at: new Date().toISOString()
          })
          .eq('user_id', friendId)
          .eq('friend_id', appUser.id)
          .eq('status', 'pending');

        if (acceptError) throw acceptError;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'rejectRequest':
        const { error: rejectError } = await supabase
          .from('friendships')
          .delete()
          .eq('user_id', friendId)
          .eq('friend_id', appUser.id)
          .eq('status', 'pending');

        if (rejectError) throw rejectError;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'getFriends':
        const { data: friendships, error: friendsError } = await supabase
          .from('friendships')
          .select(`
            *,
            friend_user:users!friendships_friend_id_fkey(*),
            main_user:users!friendships_user_id_fkey(*)
          `)
          .or(`user_id.eq.${appUser.id},friend_id.eq.${appUser.id}`)
          .eq('status', 'accepted');

        if (friendsError) throw friendsError;

        // Process friends to return the correct user data
        const friends = friendships?.map(friendship => {
          const friend = friendship.user_id === appUser.id 
            ? friendship.friend_user 
            : friendship.main_user;
          return {
            ...friendship,
            friend
          };
        }) || [];

        return new Response(JSON.stringify({ friends }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'getPendingRequests':
        const { data: requests, error: requestsError } = await supabase
          .from('friendships')
          .select(`
            *,
            sender:users!friendships_user_id_fkey(*)
          `)
          .eq('friend_id', appUser.id)
          .eq('status', 'pending');

        if (requestsError) throw requestsError;

        return new Response(JSON.stringify({ requests }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'searchUsers':
        const { data: users, error: searchError } = await supabase
          .from('users')
          .select('id, email, user_name')
          .or(`user_name.ilike.%${query}%,email.ilike.%${query}%`)
          .neq('id', appUser.id)
          .limit(20);

        if (searchError) throw searchError;

        return new Response(JSON.stringify({ users }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('Friends function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
