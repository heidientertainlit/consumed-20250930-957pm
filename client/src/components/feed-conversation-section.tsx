import React, { useMemo } from "react";
import { ChevronRight, CornerUpLeft, Flag, Star, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";

export type FeedConversationEntry = {
  id: string;
  userId: string;
  name: string;
  avatar?: string;
  rating?: number;
  content?: string;
  likes: number;
  isLiked: boolean;
  upVoteCount?: number;
  downVoteCount?: number;
  currentUserVote?: "up" | "down" | null;
  kind: "rating" | "comment";
  postId?: string;
  children?: FeedConversationEntry[];
  isOwnRating?: boolean;
};

export interface FeedConversationSectionProps {
  entries: FeedConversationEntry[];
  expanded: boolean;
  onExpand: () => void;
  onVote: (entry: FeedConversationEntry, direction: "up" | "down") => void;
  votePending?: boolean;
  canInteract: boolean;
  currentUserId?: string;
  onReply: (entry: FeedConversationEntry) => void;
  onDelete: (entry: FeedConversationEntry) => void;
  onReport: (entry: FeedConversationEntry) => void;
  renderReply?: (entry: FeedConversationEntry) => React.ReactNode;
  loading?: boolean;
}

function RatingStars({ rating }: { rating: number }) {
  const normalized = Math.max(0, Math.min(5, rating));

  return (
    <span className="inline-flex shrink-0 items-center gap-[2px]" aria-label={`${normalized} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => {
        const fill = Math.max(0, Math.min(1, normalized - value + 1));
        return (
          <span key={value} className="relative inline-flex h-[14px] w-[14px]" aria-hidden="true">
            <Star size={14} className="absolute inset-0 text-[#d8d6dd]" strokeWidth={1.8} />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star size={14} className="max-w-none fill-[#eebc38] text-[#eebc38]" strokeWidth={1.8} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function Avatar({ entry }: { entry: FeedConversationEntry }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eee7f5] text-[13px] font-semibold text-[#7950a8] ring-1 ring-[#e7dfed]">
      {entry.avatar ? (
        <img src={entry.avatar} alt="" className="h-full w-full object-cover" />
      ) : (
        entry.name.trim().charAt(0).toUpperCase() || "?"
      )}
    </span>
  );
}

function EntryRow({
  entry,
  canInteract,
  currentUserId,
  onVote,
  votePending,
  onReply,
  onDelete,
  onReport,
  renderReply,
  expanded,
  nested = false,
  depth = 0,
}: {
  entry: FeedConversationEntry;
  canInteract: boolean;
  currentUserId?: string;
  onVote: (entry: FeedConversationEntry, direction: "up" | "down") => void;
  votePending: boolean;
  onReply: (entry: FeedConversationEntry) => void;
  onDelete: (entry: FeedConversationEntry) => void;
  onReport: (entry: FeedConversationEntry) => void;
  renderReply?: (entry: FeedConversationEntry) => React.ReactNode;
  expanded: boolean;
  nested?: boolean;
  depth?: number;
}) {
  const isOwn = Boolean(entry.isOwnRating || (currentUserId && entry.userId === currentUserId));
  const hasReactionTarget = entry.kind === "comment" || Boolean(entry.postId);
  const canVote = hasReactionTarget && canInteract && !votePending;
  const contentLabel = entry.kind === "rating" ? "review" : "comment";

  return (
    <div className={nested && depth < 3 ? "ml-3 border-l border-[#eee8f1] pl-2 sm:ml-5 sm:pl-3" : ""}>
      <div className="group flex min-w-0 items-start gap-2.5 py-2.5 sm:gap-3">
        <Avatar entry={entry} />
        <div className="min-w-0 flex-1 pt-[1px]">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="max-w-full truncate text-[14px] font-bold leading-5 text-[#1f1c2c]">
              {entry.isOwnRating ? "You" : entry.name}
            </span>
            {entry.rating !== undefined && entry.rating > 0 && <RatingStars rating={entry.rating} />}
            </div>
            {hasReactionTarget && canInteract && (
              <button
                type="button"
                onClick={() => isOwn ? onDelete(entry) : onReport(entry)}
                aria-label={`${isOwn ? "Delete your" : "Report " + entry.name + "'s"} ${contentLabel}`}
                title={isOwn ? "Delete" : "Report"}
                className="-mt-1.5 -mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#b5b5bd] hover:text-[#78658b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a979d2]"
              >
                {isOwn ? <Trash2 size={15} strokeWidth={1.8} /> : <Flag size={15} strokeWidth={1.8} />}
              </button>
            )}
          </div>
          {entry.content?.trim() && (
            <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-[1.45] text-[#45414e]">
              {entry.kind === "rating" ? `“${entry.content}”` : entry.content}
            </p>
          )}
          {hasReactionTarget && (
          <div className="mt-1 flex flex-wrap items-center gap-2" aria-label="Comment actions">
            {(["up", "down"] as const).map(direction => {
              const selected = entry.currentUserVote === direction;
              const Icon = direction === "up" ? ThumbsUp : ThumbsDown;
              return (
                <button
                  key={direction}
                  type="button"
                  disabled={!canVote}
                  onClick={() => onVote(entry, direction)}
                  aria-label={`${selected ? "Remove " : ""}${direction === "up" ? "thumbs up" : "thumbs down"} ${isOwn ? "on your" : "on " + entry.name + "'s"} ${contentLabel}`}
                  aria-pressed={selected}
                  className={`inline-flex min-h-8 min-w-10 items-center justify-center gap-1 rounded-full px-1 text-[12px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a979d2] ${
                    selected ? "text-[#813be2]" : "text-[#a3a3ad]"
                  } ${canVote ? "hover:text-[#813be2]" : "cursor-not-allowed opacity-70"}`}
                >
                  <Icon size={17} strokeWidth={1.8} className={selected ? "fill-[#ede2fc]" : ""} />
                  <span>{direction === "up" ? entry.upVoteCount ?? 0 : entry.downVoteCount ?? 0}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onReply(entry)}
              aria-label={`Reply to ${isOwn ? "your" : entry.name + "'s"} ${contentLabel}`}
              title="Reply"
              className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-[#a3a3ad] hover:text-[#813be2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a979d2]"
            >
              <CornerUpLeft size={19} strokeWidth={1.8} />
            </button>
          </div>
          )}
          {renderReply?.(entry)}
        </div>
      </div>
      {expanded && expandedChildren(entry).map((child) => (
        <EntryRow
          key={child.id}
          entry={child}
          canInteract={canInteract}
          currentUserId={currentUserId}
          onVote={onVote}
          votePending={votePending}
          onReply={onReply}
          onDelete={onDelete}
          onReport={onReport}
          renderReply={renderReply}
          expanded={expanded}
          nested
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

function expandedChildren(entry: FeedConversationEntry): FeedConversationEntry[] {
  return entry.children ?? [];
}

function countDescendants(entry: FeedConversationEntry): number {
  return (entry.children ?? []).reduce((total, child) => total + 1 + countDescendants(child), 0);
}

export function FeedConversationSection({
  entries,
  expanded,
  onExpand,
  onVote,
  votePending = false,
  canInteract,
  currentUserId,
  onReply,
  onDelete,
  onReport,
  renderReply,
  loading = false,
}: FeedConversationSectionProps) {
  const orderedEntries = useMemo(() => {
    const isOwnRating = (entry: FeedConversationEntry) =>
      Boolean(entry.isOwnRating || (entry.kind === "rating" && currentUserId && entry.userId === currentUserId));
    const own = entries.filter(isOwnRating);
    const others = entries.filter((entry) => !own.includes(entry));
    return [...own, ...others];
  }, [entries, currentUserId]);

  const ownCount = orderedEntries.filter((entry) => Boolean(entry.isOwnRating || (entry.kind === "rating" && currentUserId && entry.userId === currentUserId))).length;
  const visibleEntries = expanded ? orderedEntries : orderedEntries.slice(0, ownCount + 3);
  const visibleOtherCount = Math.max(0, visibleEntries.length - ownCount);
  const remainingCount = Math.max(0, orderedEntries.length - ownCount - visibleOtherCount);
  const hiddenChildCount = expanded
    ? 0
    : orderedEntries.reduce((total, entry) => total + countDescendants(entry), 0);
  const totalRemaining = remainingCount + hiddenChildCount;
  const hiddenAreRatings = orderedEntries.slice(visibleEntries.length).every((entry) => entry.kind === "rating") && hiddenChildCount === 0;
  const moreLabel = hiddenAreRatings ? "takes" : "replies";

  return (
    <section className="mx-3 border-y border-[#e9e5eb] px-1 sm:mx-4 sm:px-1" aria-label="Conversation">
      {loading ? (
        <div className="space-y-3 py-3" aria-label="Loading conversation" aria-busy="true">
          {[0, 1].map((item) => (
            <div key={item} className="flex animate-pulse items-center gap-3">
              <span className="h-10 w-10 shrink-0 rounded-full bg-[#eeeaf0]" />
              <span className="h-3 w-2/5 rounded-full bg-[#eeeaf0]" />
              <span className="h-3 flex-1 rounded-full bg-[#f3f0f4]" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div>
            {visibleEntries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                canInteract={canInteract}
                currentUserId={currentUserId}
                onVote={onVote}
                votePending={votePending}
                onReply={onReply}
                onDelete={onDelete}
                onReport={onReport}
                renderReply={renderReply}
                expanded={expanded}
              />
            ))}
          </div>
          {totalRemaining > 0 && !expanded && (
            <button
              type="button"
              data-guest-allowed
              onClick={onExpand}
              aria-label={`View ${totalRemaining} more ${totalRemaining === 1 ? (moreLabel === "takes" ? "take" : "reply") : moreLabel}`}
              className="mb-2 inline-flex min-h-9 items-center gap-1 pl-[3px] pr-2 text-[14px] font-semibold tracking-[-0.01em] text-[#8047d4] transition-colors hover:text-[#6530b4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a979d2] sm:text-[15px]"
            >
              View {totalRemaining} more {totalRemaining === 1 ? (moreLabel === "takes" ? "take" : "reply") : moreLabel}
              <ChevronRight size={20} strokeWidth={2.5} className="ml-1" />
            </button>
          )}
        </>
      )}
    </section>
  );
}
