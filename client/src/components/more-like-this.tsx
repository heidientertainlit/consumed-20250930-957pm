import { BookOpen, Film, Mic, Music, Tv } from "lucide-react";
import { Link } from "wouter";

type SimilarMediaItem = {
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
};

function getTypeIcon(type: string) {
  const normalizedType = type.toLowerCase();

  if (normalizedType.includes("book")) return <BookOpen className="h-3 w-3" />;
  if (normalizedType.includes("tv") || normalizedType.includes("series")) {
    return <Tv className="h-3 w-3" />;
  }
  if (
    normalizedType.includes("music") ||
    normalizedType.includes("album") ||
    normalizedType.includes("song")
  ) {
    return <Music className="h-3 w-3" />;
  }
  if (normalizedType.includes("podcast")) return <Mic className="h-3 w-3" />;
  return <Film className="h-3 w-3" />;
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
}: {
  item: SimilarMediaItem;
  slotIndex: number;
}) {
  const isVerified =
    Boolean(item.title.trim()) &&
    Boolean(item.type.trim()) &&
    Boolean(item.external_id.trim()) &&
    Boolean(item.external_source.trim());

  const content = (
    <>
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
      </div>
      <p className="line-clamp-2 text-xs font-medium leading-4 text-gray-900 transition-colors group-hover:text-purple-700">
        {item.title}
      </p>
    </>
  );

  if (!isVerified) {
    return (
      <div
        className="w-[5.25rem] flex-shrink-0 text-left"
        data-testid={`similar-media-${slotIndex}`}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={getMediaHref(item)}
      className="group w-[5.25rem] flex-shrink-0 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
      aria-label={`View ${item.title}`}
      data-testid={`similar-media-${slotIndex}`}
    >
      {content}
    </Link>
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
    <section className="min-w-0 mb-5" aria-label="More like this" data-testid="more-like-this">
      <h2 className="mb-3 text-sm font-bold text-violet-950">More like this</h2>
      <div
        className="-mx-4 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-testid="more-like-this-scroll"
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
