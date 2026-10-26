import { ThumbsDown, ThumbsUp } from "lucide-react";

export const MEDIA_CONVERSATION_PROMPTS = [
  "What stayed with you after this?",
  "I didn't expect…",
  "The part I keep thinking about…",
  "Would you recommend it?",
];

export function ConversationStarterPrompts({
  prompts = MEDIA_CONVERSATION_PROMPTS,
  onSelect,
}: {
  prompts?: string[];
  onSelect: (prompt: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-testid="conversation-starter-prompts">
      {prompts.map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => onSelect(prompt)}
          className="shrink-0 rounded-full border border-violet-200 bg-white px-3.5 py-2 text-xs font-medium text-violet-800 transition-colors hover:border-violet-400 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}

export async function requestCommentVote(
  accessToken: string,
  commentId: string,
  direction: "up" | "down",
  currentVote: "up" | "down" | null,
  fetcher: typeof fetch = fetch,
) {
  const method = currentVote === direction ? "DELETE" : "POST";
  const response = await fetcher(
    `${import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co"}/functions/v1/comment-vote`,
    {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ comment_id: commentId, direction }),
    },
  );
  if (!response.ok) throw new Error((await response.text()) || "Failed to vote on reply");
  const result = await response.json();
  return {
    commentId,
    userVote: normalizeCommentVote(result.userVote ?? result.currentUserVote ?? result.current_user_vote),
    upVoteCount: Number(result.upVoteCount ?? result.up_votes ?? 0),
    downVoteCount: Number(result.downVoteCount ?? result.down_votes ?? 0),
    voteScore: Number(result.voteScore ?? result.vote_score ?? 0),
  };
}

export function normalizeCommentVote(value: unknown): "up" | "down" | null {
  if (value === "up" || value === 1 || value === "1") return "up";
  if (value === "down" || value === -1 || value === "-1") return "down";
  return null;
}

export function normalizeCommentTree(comments: any[]): any[] {
  return (comments || []).map((comment) => ({
    ...comment,
    replies: normalizeCommentTree(comment.replies || []),
  }));
}

export function visibleReplySlice<T>(replies: T[], visibleCount: number): T[] {
  return replies.slice(0, visibleCount);
}

export function remainingReplyCount(replies: unknown[], visibleCount: number): number {
  return Math.max(0, replies.length - visibleCount);
}

export function commentIndentStep(depth: number): number {
  return depth < 3 ? 4 : 0;
}

export function applyCommentVoteToTree(comments: any[], commentId: string, vote: {
  userVote: "up" | "down" | null;
  upVoteCount: number;
  downVoteCount: number;
  voteScore: number;
}): any[] {
  return comments.map((comment) => String(comment.id) === commentId
    ? { ...comment, currentUserVote: vote.userVote, upVoteCount: vote.upVoteCount, downVoteCount: vote.downVoteCount, voteScore: vote.voteScore }
    : { ...comment, replies: applyCommentVoteToTree(comment.replies || [], commentId, vote) });
}

export function CommentVoteActions({
  comment,
  vote,
  onVote,
  disabled = false,
}: {
  comment: any;
  vote: "up" | "down" | null;
  onVote: (direction: "up" | "down") => void;
  disabled?: boolean;
}) {
  const upCount = Number(comment.upVoteCount ?? comment.up_votes ?? comment.likes_count) || 0;
  const downCount = Number(comment.downVoteCount ?? comment.down_votes) || 0;
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" disabled={disabled} onClick={() => onVote("up")} aria-label="Thumbs up on reply" aria-pressed={vote === "up"} data-testid={`comment-vote-up-${comment.id}`} className={`inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors disabled:cursor-wait disabled:opacity-60 ${vote === "up" ? "bg-violet-100 text-violet-700" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`}>
        <ThumbsUp size={13} />{upCount > 0 && <span className="text-[11px]">{upCount}</span>}
      </button>
      <button type="button" disabled={disabled} onClick={() => onVote("down")} aria-label="Thumbs down on reply" aria-pressed={vote === "down"} data-testid={`comment-vote-down-${comment.id}`} className={`inline-flex items-center rounded-full px-2 py-1 transition-colors disabled:cursor-wait disabled:opacity-60 ${vote === "down" ? "bg-violet-100 text-violet-700" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`}>
        <ThumbsDown size={13} />{downCount > 0 && <span className="ml-1 text-[11px]">{downCount}</span>}
      </button>
    </div>
  );
}
