import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Search, Loader2, Star, X, ChevronUp, Plus, Sparkles,
  Tv, Film, BookOpen, Music, Mic, Gamepad2,
  MessageSquare, TrendingUp, BarChart3,
} from "lucide-react";
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

const TYPE_PILLS: { value: string; label: string; Icon: typeof Tv }[] = [
  { value: "tv", label: "TV", Icon: Tv },
  { value: "movie", label: "Movie", Icon: Film },
  { value: "book", label: "Book", Icon: BookOpen },
  { value: "music", label: "Music", Icon: Music },
  { value: "podcast", label: "Podcast", Icon: Mic },
  { value: "game", label: "Game", Icon: Gamepad2 },
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";

type Step = "search" | "compose";

// Contextual status options per media type → list id mapping.
function statusOptions(type?: string): { id: string; label: string }[] {
  const t = (type || "").toLowerCase();
  if (t.includes("book")) {
    return [{ id: "currently", label: "Reading" }, { id: "finished", label: "Finished" }, { id: "queue", label: "Want to read" }];
  }
  if (t === "music" || t === "podcast") {
    return [{ id: "currently", label: "Listening" }, { id: "finished", label: "Finished" }, { id: "queue", label: "Want to listen" }];
  }
  if (t === "game") {
    return [{ id: "currently", label: "Playing" }, { id: "finished", label: "Finished" }, { id: "queue", label: "Want to play" }];
  }
  return [{ id: "currently", label: "Watching" }, { id: "finished", label: "Finished" }, { id: "queue", label: "Want to watch" }];
}

function typeLabel(type?: string): string {
  const t = (type || "").toLowerCase();
  if (t === "tv") return "TV Series";
  if (t === "book_series") return "Book Series";
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

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
  const [isSaving, setIsSaving] = useState(false);

  // "Add more (optional)" sections
  const [rateOpen, setRateOpen] = useState(false);
  const [takeOpen, setTakeOpen] = useState(false);
  const [predOpen, setPredOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [takeText, setTakeText] = useState("");
  const [predQuestion, setPredQuestion] = useState("");
  const [predOptions, setPredOptions] = useState<string[]>(["", ""]);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  const reset = () => {
    setStep("search");
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
    setMediaTypeFilter(null);
    setSelectedMedia(null);
    setSelectedList("currently");
    setIsSaving(false);
    setRateOpen(false); setTakeOpen(false); setPredOpen(false); setPollOpen(false);
    setRating(0); setTakeText("");
    setPredQuestion(""); setPredOptions(["", ""]);
    setPollQuestion(""); setPollOptions(["", ""]);
  };

  const handleClose = () => { reset(); onClose(); };

  useEffect(() => {
    if (!session?.access_token || !searchQuery.trim()) { setSearchResults([]); return; }
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

  const statuses = statusOptions(selectedMedia?.type);
  const statusLabel = statuses.find((s) => s.id === selectedList)?.label ?? "list";

  const filteredResults = mediaTypeFilter
    ? searchResults.filter((r) => r.type === mediaTypeFilter || (mediaTypeFilter === "book" && r.type === "book_series"))
    : searchResults;

  const pickMedia = (r: any) => {
    setSelectedMedia(r);
    setSelectedList("currently");
    setStep("compose");
  };

  const handleSave = async () => {
    if (!session?.access_token || !selectedMedia) return;

    const predOpts = predOptions.filter((o) => o.trim());
    const pollOpts = pollOptions.filter((o) => o.trim());
    // Intent is based on entered content, not whether the row is expanded — a
    // filled row that was collapsed again must still save.
    const wantPred = predQuestion.trim().length > 0 || predOpts.length > 0;
    const wantPoll = pollQuestion.trim().length > 0 || pollOpts.length > 0;

    if (wantPred && (predQuestion.trim().length === 0 || predOpts.length < 2)) {
      toast({ title: "Add a prediction question and 2+ options", variant: "destructive" });
      return;
    }
    if (wantPoll && (pollQuestion.trim().length === 0 || pollOpts.length < 2)) {
      toast({ title: "Add a poll question and 2+ options", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const hasRating = rating > 0;
      const hasTake = takeText.trim().length > 0;

      // 1. Always track the media to the chosen status/list.
      const trackRes = await fetch(`${SUPABASE_URL}/functions/v1/track-media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          media: mapMedia(selectedMedia),
          listType: selectedList,
          rating: hasRating ? rating : undefined,
          review: hasRating && hasTake ? takeText.trim() : undefined,
          skip_social_post: !hasRating, // text-only take posts as a 'thought' below
        }),
      });
      if (!trackRes.ok) throw new Error("track failed");

      // 2. Text-only take (no rating) → feed-visible thought post.
      if (!hasRating && hasTake) {
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

      // 3. Prediction.
      if (wantPred) {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/create-prediction`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            question: predQuestion.trim(),
            options: predOpts,
            type: "predict",
            media_external_id: selectedMedia.external_id || null,
            media_external_source: selectedMedia.external_source || null,
            media_title: selectedMedia.title || null,
            media_type: selectedMedia.type || null,
          }),
        });
        if (!r.ok) throw new Error("prediction failed");
      }

      // 4. Poll.
      if (wantPoll) {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/create-prediction`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            question: pollQuestion.trim(),
            options: pollOpts,
            type: "poll",
            media_external_id: selectedMedia.external_id || null,
            media_external_source: selectedMedia.external_source || null,
            media_title: selectedMedia.title || null,
            media_type: selectedMedia.type || null,
          }),
        });
        if (!r.ok) throw new Error("poll failed");
      }

      window.dispatchEvent(new CustomEvent("consumed:media-tracked"));
      trackEvent("media_tracked", { media_type: selectedMedia.type, list_type: selectedList, has_rating: hasRating });
      queryClient.invalidateQueries({ queryKey: ["user-lists-with-media"] });
      queryClient.invalidateQueries({ queryKey: ["social-feed"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });

      toast({
        title: wantPred || wantPoll ? "Posted!" : hasRating ? "Rating posted" : hasTake ? "Take posted" : `Added to ${statusLabel}`,
      });
      handleClose();
    } catch (e) {
      toast({ title: "Couldn't save that", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999]">
      <div className="absolute inset-0 bg-black/80" onClick={handleClose} />

      <div
        className="absolute left-4 right-4 bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ top: "7%", maxHeight: "82vh" }}
      >
        {/* grab handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-9 h-1 rounded-full bg-gray-300" />
        </div>

        {/* ── Search step ── */}
        {step === "search" && (
          <>
            <div className="relative flex items-center justify-center px-5 py-2">
              <h2 className="text-base font-bold text-gray-900">Track</h2>
              <button onClick={handleClose} className="absolute right-4 p-1.5 rounded-full hover:bg-gray-100 text-gray-400">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 pt-1 pb-2 space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search movies, shows, books…"
                  autoFocus
                  className="w-full pl-11 pr-10 py-3 border border-gray-200 rounded-2xl bg-gray-50 text-base text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  data-testid="quick-track-search"
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
                  {TYPE_PILLS.map(({ value, label, Icon }) => {
                    const active = mediaTypeFilter === value;
                    return (
                      <button
                        key={value}
                        onClick={() => setMediaTypeFilter(active ? null : value)}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                          active ? "bg-purple-600 border-purple-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-purple-300"
                        }`}
                      >
                        <Icon size={14} />
                        {label}
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
                <div className="flex flex-col items-center text-center py-8 px-4">
                  <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center mb-3">
                    <Sparkles className="text-purple-500" size={22} />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Not sure what to track?</p>
                  <p className="text-xs text-gray-400 mt-1">Start typing above — filters are optional and just help narrow your search.</p>
                </div>
              )}

              {!isSearching && searchQuery.trim() && filteredResults.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-6">No results for "{searchQuery}".</p>
              )}

              {filteredResults.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-400 mb-1.5">Top results</p>
                  <div className="space-y-1">
                    {filteredResults.slice(0, 12).map((r, idx) => (
                      <button
                        key={`${r.external_id}-${idx}`}
                        onClick={() => pickMedia(r)}
                        className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl text-left"
                        data-testid={`quick-track-result-${r.external_id}`}
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
        )}

        {/* ── Compose / details step ── */}
        {step === "compose" && selectedMedia && (
          <>
            <div className="relative flex items-center justify-end px-5 py-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-bold px-4 py-1.5 rounded-full transition-colors mr-9"
                data-testid="quick-track-save"
              >
                {isSaving && <Loader2 className="animate-spin" size={14} />}
                Save
              </button>
              <button onClick={handleClose} className="absolute right-4 p-1.5 rounded-full hover:bg-gray-100 text-gray-400">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-5 min-h-0 space-y-4">
              {/* media header */}
              <div className="flex items-center gap-3">
                {selectedMedia.image && (
                  <img src={selectedMedia.image} alt={selectedMedia.title} className="w-14 h-20 object-cover rounded-lg flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 line-clamp-2">{selectedMedia.title}</p>
                  <p className="text-xs text-gray-500">
                    {typeLabel(selectedMedia.type)}{selectedMedia.year ? ` • ${selectedMedia.year}` : ""}
                  </p>
                  <button
                    onClick={() => { setStep("search"); setSelectedMedia(null); }}
                    className="text-xs font-medium text-purple-600 hover:text-purple-700 mt-1"
                  >
                    Change
                  </button>
                </div>
              </div>

              {/* status */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">What are you doing?</p>
                <div className="flex flex-wrap gap-2">
                  {statuses.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedList(s.id)}
                      className={`px-3.5 py-2 rounded-full border text-sm font-semibold transition-colors ${
                        selectedList === s.id ? "border-purple-600 text-purple-600 bg-purple-50" : "border-gray-200 text-gray-600 hover:border-purple-300"
                      }`}
                      data-testid={`quick-track-status-${s.id}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add more (optional) */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Add more <span className="text-gray-400 font-normal">(optional)</span></p>
                <div className="space-y-2">
                  {/* Rate it */}
                  <AddMoreRow
                    icon={<Star size={16} className="text-purple-500" />}
                    label="Rate it"
                    open={rateOpen}
                    onToggle={() => setRateOpen((v) => !v)}
                    filled={rating > 0}
                    summary={rating > 0 ? `${rating}/5` : undefined}
                    testId="quick-track-rate"
                  >
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} onClick={() => setRating(rating === star ? 0 : star)} className="p-0.5" data-testid={`quick-track-star-${star}`}>
                          <Star size={28} className={rating >= star ? "text-purple-500" : "text-gray-300"} fill={rating >= star ? "currentColor" : "none"} />
                        </button>
                      ))}
                    </div>
                  </AddMoreRow>

                  {/* Add a take */}
                  <AddMoreRow
                    icon={<MessageSquare size={16} className="text-purple-500" />}
                    label="Add a take"
                    open={takeOpen}
                    onToggle={() => setTakeOpen((v) => !v)}
                    filled={takeText.trim().length > 0}
                    testId="quick-track-take-row"
                  >
                    <textarea
                      value={takeText}
                      onChange={(e) => setTakeText(e.target.value)}
                      placeholder="Share a take…"
                      rows={3}
                      className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      data-testid="quick-track-take"
                    />
                  </AddMoreRow>

                  {/* Make a prediction */}
                  <AddMoreRow
                    icon={<TrendingUp size={16} className="text-purple-500" />}
                    label="Make a prediction"
                    open={predOpen}
                    onToggle={() => setPredOpen((v) => !v)}
                    filled={predQuestion.trim().length > 0}
                    testId="quick-track-prediction"
                  >
                    <QuestionOptions
                      question={predQuestion}
                      setQuestion={setPredQuestion}
                      options={predOptions}
                      setOptions={setPredOptions}
                      placeholder="What do you predict?"
                    />
                  </AddMoreRow>

                  {/* Create a poll */}
                  <AddMoreRow
                    icon={<BarChart3 size={16} className="text-purple-500" />}
                    label="Create a poll"
                    open={pollOpen}
                    onToggle={() => setPollOpen((v) => !v)}
                    filled={pollQuestion.trim().length > 0}
                    testId="quick-track-poll"
                  >
                    <QuestionOptions
                      question={pollQuestion}
                      setQuestion={setPollQuestion}
                      options={pollOptions}
                      setOptions={setPollOptions}
                      placeholder="Ask a question…"
                    />
                  </AddMoreRow>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

function AddMoreRow({
  icon, label, open, onToggle, filled, summary, testId, children,
}: {
  icon: React.ReactNode;
  label: string;
  open: boolean;
  onToggle: () => void;
  filled?: boolean;
  summary?: string;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-3.5 py-3" data-testid={testId}>
        <span className="flex items-center gap-2.5 text-sm font-medium text-gray-700">
          {icon}
          {label}
          {!open && filled && <span className="text-xs font-semibold text-purple-600">{summary ?? "• added"}</span>}
        </span>
        {open ? <ChevronUp size={18} className="text-gray-400" /> : <Plus size={18} className="text-gray-400" />}
      </button>
      {open && <div className="px-3.5 pb-3.5 pt-1 border-t border-gray-100">{children}</div>}
    </div>
  );
}

function QuestionOptions({
  question, setQuestion, options, setOptions, placeholder,
}: {
  question: string;
  setQuestion: (v: string) => void;
  options: string[];
  setOptions: (v: string[]) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={placeholder}
        className="w-full p-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      />
      {options.map((opt, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            type="text"
            value={opt}
            onChange={(e) => { const n = [...options]; n[idx] = e.target.value; setOptions(n); }}
            placeholder={`Option ${idx + 1}`}
            className="flex-1 p-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          {options.length > 2 && (
            <button onClick={() => setOptions(options.filter((_, i) => i !== idx))} className="p-1.5 text-gray-400 hover:text-red-500">
              <X size={15} />
            </button>
          )}
        </div>
      ))}
      {options.length < 4 && (
        <button onClick={() => setOptions([...options, ""])} className="text-sm font-medium text-purple-600 hover:text-purple-700">
          + Add option
        </button>
      )}
    </div>
  );
}
