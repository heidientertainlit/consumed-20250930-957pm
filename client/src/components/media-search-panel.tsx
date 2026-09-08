import { useState, useEffect, useRef } from "react";
import { Search, Loader2, X, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getBookVolumeLabel } from "@/lib/book-volume";

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

export function mediaSearchBody(query: string, type?: MediaTypeFilter) {
  return {
    query: query.trim(),
    include_book_series: true,
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
  fetcher = fetch,
}: {
  query: string;
  type?: MediaTypeFilter;
  bearer: string;
  signal: AbortSignal;
  fetcher?: typeof fetch;
}): Promise<any[]> {
  const response = await fetcher(`${SUPABASE_URL}/functions/v1/media-search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify(mediaSearchBody(query, type)),
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
  /** Optional content shown below the empty-state hint (e.g. recently tracked). */
  emptyStateExtra?: React.ReactNode;
}

export default function MediaSearchPanel({ onSelect, autoFocus = true, emptyStateExtra }: MediaSearchPanelProps) {
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mediaTypeFilter, setMediaTypeFilter] = useState<MediaTypeFilter | undefined>(undefined);
  const [searchError, setSearchError] = useState("");
  const searchReqId = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const previousMediaTypeRef = useRef<MediaTypeFilter | undefined>(undefined);

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    const mediaTypeChanged = previousMediaTypeRef.current !== mediaTypeFilter;
    previousMediaTypeRef.current = mediaTypeFilter;

    searchAbortRef.current?.abort();
    searchAbortRef.current = null;
    searchReqId.current += 1;
    setIsSearching(false);
    setSearchError("");

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
    // doSearch deliberately uses the query/type arguments captured by this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, session?.access_token, mediaTypeFilter]);

  useEffect(() => () => {
    searchAbortRef.current?.abort();
    searchReqId.current += 1;
  }, []);

  const doSearch = async (query: string, type?: MediaTypeFilter) => {
    const bearer = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!bearer) {
      setSearchError("Media search is unavailable. Please try again later.");
      return;
    }
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const reqId = ++searchReqId.current;
    setIsSearching(true);
    setSearchError("");
    try {
      const results = await requestMediaSearch({ query, type, bearer, signal: controller.signal });
      if (reqId === searchReqId.current) setSearchResults(results);
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
      console.error("Media search error:", error);
      if (reqId === searchReqId.current) {
        setSearchError(error instanceof Error ? error.message : "Media search failed. Please try again.");
      }
    } finally {
      if (reqId === searchReqId.current) {
        setIsSearching(false);
        if (searchAbortRef.current === controller) searchAbortRef.current = null;
      }
    }
  };

  const filteredResults = mediaTypeFilter
    ? searchResults.filter((r) => r.type === mediaTypeFilter || (mediaTypeFilter === "book" && r.type === "book_series"))
    : searchResults;

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      <div className="px-5 pt-1 pb-2 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search movies, shows, books, games…"
            autoFocus={autoFocus}
            className="w-full pl-11 pr-10 py-3 border border-gray-200 rounded-xl bg-gray-50 text-base text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            data-testid="media-search-input"
          />
          {isSearching ? (
            <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-purple-600" size={16} />
          ) : searchQuery ? (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 text-gray-400">
              <X size={15} />
            </button>
          ) : null}
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">Filter by media type</p>
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
                  className={`shrink-0 rounded-xl border px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "border-purple-600 bg-purple-600 text-white"
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
        className="flex-1 overflow-y-auto overscroll-contain px-5 pt-0 min-h-0 [-webkit-overflow-scrolling:touch]"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
      >
        {!searchQuery.trim() && (
          <>
            <div className="flex flex-col items-center text-center py-8 px-4">
              <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center mb-3">
                <Sparkles className="text-purple-500" size={22} />
              </div>
              <p className="text-sm font-semibold text-gray-700">Search for anything</p>
              <p className="text-xs text-gray-400 mt-1">Start typing above — filters are optional and just help narrow your search.</p>
            </div>
            {emptyStateExtra}
          </>
        )}

        {searchError && (
          <p role="alert" className="text-center text-sm text-red-600 py-4">{searchError}</p>
        )}

        {!isSearching && !searchError && searchQuery.trim().length >= 2 && filteredResults.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-6">No results for "{searchQuery}".</p>
        )}

        {filteredResults.length > 0 && (
          <>
            <p className="text-xs font-semibold text-gray-400 mb-1.5">Top results</p>
            <div className="space-y-1 rounded-xl border border-gray-200 p-1" data-testid="media-search-results">
              {filteredResults.slice(0, 12).map((r, idx) => (
                <button
                  key={`${r.external_id}-${idx}`}
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
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
