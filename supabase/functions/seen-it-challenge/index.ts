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

    // Get app user
    const { data: appUser } = await supabase
      .from('users')
      .select('id, display_name, user_name')
      .eq('email', user.email)
      .single();

    if (!appUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const { action } = body;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (action === 'create') {
      const { set_id, set_title, challenged_id, score, total_items } = body;

      if (!set_id || !challenged_id || score === undefined) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Verify friendship exists
      const { data: friendship } = await supabaseAdmin
        .from('friendships')
        .select('id')
        .or(`and(user_id.eq.${appUser.id},friend_id.eq.${challenged_id}),and(user_id.eq.${challenged_id},friend_id.eq.${appUser.id})`)
        .eq('status', 'accepted')
        .single();

      if (!friendship) {
        return new Response(JSON.stringify({ error: 'You can only challenge friends' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check for existing pending challenge
      const { data: existingChallenge } = await supabaseAdmin
        .from('seen_it_challenges')
        .select('id')
        .eq('set_id', set_id)
        .eq('challenger_id', appUser.id)
        .eq('challenged_id', challenged_id)
        .eq('status', 'pending')
        .single();

      if (existingChallenge) {
        return new Response(JSON.stringify({ error: 'Challenge already sent' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create challenge
      const { data: challenge, error: challengeError } = await supabaseAdmin
        .from('seen_it_challenges')
        .insert({
          set_id,
          challenger_id: appUser.id,
          challenged_id,
          challenger_score: score,
          challenger_completed_at: new Date().toISOString(),
          status: 'pending'
        })
        .select()
        .single();

      if (challengeError) {
        console.error('Challenge creation error:', challengeError);
        return new Response(JSON.stringify({ error: 'Failed to create challenge' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create notification
      await supabaseAdmin.from('notifications').insert({
        user_id: challenged_id,
        type: 'seen_it_challenge',
        content: `challenged you to Seen It: ${set_title || 'a set'}`,
        actor_id: appUser.id,
        reference_id: challenge.id,
        reference_type: 'seen_it_challenge'
      });

      return new Response(JSON.stringify({ success: true, challenge }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'respond') {
      const { challenge_id, score } = body;

      if (!challenge_id || score === undefined) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update challenge with response
      const { data: challenge, error } = await supabaseAdmin
        .from('seen_it_challenges')
        .update({
          challenged_score: score,
          challenged_completed_at: new Date().toISOString(),
          status: 'completed'
        })
        .eq('id', challenge_id)
        .eq('challenged_id', appUser.id)
        .eq('status', 'pending')
        .select()
        .single();

      if (error || !challenge) {
        return new Response(JSON.stringify({ error: 'Challenge not found or already completed' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Notify challenger of completion
      await supabaseAdmin.from('notifications').insert({
        user_id: challenge.challenger_id,
        type: 'seen_it_challenge_completed',
        content: `completed your Seen It challenge!`,
        actor_id: appUser.id,
        reference_id: challenge.id,
        reference_type: 'seen_it_challenge'
      });

      return new Response(JSON.stringify({ success: true, challenge }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get_pending') {
      const { data: challenges } = await supabaseAdmin
        .from('seen_it_challenges')
        .select(`
          *,
          challenger:users!seen_it_challenges_challenger_id_fkey(id, display_name, user_name),
          set:seen_it_sets!seen_it_challenges_set_id_fkey(id, title)
        `)
        .eq('challenged_id', appUser.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      return new Response(JSON.stringify({ challenges: challenges || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
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
