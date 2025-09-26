
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

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Look up app user by email, CREATE if doesn't exist
    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, email, user_name')
      .eq('email', user.email)
      .single();

    if (appUserError && appUserError.code === 'PGRST116') {
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
        return new Response(JSON.stringify({ 
          error: 'Failed to create user: ' + createError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      appUser = newUser;
    } else if (appUserError) {
      return new Response(JSON.stringify({ 
        error: 'User lookup failed: ' + appUserError.message 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      const { action, query, friendId } = await req.json();

      switch (action) {
        case 'getFriends': {
          const { data: friendships, error } = await supabase
            .from('friendships')
            .select(`
              id,
              accepted_at,
              friend:friend_id(id, user_name, email)
            `)
            .eq('user_id', appUser.id)
            .eq('status', 'accepted')
            .order('accepted_at', { ascending: false });

          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          return new Response(JSON.stringify({ friends: friendships || [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case 'getPendingRequests': {
          const { data: requests, error } = await supabase
            .from('friendships')
            .select(`
              id,
              user_id,
              created_at,
              sender:user_id(id, user_name, email)
            `)
            .eq('friend_id', appUser.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          return new Response(JSON.stringify({ requests: requests || [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case 'searchUsers': {
          if (!query || query.length < 2) {
            return new Response(JSON.stringify({ users: [] }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Search for users by username or email
          const { data: users, error } = await supabase
            .from('users')
            .select('id, user_name, email')
            .or(`user_name.ilike.%${query}%,email.ilike.%${query}%`)
            .neq('id', appUser.id)
            .limit(10);

          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Filter out users who are already friends or have pending requests
          const { data: existingRelations } = await supabase
            .from('friendships')
            .select('friend_id, user_id')
            .or(`and(user_id.eq.${appUser.id},friend_id.in.(${(users || []).map(u => u.id).join(',')})),and(friend_id.eq.${appUser.id},user_id.in.(${(users || []).map(u => u.id).join(',')}))`)
            .in('status', ['pending', 'accepted']);

          const relatedUserIds = new Set([
            ...(existingRelations || []).map(r => r.friend_id),
            ...(existingRelations || []).map(r => r.user_id)
          ]);

          const filteredUsers = (users || []).filter(user => !relatedUserIds.has(user.id));

          return new Response(JSON.stringify({ users: filteredUsers }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case 'sendRequest': {
          if (!friendId) {
            return new Response(JSON.stringify({ error: 'friendId is required' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Check if friendship already exists
          const { data: existing } = await supabase
            .from('friendships')
            .select('id, status')
            .or(`and(user_id.eq.${appUser.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${appUser.id})`)
            .single();

          if (existing) {
            return new Response(JSON.stringify({ 
              error: existing.status === 'accepted' ? 'Already friends' : 'Friend request already sent' 
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const { data: friendship, error } = await supabase
            .from('friendships')
            .insert({
              user_id: appUser.id,
              friend_id: friendId,
              status: 'pending'
            })
            .select()
            .single();

          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          return new Response(JSON.stringify({ friendship }), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case 'acceptRequest': {
          if (!friendId) {
            return new Response(JSON.stringify({ error: 'friendId is required' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Update the friendship status to accepted
          const { data: friendship, error } = await supabase
            .from('friendships')
            .update({ 
              status: 'accepted',
              accepted_at: new Date().toISOString()
            })
            .eq('user_id', friendId)
            .eq('friend_id', appUser.id)
            .eq('status', 'pending')
            .select()
            .single();

          if (error || !friendship) {
            return new Response(JSON.stringify({ error: 'Friend request not found or already processed' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Create reciprocal friendship
          await supabase
            .from('friendships')
            .insert({
              user_id: appUser.id,
              friend_id: friendId,
              status: 'accepted',
              accepted_at: new Date().toISOString()
            });

          return new Response(JSON.stringify({ friendship }), {
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
