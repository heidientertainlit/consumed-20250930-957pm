import React, { useId, useRef, type FormEvent } from "react";
import { Gamepad2, MessageCircle, Send } from "lucide-react";

type MediaTab = "takes" | "play";

interface MediaDetailTabsProps {
  value: MediaTab;
  onChange: (value: MediaTab) => void;
}

interface MediaTakeInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<unknown>;
  posting: boolean;
  avatarUrl?: string;
  avatarLabel?: string;
  canPost: boolean;
  onRequireSignIn: () => void;
}

export function MediaDetailTabs({ value, onChange }: MediaDetailTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Media activity"
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? "takes"
          : event.key === "End" ? "play"
          : value === "takes" ? "play" : "takes";
        onChange(next);
        event.currentTarget.querySelector<HTMLButtonElement>(`#media-tab-${next}`)?.focus();
      }}
      className="grid w-full grid-cols-2 rounded-full bg-[#f0eff2] p-[3px]"
    >
      <button
        type="button"
        role="tab"
        id="media-tab-takes"
        aria-selected={value === "takes"}
        tabIndex={value === "takes" ? 0 : -1}
        aria-controls="media-panel-takes"
        data-testid="tab-takes"
        onClick={() => onChange("takes")}
        className={`flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7040dc] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f0eff2] ${
          value === "takes"
            ? "bg-[#7040dc] text-white shadow-[0_1px_3px_rgba(48,25,93,0.18)]"
            : "text-[#64636d] hover:bg-[#e9e7ed] hover:text-[#35333d]"
        }`}
      >
        <MessageCircle aria-hidden="true" size={16} strokeWidth={2.1} />
        <span>Takes</span>
      </button>
      <button
        type="button"
        role="tab"
        id="media-tab-play"
        aria-selected={value === "play"}
        tabIndex={value === "play" ? 0 : -1}
        aria-controls="media-panel-play"
        data-testid="tab-play"
        onClick={() => onChange("play")}
        className={`flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7040dc] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f0eff2] ${
          value === "play"
            ? "bg-[#7040dc] text-white shadow-[0_1px_3px_rgba(48,25,93,0.18)]"
            : "text-[#64636d] hover:bg-[#e9e7ed] hover:text-[#35333d]"
        }`}
      >
        <Gamepad2 aria-hidden="true" size={17} strokeWidth={2} />
        <span>Play</span>
      </button>
    </div>
  );
}

export function MediaTakesHeading({ count }: { count: number }) {
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const formattedCount =
    safeCount < 1000
      ? String(safeCount)
      : new Intl.NumberFormat("en", {
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(safeCount);

  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <h2
        id="media-takes-heading"
        data-testid="media-takes-heading"
        className="text-[17px] font-bold leading-tight tracking-[-0.035em] text-[#171925] sm:text-[18px]"
      >
        What people are saying
      </h2>
      <span className="shrink-0 text-[12px] font-medium tabular-nums text-[#85838d] sm:text-[13px]">
        {formattedCount} {safeCount === 1 ? "take" : "takes"}
      </span>
    </div>
  );
}

function Avatar({
  avatarUrl,
  avatarLabel,
}: Pick<MediaTakeInputProps, "avatarUrl" | "avatarLabel">) {
  const initials = avatarLabel
    ?.trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={avatarLabel ? `${avatarLabel}'s avatar` : ""}
        className="h-9 w-9 shrink-0 rounded-full bg-[#eeeaf4] object-cover"
      />
    );
  }

  return (
    <span
      aria-label={avatarLabel || "Your profile"}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eeeaf4] text-[11px] font-bold text-[#74658e]"
    >
      {initials || <span aria-hidden="true" className="h-3 w-3 rounded-full bg-[#c8bfd8]" />}
    </span>
  );
}

export function MediaTakeInput({
  value,
  onChange,
  onSubmit,
  posting,
  avatarUrl,
  avatarLabel,
  canPost,
  onRequireSignIn,
}: MediaTakeInputProps) {
  const inputId = useId();
  const submitted = useRef(false);
  const hasText = value.trim().length > 0;
  const submitDisabled = posting || !hasText;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!submitDisabled && canPost && !submitted.current) {
      submitted.current = true;
      try {
        await onSubmit();
      } finally {
        submitted.current = false;
      }
    }
  };

  return (
    <div
      data-testid="media-take-input"
      className="w-full rounded-full border border-[#e8e6eb] bg-white p-1.5 shadow-[0_2px_9px_rgba(38,31,52,0.055)] transition-colors focus-within:border-[#c9b8ef] focus-within:ring-2 focus-within:ring-[#7040dc]/10"
    >
      {!canPost ? (
        <button
          type="button"
          data-testid="input-media-take"
          aria-label="Sign in to add your take"
          onClick={onRequireSignIn}
          className="flex min-h-9 w-full items-center gap-3 rounded-full px-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7040dc]"
        >
          <Avatar avatarUrl={avatarUrl} avatarLabel={avatarLabel} />
          <span className="min-w-0 flex-1 py-2 text-[14px] leading-5 text-[#85838d]">
            Add your take…
          </span>
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7040dc] text-white"
          >
            <Send size={15} strokeWidth={2.2} />
          </span>
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="flex min-h-9 items-center gap-3">
          <Avatar avatarUrl={avatarUrl} avatarLabel={avatarLabel} />
          <label htmlFor={inputId} className="sr-only">
            Add your take
          </label>
          <textarea
            id={inputId}
            data-testid="input-media-take"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Add your take…"
            rows={1}
            disabled={posting}
            className="min-h-9 max-h-28 min-w-0 flex-1 resize-none self-center bg-transparent py-2 text-[14px] leading-5 text-[#24222b] placeholder:text-[#85838d] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            onInput={(event) => {
              const textarea = event.currentTarget;
              textarea.style.height = "auto";
              textarea.style.height = `${Math.min(textarea.scrollHeight, 112)}px`;
            }}
          />
          <button
            type="submit"
            aria-label="Post your take"
            data-testid="button-send-take"
            disabled={submitDisabled}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7040dc] text-white transition-[transform,background-color,opacity] duration-150 hover:bg-[#6033cb] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7040dc] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[#b8a6dc] disabled:opacity-70"
          >
            <Send
              aria-hidden="true"
              size={15}
              strokeWidth={2.2}
              className={posting ? "animate-pulse" : ""}
            />
          </button>
        </form>
      )}
    </div>
  );
}
