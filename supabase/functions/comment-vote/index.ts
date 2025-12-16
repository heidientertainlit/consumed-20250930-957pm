import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
};

serve(async (req) => {
  console.log("comment-vote function hit!", req.method);
  
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
      return new Response(JSON.stringify({ error: 'Unauthorized', detail: userError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const user = authData.user;
    console.log('User authenticated:', user.id);

    // Step 2: Parse request body
    const requestBody = await req.json();
    const { comment_id, direction } = requestBody;
    console.log('Request body:', { comment_id, direction });

    if (!comment_id) {
      return new Response(JSON.stringify({ error: 'comment_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Ensure comment_id is an integer
    const commentIdInt = parseInt(String(comment_id), 10);
    if (isNaN(commentIdInt)) {
      return new Response(JSON.stringify({ error: 'Invalid comment_id' }), {
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

    // Step 3: Check for existing vote
    console.log('Checking for existing vote');
    const { data: existingVote, error: voteCheckError } = await supabaseAdmin
      .from('social_comment_votes')
      .select('id, vote_type')
      .eq('comment_id', commentIdInt)
      .eq('user_id', user.id)
      .maybeSingle();

    if (voteCheckError) {
      console.error('Error checking vote:', voteCheckError);
      return new Response(JSON.stringify({ error: 'Error checking vote', detail: voteCheckError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    console.log('Existing vote:', existingVote);

    const vote_type = direction === 'up' ? 1 : -1;
    let voteAction = 'created';

    // Step 4: Handle vote create/update/delete
    if (existingVote) {
      if (existingVote.vote_type === vote_type) {
        // Same direction - remove the vote (toggle off)
        const { error: deleteError } = await supabaseAdmin
          .from('social_comment_votes')
          .delete()
          .eq('id', existingVote.id);
        
        if (deleteError) {
          console.error('Delete error:', deleteError);
          return new Response(JSON.stringify({ error: 'Failed to remove vote', detail: deleteError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        voteAction = 'removed';
      } else {
        // Different direction - update the vote
        const { error: updateError } = await supabaseAdmin
          .from('social_comment_votes')
          .update({ vote_type })
          .eq('id', existingVote.id);
        
        if (updateError) {
          console.error('Update error:', updateError);
          return new Response(JSON.stringify({ error: 'Failed to update vote', detail: updateError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        voteAction = 'updated';
      }
    } else {
      // No existing vote - create new one
      const { error: insertError } = await supabaseAdmin
        .from('social_comment_votes')
        .insert({
          comment_id: commentIdInt,
          user_id: user.id,
          vote_type
        });
      
      if (insertError) {
        console.error('Insert error:', insertError);
        return new Response(JSON.stringify({ error: 'Failed to create vote', detail: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    console.log('Vote action:', voteAction);

    // Step 5: Count votes
    const { data: upVotes, count: upCount } = await supabaseAdmin
      .from('social_comment_votes')
      .select('id', { count: 'exact', head: false })
      .eq('comment_id', commentIdInt)
      .eq('vote_type', 1);
    
    const { data: downVotes, count: downCount } = await supabaseAdmin
      .from('social_comment_votes')
      .select('id', { count: 'exact', head: false })
      .eq('comment_id', commentIdInt)
      .eq('vote_type', -1);

    const upVoteCount = upCount ?? upVotes?.length ?? 0;
    const downVoteCount = downCount ?? downVotes?.length ?? 0;
    const voteScore = upVoteCount - downVoteCount;
    const userVote = voteAction === 'removed' ? null : direction;

    console.log('Vote counts:', { upVoteCount, downVoteCount, voteScore, userVote });

    return new Response(JSON.stringify({ 
      success: true, 
      action: voteAction,
      upVoteCount,
      downVoteCount,
      voteScore,
      userVote
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Comment vote error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
