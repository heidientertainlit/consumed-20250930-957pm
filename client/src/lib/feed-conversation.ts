import { formatFeedName } from "./feed-name";
import type { FeedConversationEntry } from "../components/feed-conversation-section";

export interface RelatedFeedRating {
  userId: string;
  userName: string;
  displayName: string;
  avatar?: string;
  rating: number;
  content?: string;
  postId?: string;
  likes?: number;
  isLiked?: boolean;
}

/** Put the viewer's rating on their comment; preserve distinct text and threads. */
export function buildFeedConversation({
  ratings, comments, viewerId, ownRating, ownAvatar, blockedUserIds = [],
}: {
  ratings: RelatedFeedRating[];
  comments: any[];
  viewerId?: string;
  ownRating?: number;
  ownAvatar?: string;
  blockedUserIds?: string[];
}): FeedConversationEntry[] {
  const blocked = new Set(blockedUserIds);
  const commentEntry = (comment: any): FeedConversationEntry => ({
    id: `comment:${comment.id}`,
    userId: comment.user?.id || comment.userId || comment.user_id || "",
    name: formatFeedName(comment.user?.displayName, comment.user?.username || comment.username),
    avatar: comment.user?.avatar,
    kind: "comment",
    content: comment.content,
    likes: comment.likesCount ?? comment.likes_count ?? 0,
    isLiked: comment.isLiked ?? comment.likedByCurrentUser ?? false,
    children: (comment.replies || []).filter((child: any) =>
      !blocked.has(child.user?.id || child.userId || child.user_id)
    ).map(commentEntry),
  });
  const rows = comments.filter(c => !blocked.has(c.user?.id || c.userId || c.user_id)).map(commentEntry);
  const normalize = (text?: string) => (text || "").trim().replace(/\s+/g, " ");
  const viewerReview = ratings.find(rating => rating.userId === viewerId)?.content;
  const ownComment = viewerId && ownRating && ownRating > 0
    ? (viewerReview?.trim()
        ? rows.find(row => row.userId === viewerId && normalize(row.content) === normalize(viewerReview))
        : undefined)
      || rows.find(row => row.userId === viewerId && row.content?.trim())
      || rows.find(row => row.userId === viewerId)
    : undefined;
  if (ownComment) {
    ownComment.rating = ownRating;
    ownComment.isOwnRating = true;
    ownComment.name = "You";
  }
  const seenRatings = new Set<string>();
  for (const rating of ratings) {
    if (blocked.has(rating.userId) || seenRatings.has(rating.userId)) continue;
    seenRatings.add(rating.userId);
    // The current rating read/save, not an older related-ratings response, wins.
    const value = rating.userId === viewerId ? ownRating : rating.rating;
    if (!value || value <= 0) continue;
    const identicalComment = rating.content?.trim()
      ? rows.find(row => row.userId === rating.userId && normalize(row.content) === normalize(rating.content))
      : undefined;
    if (identicalComment) {
      identicalComment.rating = value;
      identicalComment.isOwnRating = rating.userId === viewerId;
      if (identicalComment.isOwnRating) identicalComment.name = "You";
    } else {
      const attachedToOwnComment = rating.userId === viewerId && Boolean(ownComment);
      if (attachedToOwnComment && !rating.content?.trim()) continue;
      rows.push({
        id: `rating:${rating.userId}`, userId: rating.userId,
        name: rating.userId === viewerId && !attachedToOwnComment ? "You" : rating.displayName,
        avatar: rating.avatar, rating: attachedToOwnComment ? undefined : value, content: rating.content,
        kind: "rating", postId: rating.postId,
        likes: rating.likes || 0, isLiked: rating.isLiked || false,
        isOwnRating: rating.userId === viewerId && !attachedToOwnComment,
      });
    }
  }
  if (viewerId && ownRating && ownRating > 0 && !rows.some(row => row.isOwnRating)) {
    rows.unshift({
      id: `rating:${viewerId}`, userId: viewerId, name: "You", avatar: ownAvatar,
      rating: ownRating, kind: "rating", likes: 0, isLiked: false, isOwnRating: true,
    });
  }
  return [...rows.filter(row => row.isOwnRating), ...rows.filter(row => !row.isOwnRating)];
}

export async function toggleFeedConversationLike(
  baseUrl: string,
  accessToken: string,
  entry: FeedConversationEntry,
  request: typeof fetch = fetch,
) {
  if (!accessToken) throw new Error("Sign in to like a reply.");
  const isComment = entry.kind === "comment";
  const targetId = isComment ? entry.id.slice("comment:".length) : entry.postId;
  if (!targetId) throw new Error("This rating has no review to like.");
  const response = await request(`${baseUrl}/functions/v1/${isComment ? "social-comment-like" : "social-feed-like"}`, {
    method: entry.isLiked ? "DELETE" : "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(isComment ? { comment_id: targetId } : { post_id: targetId }),
  });
  if (!response.ok) throw new Error("Couldn't update this like. Please try again.");
}
