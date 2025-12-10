import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  console.log("vote-rank-item function hit!", req.method);
  
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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Look up user by auth UID (id) first, then by email as fallback
    let { data: appUser, error: appUserError } = await supabaseAdmin
      .from('users')
      .select('id, email, user_name')
      .eq('id', user.id)
      .maybeSingle();

    // If not found by ID, try by email
    if (!appUser) {
      const { data: emailUser, error: emailError } = await supabaseAdmin
        .from('users')
        .select('id, email, user_name')
        .eq('email', user.email)
        .maybeSingle();
      
      if (emailUser) {
        appUser = emailUser;
      }
    }

    if (!appUser) {
      return new Response(JSON.stringify({ 
        error: 'User not found in database' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const requestBody = await req.json();
    const { rankItemId, direction } = requestBody;

    if (!rankItemId) {
      return new Response(JSON.stringify({ error: 'rankItemId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!direction || !['up', 'down'].includes(direction)) {
      return new Response(JSON.stringify({ error: 'direction must be "up" or "down"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get the rank item and associated rank
    console.log('Looking for rank item:', rankItemId);
    const { data: rankItem, error: itemError } = await supabaseAdmin
      .from('rank_items')
      .select('id, rank_id, title, up_vote_count, down_vote_count')
      .eq('id', rankItemId)
      .single();

    console.log('Rank item query result:', { rankItem, itemError });

    if (itemError || !rankItem) {
      console.error('Rank item not found. ID:', rankItemId, 'Error:', itemError);
      return new Response(JSON.stringify({ error: 'Rank item not found', debug: { rankItemId, itemError: itemError?.message } }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user owns the rank (can't vote on own rank)
    const { data: rank, error: rankError } = await supabaseAdmin
      .from('ranks')
      .select('id, user_id, visibility')
      .eq('id', rankItem.rank_id)
      .single();

    if (rankError || !rank) {
      return new Response(JSON.stringify({ error: 'Rank not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (rank.user_id === appUser.id) {
      return new Response(JSON.stringify({ error: 'Cannot vote on your own rank' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check for existing vote
    const { data: existingVote, error: voteCheckError } = await supabaseAdmin
      .from('rank_item_votes')
      .select('id, direction')
      .eq('rank_item_id', rankItemId)
      .eq('voter_id', appUser.id)
      .maybeSingle();

    let voteAction = 'created';
    let previousDirection: string | null = null;
    let upDelta = 0;
    let downDelta = 0;

    if (existingVote) {
      if (existingVote.direction === direction) {
        // Same direction - remove the vote (toggle off)
        await supabaseAdmin
          .from('rank_item_votes')
          .delete()
          .eq('id', existingVote.id);
        
        voteAction = 'removed';
        previousDirection = existingVote.direction;
        
        // Decrement the appropriate counter
        if (direction === 'up') upDelta = -1;
        else downDelta = -1;
      } else {
        // Different direction - update the vote
        await supabaseAdmin
          .from('rank_item_votes')
          .update({ direction })
          .eq('id', existingVote.id);
        
        voteAction = 'changed';
        previousDirection = existingVote.direction;
        
        // Swap counters
        if (direction === 'up') {
          upDelta = 1;
          downDelta = -1;
        } else {
          upDelta = -1;
          downDelta = 1;
        }
      }
    } else {
      // No existing vote - create new one
      const { error: insertError } = await supabaseAdmin
        .from('rank_item_votes')
        .insert({
          rank_item_id: rankItemId,
          voter_id: appUser.id,
          direction
        });

      if (insertError) {
        // Handle unique constraint violation (race condition)
        if (insertError.code === '23505') {
          return new Response(JSON.stringify({ error: 'Vote already recorded' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        throw insertError;
      }
      
      // Increment the appropriate counter
      if (direction === 'up') upDelta = 1;
      else downDelta = 1;
    }

    // Update cached counts using increment/decrement
    const currentUpCount = rankItem.up_vote_count || 0;
    const currentDownCount = rankItem.down_vote_count || 0;
    const newUpCount = Math.max(0, currentUpCount + upDelta);
    const newDownCount = Math.max(0, currentDownCount + downDelta);

    await supabaseAdmin
      .from('rank_items')
      .update({ 
        up_vote_count: newUpCount,
        down_vote_count: newDownCount 
      })
      .eq('id', rankItemId);

    const userVote = voteAction === 'removed' ? null : direction;

    console.log(`Vote ${voteAction} for rank item ${rankItemId}: up=${newUpCount}, down=${newDownCount}`);

    return new Response(JSON.stringify({
      success: true,
      data: {
        rankItemId,
        upVoteCount: newUpCount,
        downVoteCount: newDownCount,
        netScore: newUpCount - newDownCount,
        userVote,
        action: voteAction
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Vote rank item error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
