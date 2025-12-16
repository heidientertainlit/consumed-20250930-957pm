import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', 
    );

    if (req.method === 'POST') {
      const body = await req.json();
      const { comment_id, direction } = body;

      if (!comment_id || !direction) {
        return new Response(JSON.stringify({ error: 'Missing comment_id or direction' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (direction !== 'up' && direction !== 'down') {
        return new Response(JSON.stringify({ error: 'direction must be "up" or "down"' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const vote_type = direction === 'up' ? 1 : -1;

      const { data: existingVote } = await serviceSupabase
        .from('social_comment_votes')
        .select('id, vote_type')
        .eq('comment_id', comment_id)
        .eq('user_id', user.id)
        .single();

      if (existingVote) {
        if (existingVote.vote_type === vote_type) {
          return new Response(JSON.stringify({ success: true, message: 'Already voted' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { error: updateError } = await serviceSupabase
          .from('social_comment_votes')
          .update({ vote_type })
          .eq('id', existingVote.id);

        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } else {
        const { error: insertError } = await serviceSupabase
          .from('social_comment_votes')
          .insert({
            comment_id,
            user_id: user.id,
            vote_type
          });

        if (insertError) {
          return new Response(JSON.stringify({ error: insertError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      const { data: upvotes } = await serviceSupabase
        .from('social_comment_votes')
        .select('id')
        .eq('comment_id', comment_id)
        .eq('vote_type', 1);

      const { data: downvotes } = await serviceSupabase
        .from('social_comment_votes')
        .select('id')
        .eq('comment_id', comment_id)
        .eq('vote_type', -1);

      const upvoteCount = upvotes?.length || 0;
      const downvoteCount = downvotes?.length || 0;
      const voteScore = upvoteCount - downvoteCount;

      await serviceSupabase
        .from('social_post_comments')
        .update({ vote_score: voteScore })
        .eq('id', comment_id);

      return new Response(JSON.stringify({ 
        success: true, 
        upvotes: upvoteCount,
        downvotes: downvoteCount,
        voteScore,
        userVote: direction
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'DELETE') {
      const body = await req.json();
      const { comment_id } = body;

      if (!comment_id) {
        return new Response(JSON.stringify({ error: 'Missing comment_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { error: deleteError } = await serviceSupabase
        .from('social_comment_votes')
        .delete()
        .eq('comment_id', comment_id)
        .eq('user_id', user.id);

      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: upvotes } = await serviceSupabase
        .from('social_comment_votes')
        .select('id')
        .eq('comment_id', comment_id)
        .eq('vote_type', 1);

      const { data: downvotes } = await serviceSupabase
        .from('social_comment_votes')
        .select('id')
        .eq('comment_id', comment_id)
        .eq('vote_type', -1);

      const upvoteCount = upvotes?.length || 0;
      const downvoteCount = downvotes?.length || 0;
      const voteScore = upvoteCount - downvoteCount;

      await serviceSupabase
        .from('social_post_comments')
        .update({ vote_score: voteScore })
        .eq('id', comment_id);

      return new Response(JSON.stringify({ 
        success: true, 
        voteScore,
        userVote: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Comment vote error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
