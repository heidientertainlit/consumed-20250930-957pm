import { useState, useEffect, useRef } from "react";
import { Search, Loader2, X, Sparkles, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { shouldRequestBookSeries, type BookSeriesDiscovery } from "@/lib/media-search-book-series";
import { getBookVolumeLabel } from "@/lib/book-volume";
import { BookSeriesSearchResult } from "@/components/book-series-search-result";
import { MovieCollectionRow, useMovieCollectionSearch } from "@/components/movie-collection-search-results";
import { blendMovieCollections } from "@/lib/blend-movie-collections";

/**
 * MediaSearchPanel — THE shared media search experience.
 *
 * Used by both the Track ("Add media") dialog and the Share-a-take composer so
 * the search box, media-type filter pills, results list, and typo rescue are
 * one single implementation. Change it here, it changes everywhere.
 */

export const MEDIA_SEARCH_FILTERS = [
  { label: "All", value: undefined },
  { label: "Movies", value: "movie" },
  { label: "TV", value: "tv" },
  { label: "Books", value: "book" },
  { label: "Music", value: "music" },
  { label: "Podcasts", value: "podcast" },
  { label: "YouTube", value: "youtube" },
  { label: "Games", value: "game" },
] as const;

type MediaTypeFilter = Exclude<(typeof MEDIA_SEARCH_FILTERS)[number]["value"], undefined>;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";

export function mediaSearchBody(query: string, type?: MediaTypeFilter, includeBookSeries = true) {
  return {
    query: query.trim(),
    include_book_series: includeBookSeries,
    ...(type ? { type } : {}),
  };
}

export function normalizeMediaSearchResult(result: any) {
  return {
    ...result,
    image: result.image || result.image_url || result.poster_url || "",
  };
}

export async function requestMediaSearch({
  query,
  type,
  bearer,
  signal,
  includeBookSeries = true,
  fetcher = fetch,
}: {
  query: string;
  type?: MediaTypeFilter;
  bearer: string;
  signal: AbortSignal;
  includeBookSeries?: boolean;
  fetcher?: typeof fetch;
}): Promise<any[]> {
  const response = await fetcher(`${SUPABASE_URL}/functions/v1/media-search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify(mediaSearchBody(query, type, includeBookSeries)),
  });
  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error("The server returned an unreadable response. Please try again.");
  }
  if (!response.ok) throw new Error(data?.error || "Media search failed. Please try again.");
  return (Array.isArray(data?.results) ? data.results : []).map(normalizeMediaSearchResult);
}

function typeLabel(type?: string, mediaSubtype?: string): string {
  switch (type) {
    case "tv": return "TV Series";
    case "movie": return "Movie";
    case "book": return "Book";
    case "book_series": return "Book Series";
    case "music":
      if (mediaSubtype === "album") return "Album";
      if (mediaSubtype === "song" || mediaSubtype === "track") return "Song";
      return "Music";
    case "podcast": return "Podcast";
    case "youtube": return "YouTube";
    default: return type ? type.charAt(0).toUpperCase() + type.slice(1) : "";
  }
}

export interface MediaSearchPanelProps {
  onSelect: (result: any) => void;
  autoFocus?: boolean;
  /** Opt-in narrowing; legacy consumers retain cross-media series discovery. */
  bookSeriesDiscovery?: BookSeriesDiscovery;
  /** Track opts into the app-bar's expandable series choices. */
  expandableBookSeries?: boolean;
  /** Track opts into movie collections without changing other search callers. */
  expandableMovieCollections?: boolean;
  /** Optional content shown below the empty-state hint (e.g. recently tracked). */
  emptyStateExtra?: React.ReactNode;
  emptyStateIcon?: LucideIcon;
  /** Opt in to the roomier Add Anything dialog treatment; other callers stay unchanged. */
  addAnythingPresentation?: boolean;
}

export default function MediaSearchPanel({ onSelect, autoFocus = true, emptyStateExtra, emptyStateIcon: EmptyStateIcon = Sparkles, bookSeriesDiscovery = "always", expandableBookSeries = false, expandableMovieCollections = false, addAnythingPresentation = false }: MediaSearchPanelProps) {
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mediaTypeFilter, setMediaTypeFilter] = useState<MediaTypeFilter | undefined>(undefined);
  const [searchError, setSearchError] = useState("");
  const [resolvedSearchKey, setResolvedSearchKey] = useState("");
  const searchReqId = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const previousMediaTypeRef = useRef<MediaTypeFilter | undefined>(undefined);
  // Native text correction can commit capitalization on blur, between pressing
  // a result and releasing it. Equivalent title text must not clear/remount
  // that result or shrink its owning dialog. Provider requests retain the text.
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const currentSearchKey = JSON.stringify([normalizedSearchQuery, mediaTypeFilter || "all"]);
  const currentSearchResolved = resolvedSearchKey === currentSearchKey;
  const collectionSearch = useMovieCollectionSearch(searchQuery,
    expandableMovieCollections && (!mediaTypeFilter || mediaTypeFilter === "movie"));

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    const mediaTypeChanged = previousMediaTypeRef.current !== mediaTypeFilter;
    previousMediaTypeRef.current = mediaTypeFilter;

    searchAbortRef.current?.abort();
    searchAbortRef.current = null;
    searchReqId.current += 1;
    setIsSearching(false);
    setSearchError("");
    setResolvedSearchKey("");

    if (trimmedQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    if (mediaTypeChanged) {
      void doSearch(trimmedQuery, mediaTypeFilter);
      return;
    }
    const timer = setTimeout(() => void doSearch(trimmedQuery, mediaTypeFilter), 200);
    return () => clearTimeout(timer);
    // Use the original query text for the request, but only repeat a search
    // when its normalized title (or the other request inputs) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedSearchQuery, session?.access_token, mediaTypeFilter, bookSeriesDiscovery]);

  useEffect(() => () => {
    searchAbortRef.current?.abort();
    searchReqId.current += 1;
  }, []);

  const doSearch = async (query: string, type?: MediaTypeFilter) => {
    const requestKey = JSON.stringify([query.trim().toLowerCase(), type || "all"]);
    const bearer = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!bearer) {
      setSearchError("Media search is unavailable. Please try again later.");
      setResolvedSearchKey(requestKey);
      setSearchResults([]);
      return;
    }
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const reqId = ++searchReqId.current;
    setIsSearching(true);
    setSearchError("");
    try {
      const results = await requestMediaSearch({
        query, type, bearer, signal: controller.signal,
        includeBookSeries: shouldRequestBookSeries(type, bookSeriesDiscovery),
      });
      if (reqId === searchReqId.current) {
        setSearchResults(results);
        setResolvedSearchKey(requestKey);
      }
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
      console.error("Media search error:", error);
      if (reqId === searchReqId.current) {
        setSearchError(error instanceof Error ? error.message : "Media search failed. Please try again.");
        setSearchResults([]);
        setResolvedSearchKey(requestKey);
      }
    } finally {
      if (reqId === searchReqId.current) {
        setIsSearching(false);
        if (searchAbortRef.current === controller) searchAbortRef.current = null;
      }
    }
  };

  const currentResults = currentSearchResolved ? searchResults : [];
  const filteredResults = mediaTypeFilter
    ? currentResults.filter((r) => r.type === mediaTypeFilter || (mediaTypeFilter === "book" && r.type === "book_series"))
    : currentResults;
  // Collections never render before this query's primary request settles.
  // The merge is query-based, so an early/late collection cannot pin itself.
  const resultRows = blendMovieCollections(searchQuery, filteredResults,
    currentSearchResolved ? collectionSearch.collections : []);

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      {addAnythingPresentation && !searchQuery.trim() && (
        <div className="shrink-0 px-6 pt-3 pb-5 sm:px-8 sm:pt-5 [@media(max-height:600px)]:hidden">
          <h1 className="font-fraunces font-bold text-[clamp(1.8rem,7vw,2.5rem)] leading-[0.98] tracking-[-0.045em] text-[#292437]">
            Go ahead.<br />
            Add <span className="font-fraunces underline decoration-[#8d70bd] decoration-[2px] underline-offset-[5px]">another.</span>
          </h1>
        </div>
      )}
      <div className={`${addAnythingPresentation ? "shrink-0 px-5 pt-1 pb-3 space-y-3 sm:px-8 [@media(max-height:600px)]:pb-2 [@media(max-height:600px)]:space-y-2" : "px-5 pt-1 pb-2 space-y-3"}`}>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search movies, shows, books, games…"
            autoFocus={autoFocus}
            className={`w-full pl-11 pr-10 py-3 border text-base text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent ${addAnythingPresentation ? "rounded-full border-[#9a7acb] bg-[#fffdfa] shadow-[0_0_0_1px_rgba(154,122,203,0.12)] placeholder:text-[#918b9c] focus:outline-none [@media(max-height:600px)]:py-2" : "border-gray-200 rounded-xl bg-gray-50"}`}
            data-testid="media-search-input"
          />
          {isSearching ? (
            <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-purple-600" size={16} />
          ) : searchQuery ? (
            <button aria-label="Clear search" onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 text-gray-400">
              <X size={15} />
            </button>
          ) : null}
        </div>

        <div>
          <p className={`text-xs font-semibold ${addAnythingPresentation ? "text-gray-600 mb-1.5 pl-1" : "text-gray-500 mb-2"}`}>Filter by media type</p>
          <div
            className="scrollbar-hide flex w-full min-w-0 max-w-full gap-1.5 overflow-x-auto pb-1"
            style={{ scrollbarWidth: "none" }}
            aria-label="Filter media type"
            data-testid="media-search-type-filters"
          >
            {MEDIA_SEARCH_FILTERS.map(({ value, label }) => {
              const active = mediaTypeFilter === value;
              const testValue = value || "all";
              return (
                <button
                  key={testValue}
                  type="button"
                  aria-pressed={active}
                  data-testid={`filter-media-${testValue}`}
                  onClick={() => setMediaTypeFilter(value)}
                  className={`shrink-0 ${addAnythingPresentation ? "rounded-full" : "rounded-xl"} border px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "border-purple-600 bg-purple-600 text-white"
                      : addAnythingPresentation
                        ? "border-[#e5e0eb] bg-[#fffdfa] text-[#403b4a] hover:border-purple-300 hover:bg-purple-50"
                        : "border-gray-200 bg-white text-gray-700 hover:border-purple-300 hover:bg-purple-50"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className={`flex-1 overflow-y-auto overscroll-contain px-5 pt-0 min-h-0 [-webkit-overflow-scrolling:touch] ${addAnythingPresentation ? "bg-[#f6f2fb] sm:px-8" : ""}`}
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
      >
        {!searchQuery.trim() && (
          <>
            <div className={`flex flex-col items-center text-center px-4 ${addAnythingPresentation ? "py-5 sm:py-7" : "py-8"}`}>
              <div className={`rounded-full bg-purple-50 flex items-center justify-center mb-3 ${addAnythingPresentation ? "w-10 h-10 mb-2" : "w-12 h-12"}`}>
                <EmptyStateIcon className="text-purple-500" size={22} aria-hidden="true" />
              </div>
              <p className={`${addAnythingPresentation ? "font-fraunces text-xl text-[#302a3c]" : "text-sm font-semibold text-gray-700"}`}>
                {addAnythingPresentation ? "Not sure what to add?" : "Search for anything"}
              </p>
              <p className={`text-xs mt-1 ${addAnythingPresentation ? "text-gray-500 max-w-xs" : "text-gray-400"}`}>
                {addAnythingPresentation ? "Search a title to find the stories, sounds, and worlds that make up your Entertainment DNA." : "Start typing above — filters are optional and just help narrow your search."}
              </p>
            </div>
            {emptyStateExtra}
          </>
        )}

        {currentSearchResolved && searchError && (
          <p role="alert" className="text-center text-sm text-red-600 py-4">{searchError}</p>
        )}

        {currentSearchResolved && !isSearching && !searchError && searchQuery.trim().length >= 2 && resultRows.length === 0 && !collectionSearch.isPending && (
          <p className="text-center text-sm text-gray-400 py-6">No results for "{searchQuery}".</p>
        )}

        {resultRows.length > 0 && (
          <>
            <p className="text-xs font-semibold text-gray-400 mb-1.5">Top results</p>
            <div className="space-y-1 rounded-xl border border-gray-200 p-1" data-testid="media-search-results">
              {resultRows.map((row, idx) => {
                if (row.kind === "collection") return (
                  <MovieCollectionRow key={`collection-${searchQuery.trim()}-${row.collection.id}`}
                    collection={row.collection} appearance="light" onOpenMedia={onSelect} onAddMedia={onSelect} />
                );
                const r = row.media;
                return expandableBookSeries && r.type === "book_series" && r.external_id ? (
                  <BookSeriesSearchResult key={`${r.type}-${r.external_source}-${r.external_id}-${normalizedSearchQuery}`} series={r} onSelect={onSelect} />
                ) : (
                <button
                  key={`${r.type}-${r.external_source}-${r.external_id || `row-${idx}`}-${normalizedSearchQuery}`}
                  onClick={() => onSelect(r)}
                  className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl text-left"
                  data-testid={`media-search-result-${r.external_id}`}
                >
                  {r.image && <img src={r.image} alt={r.title} className="w-11 h-16 object-cover rounded-lg flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm line-clamp-1">{r.title}</p>
                    <p className="text-xs text-gray-500">
                      {typeLabel(r.type, r.media_subtype)}{getBookVolumeLabel(r) ? ` • ${getBookVolumeLabel(r)}` : ""}{r.year ? ` • ${r.year}` : ""}
                    </p>
                    {r.creator && r.creator !== "Unknown Author" && <p className="text-xs text-gray-400 truncate">{r.creator}</p>}
                  </div>
                </button>);
              })}
            </div>
          </>
        )}
        {currentSearchResolved && collectionSearch.isPending && (
          <p role="status" className="px-3 py-2 text-[11px] text-gray-500">Searching collections…</p>
        )}
        {collectionSearch.isError && (
          <p className="px-3 py-2 text-[11px] text-gray-500">Movie collections unavailable. Other search results are unaffected.</p>
        )}
      </div>
    </div>
  );
}
