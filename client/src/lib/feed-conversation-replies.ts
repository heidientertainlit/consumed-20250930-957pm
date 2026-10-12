import type { FeedConversationEntry } from "../components/feed-conversation-section";

export function conversationReplyTarget(entry: FeedConversationEntry, primaryPostId: string) {
  if (entry.kind === "rating") {
    if (!entry.postId) throw new Error("This rating has no review to reply to.");
    return { postId: entry.postId, parentCommentId: undefined };
  }
  return {
    postId: entry.threadPostId || primaryPostId,
    parentCommentId: entry.id.slice("comment:".length),
  };
}

export async function postConversationReply({
  baseUrl, accessToken, entry, primaryPostId, content, request = fetch,
}: {
  baseUrl: string;
  accessToken: string;
  entry: FeedConversationEntry;
  primaryPostId: string;
  content: string;
  request?: typeof fetch;
}) {
  if (!accessToken) throw new Error("Sign in to reply.");
  if (!content.trim()) throw new Error("Write a reply first.");
  const target = conversationReplyTarget(entry, primaryPostId);
  const response = await request(`${baseUrl}/functions/v1/social-feed-comments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      post_id: target.postId, content: content.trim(),
      ...(target.parentCommentId ? { parent_comment_id: target.parentCommentId } : {}),
    }),
  });
  if (!response.ok) throw new Error("Couldn't post your reply. Your draft is still here.");
  return target;
}
