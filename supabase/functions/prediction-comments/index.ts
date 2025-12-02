import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Helper function to build nested comment tree
function buildCommentTree(flatComments: any[]) {
  const commentMap = new Map();
  const rootComments: any[] = [];

  // First pass: create a map of all comments
  flatComments.forEach(comment => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });

  // Second pass: build the tree
  flatComments.forEach(comment => {
    const commentNode = commentMap.get(comment.id);
    if (comment.parent_comment_id) {
      const parent = commentMap.get(comment.parent_comment_id);
      if (parent) {
        parent.replies.push(commentNode);
      } else {
        // Parent doesn't exist (orphan), treat as root
        rootComments.push(commentNode);
      }
    } else {
      rootComments.push(commentNode);
    }
  });

  return rootComments;
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const pool_id = url.searchParams.get('pool_id');
      const includeMeta = url.searchParams.get('include') === 'meta';

      if (!pool_id) {
        return new Response(JSON.stringify({ error: 'Missing pool_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const serviceSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '', 
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', 
      );

      // Fetch all comments for this prediction pool (including replies)
      const { data: comments, error } = await serviceSupabase
        .from('prediction_comments')
        .select(`
          id,
          content,
          created_at,
          user_id,
          parent_comment_id
        `)
        .eq('pool_id', pool_id)
        .order('created_at', { ascending: true });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Fetch user info for all commenters
      const userIds = [...new Set(comments?.map(c => c.user_id) || [])];
      const userMap: Record<string, { user_name?: string; email?: string }> = {};
      
      if (userIds.length > 0) {
        const { data: users } = await serviceSupabase
          .from('users')
          .select('id, user_name, email')
          .in('id', userIds);
        
        users?.forEach(u => {
          userMap[u.id] = { user_name: u.user_name, email: u.email };
        });
      }

      let transformedComments = comments?.map(comment => ({
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at,
        user_id: comment.user_id,
        parent_comment_id: comment.parent_comment_id,
        username: userMap[comment.user_id]?.user_name || userMap[comment.user_id]?.email?.split('@')[0] || 'Anonymous'
      })) || [];

      // Include like metadata if requested
      if (includeMeta && comments && comments.length > 0) {
        const commentIds = comments.map(c => c.id);
        
        // Get like counts for each comment
        const { data: likeCounts } = await serviceSupabase
          .from('prediction_comment_likes')
          .select('comment_id')
          .in('comment_id', commentIds);

        const likeCountMap: Record<number, number> = {};
        likeCounts?.forEach(like => {
          likeCountMap[like.comment_id] = (likeCountMap[like.comment_id] || 0) + 1;
        });

        // Check which comments current user has liked
        const { data: userLikes } = await serviceSupabase
          .from('prediction_comment_likes')
          .select('comment_id')
          .eq('user_id', user.id)
          .in('comment_id', commentIds);

        const userLikedSet = new Set(userLikes?.map(l => l.comment_id));

        // Add metadata to each comment
        transformedComments = transformedComments.map(comment => ({
          ...comment,
          likesCount: likeCountMap[comment.id] || 0,
          isLiked: userLikedSet.has(comment.id)
        }));
      }

      // Build nested tree structure
      const nestedComments = buildCommentTree(transformedComments);

      return new Response(JSON.stringify({ comments: nestedComments }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { pool_id, content, parent_comment_id } = body;

      if (!pool_id || !content) {
        return new Response(JSON.stringify({ error: 'Missing pool_id or content' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const serviceSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '', 
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', 
      );

      const insertData: any = {
        pool_id: pool_id,
        user_id: user.id,
        content
      };

      // Add parent_comment_id if this is a reply
      if (parent_comment_id) {
        insertData.parent_comment_id = parent_comment_id;
      }

      const { data: comment, error } = await serviceSupabase
        .from('prediction_comments')
        .insert(insertData)
        .select(`
          id,
          content,
          created_at,
          user_id,
          parent_comment_id
        `)
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Fetch user info separately using service client
      const { data: userData } = await serviceSupabase
        .from('users')
        .select('user_name, email')
        .eq('id', user.id)
        .single();

      // Increment comments_count on the prediction pool
      const { data: pool } = await serviceSupabase
        .from('prediction_pools')
        .select('comments_count')
        .eq('id', pool_id)
        .single();

      if (pool) {
        await serviceSupabase
          .from('prediction_pools')
          .update({ comments_count: (pool.comments_count || 0) + 1 })
          .eq('id', pool_id);
      }

      const transformedComment = {
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at,
        user_id: comment.user_id,
        parent_comment_id: comment.parent_comment_id,
        username: userData?.user_name || userData?.email?.split('@')[0] || user.email?.split('@')[0],
        likesCount: 0,
        isLiked: false,
        replies: []
      };

      return new Response(JSON.stringify({ comment: transformedComment }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'DELETE') {
      const url = new URL(req.url);
      const comment_id = url.searchParams.get('comment_id');

      if (!comment_id) {
        return new Response(JSON.stringify({ error: 'Missing comment_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const serviceSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '', 
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', 
      );

      // Verify the comment exists and belongs to the user
      const { data: comment, error: fetchError } = await serviceSupabase
        .from('prediction_comments')
        .select('id, user_id, pool_id')
        .eq('id', comment_id)
        .single();

      if (fetchError || !comment) {
        return new Response(JSON.stringify({ error: 'Comment not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (comment.user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Not authorized to delete this comment' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Delete the comment
      const { error: deleteError } = await serviceSupabase
        .from('prediction_comments')
        .delete()
        .eq('id', comment_id);

      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Decrement comments_count on the prediction pool
      const { data: pool } = await serviceSupabase
        .from('prediction_pools')
        .select('comments_count')
        .eq('id', comment.pool_id)
        .single();

      if (pool && pool.comments_count > 0) {
        await serviceSupabase
          .from('prediction_pools')
          .update({ comments_count: pool.comments_count - 1 })
          .eq('id', comment.pool_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
