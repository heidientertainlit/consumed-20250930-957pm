import { useState, useEffect, useRef } from "react";
import { X, Film, Plus, MessageSquarePlus, Star } from "lucide-react";
import { SearchPlusIcon } from "@/components/ui/search-plus-icon";
import { Link } from "wouter";
import { QuickAddListSheet } from "@/components/quick-add-list-sheet";
import { QuickAddModal } from "@/components/quick-add-modal";

const normalizeMediaType = (type: string | undefined | null): string => {
  const t = (type || "").toLowerCase().trim();
  if (t === "tv" || t === "tv show" || t === "tv_show" || t === "tvshow" || t === "series" || t === "television") return "tv";
  if (t === "book" || t === "book_series") return "book";
  if (t === "podcast") return "podcast";
  if (t === "music" || t === "album" || t === "song") return "music";
  return "movie";
};

const formatTypeLabel = (type: string, seriesCount?: number): string => {
  if (type === 'book_series') return seriesCount ? `${seriesCount}-book series` : 'book series';
  return type;
};

// Detect series name from title patterns like "X and the Y" → series "X"
const inferSeries = (title: string): string | null => {
  const andThe = /^(.+?)\s+and\s+the\s+/i.exec(title);
  if (andThe) {
    const candidate = andThe[1].trim();
    if (candidate.split(/\s+/).length <= 4) return candidate;
  }
  return null;
};

interface MediaSearchBarProps {
  session: any;
  placeholder?: string;
}

export function MediaSearchBar({
  session,
  placeholder = "Search something to track, rate, or talk about",
}: MediaSearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddMedia, setQuickAddMedia] = useState<any>(null);

  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerMedia, setComposerMedia] = useState<any>(null);

  const searchIdRef = useRef(0);

  const clear = () => { setQuery(""); setResults([]); };

  useEffect(() => {
    const currentId = ++searchIdRef.current;
    const timer = setTimeout(async () => {
      if (!query.trim() || !session?.access_token) {
        setResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const res = await fetch(
          "https://mahpgcogwpawvviapqza.supabase.co/functions/v1/media-search",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: query.trim(), include_book_series: true }),
          }
        );
        if (currentId !== searchIdRef.current) return;
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        } else {
          setResults([]);
        }
      } catch {
        if (currentId !== searchIdRef.current) return;
        setResults([]);
      } finally {
        if (currentId === searchIdRef.current) setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, session?.access_token]);

  return (
    <>
      <div className="relative">
        <div className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white/[0.12] border border-white/20 focus-within:border-purple-400/60 transition-colors">
          {isSearching
            ? <div className="w-[18px] h-[18px] border-2 border-purple-300/60 border-t-transparent rounded-full animate-spin shrink-0" />
            : <SearchPlusIcon size={18} className="text-purple-300/80 shrink-0" />
          }
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-white placeholder-white/50 text-sm outline-none"
          />
          {query && (
            <button onClick={clear} className="shrink-0">
              <X size={16} className="text-white/40" />
            </button>
          )}
        </div>

        {results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl bg-[#1a1a2e] border border-white/10 shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider px-4 pt-3 pb-2">Media</p>
            {results.slice(0, 6).map((result, index) => {
              const poster = result.poster_url || result.image_url || result.poster_path || result.image;
              const mediaObj = {
                title: result.title,
                mediaType: result.type || "movie",
                externalId: result.external_id || result.id,
                externalSource: result.external_source || "tmdb",
                imageUrl: poster || "",
              };
              return (
                <div
                  key={`${result.external_id || result.id}-${index}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.05] transition-colors"
                >
                  <Link
                    href={`/media/${normalizeMediaType(result.type)}/${result.external_source || "tmdb"}/${result.external_id || result.id}`}
                    className="flex items-center gap-3 flex-1 min-w-0"
                    onClick={clear}
                  >
                    {poster
                      ? <img src={poster} alt={result.title} className="w-12 h-16 object-cover rounded-lg shrink-0" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      : <div className="w-12 h-16 bg-white/10 rounded-lg shrink-0 flex items-center justify-center"><Film size={16} className="text-white/30" /></div>
                    }
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-semibold text-white text-sm leading-snug"
                        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                      >{result.title}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="text-xs text-white/50 capitalize">{formatTypeLabel(result.type, result.series_count)}{result.year ? ` • ${result.year}` : ""}</span>
                        {result.type === 'book_series' && result.series_count > 0 && (
                          <span className="text-[10px] font-medium bg-purple-500/30 text-purple-200 border border-purple-400/40 px-1.5 py-0.5 rounded-full">📚 {result.series_count} books</span>
                        )}
                        {result.type === 'book' && (result.series || inferSeries(result.title)) && (
                          <span className="text-[10px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded-full truncate max-w-[140px]">📚 {result.series || inferSeries(result.title)}</span>
                        )}
                      </div>
                      {result.creator && result.creator !== 'Unknown Author' && (
                        <p className="text-xs text-white/40 truncate mt-0.5">{result.creator}</p>
                      )}
                    </div>
                  </Link>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => { clear(); setQuickAddMedia(mediaObj); setIsQuickAddOpen(true); }}
                      className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center transition-colors"
                    >
                      <Plus size={20} className="text-white" />
                    </button>
                    <button
                      onClick={() => { clear(); setComposerMedia(mediaObj); setIsComposerOpen(true); }}
                      className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 flex items-center justify-center transition-colors relative"
                    >
                      <MessageSquarePlus size={16} className="text-white" />
                      <Star size={10} className="absolute -top-0.5 -right-0.5 fill-yellow-300 text-yellow-300" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <QuickAddListSheet
        isOpen={isQuickAddOpen}
        onClose={() => { setIsQuickAddOpen(false); setQuickAddMedia(null); }}
        media={quickAddMedia}
      />

      <QuickAddModal
        isOpen={isComposerOpen}
        onClose={() => { setIsComposerOpen(false); setComposerMedia(null); }}
        initialPostType="review"
        preSelectedMedia={composerMedia}
        skipToComposer={!!composerMedia}
        searchToCompose={!composerMedia}
      />
    </>
  );
}
