import React, { useEffect, useId, useRef, useState } from "react";
import { EyeOff } from "lucide-react";
import { useFeedSpoilerDiscussion } from "./feed-spoiler-discussion";

export interface FeedSpoilerTextProps {
  contentId: string;
  text: string;
  containsSpoilers?: boolean;
  className?: string;
  expandable?: boolean;
}

function ExpandableReview({ text, className }: { text: string; className: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const paragraph = useRef<HTMLParagraphElement>(null);
  const id = useId();

  useEffect(() => {
    const node = paragraph.current;
    if (!node || expanded) return;
    const measure = () => setOverflowing(node.scrollHeight > node.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [expanded, text, className]);

  const canToggle = overflowing || expanded;
  const toggle = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    setExpanded(value => !value);
  };

  return (
    <div>
      <p
        ref={paragraph}
        id={id}
        className={`${className}${canToggle ? " cursor-pointer" : ""}`}
        style={expanded ? { display: "block", overflow: "visible", WebkitLineClamp: "unset", overflowWrap: "anywhere" } : undefined}
        role={canToggle ? "button" : undefined}
        tabIndex={canToggle ? 0 : undefined}
        aria-expanded={canToggle ? expanded : undefined}
        data-guest-allowed="true"
        onClick={canToggle ? toggle : undefined}
        onKeyDown={canToggle ? event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle(event);
          }
        } : undefined}
      >{text}</p>
      {canToggle && (
        <button
          type="button"
          data-guest-allowed="true"
          aria-controls={id}
          aria-expanded={expanded}
          className="mt-1 text-xs font-semibold text-violet-600"
          onClick={toggle}
        >{expanded ? "Show less" : "Read more"}</button>
      )}
    </div>
  );
}

export function FeedSpoilerText({
  contentId,
  text,
  containsSpoilers = false,
  className = "",
  expandable = false,
}: FeedSpoilerTextProps) {
  const revealKey = JSON.stringify([contentId, text]);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const discussion = useFeedSpoilerDiscussion();
  const isRevealed = discussion ? discussion.revealed : revealedKey === revealKey;

  if (!containsSpoilers && !discussion?.containsSpoilers) {
    if (expandable) return <ExpandableReview key={revealKey} text={text} className={className} />;
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
