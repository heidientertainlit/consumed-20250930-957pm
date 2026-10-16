import { BookOpen, Film, Mic, Music, Plus, Tv, Youtube } from "lucide-react";
import { Link } from "wouter";

export type SimilarMediaItem = {
  title: string;
  type: string;
  poster_url: string;
  external_id: string;
  external_source: string;
};

type MoreLikeThisSlot = {
  key: string;
  status: "pending" | "ready" | "unavailable";
  item?: SimilarMediaItem;
};

type MoreLikeThisProps = {
  slots: MoreLikeThisSlot[];
  isGenerating: boolean;
  hasError?: boolean;
  onAdd?: (item: SimilarMediaItem) => void;
  onInteraction?: () => void;
};

function getMediaType(type: string): {
  label: string;
  icon: typeof Film;
} {
  const normalizedType = type.toLowerCase();

  if (normalizedType.includes("book")) return { label: "Book", icon: BookOpen };
  if (normalizedType.includes("tv") || normalizedType.includes("series")) {
    return { label: "TV", icon: Tv };
  }
  if (
    normalizedType.includes("music") ||
    normalizedType.includes("album") ||
    normalizedType.includes("song")
  ) {
    return { label: "Music", icon: Music };
  }
  if (normalizedType.includes("podcast")) return { label: "Podcast", icon: Mic };
  if (normalizedType.includes("youtube")) {
    return { label: "YouTube", icon: Youtube };
  }
  return { label: "Film", icon: Film };
}

function getTypeIcon(type: string) {
  const Icon = getMediaType(type).icon;
  return <Icon className="h-3 w-3" aria-hidden="true" />;
}

function getMediaHref(item: SimilarMediaItem) {
  const encodedId = item.external_id
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `/media/${encodeURIComponent(item.type)}/${encodeURIComponent(item.external_source)}/${encodedId}`;
}

function PosterFallback({ type }: { type: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-200 to-blue-200">
      <div className="scale-150 text-purple-600 opacity-60">{getTypeIcon(type)}</div>
    </div>
  );
}

function PosterCard({
  item,
  slotIndex,
  onAdd,
}: {
  item: SimilarMediaItem;
  slotIndex: number;
  onAdd?: (item: SimilarMediaItem) => void;
}) {
  const isVerified =
    Boolean(item.title.trim()) &&
    Boolean(item.type.trim()) &&
    Boolean(item.external_id.trim()) &&
    Boolean(item.external_source.trim());

  const mediaType = getMediaType(item.type);
  const TypeIcon = mediaType.icon;
  const poster = (
    <div className="relative mb-1.5 aspect-[2/3] overflow-hidden rounded-lg bg-gradient-to-br from-purple-100 to-blue-100 shadow-sm transition-shadow group-hover:shadow-md">
      <PosterFallback type={item.type} />
      {item.poster_url ? (
        <img
          key={item.poster_url}
          src={item.poster_url}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <span
        className="absolute left-1.5 top-1.5 inline-flex items-center justify-center rounded-full bg-black/65 p-1.5 text-white shadow-sm backdrop-blur-sm"
        aria-label={`Media type: ${mediaType.label}`}
      >
        <TypeIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
      </span>
    </div>
  );
  const title = (
    <p className="line-clamp-2 text-xs font-medium leading-4 text-gray-900 transition-colors group-hover:text-purple-700">
      {item.title}
    </p>
  );

  if (!isVerified) {
    return (
      <div
        className="w-[5.25rem] flex-shrink-0 text-left"
        data-testid={`similar-media-${slotIndex}`}
      >
        {poster}
        {title}
      </div>
    );
  }

  return (
    <div
      className="group relative w-[5.25rem] flex-shrink-0"
      data-testid={`similar-media-${slotIndex}`}
    >
      <div className="relative">
        <Link
          href={getMediaHref(item)}
          className="block rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
          aria-label={`View ${item.title}`}
        >
          {poster}
        </Link>
        {onAdd ? (
          <button
            type="button"
            aria-label={`Add ${item.title} to list`}
            onClick={() => onAdd(item)}
            className="absolute bottom-2 right-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/60"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <Link
        href={getMediaHref(item)}
        className="block rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
        aria-label={`View ${item.title}`}
      >
        {title}
      </Link>
    </div>
  );
}

function PendingPoster({ slotIndex }: { slotIndex: number }) {
  return (
    <div
      className="w-[5.25rem] flex-shrink-0 animate-pulse"
      aria-label="Recommendation loading"
      data-testid={`similar-media-pending-${slotIndex}`}
    >
      <div className="mb-1.5 aspect-[2/3] rounded-lg bg-purple-100/80" />
      <div className="h-2.5 w-4/5 rounded bg-purple-100/80" />
      <div className="mt-1 h-2.5 w-3/5 rounded bg-purple-100/60" />
    </div>
  );
}

export default function MoreLikeThis({
  slots,
  isGenerating,
  hasError = false,
  onAdd,
  onInteraction,
}: MoreLikeThisProps) {
  const hasAvailableSlots = slots.some((slot) => slot.status !== "unavailable");
  const showInitialSkeletons = isGenerating && !hasAvailableSlots;
  const hasRecommendations = slots.some(
    (slot) => slot.status === "ready" && slot.item,
  );
  const hasPendingSlots = slots.some((slot) => slot.status === "pending");
  const showEmptyState =
    !hasRecommendations &&
    !hasPendingSlots &&
    !showInitialSkeletons;

  return (
    <section className="min-w-0 mb-5" aria-label="More like this" data-testid="more-like-this"
      onPointerDownCapture={onInteraction} onKeyDownCapture={onInteraction}>
      <h2 className="mb-3 text-sm font-bold text-violet-950">More like this</h2>
      <div
        className="-mx-4 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-testid="more-like-this-scroll"
        onScroll={onInteraction}
        style={{ touchAction: "pan-x pan-y" }}
      >
        <div className="flex w-max items-start gap-3">
          {showInitialSkeletons
            ? Array.from({ length: 4 }, (_, index) => (
                <PendingPoster key={`initial-${index}`} slotIndex={index} />
              ))
            : slots.map((slot, index) => {
                if (slot.status === "unavailable") return null;
                if (slot.status === "pending") {
                  return <PendingPoster key={slot.key} slotIndex={index} />;
                }
                if (!slot.item) return null;
                return (
                  <PosterCard
                    key={slot.key}
                    item={slot.item}
                    slotIndex={index}
                    onAdd={onAdd}
                  />
                );
              })}
        </div>
      </div>

      {showEmptyState ? (
        <p
          className="py-2 text-xs text-gray-500"
          data-testid="more-like-this-empty"
          role="status"
        >
          {hasError ? "Similar titles are unavailable right now." : "No similar titles found."}
        </p>
      ) : null}
    </section>
  );
}
