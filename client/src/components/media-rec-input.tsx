import { useState, useEffect, useRef } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MEDIA_SEARCH_FILTERS, requestMediaSearch } from "@/components/media-search-panel";

interface MediaResult {
  title: string;
  type: string;
  creator: string;
  poster_url: string;
  external_id?: string;
  external_source?: string;
  description?: string;
}

interface MediaRecInputProps {
  placeholder?: string;
  onSubmit: (media: MediaResult) => void;
  isSubmitting: boolean;
  recCategory?: string;
}

export default function MediaRecInput({
  placeholder = "Search for a recommendation...",
  onSubmit,
  isSubmitting,
  recCategory
}: MediaRecInputProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MediaResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  // Map rec category to media type filter
  const categoryToType: Record<string, string> = {
    movies: 'movie',
    tv: 'tv',
    books: 'book',
    music: 'music',
    podcasts: 'podcast',
    games: 'game'
  };
  const [mediaTypeFilter, setMediaTypeFilter] = useState<"movie" | "tv" | "book" | "music" | "podcast" | "youtube" | "game" | undefined>(
    recCategory ? categoryToType[recCategory] as "movie" | "tv" | "book" | "music" | "podcast" | "youtube" | "game" | undefined : undefined
  );

  const searchMedia = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!apiKey) return;
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const requestId = ++requestIdRef.current;
    setIsSearching(true);
    try {
      const results = await requestMediaSearch({ query, type: mediaTypeFilter, bearer: apiKey, signal: controller.signal });
      if (requestId === requestIdRef.current) {
        setSearchResults(results.map((result) => ({ ...result, poster_url: result.poster_url || result.image || "" })));
        setShowDropdown(true);
      }
    } catch (error) {
      if (!controller.signal.aborted && requestId === requestIdRef.current) {
        console.error("Media search error:", error);
        setSearchResults([]);
      }
    } finally {
      if (requestId === requestIdRef.current) setIsSearching(false);
    }
  };

  useEffect(() => {
    if (selectedMedia) return; // Don't search when media is selected
    
    const debounce = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchMedia(searchQuery);
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 200);

    return () => clearTimeout(debounce);
  }, [searchQuery, selectedMedia, mediaTypeFilter]);

  useEffect(() => () => {
    searchAbortRef.current?.abort();
    requestIdRef.current += 1;
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (media: MediaResult) => {
    setSelectedMedia(media);
    setSearchQuery(media.title);
    setShowDropdown(false);
  };

  const handleClear = () => {
    setSelectedMedia(null);
    setSearchQuery("");
    setSearchResults([]);
    inputRef.current?.focus();
  };

  const handleSubmit = () => {
    if (selectedMedia) {
      onSubmit(selectedMedia);
      setSelectedMedia(null);
      setSearchQuery("");
    }
  };

  const getCategoryEmoji = (type: string) => {
    const emojis: Record<string, string> = {
      movie: '🎬', tv: '📺', book: '📚', music: '🎵', 
      podcast: '🎙️', game: '🎮'
    };
    return emojis[type] || '✨';
  };

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (selectedMedia) setSelectedMedia(null);
            }}
            onFocus={() => {
              if (searchResults.length > 0 && !selectedMedia) setShowDropdown(true);
            }}
            className="pl-9 pr-8 bg-white"
            disabled={isSubmitting}
            data-testid="input-media-rec-search"
          />
          {(searchQuery || selectedMedia) && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              data-testid="button-clear-rec-search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <Button
          onClick={handleSubmit}
          size="sm"
          disabled={!selectedMedia || isSubmitting}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4"
          data-testid="button-submit-rec"
        >
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Add"}
        </Button>
      </div>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide" aria-label="Filter media type">
        {MEDIA_SEARCH_FILTERS.map(({ label, value }) => (
          <button
            key={value || "all"}
            type="button"
            aria-pressed={mediaTypeFilter === value}
            onClick={() => setMediaTypeFilter(value)}
            disabled={isSubmitting}
            className={`shrink-0 rounded-xl border px-2.5 py-1 text-xs font-medium ${
              mediaTypeFilter === value
                ? "border-purple-600 bg-purple-600 text-white"
                : "border-gray-200 bg-white text-gray-700 hover:bg-purple-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Selected media preview */}
      {selectedMedia && (
        <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded-lg flex items-center gap-2">
          {selectedMedia.poster_url ? (
            <img 
              src={selectedMedia.poster_url} 
              alt={selectedMedia.title} 
              className="w-10 h-10 rounded object-cover"
            />
          ) : (
            <div className="w-10 h-10 bg-purple-100 rounded flex items-center justify-center text-lg">
              {getCategoryEmoji(selectedMedia.type)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{selectedMedia.title}</p>
            <p className="text-xs text-gray-500">{selectedMedia.type} {selectedMedia.creator && `• ${selectedMedia.creator}`}</p>
          </div>
        </div>
      )}

      {/* Search results dropdown */}
      {showDropdown && searchResults.length > 0 && !selectedMedia && (
        <div 
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto p-1"
        >
          {isSearching && (
            <div className="p-3 text-center text-gray-500">
              <Loader2 size={16} className="animate-spin inline mr-2" />
              Searching...
            </div>
          )}
          {!isSearching && searchResults.map((result, idx) => (
            <button
              key={`${result.external_id || result.title}-${idx}`}
              onClick={() => handleSelect(result)}
              className="w-full rounded-xl p-2 flex items-center gap-3 hover:bg-purple-50 transition-colors text-left"
              data-testid={`button-select-media-${idx}`}
            >
              {result.poster_url ? (
                <img 
                  src={result.poster_url} 
                  alt={result.title} 
                  className="w-10 h-14 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-14 bg-gray-100 rounded flex items-center justify-center text-lg flex-shrink-0">
                  {getCategoryEmoji(result.type)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{result.title}</p>
                <p className="text-xs text-gray-500 truncate">{result.type} {result.creator && `• ${result.creator}`}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {showDropdown && !isSearching && searchQuery.length >= 2 && searchResults.length === 0 && !selectedMedia && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-center text-gray-500 text-sm">
          No results found for "{searchQuery}"
        </div>
      )}
    </div>
  );
}
