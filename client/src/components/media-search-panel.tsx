import { useState, useEffect, useRef } from "react";
import {
  Search, Loader2, X, Sparkles,
  Tv, Film, BookOpen, Music, Mic, Youtube, Gamepad2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

/**
 * MediaSearchPanel — THE shared media search experience.
 *
 * Used by both the Track ("Add media") dialog and the Share-a-take composer so
 * the search box, media-type filter pills, results list, and typo rescue are
 * one single implementation. Change it here, it changes everywhere.
 */

const TYPE_PILLS: { value: string; label: string; Icon: typeof Tv; beta?: boolean }[] = [
  { value: "tv", label: "TV", Icon: Tv },
  { value: "movie", label: "Movie", Icon: Film },
  { value: "book", label: "Book", Icon: BookOpen },
  { value: "music", label: "Music", Icon: Music },
  { value: "podcast", label: "Podcast", Icon: Mic },
  { value: "youtube", label: "YouTube", Icon: Youtube },
  { value: "game", label: "Gaming", Icon: Gamepad2, beta: true },
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";

function typeLabel(type?: string): string {
  switch (type) {
    case "tv": return "TV Series";
    case "movie": return "Movie";
    case "book": return "Book";
    case "book_series": return "Book Series";
    case "music": return "Music";
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
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string | null>(null);
  const [correctedQuery, setCorrectedQuery] = useState<string | null>(null);
  const searchReqId = useRef(0);

  useEffect(() => {
    if (!session?.access_token || !searchQuery.trim()) { setSearchResults([]); setCorrectedQuery(null); return; }
    const t = setTimeout(() => doSearch(searchQuery), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, session?.access_token, mediaTypeFilter]);

  const runMediaSearch = async (query: string): Promise<any[]> => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/media-search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session!.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, include_book_series: true, ...(mediaTypeFilter ? { type: mediaTypeFilter } : {}) }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  };

  const doSearch = async (query: string) => {
    if (!session?.access_token) return;
    const reqId = ++searchReqId.current;
    setIsSearching(true);
    setCorrectedQuery(null);
    const matchesFilter = (r: any) =>
      !mediaTypeFilter || r.type === mediaTypeFilter || (mediaTypeFilter === "book" && r.type === "book_series");
    try {
      let results = await runMediaSearch(query);
      let corrected: string | null = null;

      // No *visible* results (after the media-type filter)? Try a one-shot spelling correction and retry.
      if (results.filter(matchesFilter).length === 0 && query.trim().length >= 4) {
        try {
          const fixRes = await fetch(`${SUPABASE_URL}/functions/v1/spell-fix`, {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ query, ...(mediaTypeFilter ? { type: mediaTypeFilter } : {}) }),
          });
          const fix = fixRes.ok ? await fixRes.json() : { corrected: null };
          if (fix.corrected) {
            const retried = await runMediaSearch(fix.corrected);
            if (retried.filter(matchesFilter).length > 0) {
              results = retried;
              corrected = fix.corrected;
            }
          }
        } catch { /* rescue is best-effort — fall through to "No results" */ }
      }

      if (reqId === searchReqId.current) {
        setSearchResults(results);
        setCorrectedQuery(corrected);
      }
    } catch (e) {
      console.error("Media search error:", e);
    } finally {
      if (reqId === searchReqId.current) setIsSearching(false);
    }
  };

  const filteredResults = mediaTypeFilter
    ? searchResults.filter((r) => r.type === mediaTypeFilter || (mediaTypeFilter === "book" && r.type === "book_series"))
    : searchResults;

  return (
    <>
      <div className="px-5 pt-1 pb-2 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search movies, shows, books, games…"
            autoFocus={autoFocus}
            className="w-full pl-11 pr-10 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-base text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            data-testid="media-search-input"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 text-gray-400">
              <X size={15} />
            </button>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">Filter by media type</p>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={() => setMediaTypeFilter(null)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                mediaTypeFilter === null ? "bg-gray-700 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              All
            </button>
            {TYPE_PILLS.map(({ value, label, Icon, beta }) => {
              const active = mediaTypeFilter === value;
              return (
                <button
                  key={value}
                  onClick={() => setMediaTypeFilter(active ? null : value)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    active ? "bg-gray-700 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <Icon size={14} />
                  {label}
                  {beta && (
                    <span
                      className={`rounded-full px-1 py-px text-[8px] font-bold uppercase tracking-wide ${
                        active ? "bg-white/20 text-white" : "bg-purple-100 text-purple-600"
                      }`}
                    >
                      Beta
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-4 min-h-0">
        {isSearching && (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-purple-500" size={24} /></div>
        )}

        {!isSearching && !searchQuery.trim() && (
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

        {!isSearching && searchQuery.trim() && filteredResults.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-6">No results for "{searchQuery}".</p>
        )}

        {filteredResults.length > 0 && (
          <>
            {correctedQuery && (
              <p className="text-xs text-gray-500 mb-1.5">
                Showing results for "<span className="font-semibold text-gray-700">{correctedQuery}</span>"
              </p>
            )}
            <p className="text-xs font-semibold text-gray-400 mb-1.5">Top results</p>
            <div className="space-y-1">
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
                      {typeLabel(r.type)}{r.year ? ` • ${r.year}` : ""}
                    </p>
                    {r.creator && r.creator !== "Unknown Author" && <p className="text-xs text-gray-400 truncate">{r.creator}</p>}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
