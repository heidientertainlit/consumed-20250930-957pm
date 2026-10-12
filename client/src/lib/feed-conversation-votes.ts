import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedConversationEntry } from "../components/feed-conversation-section";

export type ConversationVote = "up" | "down";
export type ConversationVoteState = {
  upVoteCount: number;
  downVoteCount: number;
  currentUserVote: ConversationVote | null;
};

export async function readReviewVotes(
  client: SupabaseClient, postId: string, viewerId: string,
): Promise<ConversationVoteState> {
  const [post, like, reactions] = await Promise.all([
    client.from("social_posts").select("likes_count").eq("id", postId).single(),
    client.from("social_post_likes").select("id")
      .eq("social_post_id", postId).eq("user_id", viewerId).maybeSingle(),
    client.from("post_reactions").select("user_id, reaction").eq("social_post_id", postId),
  ]);
  for (const result of [post, like, reactions]) {
    if (result.error) throw new Error("Couldn't refresh review votes.");
  }
  if (!post.data) throw new Error("The review could not be found.");
  const disagrees = (reactions.data || []).filter(row => row.reaction === "disagree");
  return {
    upVoteCount: post.data.likes_count || 0,
    downVoteCount: disagrees.length,
    currentUserVote: disagrees.some(row => row.user_id === viewerId) ? "down" : like.data ? "up" : null,
  };
}

export async function voteFeedConversation({
  baseUrl, accessToken, viewerId, entry, direction, client, request = fetch,
}: {
  baseUrl: string;
  accessToken: string;
  viewerId: string;
  entry: FeedConversationEntry;
  direction: ConversationVote;
  client: SupabaseClient;
  request?: typeof fetch;
}): Promise<ConversationVoteState> {
  if (!accessToken || !viewerId) throw new Error("Sign in to vote.");
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  if (entry.kind === "comment") {
    const response = await request(`${baseUrl}/functions/v1/comment-vote`, {
      method: "POST",
      headers,
      body: JSON.stringify({ comment_id: entry.id.slice("comment:".length), direction }),
    });
    if (!response.ok) throw new Error("Couldn't update your comment vote.");
    const result = await response.json();
    if (result.success !== true || !Number.isInteger(result.upVoteCount) || result.upVoteCount < 0
      || !Number.isInteger(result.downVoteCount) || result.downVoteCount < 0
      || ![null, "up", "down"].includes(result.userVote)) {
      throw new Error("The comment vote response was incomplete.");
    }
    return {
      upVoteCount: result.upVoteCount,
      downVoteCount: result.downVoteCount,
      currentUserVote: result.userVote,
    };
  }
  if (!entry.postId) throw new Error("This rating has no review to vote on.");
  const postId = entry.postId;
  // Reviews use the same likes + disagree reactions as their primary feed card.
  const setLike = async (liked: boolean) => {
    const response = await request(`${baseUrl}/functions/v1/social-feed-like`, {
      method: liked ? "POST" : "DELETE", headers, body: JSON.stringify({ post_id: postId }),
    });
    if (!response.ok) throw new Error("Couldn't update your review vote.");
  };
  const clearReaction = async () => {
    const { error } = await client.from("post_reactions").delete()
      .eq("social_post_id", postId).eq("user_id", viewerId);
    if (error) throw new Error("Couldn't clear your previous review vote.");
  };
  if (direction === "up") {
    // Never add a second positive reaction when switching from disagree.
    await clearReaction();
    if (entry.currentUserVote === "up" || !entry.isLiked) {
      await setLike(entry.currentUserVote !== "up");
    }
  } else {
    if (entry.isLiked) await setLike(false);
    if (entry.currentUserVote === "down") {
      await clearReaction();
    } else {
      const { error } = await client.from("post_reactions").upsert({
        social_post_id: postId, user_id: viewerId, reaction: "disagree",
      }, { onConflict: "social_post_id,user_id" });
      if (error) throw new Error("Couldn't update your review vote.");
    }
  }
  return readReviewVotes(client, postId, viewerId);
}
