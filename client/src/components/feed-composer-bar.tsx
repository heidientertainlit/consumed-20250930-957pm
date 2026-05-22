import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Star, BarChart2, TrendingUp, X, Search, Loader2, Flame, Paperclip } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

type TabType = "take" | "review" | "poll" | "prediction";

const TABS: { id: TabType; label: string; icon: React.ReactNode; placeholder: string }[] = [
  { id: "take",       label: "Take",       icon: <Flame className="w-3.5 h-3.5" />,       placeholder: "What's your hot take?" },
  { id: "review",     label: "Rate",       icon: <Star className="w-3.5 h-3.5" />,         placeholder: "Write your review..." },
  { id: "poll",       label: "Poll",       icon: <BarChart2 className="w-3.5 h-3.5" />,    placeholder: "Ask a question..." },
  { id: "prediction", label: "Prediction", icon: <TrendingUp className="w-3.5 h-3.5" />,   placeholder: "Make a prediction..." },
];

export default function FeedComposerBar() {
  const { session } = useAuth();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
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
  const [showSearch, setShowSearch] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentTab = TABS.find(t => t.id === activeTab)!;
  const showRating = activeTab === "review";
  const showPollOptions = activeTab === "poll" || activeTab === "prediction";

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen]);

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
        setSearchResults((data.results || []).slice(0, 5).map((r: any) => ({
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
    setShowSearch(false);
    setIsOpen(false);
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

      {/* Focused overlay — card anchored near the top, feed dimmed below */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[99999]">
          {/* Full-screen dim */}
          <div className="absolute inset-0 bg-black/40" onClick={resetForm} />

          {/* Card — positioned in the top third */}
          <div
            className="absolute left-4 right-4 bg-white rounded-3xl shadow-2xl overflow-hidden"
            style={{ top: '10%' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
              <button onClick={resetForm} className="text-sm font-medium text-gray-400 hover:text-gray-700">
                Cancel
              </button>
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

            {/* Composer body */}
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
                  <p className="text-[10px] text-gray-400 capitalize">{selectedMedia.type}</p>
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

            {/* Media search */}
            {showSearch && (
              <div className="mx-5 mb-2">
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                  <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <input
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search movies, shows, books…" autoFocus
                    className="flex-1 text-sm text-gray-800 placeholder:text-gray-400 border-0 outline-none bg-transparent"
                  />
                  {isSearching
                    ? <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin flex-shrink-0" />
                    : <button onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }}><X className="w-3.5 h-3.5 text-gray-300" /></button>
                  }
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-1.5 border border-gray-100 rounded-xl overflow-hidden max-h-44 overflow-y-auto">
                    {searchResults.map((r, i) => (
                      <button key={i}
                        onClick={() => { setSelectedMedia(r); setSearchQuery(""); setSearchResults([]); setShowSearch(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left border-b border-gray-50 last:border-0"
                      >
                        {r.image_url ? <img src={r.image_url} alt="" className="w-7 h-10 object-cover rounded flex-shrink-0" /> : <div className="w-7 h-10 rounded bg-gray-100 flex-shrink-0" />}
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

            {/* Bottom toolbar */}
            <div className="flex items-center gap-2 px-5 pb-4 pt-2 border-t border-gray-100">
              <button
                onClick={() => setShowSearch(s => !s)}
                className={`p-2 rounded-full transition-colors flex-shrink-0 ${showSearch ? 'bg-purple-100 text-purple-600' : 'text-gray-400 hover:bg-gray-100'}`}
              >
                <Paperclip size={16} />
              </button>
              <div className="flex gap-1.5 overflow-x-auto flex-1">
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
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
