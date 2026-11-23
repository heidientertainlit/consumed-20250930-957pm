import { useState, useEffect, useRef, useMemo } from "react";
import { Capacitor } from "@capacitor/core";
import { showMediaAdded } from "@/lib/media-added-confirmation";
import MediaSearchPanel from "@/components/media-search-panel";
import { createPortal } from "react-dom";
import {
  Loader2, Star, X,
  Tv, Film, BookOpen, Music, Mic, Youtube,
  Flame, Eye, BarChart3,
  Clock, Play, Check, Ban, Heart,
  Upload, ArrowLeft, Dna,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/posthog";
import ImportHistory, { ImportReceipt, receiptFromResponse } from "@/components/import-history";
import { getBookVolumeLabel } from "@/lib/book-volume";
import { buildQuickTrackThoughtPostPayload } from "@/lib/quick-track-post";
import { getQuickTrackPosition } from "@/lib/quick-track-position";
import type { FinishedReviewRequest } from "@/lib/media-added-confirmation";
import { changeFinishedReviewList, createFinishedReviewPostId, saveFinishedReview } from "@/lib/save-finished-review";
import { IdentityFace } from "@/components/identity-face";
import { FinishedReviewCompletion } from "@/components/finished-review-completion";

export interface TrackDetailsMedia {
  title: string;
  mediaType: string;
  imageUrl?: string;
  externalId?: string;
  externalSource?: string;
  creator?: string;
}

export interface QuickTrackMedia {
  title: string;
  type: string;
  image?: string;
  image_url?: string;
  external_id?: string;
  external_source?: string;
  creator?: string;
  year?: number;
  media_subtype?: string;
  canonical_media_id?: string;
}

interface QuickTrackSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initialStep?: Step;
  /** A selected search result skips search on mount; compose and save stay shared. */
  initialMedia?: QuickTrackMedia;
  /** The title is already saved; this mode only records the optional reaction. */
  finishedReview?: FinishedReviewRequest;
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

function typeLabel(type?: string, mediaSubtype?: string): string {
  const t = (type || "").toLowerCase();
  if (t === "tv") return "TV Series";
  if (t === "book_series") return "Book Series";
  if (t === "music" && mediaSubtype === "album") return "Album";
  if (t === "music" && (mediaSubtype === "song" || mediaSubtype === "track")) return "Song";
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function QuickTrackSheet({ isOpen, onClose, initialStep = "search", initialMedia, finishedReview }: QuickTrackSheetProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const backdropPressStarted = useRef(false);

  // Snapshot before MediaSearchPanel's autofocus opens the native keyboard.
  // Keep it through typing, filters and step changes; recapture on reopening.
  const sheetPosition = useMemo(
    () => isOpen ? getQuickTrackPosition(Capacitor.getPlatform(), window.innerHeight) : undefined,
    [isOpen],
  );

  const [step, setStep] = useState<Step>(initialMedia ? "compose" : initialStep);
  // Typo rescue: when a search returns zero results we ask spell-fix for a
  // corrected title and quietly retry with it (media-search is untouched).
  const [selectedMedia, setSelectedMedia] = useState<any>(initialMedia ?? null);
  const [selectedList, setSelectedList] = useState<string>(finishedReview ? "finished" : "queue");
  const [showFinishedListChoices, setShowFinishedListChoices] = useState(false);
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
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; failed: number; receipt?: ImportReceipt } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const importReqId = useRef(0);

  // "React to this title (optional)" composer
  const [composerMode, setComposerMode] = useState<ComposerMode>("rate");
  const [rating, setRating] = useState(0);
  const [ratingPreview, setRatingPreview] = useState(0);
  const ratingTrackRef = useRef<HTMLDivElement>(null);
  const ratingPreviewRef = useRef(0);
  const [takeText, setTakeText] = useState("");
  const [containsSpoilers, setContainsSpoilers] = useState(false);
  const [privateMode, setPrivateMode] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const saveLock = useRef(false);
  const savedReviewList = useRef("finished");
  const [reviewPostId] = useState(() => finishedReview ? createFinishedReviewPostId() : "");
  const [predQuestion, setPredQuestion] = useState("");
  const [predOptions, setPredOptions] = useState<string[]>(["", ""]);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  const reset = () => {
    setStep(initialStep);
    setSelectedMedia(null);
    setSelectedList(finishedReview ? "finished" : "queue");
    setShowFinishedListChoices(false);
    setSeasons([]); setEpisodes([]);
    setSelectedSeason(null); setSelectedEpisode(null);
    setIsSaving(false);
    importReqId.current++; // invalidate any in-flight import result
    setIsImporting(false); setImportResult(null); setImportError(null);
    setComposerMode("rate");
    setRating(0); setRatingPreview(0); ratingPreviewRef.current = 0; setTakeText("");
    setContainsSpoilers(false);
    setPrivateMode(false);
    setSaveError(null);
    setCompletionMessage(null);
    setPredQuestion(""); setPredOptions(["", ""]);
    setPollQuestion(""); setPollOptions(["", ""]);
  };

  const handleClose = () => {
    if (finishedReview && saveLock.current) return;
    backdropPressStarted.current = false; reset(); onClose();
  };

  const previewRatingAt = (clientX: number) => {
    if (!ratingTrackRef.current) return;
    const rect = ratingTrackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const starWidth = rect.width / 5;
    const starIndex = Math.floor(x / starWidth);
    const withinStar = (x % starWidth) / starWidth;
    const value = Math.max(0.5, Math.min(5, starIndex + (withinStar < 0.5 ? 0.5 : 1)));
    const roundedValue = Math.round(value * 2) / 2;
    ratingPreviewRef.current = roundedValue;
    setRatingPreview(roundedValue);
  };

  const commitDraggedRating = () => {
    if (ratingPreviewRef.current > 0) setRating(ratingPreviewRef.current);
    ratingPreviewRef.current = 0;
    setRatingPreview(0);
  };

  const setRatingPreviewValue = (value: number) => {
    ratingPreviewRef.current = value;
    setRatingPreview(value);
  };

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
    if (selectedMedia?.type === "tv" && selectedMedia.external_id && selectedSeason !== null) {
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
    // A new title cannot inherit the previous title's season or episode.
    // Clear synchronously as well as in the selectedMedia effect below so a
    // quick submit cannot race the state reset.
    seasonsReqId.current++;
    episodesReqId.current++;
    setSeasons([]);
    setEpisodes([]);
    setSelectedSeason(null);
    setSelectedEpisode(null);
    setSelectedMedia(r);
    setContainsSpoilers(false);
    setSelectedList("queue");
    setStep("compose");
  };

  const handleSave = async () => {
    if (!session?.access_token || !selectedMedia || saveLock.current) return;

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

    saveLock.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      const hasRating = rating > 0;
      const hasTake = takeText.trim().length > 0;

      if (finishedReview) {
        if (session.user.id !== finishedReview.userId) throw new Error("Please sign in again before saving.");
        if (!hasRating && !hasTake && selectedList === savedReviewList.current) return;
        if (selectedList !== savedReviewList.current) {
          await changeFinishedReviewList(finishedReview, selectedList, supabase);
          savedReviewList.current = selectedList;
          queryClient.invalidateQueries({ queryKey: ["user-lists-with-media"] });
          queryClient.invalidateQueries({ queryKey: ["lists-containing-media"] });
        }
        await saveFinishedReview({
          supabaseUrl: SUPABASE_URL, accessToken: session.access_token,
          userId: finishedReview.userId, listItemId: finishedReview.listItemId,
          media: selectedMedia, content: takeText, rating, privateMode,
          containsSpoilers, selectedSeason, selectedEpisode, episodes,
          postId: reviewPostId, canonicalMediaId: selectedMedia.canonical_media_id,
        }, supabase);
        for (const key of ["media-ratings", "user-lists-with-media", "social-feed", "feed"]) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
        if (hasRating || hasTake) {
          // Keep the source page and existing backdrop in place until the
          // saved reaction's completion moment finishes (or is dismissed).
          setCompletionMessage(hasTake ? "Review saved." : "Rating saved.");
        } else {
          onClose();
        }
        return;
      }

      // 1. Always track the media to the chosen status/list.
      const trackRes = await fetch(`${SUPABASE_URL}/functions/v1/track-media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          media: {
            ...mapMedia(selectedMedia),
            seasonNumber: selectedSeason ?? undefined,
            episodeNumber: selectedEpisode ?? undefined,
            episodeTitle:
              selectedEpisode !== null
                ? episodes.find((ep: any) => (ep.episodeNumber ?? ep.episode_number) === selectedEpisode)?.name || undefined
                : undefined,
            ...(selectedMedia.type === "book" && selectedMedia.volume_number != null
              ? { volumeNumber: selectedMedia.volume_number }
              : {}),
          },
          listType: selectedList,
          rating: hasRating ? rating : undefined,
          review: hasRating && hasTake ? takeText.trim() : undefined,
          containsSpoilers,
          skip_social_post: !hasRating, // text-only take posts as a 'thought' below
        }),
      });
      if (!trackRes.ok) throw new Error("track failed");

      // 2. Text-only take (no rating) → feed-visible thought post.
      if (!hasRating && hasTake) {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) throw new Error("Not authenticated");
        const postPayload = buildQuickTrackThoughtPostPayload({
          userId: authUser.id,
          content: takeText.trim(),
          containsSpoilers,
          media: selectedMedia,
          selectedSeason,
          selectedEpisode,
          episodes,
        });
        const { error: postErr } = await supabase.from("social_posts").insert(postPayload);
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

      showMediaAdded({ title: selectedMedia.title, listName: statusLabel });
      handleClose();
    } catch (e) {
      if (finishedReview) setSaveError(e instanceof Error ? e.message : "Couldn't save your reaction. Please try again.");
      else toast({ title: "Couldn't save that", variant: "destructive" });
    } finally {
      saveLock.current = false;
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
        const receipt = receiptFromResponse(data);
        setImportResult({ imported: data.imported || 0, skipped: data.skipped || 0, failed: data.failed || 0, receipt });
        window.dispatchEvent(new CustomEvent("consumed:media-tracked"));
        queryClient.invalidateQueries({ queryKey: ["user-lists-with-media"] });
        queryClient.invalidateQueries({ queryKey: ["media-import-batches"] });
        if (data.imported > 0) {
          showMediaAdded({ count: data.imported });
          // Keep partial-error receipts available rather than hiding failures.
          if (!data.failed && !data.skipped) handleClose();
        }
      }
    } catch (e) {
      if (reqId === importReqId.current) setImportError("Import failed. Check your connection and try again.");
    } finally {
      if (reqId === importReqId.current) setIsImporting(false);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  };

  if (!isOpen) return null;

  const ratingControl = (
    <div>
      <p className="text-sm font-semibold text-gray-700">
        {finishedReview ? "Your rating" : "What would you rate it?"} <span className="text-gray-400 font-normal">(optional)</span>
      </p>
      <div
        ref={ratingTrackRef}
        className="flex items-center gap-1.5 mt-1.5 w-fit touch-none select-none cursor-pointer"
        role="group"
        aria-label="Rating"
        onMouseLeave={() => { if (!finishedReview || !isSaving) setRatingPreviewValue(0); }}
        onTouchMove={(event) => {
          if (finishedReview && isSaving) return;
          event.stopPropagation();
          previewRatingAt(event.touches[0].clientX);
        }}
        onTouchEnd={(event) => {
          if (finishedReview && isSaving) return;
          event.stopPropagation();
          commitDraggedRating();
        }}
        onTouchCancel={() => { if (!finishedReview || !isSaving) setRatingPreviewValue(0); }}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const displayRating = ratingPreview || rating;
          const fillWidth = displayRating >= star ? "100%" : displayRating >= star - 0.5 ? "50%" : "0%";
          return (
            <div key={star} className="relative h-9 w-9">
              <Star size={30} className="absolute inset-0 m-auto text-gray-300" />
              <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ width: fillWidth }}>
                <Star size={30} className="absolute text-purple-500" style={{ left: 3, top: 3 }} fill="currentColor" />
              </div>
              <button
                type="button"
                disabled={!!finishedReview && isSaving}
                className="absolute inset-y-0 left-0 z-10 w-1/2 disabled:cursor-not-allowed"
                onMouseEnter={() => setRatingPreviewValue(star - 0.5)}
                onClick={(event) => {
                  event.stopPropagation();
                  setRating(star - 0.5);
                  setRatingPreviewValue(0);
                }}
                aria-label={`Rate ${star - 0.5} out of 5`}
              />
              <button
                type="button"
                disabled={!!finishedReview && isSaving}
                className="absolute inset-y-0 right-0 z-10 w-1/2 disabled:cursor-not-allowed"
                onMouseEnter={() => setRatingPreviewValue(star)}
                onClick={(event) => {
                  event.stopPropagation();
                  setRating(star);
                  setRatingPreviewValue(0);
                }}
                aria-label={`Rate ${star} out of 5`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  const reactionControl = (
    <div>
      <label htmlFor={finishedReview ? "finished-review-reaction" : "quick-track-take"} className="block text-sm font-semibold text-gray-700 mb-2">
        {finishedReview ? "Your reaction" : "Add a reaction"} <span className="text-gray-400 font-normal">(optional)</span>
      </label>
      <textarea
        id={finishedReview ? "finished-review-reaction" : "quick-track-take"}
        value={takeText}
        onChange={(e) => setTakeText(e.target.value)}
        disabled={!!finishedReview && isSaving}
        placeholder={finishedReview ? "Write your reaction..." : "What do you think?"}
        rows={finishedReview ? 4 : 3}
        className={finishedReview
          ? "min-h-[100px] w-full resize-y border-0 bg-white p-0 text-base leading-7 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 disabled:opacity-60"
          : "w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-sm text-gray-900 resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-60"}
        data-testid="quick-track-take"
      />
    </div>
  );

  const mediaContext = selectedMedia && (
    <div className="flex items-center gap-3" data-testid={finishedReview ? "finished-review-media" : undefined}>
      {selectedMedia.image && (
        <img src={selectedMedia.image} alt={selectedMedia.title} className={`${finishedReview ? "w-[58px] h-[82px]" : "w-14 h-20"} object-cover rounded-lg flex-shrink-0`} />
      )}
      <div className="min-w-0">
        <p className="font-bold text-gray-900 line-clamp-2">{selectedMedia.title}</p>
        <p className="text-xs text-gray-500">
          {typeLabel(selectedMedia.type, selectedMedia.media_subtype)}{getBookVolumeLabel(selectedMedia) ? ` • ${getBookVolumeLabel(selectedMedia)}` : ""}{selectedMedia.year ? ` • ${selectedMedia.year}` : ""}
        </p>
        {!finishedReview && <button
          onClick={() => { setStep("search"); setSelectedMedia(null); }}
          className="text-xs font-medium text-purple-600 hover:text-purple-700 mt-1"
        >
          Change
        </button>}
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[99999]" onClick={event => event.stopPropagation()}>
      <div
        className={`absolute inset-0 ${finishedReview ? "bg-black/95" : "bg-black/80"}`}
        aria-hidden="true"
        data-testid={finishedReview ? "finished-review-backdrop" : "quick-track-backdrop"}
        onPointerDown={event => { backdropPressStarted.current = event.target === event.currentTarget; }}
        onPointerCancel={() => { backdropPressStarted.current = false; }}
        onClick={event => {
          // Focus/layout changes can retarget a click after a gesture started
          // inside Track. Only a deliberate backdrop press may dismiss it.
          const shouldClose = backdropPressStarted.current && event.target === event.currentTarget;
          backdropPressStarted.current = false;
          if (shouldClose && !(finishedReview && isSaving)) handleClose();
        }}
      />

      <div
        className={finishedReview
          ? "fixed left-1/2 flex w-[calc(100vw-16px)] max-w-[38rem] -translate-x-1/2 flex-col overflow-hidden rounded-[26px] bg-white shadow-[0_18px_70px_rgba(25,15,45,0.22)]"
          : "absolute left-4 right-4 bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"}
        role="dialog"
        aria-modal="true"
        aria-label={completionMessage ? "Reaction saved" : finishedReview ? "Rate or review finished title" : "Add media"}
        style={finishedReview
          ? {
              right: "auto",
              bottom: "max(12px, env(safe-area-inset-bottom, 0px))",
              left: "50%",
              top: "max(12px, env(safe-area-inset-top, 0px))",
              width: "min(calc(100vw - 16px), 38rem)",
              height: "max-content",
              maxHeight: "calc(100dvh - max(24px, env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px) + 24px))",
              transform: "translateX(-50%)",
              boxSizing: "border-box",
              borderRadius: 26,
              backgroundColor: "#fff",
              marginTop: "auto",
              marginBottom: "auto",
            }
          : step === "search"
          ? {
              ...sheetPosition,
              left: "50%",
              right: "auto",
              width: "min(calc(100vw - 1.5rem), 40rem)",
              height: sheetPosition?.maxHeight,
              transform: "translateX(-50%)",
              backgroundColor: "#fffdfa",
            }
          : sheetPosition}
        onPointerDownCapture={() => { backdropPressStarted.current = false; }}
      >
        {!finishedReview && (
          <div className={`flex justify-center pt-2.5 pb-1 ${step === "search" ? "[@media(max-height:600px)]:hidden" : ""}`}>
            <div className="w-9 h-1 rounded-full bg-gray-300" />
          </div>
        )}

        {/* ── Search step ── */}
        {step === "search" && (
          <>
            <div className="relative flex items-center justify-center px-5 py-2 [@media(max-height:600px)]:py-1">
              <h2 className="text-[20px] font-bold text-[#292437]">Add Anything</h2>
              <button type="button" aria-label="Close Add Anything" onClick={handleClose} className="absolute right-4 p-1.5 rounded-full hover:bg-gray-100 text-gray-400">
                <X size={18} />
              </button>
            </div>

            <MediaSearchPanel onSelect={pickMedia} emptyStateIcon={Dna} bookSeriesDiscovery="matching-filter" expandableBookSeries expandableMovieCollections addAnythingPresentation />

            <button
              onClick={() => setStep("import")}
              className="flex shrink-0 items-center justify-center gap-2 mx-5 mb-[max(0.85rem,env(safe-area-inset-bottom))] mt-1 py-3 text-sm font-medium text-[#625b70] underline underline-offset-4 decoration-[#aaa0c6] hover:text-purple-700 transition-colors [@media(max-height:600px)]:py-2"
              data-testid="quick-track-import-open"
            >
              <Upload size={15} />
              Import from Netflix, Goodreads, or Letterboxd
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
              <button type="button" aria-label="Close Track" onClick={handleClose} className="absolute right-4 p-1.5 rounded-full hover:bg-gray-100 text-gray-400">
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
                   <ImportHistory receipt={importResult.receipt} limit={3} />
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
                    Upload your <span className="font-semibold">Netflix</span>, <span className="font-semibold">Goodreads</span>, or <span className="font-semibold">Letterboxd</span> export
                    and everything lands in your lists. Duplicates are skipped.
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
                    <p><span className="font-semibold text-gray-500">Goodreads:</span> on a computer, go to My Books → Import and export → Export Library (the export tool doesn't show up on phones)</p>
                    <p><span className="font-semibold text-gray-500">Letterboxd:</span> Settings → Data → Export Your Data</p>
                     <p><span className="font-semibold text-gray-500">Netflix:</span> Account → Security & Privacy → Access personal information → Download.</p>
                    <p className="pt-1">Heidi can import any export you have — email <a href="mailto:support@consumedapp.com" className="text-purple-600 underline">support@consumedapp.com</a></p>
                  </div>
                   <ImportHistory limit={3} />
                </>
              )}
            </div>
          </>
        )}

        {/* ── Compose / details step ── */}
        {completionMessage && (
          <FinishedReviewCompletion message={completionMessage} onDismiss={handleClose} />
        )}
        {!completionMessage && step === "compose" && selectedMedia && (
          <>
            {finishedReview ? (
              <div data-testid="finished-review-header" className="relative flex shrink-0 items-center gap-3 bg-[linear-gradient(155deg,#302452_0%,#1c1630_100%)] px-4 py-4 pr-12 text-white sm:gap-4 sm:px-6 sm:py-[18px]">
                <div className="relative shrink-0" data-testid="finished-review-face" aria-hidden="true">
                  <IdentityFace size={60} />
                  <svg
                    aria-hidden="true"
                    data-testid="finished-review-comment-bubble"
                    viewBox="0 0 32 30"
                    className="absolute -bottom-1 -right-2 h-7 w-7"
                    style={{ filter: "drop-shadow(0 0 4px rgba(192,132,252,0.9))" }}
                  >
                    <path d="M5 4.5h19a3.5 3.5 0 0 1 3.5 3.5v9a3.5 3.5 0 0 1-3.5 3.5h-8l-6.5 5v-5h-4A3.5 3.5 0 0 1 2 17V8a3.5 3.5 0 0 1 3-3.5Z" fill="#302452" stroke="#c084fc" strokeWidth="2" strokeLinejoin="round" />
                    <path d="M8 12h.1M14 12h.1M20 12h.1" stroke="#c084fc" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h2 className="text-[clamp(1.3rem,6vw,1.75rem)] font-semibold leading-[1.08] tracking-[-0.04em] text-white" data-testid="finished-review-reminder">Okay, let's hear it.</h2>
                  <p className="mt-1 text-sm font-medium text-[#dec9ff] sm:text-base">You've got thoughts.</p>
                </div>
                <button type="button" aria-label="Close Track" onClick={handleClose} disabled={isSaving}
                  className="absolute right-2 top-2 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-40 sm:right-3 sm:top-3">
                  <X size={20} />
                </button>
              </div>
            ) : (
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
                <button type="button" aria-label="Close Track" onClick={handleClose} className="absolute right-4 p-1.5 rounded-full hover:bg-gray-100 text-gray-400">
                  <X size={18} />
                </button>
              </div>
            )}

            <div data-testid={finishedReview ? "finished-review-body" : undefined} className={`${finishedReview ? "min-h-0 flex-[0_1_auto] overflow-y-auto px-6 pt-4 pb-3" : "min-h-0 flex-1 overflow-y-auto px-5 pb-5 space-y-4"}`}>
              {saveError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{saveError}</p>}
              {/* In the standard tracker this context stays up top; finished reviews
                  keep the writing space first and tuck it beside list controls. */}
              {!finishedReview && mediaContext}

              {/* Season / episode (TV only, optional) */}
              {!finishedReview && selectedMedia.type === "tv" && (
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
                          disabled={!!finishedReview && isSaving}
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
                          const n = se.seasonNumber ?? se.season_number;
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setSelectedSeason(selectedSeason === n ? null : n)}
                              disabled={!!finishedReview && isSaving}
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
                      {selectedSeason !== null && (
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
                                disabled={!!finishedReview && isSaving}
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
                                const n = ep.episodeNumber ?? ep.episode_number;
                                return (
                                  <button
                                    key={n}
                                    type="button"
                                    onClick={() => setSelectedEpisode(selectedEpisode === n ? null : n)}
                                    disabled={!!finishedReview && isSaving}
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
                      {selectedSeason !== null && selectedEpisode !== null && (
                        <p className="text-xs text-gray-500">
                          Tracking S{selectedSeason} · E{selectedEpisode}
                          {episodes.find((ep: any) => (ep.episodeNumber ?? ep.episode_number) === selectedEpisode)?.name
                            ? ` — ${episodes.find((ep: any) => (ep.episodeNumber ?? ep.episode_number) === selectedEpisode)?.name}`
                            : ""}
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {/* Optional rating and reaction */}
              <div className={finishedReview ? "space-y-3" : ""}>
                <div className="space-y-3">
                  {finishedReview ? <>{ratingControl}{reactionControl}</> : <>{reactionControl}{ratingControl}</>}
                  <div>
                    <label className={`flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700 ${finishedReview ? "" : "mt-3"}`}>
                      <input
                        type="checkbox"
                        checked={containsSpoilers}
                        onChange={(event) => setContainsSpoilers(event.target.checked)}
                        disabled={isSaving}
                        className="h-4 w-4 rounded border-gray-300 accent-purple-600 disabled:opacity-60"
                        data-testid="quick-track-spoilers"
                      />
                      Contains spoilers
                    </label>
                  </div>
                </div>
                {finishedReview && (
                  <>
                    <div className="space-y-3">
                      {mediaContext}
                      {selectedMedia.type === "tv" && (
                        <div className="grid grid-cols-2 gap-3">
                          <label className="min-w-0">
                            <span className="mb-1 block text-xs font-medium text-gray-500">Season</span>
                            <select
                              aria-label="Season"
                              value={selectedSeason ?? ""}
                              onChange={(event) => setSelectedSeason(event.target.value === "" ? null : Number(event.target.value))}
                              disabled={isSaving || isLoadingSeasons}
                              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-60"
                              data-testid="finished-review-season-select"
                            >
                              <option value="">Whole series</option>
                              {seasons.map((season: any) => {
                                const number = season.seasonNumber ?? season.season_number;
                                return <option key={number} value={String(number)}>Season {number}</option>;
                              })}
                            </select>
                          </label>
                          <label className="min-w-0">
                            <span className="mb-1 block text-xs font-medium text-gray-500">Episode</span>
                            <select
                              aria-label="Episode"
                              value={selectedEpisode ?? ""}
                              onChange={(event) => setSelectedEpisode(event.target.value === "" ? null : Number(event.target.value))}
                              disabled={isSaving || selectedSeason === null || isLoadingEpisodes || episodes.length === 0}
                              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-60"
                              data-testid="finished-review-episode-select"
                            >
                              <option value="">All episodes</option>
                              {episodes.map((episode: any) => {
                                const number = episode.episodeNumber ?? episode.episode_number;
                                return <option key={number} value={String(number)}>Episode {number}{episode.name ? ` · ${episode.name}` : ""}</option>;
                              })}
                            </select>
                          </label>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-gray-200" />
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-800">Add to a list</p>
                        <button type="button" onClick={() => setShowFinishedListChoices(value => !value)} disabled={isSaving}
                          aria-expanded={showFinishedListChoices}
                          className="text-sm font-medium text-gray-500 underline underline-offset-2 disabled:opacity-40">
                          {showFinishedListChoices ? "Done" : "Change"}
                        </button>
                      </div>
                      {(() => {
                        const currentList = LIST_CHOICES.find((choice) => choice.id === selectedList) ?? LIST_CHOICES[2];
                        return (
                          <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${currentList.bg}`}>
                              {currentList.icon}
                            </div>
                            <span className="text-sm font-medium text-gray-800">{currentList.label}</span>
                          </div>
                        );
                      })()}
                      {showFinishedListChoices && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {LIST_CHOICES.map((choice) => {
                            const active = selectedList === choice.id;
                            return (
                              <button
                                key={choice.id}
                                type="button"
                                disabled={isSaving}
                                onClick={() => { setSelectedList(choice.id); setShowFinishedListChoices(false); }}
                                aria-label={`${choice.label}: ${choice.desc}`}
                                aria-pressed={active}
                                className={`relative flex min-h-[50px] items-center gap-2 rounded-xl border px-3 text-left transition-colors disabled:opacity-60 ${
                                  active ? "border-gray-900 bg-gray-100 text-gray-900" : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
                                }`}
                                data-testid={`quick-track-status-${choice.id}`}
                              >
                                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${choice.bg}`}>
                                  {choice.icon}
                                </div>
                                <span className="text-xs font-semibold">{choice.label}</span>
                                {active && <Check size={14} className="ml-auto text-gray-700" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="border-t border-gray-200" />
                    <label className="flex cursor-pointer items-center justify-between gap-4">
                      <span>
                        <span className="block text-sm font-semibold text-gray-800">Share to NOW</span>
                        <span className="mt-0.5 block text-xs text-gray-500">Let others see your rating or reaction</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={!privateMode}
                        onChange={event => setPrivateMode(!event.target.checked)}
                        disabled={isSaving}
                        className="h-4 w-4 shrink-0 rounded border-gray-300 accent-gray-900 disabled:opacity-60"
                        data-testid="finished-review-private"
                        aria-label="Share to NOW"
                      />
                    </label>
                  </>
                )}
              </div>

              {/* Keep list choices below the shared rating/reaction box. */}
              {!finishedReview && <div>
                <p className="text-sm font-semibold text-gray-700">Add to a list</p>
                <p className="text-xs text-gray-500 mt-0.5 mb-2.5">
                  Save it for later to watch, read, listen, or play.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {LIST_CHOICES.map((s) => {
                    const active = selectedList === s.id;
                    return (
                      <button
                        key={s.id}
                        disabled={false}
                        onClick={() => setSelectedList(s.id)}
                        aria-label={`${s.label}: ${s.desc}`}
                        aria-pressed={active}
                        className={`relative min-h-[58px] flex flex-col items-center justify-center gap-1 px-1.5 rounded-2xl border text-center transition-colors ${
                          active ? "border-purple-500 bg-purple-50 text-purple-800" : "border-gray-200 bg-white text-gray-700 hover:border-purple-200"
                        }`}
                        data-testid={`quick-track-status-${s.id}`}
                      >
                        <div className={`w-7 h-7 rounded-full ${s.bg} flex items-center justify-center`}>
                          {s.icon}
                        </div>
                        <span className="font-semibold text-xs leading-tight">{s.label}</span>
                        {active && <Check size={14} className="absolute top-1.5 right-1.5 text-purple-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>}
            </div>
            {finishedReview && (
              <div className="shrink-0 border-t border-gray-100 bg-white px-6 pt-2.5 pb-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving || (!rating && !takeText.trim() && selectedList === savedReviewList.current)}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#7c3aed_0%,#4f46e5_55%,#2563eb_100%)] px-5 text-sm font-bold text-white shadow-[0_7px_20px_rgba(50,42,180,.38)] transition active:scale-[.98] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:active:scale-100 disabled:active:brightness-100"
                  data-testid="quick-track-save"
                >
                  {isSaving && <Loader2 className="animate-spin" size={16} />}
                  Save
                </button>
                <button type="button" onClick={handleClose} disabled={isSaving}
                  className="mt-2 w-full py-1 text-sm font-medium text-gray-500 disabled:opacity-40">
                  Not now
                </button>
              </div>
            )}
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
