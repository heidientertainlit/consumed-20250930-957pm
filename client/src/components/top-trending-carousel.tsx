import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Plus, ImageOff, X } from "lucide-react";
import { useLocation } from "wouter";
import { useTrendingContent, type TrendingContentItem } from "@/components/use-trending-content";
import { selectTrendingItems, type TrendingCategory } from "./trending-selection";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const pendingAfterClose = useRef<(() => void) | null>(null);
  const [category, setCategory] = useState<TrendingCategory>("all");
  const [allOpen, setAllOpen] = useState(false);
  const visibleItems = selectTrendingItems(items, category);
  const allItems = selectTrendingItems(items, category, 500);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, [category]);

  const navigateToMedia = (item: TrendingContentItem) => {
    const externalId = item.external_id;
    if (!externalId || !item.external_source) return;
    const navigate = () => setLocation(`/media/${item.media_type || "movie"}/${item.external_source}/${externalId}`);
    if (allOpen) {
      pendingAfterClose.current = navigate;
      setAllOpen(false);
    } else {
      navigate();
    }
  };

  const addMedia = (item: TrendingContentItem) => {
    const add = () => onAdd({
      title: item.title,
      mediaType: item.media_type || "movie",
      imageUrl: item.image_url,
      externalId: item.external_id,
      externalSource: item.external_source,
      creator: item.creator,
    });
    if (allOpen) {
      pendingAfterClose.current = add;
      setAllOpen(false);
    } else {
      add();
    }
  };

  const renderPoster = (item: TrendingContentItem, index: number, inDialog = false) => {
    const key = `${item.external_source || "source"}:${item.external_id || item.id || item.title}:${index}`;
    const canNavigate = Boolean(item.external_source && item.external_id);
    return (
      <article key={key} className={inDialog ? "min-w-0" : "w-[138px] shrink-0 snap-start sm:w-[194px]"}>
        <div className="relative">
          {!inDialog && (
            <span aria-hidden="true" data-testid="trending-position" className={`pointer-events-none absolute -bottom-2 -left-1 select-none font-sans text-[156px] font-black leading-[0.85] tracking-[-0.1em] sm:text-[215px] ${index === 0 ? "text-[#d5c4fa]" : "text-[#e2ddeb]"}`}>
              {index + 1}
            </span>
          )}
        <div className={`group relative aspect-[2/3] overflow-hidden rounded-[13px] bg-[#eeebf3] sm:rounded-[18px] ${inDialog ? "w-full" : "ml-[38px] w-[100px] sm:ml-12 sm:w-[146px]"}`}>
          <button
            type="button"
            onClick={() => navigateToMedia(item)}
            disabled={!canNavigate}
            className="absolute inset-0 z-[1] cursor-pointer disabled:cursor-default"
            aria-label={`Open ${item.title}`}
          >
            <ImageOff className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-violet-200" aria-hidden="true" />
            <img
              key={item.image_url}
              src={item.image_url}
              alt={item.title}
              loading="lazy"
              className={`relative h-full w-full transition-transform duration-300 group-hover:scale-[1.035] ${item.media_type === "music" || item.media_type === "podcast" ? "object-contain" : "object-cover"}`}
              onError={(event) => {
                const image = event.currentTarget;
                if (item.fallback_image_url && !image.dataset.fallbackTried) {
                  image.dataset.fallbackTried = "true";
                  image.src = item.fallback_image_url;
                  return;
                }
                image.style.opacity = "0";
              }}
              onLoad={(event) => { event.currentTarget.style.opacity = "1"; }}
            />
          </button>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-16" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.58) 0%, transparent 100%)" }} />
          <button
            type="button"
            onClick={() => addMedia(item)}
            className="absolute bottom-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-[#171322]/90 text-white transition-transform duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 active:scale-95 sm:h-10 sm:w-10"
            aria-label={`Add ${item.title}`}
          >
            <Plus size={19} />
          </button>
        </div>
        </div>
        <button type="button" onClick={() => navigateToMedia(item)} disabled={!canNavigate} className={`mt-3 block text-left disabled:cursor-default ${inDialog ? "w-full" : "ml-[38px] w-[100px] sm:ml-12 sm:w-[146px]"}`}>
          <span className="line-clamp-2 text-[14px] font-semibold leading-snug text-[#201c29] sm:text-base">{item.title}</span>
          <span className="mt-0.5 block text-[13px] text-[#77727e] sm:text-sm">{mediaTypeLabel(item.media_type)}</span>
        </button>
      </article>
    );
  };

  return (
    <>
    <section className="mb-5 rounded-[24px] bg-white px-5 py-6 shadow-[0_2px_6px_rgba(26,18,43,0.05)] sm:px-9 sm:py-8" aria-labelledby="top-trending-title" data-testid="top-trending-carousel">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.19em] text-[#7656cb]">
            <span className="h-3 w-3 rounded-full bg-[#ed4c61]" aria-hidden="true" />
            <span>Live this week</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
              <h2 id="top-trending-title" className="text-[26px] font-semibold leading-[1.12] tracking-[-0.045em] text-[#201c29] sm:text-[42px]">Trending now</h2>
            <button type="button" data-guest-allowed onClick={() => setAllOpen(true)} className="mb-1 shrink-0 rounded-md text-[16px] font-semibold text-[#7553c7] transition-colors hover:text-[#5537a4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 sm:text-[18px]">
              See all
            </button>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-[#77727e] sm:text-[19px]">What everyone’s consuming right now</p>
          <div className="scrollbar-hide -mx-1 mt-4 overflow-x-auto px-1" role="group" aria-label="Filter trending titles by category">
            <div className="flex w-max items-center gap-1.5">
              {([
                ["all", "All"],
                ["tv", "TV"],
                ["movie", "Movies"],
                ["book", "Books"],
                ["podcast", "Podcasts"],
                ["music", "Music"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  data-guest-allowed
                  aria-pressed={category === value}
                  onClick={() => setCategory(value)}
                  className={`shrink-0 rounded-full px-3.5 py-2.5 text-[14px] font-medium leading-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 sm:px-6 sm:py-3 sm:text-[17px] ${
                    category === value
                      ? "bg-[#191523] text-white hover:bg-[#302940]"
                      : "bg-[#f0edf3] text-[#514b5c] hover:bg-[#e9e4ef]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!isLoading && !isError && visibleItems.length > 3 && (
          <div className="mb-2 hidden justify-end gap-1.5 sm:flex">
            <button type="button" data-guest-allowed aria-label="Scroll trending titles left" onClick={() => scrollRef.current?.scrollBy({ left: -420, behavior: "smooth" })} className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-100 text-violet-600 transition-colors hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">
              <ArrowLeft size={15} />
            </button>
            <button type="button" data-guest-allowed aria-label="Scroll trending titles right" onClick={() => scrollRef.current?.scrollBy({ left: 420, behavior: "smooth" })} className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-100 text-violet-600 transition-colors hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      {isLoading ? (
        <div className="mt-5 flex gap-5 overflow-hidden px-4 pb-2" aria-label="Loading trending media">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="w-[176px] shrink-0 animate-pulse">
              <div className="aspect-[2/3] rounded-[20px] bg-[#e9e5ed]" />
              <div className="mt-3 h-4 w-4/5 rounded bg-[#e9e5ed]" />
              <div className="mt-2 h-3 w-3/5 rounded bg-[#e9e5ed]" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-violet-50/70 px-3.5 py-3">
          <p className="text-xs text-violet-800">Trending titles couldn’t load just now.</p>
          <button type="button" data-guest-allowed onClick={() => void refetch()} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-sm hover:bg-violet-100">Try again</button>
        </div>
      ) : visibleItems.length === 0 ? (
        <p className="mt-5 rounded-xl bg-violet-50/70 px-3.5 py-3 text-xs text-violet-700">
          {category === "all"
            ? "No chart titles are available right now."
            : `No ${category === "movie" ? "movie" : category} chart titles are available right now.`}
        </p>
      ) : (
        <div ref={scrollRef} className="scrollbar-hide -mx-1 mt-5 flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-1 pb-2 touch-pan-x sm:gap-4" data-testid="trending-media-track">
          {visibleItems.map((item, index) => renderPoster(item, index))}
        </div>
      )}
    </section>
    <Dialog open={allOpen} onOpenChange={setAllOpen}>
      <DialogContent data-testid="trending-all-dialog" onCloseAutoFocus={() => {
        const action = pendingAfterClose.current;
        pendingAfterClose.current = null;
        action?.();
      }} className="max-h-[90dvh] w-[calc(100%-24px)] max-w-5xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-[24px] border-[#e8e3ec] bg-[#fbfafc] p-0 [&>button:last-child]:hidden sm:w-[calc(100%-48px)]">
        <DialogHeader className="relative border-b border-[#eeeaf1] px-5 py-5 pr-14 text-left sm:px-8">
          <DialogClose data-guest-allowed aria-label="Close all trending titles" className="absolute right-4 top-4 rounded-full p-2 text-[#77727e] transition-colors hover:bg-[#f0edf3] hover:text-[#201c29] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 sm:right-6 sm:top-6">
            <X className="h-5 w-5" aria-hidden="true" />
          </DialogClose>
          <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#7656cb]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ed4c61]" aria-hidden="true" />
            <span>Live this week</span>
          </div>
          <DialogTitle className="text-[28px] font-semibold tracking-[-0.04em] text-[#201c29] sm:text-3xl">Trending now</DialogTitle>
          <DialogDescription className="text-sm text-[#77727e]">What everyone’s consuming right now</DialogDescription>
        </DialogHeader>
        <div className="scrollbar-hide min-h-0 overflow-y-auto px-5 pb-7 sm:px-8">
          <div className="scrollbar-hide -mx-1 mb-6 mt-5 overflow-x-auto px-1" role="group" aria-label="Filter all trending titles by category">
            <div className="flex w-max items-center gap-2">
              {([
                ["all", "All"],
                ["tv", "TV"],
                ["movie", "Movies"],
                ["book", "Books"],
                ["podcast", "Podcasts"],
                ["music", "Music"],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" data-guest-allowed aria-pressed={category === value} onClick={() => setCategory(value)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${category === value ? "bg-[#191523] text-white" : "bg-[#f0edf3] text-[#514b5c] hover:bg-[#e9e4ef]"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" aria-label="Loading all trending media">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((index) => <div key={index} className="animate-pulse"><div className="aspect-[2/3] rounded-2xl bg-[#e9e5ed]" /><div className="mt-3 h-4 w-4/5 rounded bg-[#e9e5ed]" /></div>)}
            </div>
          ) : isError ? (
            <div className="rounded-xl bg-violet-50 px-4 py-5 text-sm text-violet-800">
              <p>Trending titles couldn’t load just now.</p>
              <button type="button" data-guest-allowed onClick={() => void refetch()} className="mt-3 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100">Try again</button>
            </div>
          ) : allItems.length ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5">
              {allItems.map((item, index) => renderPoster(item, index, true))}
            </div>
          ) : (
            <p className="rounded-xl bg-violet-50/70 px-4 py-5 text-sm text-violet-700">
              {category === "all" ? "No chart titles are available right now." : `No ${category === "movie" ? "movie" : category} chart titles are available right now.`}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
