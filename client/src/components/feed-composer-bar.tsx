import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Star, BarChart2, TrendingUp, X, Search, Loader2, Flame, ArrowLeft, Bookmark, MessageSquare } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

type TabType = "take" | "review" | "poll" | "prediction";
type MediaFilter = "all" | "tv" | "movie" | "book" | "podcast" | "music" | "game" | "youtube";

const TABS: { id: TabType; label: string; icon: React.ReactNode; placeholder: string }[] = [
  { id: "take",       label: "Take",       icon: <Flame className="w-3.5 h-3.5" />,       placeholder: "What's your hot take?" },
  { id: "review",     label: "Rate",       icon: <Star className="w-3.5 h-3.5" />,         placeholder: "Write your review..." },
  { id: "poll",       label: "Poll",       icon: <BarChart2 className="w-3.5 h-3.5" />,    placeholder: "Ask a question..." },
  { id: "prediction", label: "Prediction", icon: <TrendingUp className="w-3.5 h-3.5" />,   placeholder: "Make a prediction..." },
];

const MEDIA_FILTERS: { id: MediaFilter; label: string }[] = [
  { id: "all",     label: "All" },
  { id: "tv",      label: "TV Shows" },
  { id: "movie",   label: "Movies" },
  { id: "book",    label: "Books" },
  { id: "podcast", label: "Podcasts" },
  { id: "music",   label: "Music" },
  { id: "game",    label: "Games" },
  { id: "youtube", label: "YouTube" },
];

function MediaRow({ item, onTag, onRate }: { item: any; onTag: () => void; onRate: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 active:opacity-80">
      {item.image_url
        ? <img src={item.image_url} alt="" className="w-11 h-15 object-cover rounded-lg flex-shrink-0" style={{ height: '60px', width: '44px' }} />
        : <div className="rounded-lg flex-shrink-0" style={{ width: 44, height: 60, background: 'rgba(255,255,255,0.1)' }} />
      }
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate leading-snug">{item.title}</p>
        <p className="text-xs text-white/40 capitalize mt-0.5">
          {item.type === "tv" ? "TV Show" : item.type === "movie" ? "Movie" : item.type}
          {item.year ? ` • ${item.year}` : ""}
          {item.creator && item.creator !== "Unknown Author" ? ` • ${item.creator}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onRate}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-90"
          style={{ background: 'rgba(251,146,60,0.25)' }}
          title="Rate this"
        >
          <Star size={15} className="text-orange-400" />
        </button>
        <button
          onClick={onTag}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-90"
          style={{ background: 'rgba(139,92,246,0.3)' }}
          title="Tag to post"
        >
          <Bookmark size={15} className="text-purple-300" />
        </button>
      </div>
    </div>
  );
}

export default function FeedComposerBar() {
  const { session } = useAuth();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [showMediaSearch, setShowMediaSearch] = useState(false);
  const [searchSlideIn, setSearchSlideIn] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("review");
  const [contentText, setContentText] = useState("");
  const [ratingValue, setRatingValue] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [recommendedItems, setRecommendedItems] = useState<any[]>([]);
  const [trendingItems, setTrendingItems] = useState<any[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentTab = TABS.find(t => t.id === activeTab)!;
  const showRating = activeTab === "review";
  const showPollOptions = activeTab === "poll" || activeTab === "prediction";

  useEffect(() => {
    if (isOpen && !showMediaSearch && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
    if (showMediaSearch && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen, showMediaSearch]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      if (!session?.access_token) return;
      setIsSearching(true);
      try {
        const url = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";
        const res = await fetch(`${url}/functions/v1/media-search`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery, type: mediaFilter === "all" ? undefined : mediaFilter }),
        });
        if (!res.ok) return;
        const data = await res.json();
        setSearchResults((data.results || []).slice(0, 10).map((r: any) => ({
          ...r,
          image_url: r.image_url || r.poster_url || r.image || "",
        })));
      } catch {}
      finally { setIsSearching(false); }
    }, 350);
  }, [searchQuery, mediaFilter, session]);

  const resetForm = () => {
    setContentText("");
    setRatingValue(0);
    setHoverRating(0);
    setSelectedMedia(null);
    setSearchQuery("");
    setSearchResults([]);
    setPollOptions(["", ""]);
    setShowMediaSearch(false);
    setMediaFilter("all");
    setIsOpen(false);
  };

  useEffect(() => {
    if (!showMediaSearch) return;
    requestAnimationFrame(() => setSearchSlideIn(true));

    const userId = session?.user?.id;
    if (!userId) return;

    supabase
      .from("list_items")
      .select("title, media_type, image_url, external_id, external_source, creator")
      .eq("user_id", userId)
      .not("image_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setRecommendedItems(
          data.filter(r => r.image_url).map(r => ({
            title: r.title, type: r.media_type, image_url: r.image_url,
            external_id: r.external_id, external_source: r.external_source, creator: r.creator,
          }))
        );
      });

    supabase
      .from("list_items")
      .select("title, media_type, image_url, external_id, external_source")
      .not("image_url", "is", null)
      .limit(200)
      .then(({ data }) => {
        if (!data) return;
        const counts: Record<string, { item: any; count: number }> = {};
        data.forEach(r => {
          if (!r.external_id || !r.image_url) return;
          const key = r.external_id;
          if (!counts[key]) counts[key] = { item: r, count: 0 };
          counts[key].count++;
        });
        const sorted = Object.values(counts)
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
          .map(({ item }) => ({
            title: item.title, type: item.media_type, image_url: item.image_url,
            external_id: item.external_id, external_source: item.external_source,
          }));
        setTrendingItems(sorted);
      });
  }, [showMediaSearch, session]);

  const closeMediaSearch = () => {
    setSearchSlideIn(false);
    setTimeout(() => {
      setShowMediaSearch(false);
      setSearchQuery("");
      setSearchResults([]);
      setMediaFilter("all");
    }, 260);
  };

  const selectMedia = (media: any) => {
    setSelectedMedia(media);
    closeMediaSearch();
  };

  const canPost = () => {
    if (activeTab === "take") return contentText.trim().length > 0;
    if (activeTab === "review") return !!selectedMedia && (ratingValue > 0 || contentText.trim().length > 0);
    if (activeTab === "poll") return pollOptions[0].trim().length > 0 && pollOptions[1].trim().length > 0;
    if (activeTab === "prediction") return contentText.trim().length > 0 && pollOptions[0].trim() && pollOptions[1].trim();
    return false;
  };

  const handlePost = async () => {
    if (!session?.access_token || isPosting) return;
    setIsPosting(true);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";
    try {
      if (activeTab === "take") {
        const res = await fetch(`${supabaseUrl}/functions/v1/inline-post`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            content: contentText.trim(), type: "thought", post_type: "hot_take", visibility: "public",
            media_title: selectedMedia?.title, media_type: selectedMedia?.type || selectedMedia?.mediaType,
            media_creator: selectedMedia?.creator || selectedMedia?.author || selectedMedia?.artist,
            media_image_url: selectedMedia?.image_url || selectedMedia?.poster_url || selectedMedia?.image,
            media_external_id: selectedMedia?.external_id || selectedMedia?.id,
            media_external_source: selectedMedia?.external_source || selectedMedia?.source || "tmdb",
          }),
        });
        if (!res.ok) throw new Error("Failed to post take");
        toast({ title: "Hot take posted!" });
      } else if (activeTab === "review") {
        const content = contentText.trim() || (ratingValue > 0 ? `Rated ${selectedMedia.title}` : `Reviewed ${selectedMedia.title}`);
        const res = await fetch(`${supabaseUrl}/functions/v1/inline-post`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            content, type: "rate-review", rating: ratingValue > 0 ? ratingValue : undefined, visibility: "public",
            media_title: selectedMedia.title, media_type: selectedMedia.type || selectedMedia.mediaType,
            media_creator: selectedMedia.creator || selectedMedia.author || selectedMedia.artist,
            media_image_url: selectedMedia.image_url || selectedMedia.poster_url || selectedMedia.image,
            media_external_id: selectedMedia.external_id || selectedMedia.id,
            media_external_source: selectedMedia.external_source || selectedMedia.source || "tmdb",
          }),
        });
        if (!res.ok) throw new Error("Failed to post review");
        toast({ title: "Review posted!" });
      } else if (activeTab === "poll") {
        const filled = pollOptions.filter(o => o.trim());
        const res = await fetch(`${supabaseUrl}/functions/v1/create-prediction`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ question: contentText.trim() || "What do you think?", options: filled, type: "poll" }),
        });
        if (!res.ok) throw new Error("Failed to create poll");
        toast({ title: "Poll created!" });
      } else if (activeTab === "prediction") {
        const filled = pollOptions.filter(o => o.trim());
        const res = await fetch(`${supabaseUrl}/functions/v1/create-prediction`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            question: contentText.trim(), options: filled, type: "predict",
            media_title: selectedMedia?.title || null, media_type: selectedMedia?.type || null,
            media_image_url: selectedMedia?.image_url || selectedMedia?.poster_url || null,
            media_external_id: selectedMedia?.external_id || null,
            media_external_source: selectedMedia?.external_source || null,
          }),
        });
        if (!res.ok) throw new Error("Failed to create prediction");
        toast({ title: "Prediction posted!" });
      }
      setTimeout(() => queryClient.refetchQueries({ queryKey: ["social-feed"] }), 800);
      resetForm();
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <>
      {/* Collapsed trigger */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-full rounded-2xl bg-white border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
      >
        <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
          <Plus className="w-4 h-4 text-white" />
        </div>
        <span className="text-gray-400 text-sm flex-1">What's your next move?</span>
      </button>

      {isOpen && createPortal(
        <div className="fixed inset-0 z-[99999]">
          {/* Dim backdrop */}
          <div className="absolute inset-0 bg-black/65" onClick={resetForm} />

          {/* ── Composer card ── */}
          <div
            className="absolute left-4 right-4 bg-white rounded-3xl shadow-2xl overflow-hidden"
            style={{ top: '20%' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
              <button onClick={resetForm} className="text-sm font-medium text-gray-400 hover:text-gray-700">Cancel</button>
              <span className="text-sm font-semibold text-gray-700">{currentTab.label}</span>
              <button
                onClick={handlePost}
                disabled={!canPost() || isPosting}
                className="bg-purple-600 disabled:opacity-40 text-white text-sm font-semibold px-4 py-1.5 rounded-full flex items-center gap-1.5 active:scale-95 transition-all"
              >
                {isPosting && <Loader2 className="w-3 h-3 animate-spin" />}
                Post
              </button>
            </div>

            {/* Textarea */}
            <div className="px-5 pt-3 pb-2">
              <textarea
                ref={textareaRef}
                value={contentText}
                onChange={e => setContentText(e.target.value)}
                placeholder={currentTab.placeholder}
                rows={3}
                className="w-full text-base text-gray-800 placeholder:text-gray-400 resize-none border-0 outline-none focus:outline-none bg-transparent"
              />
            </div>

            {/* Selected media chip */}
            {selectedMedia && (
              <div className="mx-5 mb-2 flex items-center gap-2 bg-gray-50 rounded-xl p-2 border border-gray-100">
                {selectedMedia.image_url && (
                  <img src={selectedMedia.image_url} alt="" className="w-8 h-11 object-cover rounded flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{selectedMedia.title}</p>
                  <p className="text-[10px] text-gray-400 capitalize">{selectedMedia.type}{selectedMedia.year ? ` · ${selectedMedia.year}` : ""}</p>
                </div>
                <button onClick={() => setSelectedMedia(null)} className="text-gray-300 hover:text-red-400 p-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Rating */}
            {showRating && (
              <div className="mx-5 mb-2 flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">Rating:</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button key={star}
                      onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRatingValue(star === ratingValue ? 0 : star)}
                      className="transition-transform active:scale-90"
                    >
                      <Star className={`w-6 h-6 transition-colors ${star <= (hoverRating || ratingValue) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Poll/Prediction options */}
            {showPollOptions && (
              <div className="mx-5 mb-2 space-y-1.5">
                {pollOptions.map((opt, i) => (
                  <input key={i} value={opt}
                    onChange={e => { const next = [...pollOptions]; next[i] = e.target.value; setPollOptions(next); }}
                    placeholder={`Option ${i + 1}`}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-purple-400 text-gray-800 placeholder:text-gray-400 bg-gray-50"
                  />
                ))}
              </div>
            )}

            {/* Bottom toolbar */}
            <div className="px-5 pb-4 pt-2 border-t border-gray-100 space-y-2">
              <div className="flex gap-1.5">
                {TABS.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all ${
                      activeTab === tab.id ? "bg-purple-100 text-purple-700" : "text-gray-400 hover:bg-gray-100"
                    }`}
                  >
                    {tab.icon}{tab.label}
                  </button>
                ))}
              </div>
              <div>
                <button
                  onClick={() => setShowMediaSearch(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border bg-purple-50 border-purple-200 text-purple-600 hover:bg-purple-100 transition-all"
                >
                  <Plus size={13} strokeWidth={2.5} />
                  Add media
                </button>
              </div>
            </div>
          </div>

          {/* ── Full-screen media search layer (slides up) ── */}
          {showMediaSearch && (
            <div
              className="absolute inset-0 flex flex-col"
              style={{
                zIndex: 1,
                background: 'linear-gradient(160deg, #0a0a0f 0%, #12121f 50%, #2d1f4e 100%)',
                transform: searchSlideIn ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)',
              }}
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-4 pt-14 pb-4 flex-shrink-0">
                <button onClick={closeMediaSearch} className="p-2 rounded-full hover:bg-white/10 transition-colors flex-shrink-0">
                  <ArrowLeft size={20} className="text-white" />
                </button>
                <div className="flex-1 flex items-center gap-2 rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <Search size={16} className="text-white/50 flex-shrink-0" />
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search movies, shows, books…"
                    className="flex-1 text-sm text-white placeholder:text-white/40 bg-transparent outline-none"
                    autoFocus
                  />
                  {searchQuery && (
                    isSearching
                      ? <Loader2 size={14} className="text-white/40 animate-spin flex-shrink-0" />
                      : <button onClick={() => { setSearchQuery(""); setSearchResults([]); }}><X size={14} className="text-white/40" /></button>
                  )}
                </div>
              </div>

              {/* Filter pills */}
              <div className="flex gap-2 px-4 pb-4 overflow-x-auto flex-shrink-0">
                {MEDIA_FILTERS.map(f => (
                  <button key={f.id} onClick={() => setMediaFilter(f.id)}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      mediaFilter === f.id
                        ? "bg-purple-500 text-white"
                        : "text-white/60 hover:text-white hover:bg-white/10"
                    }`}
                    style={mediaFilter !== f.id ? { background: 'rgba(255,255,255,0.08)' } : {}}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Results / Pre-search sections */}
              <div className="flex-1 overflow-y-auto">

                {/* ── Pre-search: Recommended + Trending ── */}
                {!searchQuery && (
                  <div className="pb-8">
                    {/* Recommended */}
                    {recommendedItems.length > 0 && (
                      <div className="pt-5">
                        <p className="px-5 text-xs font-bold text-white/40 uppercase tracking-widest mb-3">For You</p>
                        {recommendedItems.map((r, i) => (
                          <MediaRow key={i} item={r}
                            onTag={() => selectMedia(r)}
                            onRate={() => { setActiveTab("review"); selectMedia(r); }}
                          />
                        ))}
                      </div>
                    )}
                    {/* Trending */}
                    {trendingItems.length > 0 && (
                      <div className="pt-5">
                        <p className="px-5 text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Trending on Consumed</p>
                        {trendingItems.map((r, i) => (
                          <MediaRow key={i} item={r}
                            onTag={() => selectMedia(r)}
                            onRate={() => { setActiveTab("review"); selectMedia(r); }}
                          />
                        ))}
                      </div>
                    )}
                    {recommendedItems.length === 0 && trendingItems.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-48 gap-3 text-center px-8">
                        <Search size={32} className="text-white/20" />
                        <p className="text-sm text-white/40">Search for a movie, show, book, or anything else to tag it to your post.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Loading */}
                {searchQuery && isSearching && (
                  <div className="flex justify-center py-10">
                    <Loader2 size={24} className="text-purple-400 animate-spin" />
                  </div>
                )}

                {/* No results */}
                {searchQuery && !isSearching && searchResults.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-40 text-center px-8">
                    <p className="text-sm text-white/40">No results for "<span className="text-white/60">{searchQuery}</span>"</p>
                  </div>
                )}

                {/* Search results */}
                {searchResults.length > 0 && (
                  <div className="pt-4 pb-8">
                    <p className="px-5 text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Results</p>
                    {searchResults.map((r, i) => (
                      <MediaRow key={i} item={r}
                        onTag={() => selectMedia(r)}
                        onRate={() => { setActiveTab("review"); selectMedia(r); }}
                      />
                    ))}
                    <p className="text-center text-xs text-white/25 mt-6 px-8">
                      Can't find what you're looking for?{" "}
                      <span className="text-purple-400 font-medium">Search more specifically →</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
