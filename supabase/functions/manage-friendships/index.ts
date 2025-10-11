
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

    // Look up app user by ID first (more reliable), then fall back to email
    let { data: appUser, error: appUserError } = await supabase
      .from('users')
      .select('id, email, user_name')
      .eq('id', user.id)
      .single();

    // If not found by ID, try by email
    if (appUserError && appUserError.code === 'PGRST116') {
      const { data: emailUser } = await supabase
        .from('users')
        .select('id, email, user_name')
        .eq('email', user.email)
        .single();
      
      if (emailUser) {
        appUser = emailUser;
      } else {
        // User doesn't exist, create it
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email,
            user_name: user.user_metadata?.user_name || user.email.split('@')[0] || 'user',
            first_name: user.user_metadata?.first_name || '',
            last_name: user.user_metadata?.last_name || ''
          })
          .select('id, email, user_name')
          .single();

        if (createError) {
          // If it's a duplicate key error, try fetching the user again
          if (createError.code === '23505') {
            const { data: existingUser } = await supabase
              .from('users')
              .select('id, email, user_name')
              .eq('id', user.id)
              .single();
            
            if (existingUser) {
              appUser = existingUser;
            } else {
              return new Response(JSON.stringify({ 
                error: 'Failed to create or fetch user' 
              }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          } else {
            return new Response(JSON.stringify({ 
              error: 'Failed to create user: ' + createError.message 
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        } else {
          appUser = newUser;
        }
      }
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
          const { data: friendships, error: friendshipsError } = await supabase
            .from('friendships')
            .select('id, friend_id, created_at')
            .eq('user_id', appUser.id)
            .eq('status', 'accepted')
            .order('created_at', { ascending: false });

          if (friendshipsError) {
            return new Response(JSON.stringify({ error: friendshipsError.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          if (!friendships || friendships.length === 0) {
            return new Response(JSON.stringify({ friends: [] }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Fetch user data for each friendship
          const friendIds = friendships.map(f => f.friend_id);
          const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, user_name, email, first_name, last_name')
            .in('id', friendIds);

          if (usersError) {
            return new Response(JSON.stringify({ error: usersError.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Combine friendships with user data
          const friends = friendships.map(friendship => ({
            id: friendship.id,
            created_at: friendship.created_at,
            friend: users?.find(u => u.id === friendship.friend_id) || null
          }));

          return new Response(JSON.stringify({ friends }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        case 'getPendingRequests': {
          const { data: friendships, error: friendshipsError } = await supabase
            .from('friendships')
            .select('id, user_id, created_at')
            .eq('friend_id', appUser.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

          if (friendshipsError) {
            return new Response(JSON.stringify({ error: friendshipsError.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          if (!friendships || friendships.length === 0) {
            return new Response(JSON.stringify({ requests: [] }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Fetch user data for each friendship
          const userIds = friendships.map(f => f.user_id);
          const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, user_name, email, first_name, last_name')
            .in('id', userIds);

          if (usersError) {
            return new Response(JSON.stringify({ error: usersError.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Combine friendships with user data
          const requests = friendships.map(friendship => ({
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
          console.log('Search users called with query:', query);
          
          if (!query || query.length < 2) {
            console.log('Query too short, returning empty results');
            return new Response(JSON.stringify({ users: [] }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          console.log('Searching for users with query:', query, 'excluding user:', appUser.id);

          // Get all users except current user, then filter manually for better control
          const { data: allUsers, error: fetchError } = await supabase
            .from('users')
            .select('id, user_name, email, first_name, last_name, display_name')
            .neq('id', appUser.id);

          console.log('Fetched all users:', { count: allUsers?.length || 0, error: fetchError });

          if (fetchError) {
            console.error('User fetch error:', fetchError);
            return new Response(JSON.stringify({ error: fetchError.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Manual filter to handle null values properly
          const queryLower = query.toLowerCase();
          const matchedUsers = (allUsers || []).filter(user => {
            const userName = (user.user_name || '').toLowerCase();
            const email = (user.email || '').toLowerCase();
            const firstName = (user.first_name || '').toLowerCase();
            const lastName = (user.last_name || '').toLowerCase();
            const fullName = `${firstName} ${lastName}`.trim();
            
            return userName.includes(queryLower) ||
                   email.includes(queryLower) ||
                   firstName.includes(queryLower) ||
                   lastName.includes(queryLower) ||
                   fullName.includes(queryLower);
          }).slice(0, 20); // Get top 20 matches

          console.log('Matched users count:', matchedUsers.length);

          // Return all matched users (no filtering for existing relationships)
          // This allows testing and finding users even if they have pending requests
          return new Response(JSON.stringify({ users: matchedUsers }), {
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

          // Send notification to the friend
          const requesterName = appUser.user_name || appUser.email?.split('@')[0] || 'Someone';
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

          // Check if the pending request exists
          const { data: existingRequest, error: checkError } = await supabase
            .from('friendships')
            .select('id')
            .eq('user_id', friendId)
            .eq('friend_id', appUser.id)
            .eq('status', 'pending')
            .single();

          if (checkError || !existingRequest) {
            return new Response(JSON.stringify({ error: 'Friend request not found or already processed' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Delete the pending request (where friend_id = current user, should be allowed)
          const { error: deleteError } = await supabase
            .from('friendships')
            .delete()
            .eq('user_id', friendId)
            .eq('friend_id', appUser.id)
            .eq('status', 'pending');

          if (deleteError) {
            console.error('Delete error:', deleteError);
          }

          // Create accepted friendship for current user (this we can definitely do)
          const { error: insertError1 } = await supabase
            .from('friendships')
            .insert({
              user_id: appUser.id,
              friend_id: friendId,
              status: 'accepted'
            });

          if (insertError1) {
            return new Response(JSON.stringify({ error: insertError1.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Try to create reciprocal friendship (might fail due to RLS, but that's ok)
          const { error: insertError2 } = await supabase
            .from('friendships')
            .insert({
              user_id: friendId,
              friend_id: appUser.id,
              status: 'accepted'
            });

          if (insertError2) {
            console.log('Reciprocal insert failed (expected due to RLS):', insertError2.message);
          }

          // Send notification to the friend that request was accepted
          const accepterName = appUser.user_name || appUser.email?.split('@')[0] || 'Someone';
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
          if (!friendId) {
            return new Response(JSON.stringify({ error: 'friendId is required' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Delete the pending friendship request
          const { error } = await supabase
            .from('friendships')
            .delete()
            .eq('user_id', friendId)
            .eq('friend_id', appUser.id)
            .eq('status', 'pending');

          if (error) {
            return new Response(JSON.stringify({ error: 'Failed to reject friend request' }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
