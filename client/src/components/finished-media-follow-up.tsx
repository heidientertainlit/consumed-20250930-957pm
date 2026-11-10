import { useRef, useState } from "react";
import { Check, Star } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

export interface FinishedMediaFollowUpProps {
  isOpen: boolean;
  media: { title: string; mediaType: string; imageUrl?: string } | null;
  rating: number;
  reaction: string;
  busy: boolean;
  error: string | null;
  elevated?: boolean;
  onRatingChange: (rating: number) => void;
  onReactionChange: (text: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function FinishedMediaFollowUpContent({
  media,
  rating,
  reaction,
  busy,
  error,
  onRatingChange,
  onReactionChange,
  onSubmit,
  onClose,
}: FinishedMediaFollowUpProps) {
  const ratingTrackRef = useRef<HTMLDivElement>(null);
  const [ratingPreview, setRatingPreview] = useState(0);
  const hasReaction = reaction.trim().length > 0;
  const canSubmit = !busy && (rating > 0 || hasReaction);

  if (!media) return null;

  const previewRatingAt = (clientX: number) => {
    if (busy) return;
    const track = ratingTrackRef.current;
    if (!track) return;
    const bounds = track.getBoundingClientRect();
    const offset = Math.min(Math.max(clientX - bounds.left, 0), bounds.width);
    setRatingPreview(Math.max(0.5, Math.min(5, Math.ceil((offset / bounds.width) * 10) / 2)));
  };

  const commitDraggedRating = () => {
    if (!busy && ratingPreview > 0) onRatingChange(ratingPreview);
    setRatingPreview(0);
  };

  const displayRating = ratingPreview || rating;

  return (
    <div className="flex max-h-[min(88dvh,760px)] flex-col overflow-hidden bg-white">
      <div className="shrink-0 px-5 pt-5 pb-4">
        <div className="flex items-start gap-3.5">
          <div className="h-[76px] w-[58px] shrink-0 overflow-hidden rounded-xl bg-purple-50 ring-1 ring-purple-100">
            {media.imageUrl ? (
              <img src={media.imageUrl} alt={`${media.title} cover`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Star aria-hidden="true" size={23} className="text-purple-300" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <Check size={13} aria-hidden="true" />
              Added to Finished
            </div>
            <p className="truncate text-[17px] font-bold leading-snug text-slate-900">{media.title}</p>
            <p className="mt-0.5 text-sm capitalize text-slate-500">{media.mediaType}</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-5">
        <div className="border-t border-slate-100 pt-4">
          <h2 className="text-[21px] font-bold tracking-tight text-slate-900">What did you think?</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            Leave a reaction, a rating, or both. Both are optional.
          </p>

          <label htmlFor="finished-reaction" className="mt-4 block text-sm font-semibold text-slate-800">
            Your reaction <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="finished-reaction"
            value={reaction}
            onChange={(event) => onReactionChange(event.target.value)}
            disabled={busy}
            maxLength={5000}
            rows={4}
            placeholder="What stayed with you?"
            className="mt-2 min-h-[104px] w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] leading-relaxed text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100 disabled:cursor-not-allowed disabled:opacity-60"
            aria-describedby="finished-reaction-visibility"
          />
          <div className="mt-2 flex items-start justify-between gap-3">
            <p id="finished-reaction-visibility" className="text-xs leading-relaxed text-purple-700">
              Reactions and ratings are public and will appear on the feed.
            </p>
            <span className="shrink-0 text-xs tabular-nums text-slate-400">{reaction.length}/5000</span>
          </div>

          <div className="mt-5 rounded-2xl border border-purple-100 bg-purple-50/50 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">
                Add a rating <span className="font-normal text-slate-400">(optional)</span>
              </p>
              {rating > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onRatingChange(0);
                    setRatingPreview(0);
                  }}
                  disabled={busy}
                  className="text-xs font-semibold text-purple-700 underline decoration-purple-300 underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear rating
                </button>
              )}
            </div>
            <div
              ref={ratingTrackRef}
              className={`mt-2 flex w-fit touch-none select-none items-center gap-1 ${busy ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
              role="group"
              aria-label="Choose a rating from half a star to five stars"
              onMouseLeave={() => setRatingPreview(0)}
              onTouchStart={(event) => {
                event.stopPropagation();
                previewRatingAt(event.touches[0].clientX);
              }}
              onTouchMove={(event) => {
                event.stopPropagation();
                previewRatingAt(event.touches[0].clientX);
              }}
              onTouchEnd={(event) => {
                event.stopPropagation();
                commitDraggedRating();
              }}
              onTouchCancel={() => setRatingPreview(0)}
            >
              {[1, 2, 3, 4, 5].map((star) => {
                const fillWidth = displayRating >= star ? "100%" : displayRating >= star - 0.5 ? "50%" : "0%";
                return (
                  <div key={star} className="relative h-11 w-10">
                    <Star size={31} className="absolute inset-0 m-auto text-purple-200" aria-hidden="true" />
                    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ width: fillWidth }}>
                      <Star size={31} className="absolute left-[4px] top-[5px] text-purple-600" fill="currentColor" aria-hidden="true" />
                    </div>
                    <button
                      type="button"
                      aria-label={`Rate ${star - 0.5} out of 5`}
                      aria-pressed={rating === star - 0.5}
                      disabled={busy}
                      onMouseEnter={() => setRatingPreview(star - 0.5)}
                      onClick={() => {
                        onRatingChange(star - 0.5);
                        setRatingPreview(0);
                      }}
                      className="absolute inset-y-0 left-0 z-10 w-1/2 rounded-l-md outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                    />
                    <button
                      type="button"
                      aria-label={`Rate ${star} out of 5`}
                      aria-pressed={rating === star}
                      disabled={busy}
                      onMouseEnter={() => setRatingPreview(star)}
                      onClick={() => {
                        onRatingChange(star);
                        setRatingPreview(0);
                      }}
                      className="absolute inset-y-0 right-0 z-10 w-1/2 rounded-r-md outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                    />
                  </div>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {rating > 0 ? `${rating} out of 5` : "Tap a half or full star"}
            </p>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm leading-relaxed text-rose-700">
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="min-h-12 flex-1 rounded-full px-5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="min-h-12 flex-[1.5] rounded-full bg-purple-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300"
            >
              {busy ? "Saving…" : hasReaction ? "Post reaction" : "Save rating"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FinishedMediaFollowUp(props: FinishedMediaFollowUpProps) {
  const { isOpen, busy, elevated, onClose } = props;

  return (
    <Drawer open={isOpen} onOpenChange={(open) => {
      if (!open && !busy) onClose();
    }}>
      <DrawerContent
        className={`overflow-hidden rounded-t-[28px] bg-white p-0 shadow-[0_-12px_48px_rgba(42,25,75,0.18)] ${elevated ? "z-[100000]" : ""}`}
        overlayClassName={elevated ? "z-[100000]" : undefined}
      >
        <DrawerTitle className="sr-only">Finished media reaction</DrawerTitle>
        <FinishedMediaFollowUpContent {...props} />
      </DrawerContent>
    </Drawer>
  );
}
