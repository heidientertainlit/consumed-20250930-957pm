import { useState, useEffect, useRef } from "react";
import MediaSearchPanel from "@/components/media-search-panel";
import { createPortal } from "react-dom";
import {
  Loader2, Star, X,
  Tv, Film, BookOpen, Music, Mic, Youtube,
  Flame, Eye, BarChart3,
  Clock, Play, Check, Ban, Heart,
  Upload, ArrowLeft,
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
  { value: "youtube", label: "YouTube", Icon: Youtube },
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";

type Step = "search" | "compose" | "import";

// Full set of system lists (slugs map to track-media's listType).
const LIST_CHOICES: { id: string; label: string; desc: string; bg: string; icon: JSX.Element }[] = [
  { id: "queue", label: "Want To", desc: "Watch, read, listen later", bg: "bg-blue-100", icon: <Clock className="text-blue-600" size={20} /> },
  { id: "currently", label: "Currently", desc: "Currently consuming", bg: "bg-purple-100", icon: <Play className="text-purple-600" size={20} /> },
  { id: "finished", label: "Finished", desc: "Completed media", bg: "bg-green-100", icon: <Check className="text-green-600" size={20} /> },
  { id: "dnf", label: "Did Not Finish", desc: "Stopped before the end", bg: "bg-red-100", icon: <Ban className="text-red-600" size={20} /> },
  { id: "favorites", label: "Favorites", desc: "Your favorites", bg: "bg-yellow-100", icon: <Heart className="text-yellow-600" size={20} /> },
];

type ComposerMode = "take" | "rate" | "predict" | "poll";

const COMPOSER_MODES: { id: ComposerMode; label: string; Icon: typeof Star }[] = [
  { id: "take", label: "Take", Icon: Flame },
  { id: "rate", label: "Rate", Icon: Star },
  { id: "predict", label: "Predict", Icon: Eye },
  { id: "poll", label: "Poll", Icon: BarChart3 },
];

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
  // Typo rescue: when a search returns zero results we ask spell-fix for a
  // corrected title and quietly retry with it (media-search is untouched).
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [selectedList, setSelectedList] = useState<string>("queue");
  // Season/episode picker for TV (compose step only — search is untouched)
  const [seasons, setSeasons] = useState<any[]>([]);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [isLoadingSeasons, setIsLoadingSeasons] = useState(false);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Goodreads / Letterboxd import
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; failed: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const importReqId = useRef(0);

  // "React to this title (optional)" composer
  const [composerMode, setComposerMode] = useState<ComposerMode>("rate");
  const [rating, setRating] = useState(0);
  const [takeText, setTakeText] = useState("");
  const [predQuestion, setPredQuestion] = useState("");
  const [predOptions, setPredOptions] = useState<string[]>(["", ""]);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  const reset = () => {
    setStep("search");
    setSelectedMedia(null);
    setSelectedList("queue");
    setSeasons([]); setEpisodes([]);
    setSelectedSeason(null); setSelectedEpisode(null);
    setIsSaving(false);
    importReqId.current++; // invalidate any in-flight import result
    setIsImporting(false); setImportResult(null); setImportError(null);
    setComposerMode("rate");
    setRating(0); setTakeText("");
    setPredQuestion(""); setPredOptions(["", ""]);
    setPollQuestion(""); setPollOptions(["", ""]);
  };

  const handleClose = () => { reset(); onClose(); };

  useEffect(() => {
    if (selectedMedia?.type === "tv" && selectedMedia.external_id) {
      fetchSeasons(selectedMedia.external_id);
    } else {
      seasonsReqId.current++; episodesReqId.current++;
      setSeasons([]); setEpisodes([]);
      setSelectedSeason(null); setSelectedEpisode(null);
      setIsLoadingSeasons(false); setIsLoadingEpisodes(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMedia]);

  useEffect(() => {
    // Always drop any prior episode selection the moment the season changes,
    // so a save can never carry an episode from a different season.
    setEpisodes([]);
    setSelectedEpisode(null);
    if (selectedMedia?.type === "tv" && selectedMedia.external_id && selectedSeason) {
      fetchEpisodes(selectedMedia.external_id, selectedSeason);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeason]);

  const seasonsReqId = useRef(0);
  const episodesReqId = useRef(0);

  const fetchSeasons = async (externalId: string) => {
    const reqId = ++seasonsReqId.current;
    setIsLoadingSeasons(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/get-media-details?source=tmdb&external_id=${externalId}&media_type=tv`,
        { headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` } },
      );
      if (reqId !== seasonsReqId.current) return; // stale response — a newer fetch superseded this one
      if (res.ok) {
        const data = await res.json();
        if (reqId !== seasonsReqId.current) return;
        setSeasons(data.seasons || []);
      }
    } catch (e) {
      console.error("Error fetching seasons:", e);
    } finally {
      if (reqId === seasonsReqId.current) setIsLoadingSeasons(false);
    }
  };

  const fetchEpisodes = async (externalId: string, seasonNum: number) => {
    const reqId = ++episodesReqId.current;
    setIsLoadingEpisodes(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/get-season-episodes?external_id=${externalId}&season=${seasonNum}`,
        { headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` } },
      );
      if (reqId !== episodesReqId.current) return; // stale response
      if (res.ok) {
        const data = await res.json();
        if (reqId !== episodesReqId.current) return;
        setEpisodes(data.episodes || []);
      }
    } catch (e) {
      console.error("Error fetching episodes:", e);
    } finally {
      if (reqId === episodesReqId.current) setIsLoadingEpisodes(false);
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

  const statusLabel = LIST_CHOICES.find((s) => s.id === selectedList)?.label ?? "list";


  const pickMedia = (r: any) => {
    setSelectedMedia(r);
    setSelectedList("queue");
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
          media: {
            ...mapMedia(selectedMedia),
            seasonNumber: selectedSeason || undefined,
            episodeNumber: selectedEpisode || undefined,
            episodeTitle:
              selectedEpisode
                ? episodes.find((ep: any) => (ep.episodeNumber || ep.episode_number) === selectedEpisode)?.name || undefined
                : undefined,
          },
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

      if (!(hasRating && !wantPred && !wantPoll)) {
        toast({
          title: wantPred || wantPoll ? "Posted!" : hasTake ? "Take posted" : `Added to ${statusLabel}`,
        });
      }
      handleClose();
    } catch (e) {
      toast({ title: "Couldn't save that", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportFile = async (file: File | null) => {
    if (!file || !session?.access_token) return;
    const reqId = ++importReqId.current;
    setIsImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/import-media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (reqId !== importReqId.current) return; // sheet was closed/reset — drop stale result
      if (!res.ok) {
        setImportError(data?.error || "Import failed. Make sure it's a Goodreads or Letterboxd export file.");
      } else {
        setImportResult({ imported: data.imported || 0, skipped: data.skipped || 0, failed: data.failed || 0 });
        window.dispatchEvent(new CustomEvent("consumed:media-tracked"));
        queryClient.invalidateQueries({ queryKey: ["user-lists-with-media"] });
      }
    } catch (e) {
      if (reqId === importReqId.current) setImportError("Import failed. Check your connection and try again.");
    } finally {
      if (reqId === importReqId.current) setIsImporting(false);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999]">
      <div className="absolute inset-0 bg-black/80" onClick={handleClose} />

      <div
        className="absolute left-4 right-4 bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ top: "12%", maxHeight: "82vh" }}
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

            <MediaSearchPanel onSelect={pickMedia} />

            <button
              onClick={() => setStep("import")}
              className="flex items-center justify-center gap-2 mx-5 mb-4 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:text-purple-600 hover:border-purple-300 transition-colors"
              data-testid="quick-track-import-open"
            >
              <Upload size={15} />
              Import from Goodreads or Letterboxd
            </button>
          </>
        )}

        {/* ── Import step ── */}
        {step === "import" && (
          <>
            <div className="relative flex items-center justify-center px-5 py-2">
              <button
                onClick={() => { importReqId.current++; setStep("search"); setIsImporting(false); setImportResult(null); setImportError(null); }}
                className="absolute left-4 p-1.5 rounded-full hover:bg-gray-100 text-gray-400"
                data-testid="quick-track-import-back"
              >
                <ArrowLeft size={18} />
              </button>
              <h2 className="text-base font-bold text-gray-900">Import your library</h2>
              <button onClick={handleClose} className="absolute right-4 p-1.5 rounded-full hover:bg-gray-100 text-gray-400">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-6 min-h-0 space-y-4">
              {importResult ? (
                <div className="text-center py-6 space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                    <Check size={26} className="text-green-600" />
                  </div>
                  <p className="font-bold text-gray-900 text-lg">
                    {importResult.imported} {importResult.imported === 1 ? "item" : "items"} imported
                  </p>
                  <p className="text-sm text-gray-500">
                    {importResult.skipped > 0 && `${importResult.skipped} skipped — already in your library.`}
                    {importResult.skipped === 0 && importResult.failed === 0 && "All set — they're in your lists now."}
                  </p>
                  {importResult.failed > 0 && (
                    <p className="text-sm text-gray-500">
                      {importResult.failed} {importResult.failed === 1 ? "item" : "items"} couldn't be imported — usually a
                      formatting quirk in the export. Email Heidi (the builder of Consumed) if you'd like her to add them for you.
                    </p>
                  )}
                  <button
                    onClick={handleClose}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold px-6 py-2.5 rounded-full transition-colors"
                    data-testid="quick-track-import-done"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    Upload your <span className="font-semibold">Goodreads</span> or <span className="font-semibold">Letterboxd</span> export
                    and your books and movies land in your lists automatically. Anything already in your library is skipped, so
                    it's safe to re-import a fresh export anytime.
                  </p>

                  <button
                    onClick={() => importFileRef.current?.click()}
                    disabled={isImporting}
                    className="w-full flex flex-col items-center gap-2 py-8 rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50/50 hover:bg-purple-50 transition-colors disabled:opacity-60"
                    data-testid="quick-track-import-upload"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="animate-spin text-purple-600" size={28} />
                        <span className="text-sm font-medium text-purple-700">Importing… this can take a minute</span>
                      </>
                    ) : (
                      <>
                        <Upload className="text-purple-600" size={28} />
                        <span className="text-sm font-semibold text-purple-700">Choose your export file</span>
                        <span className="text-xs text-gray-400">CSV or ZIP</span>
                      </>
                    )}
                  </button>
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".csv,.zip"
                    className="hidden"
                    onChange={(e) => handleImportFile(e.target.files?.[0] || null)}
                  />

                  {importError && (
                    <p className="text-sm text-red-600 text-center">{importError}</p>
                  )}

                  <div className="text-xs text-gray-400 space-y-1.5 pt-1">
                    <p><span className="font-semibold text-gray-500">Goodreads:</span> My Books → Import and export → Export Library</p>
                    <p><span className="font-semibold text-gray-500">Letterboxd:</span> Settings → Data → Export Your Data</p>
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

              {/* Season / episode (TV only, optional) */}
              {selectedMedia.type === "tv" && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Season & episode <span className="text-gray-400 font-normal">(optional)</span>
                  </p>
                  {isLoadingSeasons ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400 py-1">
                      <Loader2 className="animate-spin" size={14} /> Loading seasons…
                    </div>
                  ) : seasons.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
                        <button
                          type="button"
                          onClick={() => setSelectedSeason(null)}
                          className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                            selectedSeason === null
                              ? "bg-purple-600 border-purple-600 text-white"
                              : "bg-white border-gray-200 text-gray-600"
                          }`}
                          data-testid="quick-track-season-all"
                        >
                          Whole series
                        </button>
                        {seasons.map((se: any) => {
                          const n = se.seasonNumber || se.season_number;
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setSelectedSeason(selectedSeason === n ? null : n)}
                              className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                                selectedSeason === n
                                  ? "bg-purple-600 border-purple-600 text-white"
                                  : "bg-white border-gray-200 text-gray-600"
                              }`}
                              data-testid={`quick-track-season-${n}`}
                            >
                              Season {n}
                            </button>
                          );
                        })}
                      </div>
                      {selectedSeason && (
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
                          {isLoadingEpisodes ? (
                            <div className="flex items-center gap-2 text-sm text-gray-400 py-1">
                              <Loader2 className="animate-spin" size={14} /> Loading episodes…
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setSelectedEpisode(null)}
                                className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                                  selectedEpisode === null
                                    ? "bg-purple-100 border-purple-300 text-purple-700"
                                    : "bg-white border-gray-200 text-gray-600"
                                }`}
                                data-testid="quick-track-episode-all"
                              >
                                All episodes
                              </button>
                              {episodes.map((ep: any) => {
                                const n = ep.episodeNumber || ep.episode_number;
                                return (
                                  <button
                                    key={n}
                                    type="button"
                                    onClick={() => setSelectedEpisode(selectedEpisode === n ? null : n)}
                                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                                      selectedEpisode === n
                                        ? "bg-purple-100 border-purple-300 text-purple-700"
                                        : "bg-white border-gray-200 text-gray-600"
                                    }`}
                                    title={ep.name || undefined}
                                    data-testid={`quick-track-episode-${n}`}
                                  >
                                    Ep {n}
                                  </button>
                                );
                              })}
                            </>
                          )}
                        </div>
                      )}
                      {selectedSeason && selectedEpisode && (
                        <p className="text-xs text-gray-500">
                          Tracking S{selectedSeason} · E{selectedEpisode}
                          {episodes.find((ep: any) => (ep.episodeNumber || ep.episode_number) === selectedEpisode)?.name
                            ? ` — ${episodes.find((ep: any) => (ep.episodeNumber || ep.episode_number) === selectedEpisode)?.name}`
                            : ""}
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {/* status / list — the primary "where does this go?" step */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Add to a list</p>
                <div className="space-y-2">
                  {LIST_CHOICES.map((s) => {
                    const active = selectedList === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedList(s.id)}
                        className={`w-full flex items-center gap-3 py-3 px-3 rounded-2xl border text-left transition-colors ${
                          active ? "border-purple-500 bg-purple-50" : "border-gray-100 hover:border-purple-200"
                        }`}
                        data-testid={`quick-track-status-${s.id}`}
                      >
                        <div className={`w-10 h-10 rounded-full ${s.bg} flex items-center justify-center flex-shrink-0`}>
                          {s.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm">{s.label}</p>
                          <p className="text-xs text-gray-400">{s.desc}</p>
                        </div>
                        {active && <Check size={18} className="text-purple-600 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Take + optional rating — matches the main composer */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Add a reaction <span className="text-gray-400 font-normal">(optional)</span></p>
                <div className="rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="p-3.5 space-y-3">
                    <textarea
                      value={takeText}
                      onChange={(e) => setTakeText(e.target.value)}
                      placeholder="What do you think?"
                      rows={3}
                      className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      data-testid="quick-track-take"
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-700">What would you rate it? <span className="text-gray-400 font-normal">(optional)</span></p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button key={star} onClick={() => setRating(rating === star ? 0 : star)} className="p-0.5" data-testid={`quick-track-star-${star}`}>
                            <Star size={30} className={rating >= star ? "text-purple-500" : "text-gray-300"} fill={rating >= star ? "currentColor" : "none"} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
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
