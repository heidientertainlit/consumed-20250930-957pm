import React, { useState } from "react";
import { Eye } from "lucide-react";

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
  const isRevealed = revealedKey === revealKey;

  if (!containsSpoilers) {
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
    <div className="relative">
      <p
        className={`${className}${isRevealed ? " line-clamp-none" : " select-none blur-md pointer-events-none"}`}
        aria-hidden={!isRevealed}
        style={revealedStyle}
      >
        {text}
      </p>
      {!isRevealed && (
        <button
          type="button"
          data-guest-allowed="true"
          onClick={(event) => {
            event.stopPropagation();
            setRevealedKey(revealKey);
          }}
          className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-md bg-[#f5f1f8]/75 px-3 text-[13px] font-semibold text-[#7040a4] backdrop-blur-[1px] transition-colors hover:bg-[#eee7f5]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a979d2]"
        >
          <Eye size={16} strokeWidth={1.9} aria-hidden="true" />
          <span>Show Spoiler</span>
        </button>
      )}
    </div>
  );
}
