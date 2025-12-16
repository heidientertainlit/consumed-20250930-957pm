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
      const post_id = url.searchParams.get('post_id');
      const includeMeta = url.searchParams.get('include') === 'meta';

      if (!post_id) {
        return new Response(JSON.stringify({ error: 'Missing post_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const serviceSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '', 
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', 
      );

      // Fetch all comments for this post (including replies)
      const { data: comments, error } = await serviceSupabase
        .from('social_post_comments')
        .select(`
          id,
          content,
          created_at,
          user_id,
          parent_comment_id,
          users!inner(user_name, email)
        `)
        .eq('social_post_id', post_id)
        .order('created_at', { ascending: true });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let transformedComments = comments?.map(comment => ({
        ...comment,
        username: comment.users?.user_name || comment.users?.email?.split('@')[0]
      })) || [];

      // Always include vote metadata for comments
      if (comments && comments.length > 0) {
        const commentIds = comments.map(c => c.id);
        
        // Get all votes on these comments to compute vote scores (gracefully handle if table doesn't exist)
        let allVotes: any[] = [];
        try {
          const { data: votesData } = await serviceSupabase
            .from('social_comment_votes')
            .select('comment_id, vote_type, user_id')
            .in('comment_id', commentIds);
          allVotes = votesData || [];
        } catch (e) {
          // Table might not exist yet, continue without votes
          console.log('social_comment_votes table not found, skipping vote data');
        }

        // Compute vote counts for each comment and track user's vote
        const upVoteMap: Record<string, number> = {};
        const downVoteMap: Record<string, number> = {};
        const userVoteMap: Record<string, string> = {};
        allVotes.forEach(vote => {
          if (vote.vote_type === 1) {
            upVoteMap[vote.comment_id] = (upVoteMap[vote.comment_id] || 0) + 1;
          } else if (vote.vote_type === -1) {
            downVoteMap[vote.comment_id] = (downVoteMap[vote.comment_id] || 0) + 1;
          }
          if (vote.user_id === user.id) {
            userVoteMap[vote.comment_id] = vote.vote_type === 1 ? 'up' : 'down';
          }
        });

        // Include like metadata if requested
        if (includeMeta) {
          // Get like counts for each comment
          const { data: likeCounts } = await serviceSupabase
            .from('social_comment_likes')
            .select('comment_id')
            .in('comment_id', commentIds);

          const likeCountMap: Record<number, number> = {};
          likeCounts?.forEach(like => {
            likeCountMap[like.comment_id] = (likeCountMap[like.comment_id] || 0) + 1;
          });

          // Check which comments current user has liked
          const { data: userLikes } = await serviceSupabase
            .from('social_comment_likes')
            .select('comment_id')
            .eq('user_id', user.id)
            .in('comment_id', commentIds);

          const userLikedSet = new Set(userLikes?.map(l => l.comment_id));

          // Add all metadata to each comment
          transformedComments = transformedComments.map(comment => ({
            ...comment,
            likesCount: likeCountMap[comment.id] || 0,
            isLiked: userLikedSet.has(comment.id),
            upVoteCount: upVoteMap[comment.id] || 0,
            downVoteCount: downVoteMap[comment.id] || 0,
            voteScore: (upVoteMap[comment.id] || 0) - (downVoteMap[comment.id] || 0),
            currentUserVote: userVoteMap[comment.id] || null
          }));
        } else {
          // Add vote metadata only
          transformedComments = transformedComments.map(comment => ({
            ...comment,
            upVoteCount: upVoteMap[comment.id] || 0,
            downVoteCount: downVoteMap[comment.id] || 0,
            voteScore: (upVoteMap[comment.id] || 0) - (downVoteMap[comment.id] || 0),
            currentUserVote: userVoteMap[comment.id] || null
          }));
        }
      }

      // Build nested tree structure
      const nestedComments = buildCommentTree(transformedComments);

      return new Response(JSON.stringify({ comments: nestedComments }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { post_id, content, parent_comment_id } = body;

      if (!post_id || !content) {
        return new Response(JSON.stringify({ error: 'Missing post_id or content' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const serviceSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '', 
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', 
      );

      const insertData: any = {
        social_post_id: post_id,
        user_id: user.id,
        content
      };

      // Add parent_comment_id if this is a reply
      if (parent_comment_id) {
        insertData.parent_comment_id = parent_comment_id;
      }

      const { data: comment, error } = await serviceSupabase
        .from('social_post_comments')
        .insert(insertData)
        .select(`
          id,
          content,
          created_at,
          user_id,
          parent_comment_id,
          users!inner(user_name, email)
        `)
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const transformedComment = {
        ...comment,
        username: comment.users?.user_name || comment.users?.email?.split('@')[0],
        likesCount: 0,
        isLiked: false,
        voteScore: 0,
        currentUserVote: null,
        replies: []
      };

      // Send notification
      let notifyUserId = null;
      let notificationType = 'comment';
      let notificationMessage = '';
      const commenterName = comment.users?.user_name || comment.users?.email?.split('@')[0] || 'Someone';

      if (parent_comment_id) {
        // This is a reply - notify the parent comment author
        const { data: parentComment } = await serviceSupabase
          .from('social_post_comments')
          .select('user_id')
          .eq('id', parent_comment_id)
          .single();
        
        if (parentComment && parentComment.user_id !== user.id) {
          notifyUserId = parentComment.user_id;
          notificationType = 'comment_reply';
          notificationMessage = `${commenterName} replied to your comment`;
        }
      } else {
        // Top-level comment - notify post author
        const { data: post } = await serviceSupabase
          .from('social_posts')
          .select('user_id')
          .eq('id', post_id)
          .single();

        if (post && post.user_id !== user.id) {
          notifyUserId = post.user_id;
          notificationType = 'comment';
          notificationMessage = `${commenterName} commented on your post`;
        }
      }

      // Send notification if we have a recipient
      if (notifyUserId) {
        try {
          const notifResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              userId: notifyUserId,
              type: notificationType,
              triggeredByUserId: user.id,
              message: notificationMessage,
              postId: post_id,
              commentId: comment.id
            })
          });
          
          if (!notifResponse.ok) {
            console.error('Failed to send notification:', await notifResponse.text());
          }
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
        }
      }

      // Extract @mentions and send notifications (with deduplication)
      if (content) {
        // Whitelist pattern: @ must be at start OR preceded by allowed punctuation/whitespace
        // Allows: "@alex", " @alex", ",@alex", "(@alex", "FYI:@alex", "!@alex"
        // Blocks: "user@alex", "http://@alex", "?ref=@alex", "&id=@alex"
        const mentionPattern = /(^|[\s,;:!?(){}\[\]"'<>\-])@([\w.-]+)/g;
        const mentions: string[] = [];
        let match;
        
        while ((match = mentionPattern.exec(content)) !== null) {
          mentions.push(match[2]); // Group 2 is the username (group 1 is delimiter)
        }

        if (mentions.length > 0) {
          console.log('Found mentions in comment:', mentions);
          
          // Look up user IDs for mentioned usernames
          const { data: mentionedUsers } = await serviceSupabase
            .from('users')
            .select('id, user_name')
            .in('user_name', mentions);

          if (mentionedUsers && mentionedUsers.length > 0) {
            // Deduplicate: don't send mention notification if user already received comment notification
            const alreadyNotified = notifyUserId; // User who already got comment/reply notification
            
            // Send notification to each mentioned user
            for (const mentionedUser of mentionedUsers) {
              // Skip if: mentioning yourself OR already notified as post/comment author
              if (mentionedUser.id !== user.id && mentionedUser.id !== alreadyNotified) {
                try {
                  const notifResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                    },
                    body: JSON.stringify({
                      userId: mentionedUser.id,
                      type: 'mention',
                      triggeredByUserId: user.id,
                      message: `${commenterName} mentioned you in a comment`,
                      postId: post_id,
                      commentId: comment.id
                    })
                  });
                  
                  if (!notifResponse.ok) {
                    console.error('Failed to send mention notification:', await notifResponse.text());
                  }
                } catch (notifError) {
                  console.error('Error sending mention notification:', notifError);
                }
              }
            }
          }
        }
      }

      return new Response(JSON.stringify({ comment: transformedComment }), {
        status: 201,
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
