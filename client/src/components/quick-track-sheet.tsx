import { useState, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Search, Loader2, Star, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/posthog";

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

type Step = "search" | "compose";

export function QuickTrackSheet({ isOpen, onClose }: QuickTrackSheetProps) {
  const { session } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [selectedList, setSelectedList] = useState<string>("currently");
  const [isTracking, setIsTracking] = useState(false);

  // compose
  const [rating, setRating] = useState(0);
  const [takeText, setTakeText] = useState("");

  const reset = () => {
    setStep("search");
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
    setMediaTypeFilter(null);
    setSelectedMedia(null);
    setSelectedList("currently");
    setIsTracking(false);
    setRating(0);
    setTakeText("");
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

  const listLabel = LISTS.find((l) => l.id === selectedList)?.label ?? "list";

  // "Just add" — track to the chosen list, no rating/take.
  const justAdd = async () => {
    if (!session?.access_token || !selectedMedia) return;
    setIsTracking(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/track-media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ media: mapMedia(selectedMedia), listType: selectedList }),
      });
      if (!res.ok) throw new Error("track failed");
      window.dispatchEvent(new CustomEvent("consumed:media-tracked"));
      trackEvent("media_tracked", { media_type: selectedMedia.type, list_type: selectedList, has_rating: false });
      queryClient.invalidateQueries({ queryKey: ["user-lists-with-media"] });
      toast({ title: `Added to ${listLabel}` });
      handleClose();
    } catch (e) {
      toast({ title: "Couldn't add that", variant: "destructive" });
    } finally {
      setIsTracking(false);
    }
  };

  // Inline compose: a single track-media call carries the rating + take into the
  // same chosen list. A text-only take (no rating) also creates a 'thought' feed
  // post (track-media's add-to-list card is filtered from the feed without a rating).
  const postCompose = async () => {
    if (!session?.access_token || !selectedMedia) return;
    if (rating === 0 && !takeText.trim()) return;
    setIsTracking(true);
    try {
      const hasRating = rating > 0;
      const trackRes = await fetch(`${SUPABASE_URL}/functions/v1/track-media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          media: mapMedia(selectedMedia),
          listType: selectedList,
          rating: hasRating ? rating : undefined,
          review: hasRating && takeText.trim() ? takeText.trim() : undefined,
          skip_social_post: !hasRating, // text-only take posts as a 'thought' below instead
        }),
      });
      if (!trackRes.ok) throw new Error("track failed");

      // Text-only take → create a feed-visible thought post.
      if (!hasRating && takeText.trim()) {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) throw new Error("Not authenticated");
        const { error: postErr } = await supabase.from("social_posts").insert({
          user_id: authUser.id,
          content: takeText.trim(),
          post_type: "thought",
          visibility: "public",
          media_title: selectedMedia.title || null,
          media_type: selectedMedia.type?.toLowerCase() || null,
          media_external_id: selectedMedia.external_id || null,
          media_external_source: selectedMedia.external_source || "tmdb",
          image_url: selectedMedia.image || selectedMedia.image_url || "",
          fire_votes: 0,
          ice_votes: 0,
        });
        if (postErr) throw postErr;
      }

      window.dispatchEvent(new CustomEvent("consumed:media-tracked"));
      trackEvent("media_tracked", { media_type: selectedMedia.type, list_type: selectedList, has_rating: hasRating });
      queryClient.invalidateQueries({ queryKey: ["user-lists-with-media"] });
      queryClient.invalidateQueries({ queryKey: ["social-feed"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      toast({ title: hasRating ? "Rating posted" : "Take posted" });
      handleClose();
    } catch (e) {
      toast({ title: "Couldn't post that", variant: "destructive" });
    } finally {
      setIsTracking(false);
    }
  };

  const filteredResults = mediaTypeFilter
    ? searchResults.filter((r) => r.type === mediaTypeFilter || (mediaTypeFilter === "book" && r.type === "book_series"))
    : searchResults;

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl !bg-white flex flex-col overflow-hidden p-0 !shadow-none !border-0 !outline-none"
        style={{ backgroundColor: "white", maxHeight: "88svh" }}
      >
        {/* Drag handle */}
        <div className="flex-shrink-0 pt-3 pb-1 flex items-center justify-center">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-1">
          {/* ── Search step ── */}
          {step === "search" && (
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Track something</h2>
                <p className="text-xs text-gray-500 mt-0.5">Find a movie, show, or book and add it to your library.</p>
              </div>

              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search movies, shows, books…"
                  autoFocus
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-base text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  data-testid="quick-track-search"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                <span className="flex-shrink-0 text-xs font-semibold text-gray-400 uppercase tracking-wide pr-0.5">Filter</span>
                {TYPE_PILLS.map(({ value, label }) => (
                  <button
                    key={label}
                    onClick={() => setMediaTypeFilter(value)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      mediaTypeFilter === value ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {isSearching && (
                <div className="flex justify-center py-6">
                  <Loader2 className="animate-spin text-purple-500" size={24} />
                </div>
              )}

              {!isSearching && searchQuery.trim() && filteredResults.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-6">No results for "{searchQuery}".</p>
              )}

              {!isSearching && !searchQuery.trim() && (
                <p className="text-center text-sm text-gray-400 py-4">Start typing to find something to track.</p>
              )}

              {filteredResults.length > 0 && (
                <div className="space-y-1">
                  {filteredResults.slice(0, 12).map((r, idx) => (
                    <button
                      key={`${r.external_id}-${idx}`}
                      onClick={() => {
                        setSelectedMedia(r);
                        setStep("compose");
                      }}
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

          {/* ── Compose step: pick list + optional rating/take, all inline ── */}
          {step === "compose" && selectedMedia && (
            <div className="space-y-4">
              <button
                onClick={() => {
                  setStep("search");
                  setSelectedMedia(null);
                  setRating(0);
                  setTakeText("");
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
                      className={`px-3.5 py-2 rounded-full border text-sm font-semibold transition-colors ${
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

              {/* Optional rating + take — composer lives right here, no jump */}
              <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">Add a rating or a take</p>
                  <span className="text-xs text-gray-400">optional</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(rating === star ? 0 : star)}
                      data-testid={`quick-track-star-${star}`}
                      className="p-0.5"
                    >
                      <Star
                        size={26}
                        className={rating >= star ? "text-yellow-400" : "text-gray-300"}
                        fill={rating >= star ? "currentColor" : "none"}
                      />
                    </button>
                  ))}
                  {rating > 0 && <span className="ml-1 text-sm font-semibold text-gray-600">{rating}/5</span>}
                </div>

                <textarea
                  value={takeText}
                  onChange={(e) => setTakeText(e.target.value)}
                  placeholder="Share a take… (optional)"
                  rows={3}
                  className="w-full p-3 border border-gray-200 rounded-xl bg-white text-sm text-gray-900 resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  data-testid="quick-track-take"
                />
              </div>

              <div className="space-y-2 pt-1">
                {rating > 0 || takeText.trim() ? (
                  <button
                    disabled={isTracking}
                    onClick={postCompose}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold disabled:opacity-60 transition-colors"
                    data-testid="quick-track-post"
                  >
                    {isTracking ? <Loader2 className="animate-spin" size={16} /> : null}
                    Post to {listLabel}
                  </button>
                ) : (
                  <button
                    disabled={isTracking}
                    onClick={justAdd}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold disabled:opacity-60 transition-colors"
                    data-testid="quick-track-just-add"
                  >
                    {isTracking ? <Loader2 className="animate-spin" size={16} /> : null}
                    Add to {listLabel}
                  </button>
                )}
                <p className="text-xs text-gray-400 text-center px-2">
                  Just logging it? Tap “Add to {listLabel}”. Add a rating or take and it'll post to your feed.
                </p>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
