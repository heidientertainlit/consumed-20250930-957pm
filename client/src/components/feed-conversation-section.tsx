import React, { useId, useMemo, useState } from "react";
import { ChevronRight, Flag, MoreHorizontal, Star, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { FeedSpoilerText } from "./feed-spoiler-text";
import { FeedSpoilerDiscussion } from "./feed-spoiler-discussion";

export type FeedConversationEntry = {
  id: string;
  userId: string;
  name: string;
  avatar?: string;
  rating?: number;
  content?: string;
  containsSpoilers?: boolean;
  likes: number;
  isLiked: boolean;
  upVoteCount?: number;
  downVoteCount?: number;
  currentUserVote?: "up" | "down" | null;
  kind: "rating" | "comment";
  postId?: string;
  threadPostId?: string;
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
  scopeKey?: string | number;
  ratingsExpanded?: boolean;
  onRatingsExpandedChange?: (expanded: boolean) => void;
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

  const row = (
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Options for ${isOwn ? "your" : entry.name + "'s"} ${contentLabel}`}
                    className="-mt-1.5 -mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center text-[#b5b5bd] hover:text-[#78658b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a979d2]"
                  >
                    <MoreHorizontal size={18} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                  {isOwn ? (
                    <DropdownMenuItem
                      aria-label={`Delete your ${contentLabel}`}
                      onSelect={() => onDelete(entry)}
                      className="min-h-11 cursor-pointer text-red-600 focus:text-red-700"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      aria-label={`Flag ${entry.name}'s ${contentLabel}`}
                      onSelect={() => onReport(entry)}
                      className="min-h-11 cursor-pointer"
                    >
                      <Flag size={16} aria-hidden="true" />
                      <span>Flag</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {entry.content?.trim() && (
            <FeedSpoilerText
              contentId={entry.postId || entry.id}
              text={entry.kind === "rating" ? `“${entry.content}”` : entry.content}
              containsSpoilers={entry.containsSpoilers}
              className="mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-[1.45] text-[#45414e]"
            />
          )}
          {hasReactionTarget && (
          <div className="mt-1 flex flex-wrap items-center gap-2" aria-label="Comment actions">
            {(["up", "down"] as const).map(direction => {
              const selected = entry.currentUserVote === direction;
              const Icon = direction === "up" ? ThumbsUp : ThumbsDown;
              const count = (direction === "up" ? entry.upVoteCount : entry.downVoteCount) ?? 0;
              return (
                <button
                  key={direction}
                  type="button"
                  disabled={!canVote}
                  onClick={() => onVote(entry, direction)}
                  aria-label={`${selected ? "Remove " : ""}${direction === "up" ? "thumbs up" : "thumbs down"} ${isOwn ? "on your" : "on " + entry.name + "'s"} ${contentLabel}`}
                  aria-pressed={selected}
                  className={`inline-flex min-h-8 min-w-10 items-center justify-start gap-1 rounded-full text-[12px] tabular-nums text-[#89909D] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a979d2] ${
                    canVote ? "hover:text-gray-600" : "cursor-not-allowed opacity-70"
                  }`}
                >
                  <Icon size={17} strokeWidth={1.75} className={selected ? "fill-[#e5e7eb]" : ""} />
                  {count > 0 && <span>{count}</span>}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onReply(entry)}
              aria-label={`Reply to ${isOwn ? "your" : entry.name + "'s"} ${contentLabel}`}
              title="Reply"
              className="inline-flex min-h-8 items-center justify-start text-[13px] font-normal text-gray-600 hover:text-[#813be2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a979d2]"
            >
              Reply
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

  // Additional reviews are independent discussions, even on a marked card.
  // Their real descendants inherit that review's own spoiler protection.
  return entry.kind === "rating" ? (
    <FeedSpoilerDiscussion
      discussionId={entry.postId || entry.id}
      content={entry.content}
      containsSpoilers={entry.containsSpoilers}
    >
      {row}
    </FeedSpoilerDiscussion>
  ) : row;
}

function expandedChildren(entry: FeedConversationEntry): FeedConversationEntry[] {
  return entry.children ?? [];
}

function countDescendants(entry: FeedConversationEntry): number {
  return (entry.children ?? []).reduce((total, child) => total + 1 + countDescendants(child), 0);
}

function RelatedRatingsDisclosure({
  entries,
  canInteract,
  currentUserId,
  onVote,
  votePending,
  onReply,
  onDelete,
  onReport,
  renderReply,
  expanded: controlledExpanded,
  onExpandedChange,
}: {
  entries: FeedConversationEntry[];
  canInteract: boolean;
  currentUserId?: string;
  onVote: (entry: FeedConversationEntry, direction: "up" | "down") => void;
  votePending: boolean;
  onReply: (entry: FeedConversationEntry) => void;
  onDelete: (entry: FeedConversationEntry) => void;
  onReport: (entry: FeedConversationEntry) => void;
  renderReply?: (entry: FeedConversationEntry) => React.ReactNode;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const listId = useId();
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : localExpanded;

  const validRatings = useMemo(() => {
    const seen = new Set<string>();
    return entries.filter((entry) => {
      if (entry.kind !== "rating" || !entry.userId || !Number.isFinite(entry.rating) || (entry.rating ?? 0) <= 0 || (entry.rating ?? 0) > 5 || seen.has(entry.userId)) {
        return false;
      }
      seen.add(entry.userId);
      return true;
    });
  }, [entries]);
  const average = validRatings.length
    ? (validRatings.reduce((total, entry) => total + (entry.rating ?? 0), 0) / validRatings.length).toFixed(1)
    : null;
  const toggle = () => {
    const next = !isExpanded;
    if (!isControlled) setLocalExpanded(next);
    onExpandedChange?.(next);
  };

  if (!entries.length) return null;

  return (
    <div className="py-2">
      <button
        type="button"
        data-guest-allowed
        data-testid="related-ratings-toggle"
        aria-expanded={isExpanded}
        aria-controls={listId}
        aria-label={average
          ? `Ratings and reviews for this title. Average of these additional ratings: ${average} out of 5 from ${validRatings.length} ${validRatings.length === 1 ? "rating" : "ratings"}. ${isExpanded ? "Hide" : "Show"} ratings and reviews.`
          : `Ratings and reviews for this title. ${entries.length} ${entries.length === 1 ? "review" : "reviews"}. ${isExpanded ? "Hide" : "Show"} ratings and reviews.`}
        onClick={toggle}
        className="group inline-flex min-h-12 max-w-full items-center gap-3 rounded-full px-1.5 text-left transition-colors hover:bg-[#faf8fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a979d2]"
      >
        {validRatings.length > 0 && (
          <span className="flex items-center -space-x-1.5" aria-hidden="true">
            {validRatings.slice(0, 3).map((entry) => (
              <span
                key={entry.userId}
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-[#faf9fb] bg-[#eee7f5] text-[13px] font-semibold text-[#7950a8]"
              >
                {entry.avatar
                  ? <img src={entry.avatar} alt="" className="h-full w-full object-cover" />
                  : entry.name.trim().charAt(0).toUpperCase() || "?"}
              </span>
            ))}
            {validRatings.length > 3 && (
              <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#faf9fb] bg-[#eeeaf1] text-[13px] font-semibold text-[#51465d]">
                +{validRatings.length - 3}
              </span>
            )}
          </span>
        )}
        {average && (
          <>
            <span className="h-9 w-px shrink-0 bg-[#e4dfe8]" aria-hidden="true" />
            <span className="inline-flex items-center gap-1.5 text-[16px] font-bold tabular-nums tracking-[-0.02em] text-[#30243d]">
              <Star size={21} strokeWidth={1.8} className="text-[#49365e]" aria-hidden="true" />
              {average}
            </span>
            <span className="sr-only">Average of these additional ratings</span>
          </>
        )}
        {!average && (
          <span className="text-[14px] font-semibold text-[#7040aa]">
            Ratings &amp; reviews <span className="font-normal text-[#756d7d]">({entries.length})</span>
          </span>
        )}
        <ChevronRight
          size={17}
          strokeWidth={2}
          aria-hidden="true"
          className={`ml-0.5 shrink-0 text-[#9a8ca5] transition-transform ${isExpanded ? "rotate-90" : ""}`}
        />
      </button>
      <div id={listId} data-testid="related-ratings-list" className="mt-1" hidden={!isExpanded}>
        {isExpanded && (
          <>
            {entries.map((entry) => (
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
                expanded
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
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
  scopeKey,
  ratingsExpanded,
  onRatingsExpandedChange,
}: FeedConversationSectionProps) {
  const orderedEntries = useMemo(() => {
    const isOwnRating = (entry: FeedConversationEntry) =>
      Boolean(entry.isOwnRating || (entry.kind === "rating" && currentUserId && entry.userId === currentUserId));
    const own = entries.filter(isOwnRating);
    const others = entries.filter((entry) => !own.includes(entry));
    return [...own, ...others];
  }, [entries, currentUserId]);

  const ratingEntries = orderedEntries.filter((entry) => entry.kind === "rating");
  const commentEntries = orderedEntries.filter((entry) => entry.kind === "comment");
  const ownCount = commentEntries.filter((entry) => Boolean(entry.isOwnRating)).length;
  const visibleEntries = expanded ? commentEntries : commentEntries.slice(0, ownCount + 3);
  const visibleOtherCount = Math.max(0, visibleEntries.length - ownCount);
  const remainingCount = Math.max(0, commentEntries.length - ownCount - visibleOtherCount);
  const hiddenChildCount = expanded
    ? 0
    : commentEntries.reduce((total, entry) => total + countDescendants(entry), 0);
  const totalRemaining = remainingCount + hiddenChildCount;
  const moreLabel = "replies";

  return (
    <section className="mx-3 border-t border-[#e9e5eb] px-1 sm:mx-4 sm:px-1" aria-label="Conversation">
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
          {ratingEntries.length > 0 && (
            <RelatedRatingsDisclosure
              key={scopeKey}
              entries={ratingEntries}
              canInteract={canInteract}
              currentUserId={currentUserId}
              onVote={onVote}
              votePending={votePending}
              onReply={onReply}
              onDelete={onDelete}
              onReport={onReport}
              renderReply={renderReply}
              expanded={ratingsExpanded}
              onExpandedChange={onRatingsExpandedChange}
            />
          )}
          {commentEntries.length > 0 && ratingEntries.length > 0 && (
            <div data-testid="conversation-comments-label" className="pb-1 pt-1 text-[12px] font-medium text-[#827987]">
              Comments
            </div>
          )}
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
              aria-label={`View ${totalRemaining} more ${totalRemaining === 1 ? "reply" : moreLabel}`}
              className="mb-2 inline-flex min-h-9 items-center gap-1 pl-[3px] pr-2 text-[14px] font-semibold tracking-[-0.01em] text-[#8047d4] transition-colors hover:text-[#6530b4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a979d2] sm:text-[15px]"
            >
              View {totalRemaining} more {totalRemaining === 1 ? "reply" : moreLabel}
              <ChevronRight size={20} strokeWidth={2.5} className="ml-1" />
            </button>
          )}
        </>
      )}
    </section>
  );
}
