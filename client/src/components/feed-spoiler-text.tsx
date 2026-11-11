import React, { useState } from "react";
import { EyeOff } from "lucide-react";
import { useFeedSpoilerDiscussion } from "./feed-spoiler-discussion";

export interface FeedSpoilerTextProps {
  contentId: string;
  text: string;
  containsSpoilers?: boolean;
  className?: string;
}

export function FeedSpoilerText({
  contentId,
  text,
  containsSpoilers = false,
  className = "",
}: FeedSpoilerTextProps) {
  const revealKey = JSON.stringify([contentId, text]);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const discussion = useFeedSpoilerDiscussion();
  const isRevealed = discussion ? discussion.revealed : revealedKey === revealKey;

  if (!containsSpoilers && !discussion?.containsSpoilers) {
    return <p className={className}>{text}</p>;
  }

  const revealedStyle: React.CSSProperties | undefined = isRevealed
    ? {
        display: "block",
        overflow: "visible",
        WebkitBoxOrient: "initial",
        WebkitLineClamp: "unset",
      }
    : undefined;

  return (
    <div className={`relative${isRevealed ? "" : " min-h-11"}`}>
      <p
        className={`${className}${isRevealed ? " line-clamp-none" : " select-none blur-sm pointer-events-none"}`}
        aria-hidden={!isRevealed}
        style={revealedStyle}
      >
        {text}
      </p>
      {!isRevealed && (
        <button
          type="button"
          data-guest-allowed="true"
          aria-label="Show Spoiler"
          onClick={(event) => {
            event.stopPropagation();
            if (discussion) discussion.reveal();
            else setRevealedKey(revealKey);
          }}
          className="absolute left-1/2 top-1/2 z-10 flex min-h-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#eee7f5]/80 px-3 text-[13px] font-semibold text-[#7040a4] transition-colors hover:bg-[#e8ddf2]/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a979d2]"
        >
          <EyeOff size={16} strokeWidth={1.9} aria-hidden="true" />
          <span>Spoiler</span>
        </button>
      )}
    </div>
  );
}
