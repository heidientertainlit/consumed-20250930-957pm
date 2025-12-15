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
          headers: { Authorization: req.headers.get('Authorization')! }
        }
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Step 1: Get authenticated user
    const { data: authData, error: userError } = await supabase.auth.getUser();
    if (userError || !authData?.user) {
      console.log('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized', step: 1, detail: userError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const user = authData.user;
    console.log('Step 1 passed: User authenticated:', user.id);

    // Step 2: Look up app user
    let { data: appUser } = await supabaseAdmin
      .from('users')
      .select('id, email, user_name')
      .eq('id', user.id)
      .maybeSingle();

    if (!appUser) {
      const { data: emailUser } = await supabaseAdmin
        .from('users')
        .select('id, email, user_name')
        .eq('email', user.email)
        .maybeSingle();
      appUser = emailUser;
    }

    if (!appUser) {
      return new Response(JSON.stringify({ error: 'User not found in database', step: 2 }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    console.log('Step 2 passed: App user found:', appUser.id);

    // Step 3: Parse request body
    const requestBody = await req.json();
    const { rankItemId, direction } = requestBody;
    console.log('Step 3: Request body:', { rankItemId, direction });

    if (!rankItemId) {
      return new Response(JSON.stringify({ error: 'rankItemId is required', step: 3 }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!direction || !['up', 'down'].includes(direction)) {
      return new Response(JSON.stringify({ error: 'direction must be "up" or "down"', step: 3 }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Step 4: Get the rank item
    console.log('Step 4: Looking for rank item:', rankItemId);
    const { data: rankItem, error: itemError } = await supabaseAdmin
      .from('rank_items')
      .select('id, rank_id, title')
      .eq('id', rankItemId)
      .single();

    if (itemError || !rankItem) {
      console.error('Step 4 failed: Rank item not found:', itemError);
      return new Response(JSON.stringify({ error: 'Rank item not found', step: 4, detail: itemError?.message }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    console.log('Step 4 passed: Rank item found:', rankItem.title);

    // Step 5: Check if user owns the rank
    const { data: rank, error: rankError } = await supabaseAdmin
      .from('ranks')
      .select('id, user_id, visibility')
      .eq('id', rankItem.rank_id)
      .single();

    if (rankError || !rank) {
      console.error('Step 5 failed: Rank not found:', rankError);
      return new Response(JSON.stringify({ error: 'Rank not found', step: 5, detail: rankError?.message }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (rank.user_id === appUser.id) {
      return new Response(JSON.stringify({ error: 'Cannot vote on your own rank', step: 5 }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    console.log('Step 5 passed: User can vote on this rank');

    // Step 6: Check for existing vote
    console.log('Step 6: Checking for existing vote');
    const { data: existingVote, error: voteCheckError } = await supabaseAdmin
      .from('rank_item_votes')
      .select('id, direction')
      .eq('rank_item_id', rankItemId)
      .eq('voter_id', appUser.id)
      .maybeSingle();

    if (voteCheckError) {
      console.error('Step 6 failed: Error checking vote:', voteCheckError);
      return new Response(JSON.stringify({ error: 'Error checking vote', step: 6, detail: voteCheckError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    console.log('Step 6 passed: Existing vote:', existingVote);

    let voteAction = 'created';

    // Step 7: Handle vote create/update/delete
    if (existingVote) {
      if (existingVote.direction === direction) {
        // Same direction - remove the vote (toggle off)
        const { error: deleteError } = await supabaseAdmin
          .from('rank_item_votes')
          .delete()
          .eq('id', existingVote.id);
        
        if (deleteError) {
          console.error('Step 7 failed: Delete error:', deleteError);
          return new Response(JSON.stringify({ error: 'Failed to remove vote', step: 7, detail: deleteError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        voteAction = 'removed';
      } else {
        // Different direction - update the vote
        const { error: updateError } = await supabaseAdmin
          .from('rank_item_votes')
          .update({ direction })
          .eq('id', existingVote.id);
        
        if (updateError) {
          console.error('Step 7 failed: Update error:', updateError);
          return new Response(JSON.stringify({ error: 'Failed to update vote', step: 7, detail: updateError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        voteAction = 'changed';
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
        console.error('Step 7 failed: Insert error:', insertError);
        if (insertError.code === '23505') {
          return new Response(JSON.stringify({ error: 'Vote already recorded', step: 7 }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({ error: 'Failed to create vote', step: 7, detail: insertError.message, code: insertError.code }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    console.log('Step 7 passed: Vote action:', voteAction);

    // Step 8: Count votes and update cached counts
    const { data: upVotes, count: upCount } = await supabaseAdmin
      .from('rank_item_votes')
      .select('id', { count: 'exact', head: false })
      .eq('rank_item_id', rankItemId)
      .eq('direction', 'up');
    
    const { data: downVotes, count: downCount } = await supabaseAdmin
      .from('rank_item_votes')
      .select('id', { count: 'exact', head: false })
      .eq('rank_item_id', rankItemId)
      .eq('direction', 'down');

    const upVoteCount = upCount ?? upVotes?.length ?? 0;
    const downVoteCount = downCount ?? downVotes?.length ?? 0;
    const userVote = voteAction === 'removed' ? null : direction;

    // Update cached vote counts in rank_items table for efficient reads
    const { error: updateCountsError } = await supabaseAdmin
      .from('rank_items')
      .update({ 
        up_vote_count: upVoteCount, 
        down_vote_count: downVoteCount 
      })
      .eq('id', rankItemId);
    
    if (updateCountsError) {
      console.error('Warning: Failed to update cached vote counts:', updateCountsError);
      // Don't fail the request, vote was still recorded
    }

    console.log(`Step 8 passed: Vote counts - up=${upVoteCount}, down=${downVoteCount}`);

    return new Response(JSON.stringify({
      success: true,
      data: {
        rankItemId,
        upVoteCount,
        downVoteCount,
        netScore: upVoteCount - downVoteCount,
        userVote,
        action: voteAction
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Vote rank item error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    return new Response(JSON.stringify({ 
      error: errorMessage || 'Unknown error',
      stack: errorStack,
      type: typeof error
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
