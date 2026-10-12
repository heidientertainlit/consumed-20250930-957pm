import { useRef } from "react";
import { ArrowLeft, ArrowRight, Plus, ImageOff } from "lucide-react";
import { useLocation } from "wouter";
import { useTrendingContent, type TrendingContentItem } from "@/components/use-trending-content";

function mediaTypeLabel(type?: string) {
  const labels: Record<string, string> = {
    tv: "TV Show",
    movie: "Movie",
    book: "Book",
    book_series: "Book Series",
    music: "Music",
    podcast: "Podcast",
  };
  return labels[type?.toLowerCase() || ""] || type || "Media";
}

export function TopTrendingCarousel({
  onAdd,
}: {
  onAdd: (media: { title: string; mediaType: string; imageUrl?: string; externalId?: string; externalSource?: string; creator?: string }) => void;
}) {
  const { data: items = [], isLoading, isError, refetch } = useTrendingContent();
  const [, setLocation] = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const navigateToMedia = (item: TrendingContentItem) => {
    const externalId = item.external_id;
    if (!externalId || !item.external_source) return;
    setLocation(`/media/${item.media_type || "movie"}/${item.external_source}/${externalId}`);
  };

  return (
    <section className="mb-5 rounded-2xl border border-violet-100 bg-white px-4 py-4 shadow-[0_8px_28px_rgba(82,48,132,0.06)] sm:px-5" aria-labelledby="top-trending-title" data-testid="top-trending-carousel">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="top-trending-title" className="text-sm font-bold text-gray-900">Top &amp; Trending</h2>
          <p className="text-xs text-gray-500">Across all media types</p>
        </div>
        {!isLoading && !isError && items.length > 3 && (
          <div className="hidden shrink-0 gap-1.5 sm:flex">
            <button type="button" data-guest-allowed aria-label="Scroll trending titles left" onClick={() => scrollRef.current?.scrollBy({ left: -420, behavior: "smooth" })} className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-100 text-violet-600 transition hover:bg-violet-50">
              <ArrowLeft size={15} />
            </button>
            <button type="button" data-guest-allowed aria-label="Scroll trending titles right" onClick={() => scrollRef.current?.scrollBy({ left: 420, behavior: "smooth" })} className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-100 text-violet-600 transition hover:bg-violet-50">
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex gap-3 overflow-hidden" aria-label="Loading trending media">
          {[0, 1, 2, 3, 4].map((index) => (
            <div key={index} className="w-[108px] shrink-0 animate-pulse">
              <div className="aspect-[2/3] rounded-xl bg-violet-50" />
              <div className="mt-2 h-3 w-4/5 rounded bg-violet-50" />
              <div className="mt-1.5 h-2.5 w-3/5 rounded bg-violet-50" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-violet-50/70 px-3.5 py-3">
          <p className="text-xs text-violet-800">Trending titles couldn’t load just now.</p>
          <button type="button" data-guest-allowed onClick={() => void refetch()} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-sm hover:bg-violet-100">Try again</button>
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl bg-violet-50/70 px-3.5 py-3 text-xs text-violet-700">No trending titles are available right now.</p>
      ) : (
        <div ref={scrollRef} className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 touch-pan-x" data-testid="trending-media-track">
          {items.map((item, index) => {
            const key = `${item.external_source || "source"}:${item.external_id || item.id || item.title}:${index}`;
            const canNavigate = Boolean(item.external_source && item.external_id);
            return (
              <article key={key} className="w-[106px] shrink-0 snap-start sm:w-[118px]">
                <div className="group relative aspect-[2/3] overflow-hidden rounded-xl bg-violet-50 shadow-[0_5px_14px_rgba(55,35,78,0.12)]">
                  <button
                    type="button"
                    onClick={() => navigateToMedia(item)}
                    disabled={!canNavigate}
                    className="absolute inset-0 z-0 cursor-pointer disabled:cursor-default"
                    aria-label={`Open ${item.title}`}
                  >
                    <ImageOff className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-violet-200" aria-hidden="true" />
                    <img
                      src={item.image_url}
                      alt={item.title}
                      loading="lazy"
                      className={`relative h-full w-full transition-transform duration-300 group-hover:scale-[1.04] ${item.media_type === "music" || item.media_type === "podcast" ? "object-contain" : "object-cover"}`}
                      onError={(event) => { event.currentTarget.style.opacity = "0"; }}
                    />
                  </button>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)" }} />
                  <button
                    type="button"
                    onClick={() => onAdd({
                      title: item.title,
                      mediaType: item.media_type || "movie",
                      imageUrl: item.image_url,
                      externalId: item.external_id,
                      externalSource: item.external_source,
                      creator: item.creator,
                    })}
                    className="absolute bottom-2 right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 border border-white/20"
                    style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                    aria-label={`Add ${item.title}`}
                  >
                    <Plus size={16} className="text-white" />
                  </button>
                </div>
                <button type="button" onClick={() => navigateToMedia(item)} disabled={!canNavigate} className="mt-2 block w-full text-left disabled:cursor-default">
                  <span className="line-clamp-2 text-xs font-semibold leading-snug text-gray-900">{item.title}</span>
                  <span className="mt-0.5 block text-[10px] text-gray-500">{mediaTypeLabel(item.media_type)}</span>
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
