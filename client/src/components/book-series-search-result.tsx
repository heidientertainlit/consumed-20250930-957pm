import { useEffect, useId, useRef, useState } from "react";
import { BookOpen, ChevronDown, Loader2, Plus } from "lucide-react";
import { fetchBookSeriesChildren } from "@/lib/book-series-children";

type SeriesBook = Awaited<ReturnType<typeof fetchBookSeriesChildren>>[number];

export function BookSeriesSearchResult({ series, onSelect }: {
  series: any;
  onSelect: (result: any) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [books, setBooks] = useState<SeriesBook[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const regionId = useId();
  const seriesRoot = useRef<HTMLDivElement>(null);
  const traceArrow = (stage: string, details: Record<string, unknown> = {}) => {
    if (import.meta.env.DEV) console.info("[book-series-arrow]", { instance: regionId, stage, ...details });
  };

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    traceArrow("mounted");
    const trace = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      const toggle = seriesRoot.current?.querySelector("[aria-expanded]");
      traceArrow(event.type, {
        target_tag: target?.tagName,
        inside_series: !!target && !!seriesRoot.current?.contains(target),
        inside_toggle: !!target && !!toggle?.contains(target),
        expanded: toggle?.getAttribute("aria-expanded"),
        input_focused: document.activeElement instanceof HTMLInputElement,
      });
    };
    const events = ["pointerdown", "mousedown", "mouseup", "click", "pointercancel"];
    events.forEach(name => document.addEventListener(name, trace, true));
    return () => {
      events.forEach(name => document.removeEventListener(name, trace, true));
      traceArrow("unmounted");
    };
  }, []);

  useEffect(() => { traceArrow("state", { expanded, loaded_books: books?.length ?? null, failed: !!error }); },
    [expanded, books, error]);

  useEffect(() => {
    if (!expanded || books !== null) return;
    const controller = new AbortController();
    setError("");
    void fetchBookSeriesChildren(series.title, series.creator, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setBooks(result); })
      .catch(reason => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Couldn't load books. Please try again.");
      });
    return () => controller.abort();
  }, [expanded, books, series.title, series.creator, attempt]);

  return (
    <div ref={seriesRoot} data-testid={`media-search-series-${series.external_id}`}>
      <div className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50">
        <button
          type="button"
          onClick={() => { traceArrow("toggle-handler"); setExpanded(value => !value); }}
          aria-expanded={expanded}
          aria-controls={regionId}
          className="flex flex-1 min-w-0 items-center gap-3 text-left"
          data-testid={`media-search-result-${series.external_id}`}
        >
          {series.image && <img src={series.image} alt="" className="w-11 h-16 object-cover rounded-lg shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm line-clamp-1">{series.title}</p>
            <p className="text-xs text-gray-500">{series.series_count > 0 ? `${series.series_count}-Book Series` : "Book Series"}</p>
            {series.creator && series.creator !== "Unknown Author" && <p className="text-xs text-gray-400 truncate">{series.creator}</p>}
            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
              <BookOpen size={11} aria-hidden="true" />
              {series.series_count > 0 ? `${series.series_count} books` : "Books in this series"}
              <ChevronDown size={11} aria-hidden="true" className={expanded ? "rotate-180" : ""} />
            </span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onSelect(series)}
          aria-label={`Add ${series.title} series`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white hover:bg-purple-700"
        >
          <Plus size={15} aria-hidden="true" />
        </button>
      </div>
      {expanded && (
        <div id={regionId} className="ml-4 mr-2 mb-2 overflow-hidden rounded-xl border border-purple-200 bg-purple-50">
          <p className="border-b border-purple-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-purple-700">Books in this series</p>
          {error ? (
            <div className="px-3 py-3">
              <p role="alert" className="text-xs text-gray-600">{error}</p>
              <button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-2 text-xs font-medium text-purple-700 underline">Try again</button>
            </div>
          ) : books === null ? (
            <p role="status" className="flex items-center gap-2 px-3 py-3 text-xs text-gray-500"><Loader2 size={12} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />Loading books...</p>
          ) : books.length === 0 ? (
            <p className="px-3 py-3 text-xs text-gray-500">No individual books found.</p>
          ) : books.map(book => (
            <button
              key={book.external_id}
              type="button"
              onClick={() => onSelect({ ...book, image: book.poster_url })}
              data-testid={`media-search-series-book-${book.external_id}`}
              className="flex w-full items-center gap-2.5 border-b border-purple-100 px-3 py-2 text-left last:border-0 hover:bg-purple-100"
            >
              {book.poster_url ? <img src={book.poster_url} alt="" className="h-11 w-8 shrink-0 rounded object-cover" /> : <BookOpen size={22} aria-hidden="true" className="shrink-0 text-purple-300" />}
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium leading-snug text-gray-900">{book.title}</span>
                <span className="mt-0.5 block text-[10px] text-gray-500">{[book.creator, book.year].filter(Boolean).join(" · ")}</span>
              </span>
              <Plus size={14} aria-hidden="true" className="shrink-0 text-purple-600" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
