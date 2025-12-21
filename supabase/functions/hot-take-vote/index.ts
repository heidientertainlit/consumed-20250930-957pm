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

    const body = await req.json();
    const { postId, voteType } = body;

    if (!postId || !voteType || !['fire', 'ice'].includes(voteType)) {
      return new Response(JSON.stringify({ error: 'Missing postId or invalid voteType' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if user already voted on this hot take
    const { data: existingVote } = await serviceSupabase
      .from('hot_take_votes')
      .select('id, vote_type')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .single();

    if (existingVote) {
      if (existingVote.vote_type === voteType) {
        // Same vote - remove it (toggle off)
        await serviceSupabase
          .from('hot_take_votes')
          .delete()
          .eq('id', existingVote.id);

        // Decrement the count
        const countField = voteType === 'fire' ? 'fire_votes' : 'ice_votes';
        const { data: post } = await serviceSupabase
          .from('social_posts')
          .select(countField)
          .eq('id', postId)
          .single();

        if (post) {
          const currentCount = post[countField] || 0;
          await serviceSupabase
            .from('social_posts')
            .update({ [countField]: Math.max(0, currentCount - 1) })
            .eq('id', postId);
        }

        return new Response(JSON.stringify({ success: true, action: 'removed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        // Different vote - switch it
        await serviceSupabase
          .from('hot_take_votes')
          .update({ vote_type: voteType })
          .eq('id', existingVote.id);

        // Update counts: decrement old, increment new
        const oldField = existingVote.vote_type === 'fire' ? 'fire_votes' : 'ice_votes';
        const newField = voteType === 'fire' ? 'fire_votes' : 'ice_votes';

        const { data: post } = await serviceSupabase
          .from('social_posts')
          .select('fire_votes, ice_votes')
          .eq('id', postId)
          .single();

        if (post) {
          await serviceSupabase
            .from('social_posts')
            .update({
              [oldField]: Math.max(0, (post[oldField] || 0) - 1),
              [newField]: (post[newField] || 0) + 1
            })
            .eq('id', postId);
        }

        return new Response(JSON.stringify({ success: true, action: 'switched' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // New vote
    const { error: insertError } = await serviceSupabase
      .from('hot_take_votes')
      .insert({
        post_id: postId,
        user_id: user.id,
        vote_type: voteType
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Increment vote count on the post
    const countField = voteType === 'fire' ? 'fire_votes' : 'ice_votes';
    const { data: post } = await serviceSupabase
      .from('social_posts')
      .select(countField)
      .eq('id', postId)
      .single();

    if (post) {
      const currentCount = post[countField] || 0;
      await serviceSupabase
        .from('social_posts')
        .update({ [countField]: currentCount + 1 })
        .eq('id', postId);
    }

    // Award points for voting (2 points per vote)
    await serviceSupabase.rpc('add_user_points', {
      p_user_id: user.id,
      p_points: 2,
      p_reason: 'hot_take_vote'
    });

    // Send notification to post owner
    const { data: postData } = await serviceSupabase
      .from('social_posts')
      .select('user_id')
      .eq('id', postId)
      .single();

    if (postData && postData.user_id !== user.id) {
      const { data: voter } = await serviceSupabase
        .from('users')
        .select('user_name, display_name')
        .eq('id', user.id)
        .single();

      const voterName = voter?.display_name || voter?.user_name || 'Someone';
      const emoji = voteType === 'fire' ? '🔥' : '🧊';

      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          userId: postData.user_id,
          type: 'hot_take_vote',
          triggeredByUserId: user.id,
          message: `${voterName} voted ${emoji} on your Hot Take`,
          postId: postId
        })
      });
    }

    return new Response(JSON.stringify({ success: true, action: 'added' }), {
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
