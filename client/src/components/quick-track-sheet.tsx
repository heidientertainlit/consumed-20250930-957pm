import { useState, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Search, Loader2, Star, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export interface TrackDetailsMedia {
  title: string;
  mediaType: string;
  imageUrl?: string;
  externalId?: string;
  externalSource?: string;
  creator?: string;
}

interface QuickTrackSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDetails: (media: TrackDetailsMedia, listType: string) => void;
}

const LISTS = [
  { id: "currently", label: "Currently" },
  { id: "queue", label: "Want To" },
  { id: "finished", label: "Finished" },
  { id: "favorites", label: "Favorites" },
  { id: "dnf", label: "DNF" },
];

const TYPE_PILLS: { value: string | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "tv", label: "TV" },
  { value: "movie", label: "Movie" },
  { value: "book", label: "Book" },
  { value: "music", label: "Music" },
  { value: "podcast", label: "Podcast" },
  { value: "game", label: "Game" },
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";

export function QuickTrackSheet({ isOpen, onClose, onAddDetails }: QuickTrackSheetProps) {
  const { session } = useAuth();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  const reset = () => {
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
    setMediaTypeFilter(null);
    setSelectedMedia(null);
    setSelectedList(null);
    setIsTracking(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  useEffect(() => {
    if (!session?.access_token || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => doSearch(searchQuery), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, session?.access_token, mediaTypeFilter]);

  const doSearch = async (query: string) => {
    if (!session?.access_token) return;
    setIsSearching(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/media-search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, include_book_series: true, ...(mediaTypeFilter ? { media_type: mediaTypeFilter } : {}) }),
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (e) {
      console.error("Track search error:", e);
    } finally {
      setIsSearching(false);
    }
  };

  const mapMedia = (r: any): TrackDetailsMedia => ({
    title: r.title,
    mediaType: r.type,
    imageUrl: r.image || r.image_url,
    externalId: r.external_id,
    externalSource: r.external_source || "tmdb",
    creator: r.creator,
  });

  // "Just add" — track quietly to the chosen list, no rating/take.
  const justAdd = async () => {
    if (!session?.access_token || !selectedMedia || !selectedList) return;
    setIsTracking(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/track-media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ media: mapMedia(selectedMedia), listType: selectedList }),
      });
      if (!res.ok) throw new Error("track failed");
      window.dispatchEvent(new CustomEvent("consumed:media-tracked"));
      queryClient.invalidateQueries({ queryKey: ["user-lists-with-media"] });
      toast({ title: `Added to ${LISTS.find((l) => l.id === selectedList)?.label}` });
      handleClose();
    } catch (e) {
      toast({ title: "Couldn't add that", variant: "destructive" });
    } finally {
      setIsTracking(false);
    }
  };

  // "Rate or write a take" — hand off to the full composer, which does the single
  // track + rating/review into the same list. We do NOT track here (avoids double-add).
  const goToDetails = () => {
    if (!selectedMedia || !selectedList) return;
    const m = mapMedia(selectedMedia);
    const list = selectedList;
    reset();
    onAddDetails(m, list);
  };

  const filteredResults = mediaTypeFilter
    ? searchResults.filter((r) => r.type === mediaTypeFilter || (mediaTypeFilter === "book" && r.type === "book_series"))
    : searchResults;

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl !bg-white flex flex-col overflow-hidden p-0 !shadow-none !border-0 !outline-none"
        style={{ backgroundColor: "white", height: "92svh" }}
      >
        {/* Drag handle */}
        <div className="flex-shrink-0 pt-3 pb-1 flex items-center justify-center">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-safe pt-2">
          {/* ── Search step ── */}
          {!selectedMedia && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Track something</h2>
                <p className="text-sm text-gray-500 mt-0.5">Find a movie, show, or book and add it to your library.</p>
              </div>

              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search movies, shows, books…"
                  autoFocus
                  className="w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-2xl bg-gray-50 text-base text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  data-testid="quick-track-search"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {TYPE_PILLS.map(({ value, label }) => (
                  <button
                    key={label}
                    onClick={() => setMediaTypeFilter(value)}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      mediaTypeFilter === value ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {isSearching && (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-purple-500" size={26} />
                </div>
              )}

              {!isSearching && searchQuery.trim() && filteredResults.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-8">No results for "{searchQuery}".</p>
              )}

              {!isSearching && !searchQuery.trim() && (
                <div className="text-center py-12 text-gray-300">
                  <Search size={40} className="mx-auto mb-3" />
                  <p className="text-sm text-gray-400">Start typing to find something to track.</p>
                </div>
              )}

              {filteredResults.length > 0 && (
                <div className="space-y-1">
                  {filteredResults.slice(0, 12).map((r, idx) => (
                    <button
                      key={`${r.external_id}-${idx}`}
                      onClick={() => setSelectedMedia(r)}
                      className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl text-left"
                      data-testid={`quick-track-result-${r.external_id}`}
                    >
                      {r.image && <img src={r.image} alt={r.title} className="w-11 h-16 object-cover rounded-lg flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm line-clamp-1">{r.title}</p>
                        <p className="text-xs text-gray-500 capitalize">
                          {r.type === "book_series" ? "book series" : r.type}
                          {r.year ? ` • ${r.year}` : ""}
                        </p>
                        {r.creator && r.creator !== "Unknown Author" && <p className="text-xs text-gray-400 truncate">{r.creator}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Pick list + choose depth step ── */}
          {selectedMedia && (
            <div className="space-y-5">
              <button
                onClick={() => {
                  setSelectedMedia(null);
                  setSelectedList(null);
                }}
                className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft size={16} /> Back to search
              </button>

              <div className="flex items-center gap-3">
                {selectedMedia.image && (
                  <img src={selectedMedia.image} alt={selectedMedia.title} className="w-14 h-20 object-cover rounded-lg flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 line-clamp-2">{selectedMedia.title}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {selectedMedia.type === "book_series" ? "book series" : selectedMedia.type}
                    {selectedMedia.year ? ` • ${selectedMedia.year}` : ""}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Add to a list</p>
                <div className="flex flex-wrap gap-2">
                  {LISTS.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setSelectedList(l.id)}
                      className={`px-4 py-2.5 rounded-full border text-sm font-semibold transition-colors ${
                        selectedList === l.id
                          ? "border-purple-600 bg-purple-600 text-white"
                          : "border-gray-200 text-gray-700 hover:border-purple-300 hover:bg-purple-50"
                      }`}
                      data-testid={`quick-track-list-${l.id}`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              {selectedList && (
                <div className="space-y-3 pt-1">
                  <button
                    disabled={isTracking}
                    onClick={justAdd}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold disabled:opacity-60 transition-colors"
                    data-testid="quick-track-just-add"
                  >
                    {isTracking ? <Loader2 className="animate-spin" size={16} /> : null}
                    Add to {LISTS.find((l) => l.id === selectedList)?.label}
                  </button>

                  <button
                    disabled={isTracking}
                    onClick={goToDetails}
                    className="w-full flex items-center justify-center gap-1.5 py-3 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60 transition-colors"
                    data-testid="quick-track-add-details"
                  >
                    <Star size={15} className="text-purple-600" /> Add a rating or a take
                  </button>

                  <p className="text-xs text-gray-400 text-center px-2">
                    Just logging it? Tap "Add to {LISTS.find((l) => l.id === selectedList)?.label}". Want to share your thoughts?
                    Add a rating or take and it'll post to your feed.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
