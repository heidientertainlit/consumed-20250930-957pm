import { useRef, useState } from "react";
import { Ban, BookOpen, Check, Clock, Film, Heart, Mic, Music, Play, Star, Tv, X, Youtube } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { FinishedTvScopePicker, type FinishedTvScopePickerProps } from "./finished-tv-scope-picker";

export interface FinishedMediaFollowUpProps {
  isOpen: boolean;
  media: { title: string; mediaType: string; imageUrl?: string } | null;
  rating: number;
  reaction: string;
  busy: boolean;
  error: string | null;
  elevated?: boolean;
  tvScope?: FinishedTvScopePickerProps;
  onRatingChange: (rating: number) => void;
  onReactionChange: (text: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

const LIST_CHOICES = [
  { id: "queue", label: "Want To", bg: "bg-blue-100", icon: <Clock className="text-blue-600" size={20} /> },
  { id: "currently", label: "Currently", bg: "bg-purple-100", icon: <Play className="text-purple-600" size={20} /> },
  { id: "finished", label: "Finished", bg: "bg-green-100", icon: <Check className="text-green-600" size={20} /> },
  { id: "dnf", label: "Did Not Finish", bg: "bg-red-100", icon: <Ban className="text-red-600" size={20} /> },
  { id: "favorites", label: "Favorites", bg: "bg-yellow-100", icon: <Heart className="text-yellow-600" size={20} /> },
];

export function finishedMediaTypeLabel(mediaType?: string): string {
  const value = (mediaType || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const labels: Record<string, string> = {
    tv: "TV Series",
    tv_show: "TV Series",
    tv_shows: "TV Series",
    television: "TV Series",
    tv_series: "TV Series",
    series: "TV Series",
    movie: "Movie",
    film: "Movie",
    book: "Book",
    book_series: "Book Series",
    podcast: "Podcast",
    podcast_series: "Podcast",
    youtube: "YouTube",
    music: "Music",
    album: "Album",
    song: "Song",
    game: "Game",
    video_game: "Game",
  };
  return labels[value] ?? (value ? value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "");
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
  tvScope,
}: FinishedMediaFollowUpProps) {
  const ratingTrackRef = useRef<HTMLDivElement>(null);
  const [ratingPreview, setRatingPreview] = useState(0);
  const hasReaction = reaction.trim().length > 0;

  if (!media) return null;

  const previewRatingAt = (clientX: number) => {
    if (busy) return;
    const track = ratingTrackRef.current;
    if (!track) return;
    const bounds = track.getBoundingClientRect();
    if (!bounds.width) return;
    const offset = Math.min(Math.max(clientX - bounds.left, 0), bounds.width);
    setRatingPreview(Math.max(0.5, Math.min(5, Math.ceil((offset / bounds.width) * 10) / 2)));
  };
  const commitDraggedRating = () => {
    if (!busy && ratingPreview > 0) onRatingChange(ratingPreview);
    setRatingPreview(0);
  };
  const save = () => {
    if (busy) return;
    if (rating > 0 || hasReaction || tvScope?.selectedSeason != null) onSubmit();
    else onClose();
  };
  const displayRating = ratingPreview || rating;

  return (
    <div className="flex max-h-[min(88dvh,760px)] min-h-0 flex-col overflow-hidden bg-white">
      <div className="relative flex shrink-0 items-center justify-end px-5 py-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="mr-9 flex items-center gap-1.5 rounded-full bg-purple-600 px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close"
          className="absolute right-4 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
            {media.imageUrl ? (
              <img src={media.imageUrl} alt={media.title} className="h-full w-full object-cover" />
            ) : (
              <MediaTypeIcon mediaType={media.mediaType} />
            )}
          </div>
          <div className="min-w-0">
            <p className="line-clamp-2 font-bold text-gray-900">{media.title}</p>
            <p className="text-xs text-gray-500">{finishedMediaTypeLabel(media.mediaType)}</p>
          </div>
        </div>

        {tvScope && <FinishedTvScopePicker {...tvScope} disabled={busy} />}

        <div>
          <p className="text-sm font-semibold text-gray-700">Add to a list</p>
          <p className="mb-2.5 mt-0.5 text-xs text-gray-500">Save it for later to watch, read, listen, or play.</p>
          <div className="grid grid-cols-3 gap-2" aria-label="Current list">
            {LIST_CHOICES.map((choice) => {
              const active = choice.id === "finished";
              return (
                <button
                  key={choice.id}
                  type="button"
                  disabled
                  aria-label={`${choice.label}${active ? ", already saved" : ""}. List changes are unavailable here.`}
                  aria-pressed={active}
                  title={active ? "This title is already saved to Finished" : "List changes are unavailable in this follow-up"}
                  className={`relative flex min-h-[58px] cursor-not-allowed flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 text-center ${
                    active ? "border-purple-500 bg-purple-50 text-purple-800" : "border-gray-200 bg-white text-gray-700"
                  }`}
                >
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full ${choice.bg}`}>{choice.icon}</div>
                  <span className="text-xs font-semibold leading-tight">{choice.label}</span>
                  {active && <Check size={14} className="absolute right-1.5 top-1.5 text-purple-600" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-gray-500">
            Already saved to Finished. Rating and reaction are optional.
          </p>
        </div>

        <div>
          <div className="overflow-hidden rounded-2xl border border-gray-200">
            <div className="space-y-3.5 p-3.5">
              <div>
                <p className="text-sm font-semibold text-gray-700">
                  What would you rate it? <span className="font-normal text-gray-400">(optional)</span>
                </p>
                <div
                  ref={ratingTrackRef}
                  className={`mt-1.5 flex w-fit touch-none select-none items-center gap-1.5 ${busy ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                  role="group"
                  aria-label="Rating"
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
                      <div key={star} className="relative h-9 w-9">
                        <Star size={30} className="absolute inset-0 m-auto text-gray-300" aria-hidden="true" />
                        <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ width: fillWidth }}>
                          <Star size={30} className="absolute left-[3px] top-[3px] text-purple-500" fill="currentColor" aria-hidden="true" />
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          className="absolute inset-y-0 left-0 z-10 w-1/2 rounded-l-md outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                          onMouseEnter={() => setRatingPreview(star - 0.5)}
                          onClick={() => {
                            onRatingChange(star - 0.5);
                            setRatingPreview(0);
                          }}
                          aria-label={`Rate ${star - 0.5} out of 5`}
                          aria-pressed={rating === star - 0.5}
                        />
                        <button
                          type="button"
                          disabled={busy}
                          className="absolute inset-y-0 right-0 z-10 w-1/2 rounded-r-md outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                          onMouseEnter={() => setRatingPreview(star)}
                          onClick={() => {
                            onRatingChange(star);
                            setRatingPreview(0);
                          }}
                          aria-label={`Rate ${star} out of 5`}
                          aria-pressed={rating === star}
                        />
                      </div>
                    );
                  })}
                  {rating > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        onRatingChange(0);
                        setRatingPreview(0);
                      }}
                      disabled={busy}
                      className="ml-1 rounded px-1.5 py-1 text-xs font-medium text-gray-500 underline underline-offset-2 hover:text-gray-700 disabled:opacity-50"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="finished-reaction" className="mb-2 block text-sm font-semibold text-gray-700">
                  Add a reaction <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  id="finished-reaction"
                  value={reaction}
                  onChange={(event) => onReactionChange(event.target.value)}
                  disabled={busy}
                  maxLength={5000}
                  rows={3}
                  placeholder="What do you think?"
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-describedby="finished-reaction-visibility"
                />
                <p id="finished-reaction-visibility" className="mt-1.5 text-xs text-gray-500">
                  Reactions and ratings are public and may appear on the feed.
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm leading-relaxed text-rose-700">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="min-h-11 w-full rounded-full px-5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

function MediaTypeIcon({ mediaType }: { mediaType: string }) {
  const type = mediaType.toLowerCase();
  const Icon = type.includes("book") ? BookOpen : type.includes("podcast") ? Mic
    : type.includes("tv") || type.includes("series") ? Tv : type.includes("movie") || type.includes("film") ? Film
    : type.includes("youtube") ? Youtube : Music;
  return <Icon size={24} className="text-gray-400" aria-hidden="true" />;
}

export function FinishedMediaFollowUp(props: FinishedMediaFollowUpProps) {
  const { isOpen, busy, elevated, onClose } = props;

  return (
    <Drawer open={isOpen} onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DrawerContent
        className={`overflow-hidden rounded-t-[28px] bg-white p-0 shadow-[0_-12px_48px_rgba(42,25,75,0.18)] [&>div:first-child]:mt-3 [&>div:first-child]:h-1 [&>div:first-child]:w-10 [&>div:first-child]:bg-gray-300 ${elevated ? "z-[100000]" : ""}`}
        overlayClassName={elevated ? "z-[100000]" : undefined}
      >
        <DrawerTitle className="sr-only">Finished media follow-up</DrawerTitle>
        <FinishedMediaFollowUpContent {...props} />
      </DrawerContent>
    </Drawer>
  );
}
