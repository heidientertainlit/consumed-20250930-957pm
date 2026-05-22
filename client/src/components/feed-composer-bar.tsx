import { useState, useRef, useEffect } from "react";
import { Plus, Star, BarChart2, TrendingUp, X, Search, Loader2, Flame } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

type TabType = "take" | "review" | "poll" | "prediction";

const TABS: { id: TabType; label: string; icon: React.ReactNode; placeholder: string }[] = [
  { id: "take",       label: "Take",       icon: <Flame className="w-3.5 h-3.5" />,       placeholder: "What's your hot take?" },
  { id: "review",     label: "Review",     icon: <Star className="w-3.5 h-3.5" />,         placeholder: "Write your review..." },
  { id: "poll",       label: "Poll",       icon: <BarChart2 className="w-3.5 h-3.5" />,    placeholder: "Ask a question..." },
  { id: "prediction", label: "Prediction", icon: <TrendingUp className="w-3.5 h-3.5" />,   placeholder: "Make a prediction..." },
];

const ROW1: TabType[] = ["take", "review", "poll", "prediction"];

export default function FeedComposerBar() {
  const { session, user } = useAuth();
  const { toast } = useToast();

  const [isExpanded, setIsExpanded] = useState(false);
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

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentTab = TABS.find(t => t.id === activeTab)!;

  const needsMedia = activeTab === "review" || activeTab === "take" || activeTab === "prediction";
  const showRating = activeTab === "review";
  const showSearch = needsMedia;
  const showPollOptions = activeTab === "poll";

  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (!contentText.trim() && !selectedMedia) setIsExpanded(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isExpanded, contentText, selectedMedia]);

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
          body: JSON.stringify({ query: searchQuery }),
        });
        if (!res.ok) return;
        const data = await res.json();
        setSearchResults((data.results || []).slice(0, 6).map((r: any) => ({
          ...r,
          image_url: r.image_url || r.poster_url || r.image || "",
        })));
      } catch {}
      finally { setIsSearching(false); }
    }, 400);
  }, [searchQuery, session]);

  const resetForm = () => {
    setContentText("");
    setRatingValue(0);
    setHoverRating(0);
    setSelectedMedia(null);
    setSearchQuery("");
    setSearchResults([]);
    setPollOptions(["", ""]);
    setIsExpanded(false);
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
            content: contentText.trim(),
            type: "thought",
            post_type: "hot_take",
            visibility: "public",
            media_title: selectedMedia?.title,
            media_type: selectedMedia?.type || selectedMedia?.mediaType,
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
            content,
            type: "rate-review",
            rating: ratingValue > 0 ? ratingValue : undefined,
            visibility: "public",
            media_title: selectedMedia.title,
            media_type: selectedMedia.type || selectedMedia.mediaType,
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
            question: contentText.trim(),
            options: filled,
            type: "predict",
            media_title: selectedMedia?.title || null,
            media_type: selectedMedia?.type || null,
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

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full rounded-2xl bg-white border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
      >
        <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
          <Plus className="w-4 h-4 text-white" />
        </div>
        <span className="text-gray-400 text-sm flex-1">What's your next move?</span>
      </button>
    );
  }

  return (
    <div ref={containerRef} className="rounded-2xl overflow-hidden shadow-xl">
      {/* White composer card */}
      <div className="bg-white">
        {/* Textarea */}
        <div className="px-4 pt-4 pb-2">
          <textarea
            ref={textareaRef}
            value={contentText}
            onChange={e => setContentText(e.target.value)}
            placeholder={currentTab.placeholder}
            rows={3}
            className="w-full text-sm text-gray-800 placeholder:text-gray-400 resize-none border-0 outline-none focus:outline-none bg-transparent"
          />
        </div>

        {/* Selected media chip */}
        {selectedMedia && (
          <div className="mx-4 mb-3 flex items-center gap-2 bg-gray-50 rounded-xl p-2 border border-gray-100">
            {selectedMedia.image_url && (
              <img src={selectedMedia.image_url} alt="" className="w-8 h-11 object-cover rounded" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{selectedMedia.title}</p>
              <p className="text-[10px] text-gray-400 capitalize">{selectedMedia.type}</p>
            </div>
            <button onClick={() => setSelectedMedia(null)} className="text-gray-300 hover:text-red-400 p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Poll / Prediction options */}
        {(showPollOptions || activeTab === "prediction") && (
          <div className="mx-4 mb-3 space-y-2">
            {pollOptions.map((opt, i) => (
              <input
                key={i}
                value={opt}
                onChange={e => { const next = [...pollOptions]; next[i] = e.target.value; setPollOptions(next); }}
                placeholder={`Option ${i + 1}`}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-purple-400 text-gray-800 placeholder:text-gray-400"
              />
            ))}
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-gray-100 mx-4" />

        {/* Tab row */}
        <div className="px-4 pt-2 pb-1">
          <div className="flex gap-1">
            {ROW1.map(tabId => {
              const tab = TABS.find(t => t.id === tabId)!;
              const active = activeTab === tabId;
              return (
                <button
                  key={tabId}
                  onClick={() => setActiveTab(tabId)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    active
                      ? "bg-purple-100 text-purple-700"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 mx-4 mt-1" />

        {/* Post button row */}
        <div className="px-4 py-3 flex items-center justify-between">
          <button onClick={resetForm} className="text-gray-400 text-xs hover:text-gray-600">Cancel</button>
          <button
            onClick={handlePost}
            disabled={!canPost() || isPosting}
            className="bg-purple-600 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2 rounded-full flex items-center gap-2 active:scale-95 transition-all"
          >
            {isPosting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Post
          </button>
        </div>
      </div>

      {/* Rating row — below the white card */}
      {showRating && (
        <div className="bg-white border-t border-gray-100 px-4 py-3 flex items-center gap-3">
          <span className="text-sm text-gray-600 font-medium">Rating:</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRatingValue(star === ratingValue ? 0 : star)}
                className="transition-transform active:scale-90"
              >
                <Star
                  className={`w-6 h-6 transition-colors ${
                    star <= (hoverRating || ratingValue)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              </button>
            ))}
          </div>
          {ratingValue > 0 && (
            <span className="text-xs text-gray-400">{ratingValue}/5</span>
          )}
        </div>
      )}

      {/* Media search row */}
      {showSearch && !selectedMedia && (
        <div className="bg-white border-t border-gray-100">
          <div className="px-4 py-2 flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search for a movie, show, book..."
              className="flex-1 text-sm text-gray-800 placeholder:text-gray-400 border-0 outline-none focus:outline-none bg-transparent py-1.5"
            />
            {isSearching && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin flex-shrink-0" />}
          </div>

          {/* Results */}
          {searchResults.length > 0 && (
            <div className="border-t border-gray-100 max-h-56 overflow-y-auto">
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => { setSelectedMedia(r); setSearchQuery(""); setSearchResults([]); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                >
                  {r.image_url
                    ? <img src={r.image_url} alt="" className="w-8 h-11 object-cover rounded flex-shrink-0" />
                    : <div className="w-8 h-11 rounded bg-gray-100 flex-shrink-0" />
                  }
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{r.title}</p>
                    <p className="text-xs text-gray-400 capitalize">{r.type}{r.year ? ` · ${r.year}` : ""}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
