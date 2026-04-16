import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import {
  Sparkles, Check, X, Clock, ArrowLeft, Loader2, Trash2, Pencil,
  ChevronDown, ChevronUp, Calendar, Star, Zap, Brain, Vote, Dna,
  RefreshCw, Send, ListChecks, TrendingUp,
} from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Draft = {
  id: string;
  content_type: string;
  title: string;
  options: string[];
  correct_answer: string | null;
  category: string;
  show_tag: string | null;
  media_title: string | null;
  media_type: string | null;
  difficulty: string | null;
  points_reward: number;
  partner_tag: string | null;
  template_type: string | null;
  rotation_type: string | null;
  ai_notes: string | null;
  status: string;
  featured_date: string | null;
  publish_at: string | null;
  rejection_reason: string | null;
  published_pool_id: string | null;
  created_at: string;
  approved_at: string | null;
  published_at: string | null;
};

const CONTENT_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; description: string }> = {
  trivia: {
    label: "Trivia",
    color: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    icon: <Brain size={12} />,
    description: "Knowledge questions with a correct answer",
  },
  poll: {
    label: "Poll",
    color: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    icon: <Vote size={12} />,
    description: "Opinion questions — no right answer",
  },
  featured_play: {
    label: "Featured Play",
    color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    icon: <Star size={12} />,
    description: "Main daily event — the biggest conversation",
  },
  dna_moment: {
    label: "DNA Moment",
    color: "bg-green-500/20 text-green-300 border-green-500/30",
    icon: <Dna size={12} />,
    description: "Binary identity questions that build user DNA",
  },
};

function ContentTypePill({ type }: { type: string }) {
  const config = CONTENT_TYPE_CONFIG[type] || { label: type, color: "bg-gray-500/20 text-gray-300 border-gray-500/30", icon: null, description: "" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string | null }) {
  if (!difficulty) return null;
  const map: Record<string, string> = {
    easy: "bg-emerald-500/20 text-emerald-300",
    medium: "bg-orange-500/20 text-orange-300",
    chaotic: "bg-red-500/20 text-red-300",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[difficulty] || "bg-gray-500/20 text-gray-300"}`}>
      {difficulty}
    </span>
  );
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Returns upcoming dates for a given day-of-week (0=Sun, 2=Tue, 6=Sat)
function getUpcomingDaysOfWeek(dayOfWeek: number, count: number, startDate: Date): Date[] {
  const results: Date[] = [];
  const d = new Date(startDate);
  const diff = (dayOfWeek - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
  for (let i = 0; i < count; i++) {
    results.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return results;
}

// Auto-assign publish dates across a batch of approved items
function autoScheduleBatch(items: Draft[], startDate: Date): Record<string, string> {
  const dates: Record<string, string> = {};
  const featuredPlays = items.filter(d => d.content_type === "featured_play");
  const triviaAndPolls = items.filter(d => d.content_type === "trivia" || d.content_type === "poll");
  // DNA moments get no date — they publish without one

  // Featured plays: 1 per day starting from startDate
  featuredPlays.forEach((d, i) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    dates[d.id] = toLocalDateStr(date);
  });

  // Trivia + polls: Tuesday (2) and Saturday (6) drops, up to 8 per drop day
  if (triviaAndPolls.length > 0) {
    const numDropDays = Math.ceil(triviaAndPolls.length / 8);
    const tueDrops = getUpcomingDaysOfWeek(2, Math.ceil(numDropDays / 2) + 1, startDate);
    const satDrops = getUpcomingDaysOfWeek(6, Math.ceil(numDropDays / 2) + 1, startDate);
    // Interleave: Tue, Sat, Tue, Sat...
    const dropDays: Date[] = [];
    const maxLen = Math.max(tueDrops.length, satDrops.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < tueDrops.length) dropDays.push(tueDrops[i]);
      if (i < satDrops.length) dropDays.push(satDrops[i]);
    }
    dropDays.sort((a, b) => a.getTime() - b.getTime());

    triviaAndPolls.forEach((d, i) => {
      const dropIndex = Math.floor(i / 40);
      if (dropDays[dropIndex]) {
        dates[d.id] = toLocalDateStr(dropDays[dropIndex]);
      }
    });
  }

  return dates;
}

export default function AdminTriviaPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"generate" | "drafts" | "scheduled" | "published">("generate");
  const [generating, setGenerating] = useState(false);

  // Generate form state
  const [contentType, setContentType] = useState<string>("mixed");
  const [mediaType, setMediaType] = useState<string>("mixed");
  const [count, setCount] = useState<number>(10);

  // Auto-set count when content type changes
  function handleContentTypeChange(newType: string) {
    setContentType(newType);
    if (newType === "featured_play") setCount(31);
    else if (newType === "dna_moment" && count > 20) setCount(20);
    else if (count === 31 && newType !== "featured_play") setCount(10);
  }
  const [focusTopic, setFocusTopic] = useState<string>("");
  const [partnerTag, setPartnerTag] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("medium");
  const [useTrending, setUseTrending] = useState<boolean>(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editCorrectAnswer, setEditCorrectAnswer] = useState<string>("");
  const [editCategory, setEditCategory] = useState<string>("");
  const [editShowTag, setEditShowTag] = useState<string>("");
  const [editMediaTitle, setEditMediaTitle] = useState<string>("");
  const [editPointsReward, setEditPointsReward] = useState<number>(10);

  // Reject state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState<string>("");

  // Schedule state
  const [scheduleDates, setScheduleDates] = useState<Record<string, string>>({});
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [batchPublishing, setBatchPublishing] = useState(false);
  const [batchStartDate, setBatchStartDate] = useState(toLocalDateStr((() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })()));

  // Expanded notes
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // Data queries
  const { data: allDrafts = [], isLoading: draftsLoading } = useQuery<Draft[]>({
    queryKey: ["trivia-poll-drafts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trivia_poll_drafts")
        .select("*")
        .in("status", ["draft", "approved"])
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  // Separate pending review from approved-but-not-yet-published (legacy items from old flow)
  const drafts = allDrafts.filter(d => d.status === "draft");
  const legacyApproved = allDrafts.filter(d => d.status === "approved");

  const { data: published = [], isLoading: publishedLoading, refetch: refetchPublished } = useQuery<Draft[]>({
    queryKey: ["trivia-poll-published"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trivia_poll_drafts")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  // Upcoming: already-published content from prediction_pools with future dates
  const { data: upcoming = [], isLoading: upcomingLoading } = useQuery<{
    id: string; title: string; type: string; category: string | null;
    show_tag: string | null; featured_date: string | null; publish_at: string | null;
    difficulty: string | null; correct_answer: string | null;
  }[]>({
    queryKey: ["trivia-poll-upcoming"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("prediction_pools")
        .select("id, title, type, category, show_tag, featured_date, publish_at, difficulty, correct_answer")
        .or(`featured_date.gte.${today},publish_at.gte.${new Date().toISOString()}`)
        .order("featured_date", { ascending: true, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  async function handleGenerate() {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${supabaseUrl}/functions/v1/generate-trivia-polls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
          "apikey": supabaseAnonKey,
        },
        body: JSON.stringify({ contentType, count, mediaType, focusTopic, partnerTag, difficulty, useTrending }),
      });
      const result = await resp.json();
      if (!resp.ok || !result.success) {
        throw new Error(result.error || "Generation failed");
      }
      const dedupMsg = result.dedupDropped ? ` (${result.dedupDropped} skipped as duplicates)` : "";
      toast({ title: `Generated ${result.generated} items${dedupMsg}`, description: "Review them in the Drafts tab." });
      queryClient.invalidateQueries({ queryKey: ["trivia-poll-drafts"] });
      setActiveTab("drafts");
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  function startEdit(draft: Draft) {
    setEditingId(draft.id);
    setEditTitle(draft.title);
    setEditOptions(draft.options || []);
    setEditCorrectAnswer(draft.correct_answer || "");
    setEditCategory(draft.category || "");
    setEditShowTag(draft.show_tag || "");
    setEditMediaTitle(draft.media_title || draft.show_tag || "");
    setEditPointsReward(draft.points_reward || 10);
  }

  async function saveEdit(draft: Draft) {
    const { error } = await supabase
      .from("trivia_poll_drafts")
      .update({
        title: editTitle,
        options: editOptions,
        correct_answer: editCorrectAnswer || null,
        category: editCategory,
        show_tag: editMediaTitle || editShowTag || null,
        points_reward: editPointsReward,
      })
      .eq("id", draft.id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["trivia-poll-drafts"] });
    }
  }

  // Returns the next upcoming Tuesday or Saturday from batchStartDate
  function getNextDropDate(contentType: string): string {
    const start = new Date(batchStartDate + "T12:00:00");
    if (contentType === "featured_play") return batchStartDate;
    if (contentType === "dna_moment") return "";
    const nextTue = getUpcomingDaysOfWeek(2, 1, start)[0];
    const nextSat = getUpcomingDaysOfWeek(6, 1, start)[0];
    return toLocalDateStr(nextTue < nextSat ? nextTue : nextSat);
  }

  async function approveDraft(draft: Draft) {
    // Immediately publish — no separate "Publish" step needed
    const dateStr = getNextDropDate(draft.content_type);
    try {
      await publishDraft(draft, dateStr);
    } catch {
      // publishDraft already shows the toast
    }
  }

  async function rejectDraft(id: string) {
    if (!rejectFeedback.trim()) {
      toast({ title: "Add feedback", description: "Tell the AI what was wrong with this.", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("trivia_poll_drafts")
      .update({ status: "rejected", rejection_reason: rejectFeedback.trim() })
      .eq("id", id);
    if (error) {
      toast({ title: "Reject failed", description: error.message, variant: "destructive" });
    } else {
      setRejectingId(null);
      setRejectFeedback("");
      queryClient.invalidateQueries({ queryKey: ["trivia-poll-drafts"] });
    }
  }

  async function deleteDraft(id: string) {
    const { error } = await supabase.from("trivia_poll_drafts").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["trivia-poll-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["trivia-poll-published"] });
    }
  }

  async function publishDraft(draft: Draft, dateOverride?: string) {
    setPublishingId(draft.id);
    try {
      const dateStr = dateOverride !== undefined ? dateOverride : scheduleDates[draft.id];
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (draft.content_type === "dna_moment") {
        const dnaData = {
          question_text: draft.title,
          option_a: draft.options[0] || "Yes",
          option_b: draft.options[1] || "No",
          category: draft.category?.toLowerCase() === "habit" ? "habit"
            : draft.category?.toLowerCase() === "personality" ? "personality"
            : draft.category?.toLowerCase() === "preference" ? "preference"
            : "genre",
          is_active: true,
          display_date: dateStr ? new Date(dateStr).toISOString() : null,
        };
        const resp = await fetch(`${supabaseUrl}/functions/v1/generate-trivia-polls`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ action: "publish_dna", dnaData, draftId: draft.id }),
        });
        const result = await resp.json();
        if (!resp.ok || result.error) throw new Error(result.error || "DNA publish failed");
      } else {
        // polls-carousel.tsx and get-polls BOTH query type = 'vote' — must match
        const poolType = draft.content_type === "trivia" ? "trivia"
          : draft.content_type === "featured_play" ? "predict"
          : "vote";

        const poolId = crypto.randomUUID();

        const poolData: Record<string, any> = {
          id: poolId,
          title: draft.title,
          type: poolType,
          options: draft.options,
          correct_answer: draft.correct_answer || null,
          category: draft.category || "Pop Culture",
          show_tag: draft.show_tag || null,
          media_title: draft.media_title || draft.show_tag || null,
          media_external_source: draft.media_type === "tv" || draft.media_type === "movie" ? "tmdb"
            : draft.media_type === "book" ? "googlebooks"
            : draft.media_type === "music" ? "spotify"
            : null,
          points_reward: draft.points_reward || 10,
          status: "open",
          origin_type: "consumed",
          partner_tag: draft.partner_tag || null,
          difficulty: draft.difficulty || "medium",
          inline: draft.content_type !== "featured_play",
          icon: draft.content_type === "trivia" ? "help-circle"
            : draft.content_type === "featured_play" ? "⭐"
            : "📊",
        };

        if (draft.content_type === "featured_play" && dateStr) {
          poolData.featured_date = dateStr;
        } else if (dateStr) {
          poolData.publish_at = new Date(dateStr).toISOString();
        }

        const resp = await fetch(`${supabaseUrl}/functions/v1/generate-trivia-polls`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ action: "publish", poolData, draftId: draft.id }),
        });
        const result = await resp.json();
        if (!resp.ok || result.error) throw new Error(result.error || "Publish failed");
      }

      queryClient.invalidateQueries({ queryKey: ["trivia-poll-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["trivia-poll-published"] });
      queryClient.invalidateQueries({ queryKey: ["trivia-poll-upcoming"] });
    } catch (err: any) {
      toast({ title: "Publish failed", description: err.message, variant: "destructive" });
      throw err; // Rethrow so batch can count failures correctly
    } finally {
      setPublishingId(null);
    }
  }

  async function approveAll() {
    if (drafts.length === 0) return;
    // Calculate batch dates, then publish all immediately — no Scheduled tab needed
    const start = new Date(batchStartDate + "T12:00:00");
    const batchDates = autoScheduleBatch(drafts, start);
    setBatchPublishing(true);
    let successCount = 0;
    let failCount = 0;
    for (const draft of drafts) {
      const dateStr = draft.content_type === "dna_moment" ? "" : (batchDates[draft.id] || getNextDropDate(draft.content_type));
      try {
        await publishDraft(draft, dateStr);
        successCount++;
      } catch {
        failCount++;
      }
    }
    setBatchPublishing(false);
    if (failCount > 0) {
      toast({ title: `${failCount} item${failCount !== 1 ? "s" : ""} failed to publish`, variant: "destructive" });
    }
    queryClient.invalidateQueries({ queryKey: ["trivia-poll-drafts"] });
    queryClient.invalidateQueries({ queryKey: ["trivia-poll-published"] });
  }

  async function publishAllScheduled() {
    // Auto-assign dates if none have been set yet — so "Publish All" works in one click
    let currentDates = scheduleDates;
    const undated = legacyApproved.filter(d => d.content_type !== "dna_moment" && !currentDates[d.id]);
    if (undated.length > 0) {
      const start = new Date(batchStartDate + "T12:00:00");
      const newDates = autoScheduleBatch(legacyApproved, start);
      currentDates = { ...currentDates, ...newDates };
      setScheduleDates(currentDates);
    }

    const toPublish = legacyApproved.filter(d => currentDates[d.id] || d.content_type === "dna_moment");
    if (toPublish.length === 0) {
      toast({ title: "No items ready", description: "No items are ready to publish.", variant: "destructive" });
      return;
    }
    setBatchPublishing(true);
    let successCount = 0;
    let failCount = 0;
    for (const draft of toPublish) {
      try {
        await publishDraft(draft);
        successCount++;
      } catch {
        failCount++;
      }
    }
    setBatchPublishing(false);
    if (failCount > 0) {
      toast({ title: `${failCount} item${failCount !== 1 ? "s" : ""} failed to publish`, variant: "destructive" });
    }
    queryClient.invalidateQueries({ queryKey: ["trivia-poll-drafts"] });
    queryClient.invalidateQueries({ queryKey: ["trivia-poll-published"] });
  }

  const totalDraftCount = drafts.length + legacyApproved.length;
  const tabs = [
    { id: "generate", label: "Generate", icon: <Sparkles size={14} /> },
    { id: "drafts", label: `Drafts${totalDraftCount ? ` (${totalDraftCount})` : ""}`, icon: <Brain size={14} /> },
    { id: "scheduled", label: `Scheduled${upcoming.length ? ` (${upcoming.length})` : ""}`, icon: <Clock size={14} /> },
    { id: "published", label: "Published", icon: <Check size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => setLocation("/admin")}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-3 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Admin
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Content Generator</h1>
              <p className="text-gray-400 text-sm">Trivia, polls, Featured Plays, and DNA Moments — powered by GPT-4o</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Sparkles size={12} />
              <span>GPT-4o</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900 rounded-xl p-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* GENERATE TAB */}
        {activeTab === "generate" && (
          <div className="space-y-5">
            {/* Content type */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">Content Type</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { id: "mixed", label: "Mixed Batch", desc: "Trivia + polls for weekly drops", icon: <Zap size={16} /> },
                  { id: "trivia", label: "Trivia Only", desc: "4 options, 1 correct", icon: <Brain size={16} /> },
                  { id: "poll", label: "Polls Only", desc: "Opinion, no right answer", icon: <Vote size={16} /> },
                  { id: "featured_play", label: "Featured Play", desc: "1 per day · generate 31 at a time", icon: <Star size={16} /> },
                  { id: "dna_moment", label: "DNA Moments", desc: "Binary identity questions", icon: <Dna size={16} /> },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => handleContentTypeChange(opt.id)}
                    className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${
                      contentType === opt.id
                        ? "border-purple-500 bg-purple-500/10"
                        : "border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    <div className={`${contentType === opt.id ? "text-purple-400" : "text-gray-400"}`}>{opt.icon}</div>
                    <span className="text-sm font-medium text-white">{opt.label}</span>
                    <span className="text-xs text-gray-500">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Media type */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">Media Focus</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "mixed", label: "Mixed (40% TV · 30% Movies · 20% Books · 10% Music)" },
                  { id: "tv", label: "TV Only" },
                  { id: "movie", label: "Movies Only" },
                  { id: "book", label: "Books Only" },
                  { id: "music", label: "Music Only" },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setMediaType(opt.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                      mediaType === opt.id
                        ? "border-purple-500 bg-purple-500/10 text-purple-300"
                        : "border-gray-700 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Count + difficulty */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-200 mb-3">How Many to Generate</h3>
                {contentType === "featured_play" ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-bold text-purple-400">31</span>
                      <span className="text-sm text-gray-400">items</span>
                    </div>
                    <p className="text-xs text-gray-500">1 per day = full month. Scheduled consecutively from your start date.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={20}
                        value={count}
                        onChange={e => setCount(Number(e.target.value))}
                        className="flex-1 accent-purple-500"
                      />
                      <span className="text-xl font-bold text-white w-8 text-center">{count}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600 mt-1">
                      <span>1</span>
                      <span>Quick test</span>
                      <span>Monthly batch</span>
                      <span>20</span>
                    </div>
                  </>
                )}
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-gray-200 mb-3">Difficulty Bias</h3>
                <div className="flex flex-col gap-2">
                  {[
                    { id: "easy", label: "Easy", desc: "Mainstream hits" },
                    { id: "medium", label: "Medium", desc: "Mix of pop + depth" },
                    { id: "chaotic", label: "Chaotic", desc: "Deep fandom cuts" },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setDifficulty(opt.id)}
                      className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-sm transition-all ${
                        difficulty === opt.id
                          ? "border-purple-500 bg-purple-500/10 text-white"
                          : "border-gray-700 text-gray-400 hover:border-gray-600"
                      }`}
                    >
                      <span>{opt.label}</span>
                      <span className="text-xs text-gray-500">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Optional fields */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">Optional Targeting</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Focus Topic (e.g. "Oscars 2026", "Taylor Swift")</label>
                  <Input
                    value={focusTopic}
                    onChange={e => { setFocusTopic(e.target.value); if (e.target.value) setUseTrending(false); }}
                    placeholder="Leave blank for general content"
                    disabled={useTrending}
                    className="bg-gray-800 border-gray-700 text-white text-sm disabled:opacity-40"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Partner Tag (e.g. "reelz" for room scoping)</label>
                  <Input
                    value={partnerTag}
                    onChange={e => setPartnerTag(e.target.value)}
                    placeholder="Leave blank for main feed"
                    className="bg-gray-800 border-gray-700 text-white text-sm"
                  />
                </div>
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => { setUseTrending(v => !v); if (!useTrending) setFocusTopic(""); }}
                  className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg border transition-colors ${useTrending ? "bg-purple-600/20 border-purple-500 text-purple-300" : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"}`}
                >
                  <TrendingUp size={14} />
                  {useTrending ? "Trending mode ON — questions based on what's hot right now" : "Generate from trending (TMDB + Open Library)"}
                </button>
                {useTrending && (
                  <p className="text-xs text-purple-400/70 mt-1.5">Pulls this week's trending TV, movies (TMDB), and books (Open Library + Google Books) — all free sources.</p>
                )}
              </div>
            </div>

            {/* Cadence reminder */}
            <div className="bg-blue-950/40 border border-blue-800/40 rounded-xl p-4 text-xs text-blue-300 space-y-1">
              <p className="font-semibold">Content cadence</p>
              <p><span className="text-yellow-400">Featured Plays:</span> Generate 31 → "Approve &amp; Publish All" schedules 1/day for a month automatically</p>
              <p><span className="text-purple-300">Trivia + Polls:</span> Tuesday + Saturday drops → 6–8 trivia + 6–8 polls per drop, up to 40 per drop</p>
              <p><span className="text-green-400">DNA Moments:</span> Generate 10–20 at a time, publish without dates (they release continuously)</p>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white h-12 text-base font-semibold"
            >
              {generating ? (
                <><Loader2 size={18} className="mr-2 animate-spin" />Generating {count} items…</>
              ) : (
                <><Sparkles size={18} className="mr-2" />Generate {count} {contentType === "mixed" ? "mixed items" : CONTENT_TYPE_CONFIG[contentType]?.label || contentType}</>
              )}
            </Button>
          </div>
        )}

        {/* DRAFTS TAB */}
        {activeTab === "drafts" && (
          <div className="space-y-3">
            {draftsLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-500" /></div>
            ) : totalDraftCount === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ListChecks size={40} className="mx-auto mb-3 opacity-30" />
                <p>No drafts yet. Generate content to get started.</p>
              </div>
            ) : (
              <>
                {/* Legacy approved items — need to be published */}
                {legacyApproved.length > 0 && (
                  <div className="bg-yellow-950/40 border border-yellow-700/50 rounded-xl p-4 mb-2">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-yellow-300">{legacyApproved.length} item{legacyApproved.length !== 1 ? "s" : ""} ready to publish</p>
                        <p className="text-xs text-yellow-600 mt-0.5">These were approved but not yet published. Set a date and publish each, or publish all at once.</p>
                      </div>
                      <Button onClick={publishAllScheduled} disabled={batchPublishing} size="sm" className="bg-yellow-700 hover:bg-yellow-600 text-white whitespace-nowrap text-xs">
                        {batchPublishing ? <Loader2 size={12} className="animate-spin mr-1" /> : <Send size={12} className="mr-1" />}
                        Publish All
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {legacyApproved.map(draft => (
                        <div key={draft.id} className="bg-gray-900 border border-gray-700 rounded-lg p-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <ContentTypePill type={draft.content_type} />
                              {draft.category && <span className="text-xs text-gray-500">{draft.category}</span>}
                            </div>
                            <p className="text-sm text-white truncate">{draft.title}</p>
                          </div>
                          {draft.content_type !== "dna_moment" && (
                            <input
                              type="date"
                              value={scheduleDates[draft.id] || ""}
                              onChange={e => setScheduleDates(prev => ({ ...prev, [draft.id]: e.target.value }))}
                              min={toLocalDateStr(new Date())}
                              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white"
                            />
                          )}
                          <Button onClick={() => publishDraft(draft)} disabled={publishingId === draft.id} size="sm" className="bg-green-700 hover:bg-green-600 text-white text-xs">
                            {publishingId === draft.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                          </Button>
                          <button onClick={() => deleteDraft(draft.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending review drafts */}
                {drafts.length > 0 && (
                  <>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-sm text-gray-400">{drafts.length} draft{drafts.length !== 1 ? "s" : ""} waiting for review</p>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs text-gray-500 whitespace-nowrap">Schedule from</label>
                          <input
                            type="date"
                            value={batchStartDate}
                            onChange={e => { if (e.target.value) setBatchStartDate(e.target.value); }}
                            min={toLocalDateStr(new Date())}
                            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                          />
                        </div>
                        <Button onClick={approveAll} disabled={batchPublishing} size="sm" className="text-xs bg-green-700 hover:bg-green-600 text-white whitespace-nowrap">
                          {batchPublishing ? <Loader2 size={12} className="animate-spin mr-1" /> : <Check size={12} className="mr-1" />}
                          Approve &amp; Publish All
                        </Button>
                      </div>
                    </div>
                    {drafts.map(draft => (
                      <DraftCard
                        key={draft.id}
                        draft={draft}
                        editing={editingId === draft.id}
                        rejecting={rejectingId === draft.id}
                        editTitle={editTitle}
                        editOptions={editOptions}
                        editCorrectAnswer={editCorrectAnswer}
                        editCategory={editCategory}
                        editShowTag={editShowTag}
                        editMediaTitle={editMediaTitle}
                        editPointsReward={editPointsReward}
                        rejectFeedback={rejectFeedback}
                        expandedNotes={expandedNotes}
                        onEdit={() => startEdit(draft)}
                        onSaveEdit={() => saveEdit(draft)}
                        onCancelEdit={() => setEditingId(null)}
                        onApprove={() => approveDraft(draft)}
                        onStartReject={() => { setRejectingId(draft.id); setRejectFeedback(""); }}
                        onConfirmReject={() => rejectDraft(draft.id)}
                        onCancelReject={() => setRejectingId(null)}
                        onDelete={() => deleteDraft(draft.id)}
                        onToggleNotes={() => {
                          const next = new Set(expandedNotes);
                          next.has(draft.id) ? next.delete(draft.id) : next.add(draft.id);
                          setExpandedNotes(next);
                        }}
                        setEditTitle={setEditTitle}
                        setEditOptions={setEditOptions}
                        setEditCorrectAnswer={setEditCorrectAnswer}
                        setEditCategory={setEditCategory}
                        setEditShowTag={setEditShowTag}
                        setEditMediaTitle={setEditMediaTitle}
                        setEditPointsReward={setEditPointsReward}
                        setRejectFeedback={setRejectFeedback}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* SCHEDULED TAB — shows already-published content with future dates */}
        {activeTab === "scheduled" && (
          <div className="space-y-4">
            {upcomingLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-500" /></div>
            ) : upcoming.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Clock size={40} className="mx-auto mb-3 opacity-30" />
                <p>Nothing scheduled yet. Approve drafts to see your content calendar here.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500">{upcoming.length} item{upcoming.length !== 1 ? "s" : ""} scheduled — already live in the app, appearing on their assigned dates.</p>

                {/* Featured Plays section */}
                {upcoming.filter(u => u.type === "predict").length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wide mb-2">Featured Plays — 1 per day</p>
                    <div className="space-y-1.5">
                      {upcoming.filter(u => u.type === "predict").sort((a, b) => (a.featured_date || "").localeCompare(b.featured_date || "")).map(item => (
                        <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 flex items-center gap-3">
                          <span className="text-xs text-yellow-600 font-mono w-20 shrink-0">
                            {item.featured_date ? new Date(item.featured_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                          </span>
                          <p className="text-sm text-white flex-1 truncate">{item.title}</p>
                          {item.category && <span className="text-xs text-gray-500 shrink-0">{item.category}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trivia section */}
                {upcoming.filter(u => u.type === "trivia").length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-purple-400 uppercase tracking-wide mb-2">Trivia drops</p>
                    <div className="space-y-1.5">
                      {upcoming.filter(u => u.type === "trivia").sort((a, b) => (a.publish_at || "").localeCompare(b.publish_at || "")).map(item => (
                        <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 flex items-center gap-3">
                          <span className="text-xs text-purple-600 font-mono w-20 shrink-0">
                            {item.publish_at ? new Date(item.publish_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                          </span>
                          <p className="text-sm text-white flex-1 truncate">{item.title}</p>
                          {item.category && <span className="text-xs text-gray-500 shrink-0">{item.category}</span>}
                          {item.correct_answer && <span className="text-xs text-green-600 shrink-0 truncate max-w-24">✓ {item.correct_answer}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Polls section */}
                {upcoming.filter(u => u.type === "vote").length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-2">Poll drops</p>
                    <div className="space-y-1.5">
                      {upcoming.filter(u => u.type === "vote").sort((a, b) => (a.publish_at || "").localeCompare(b.publish_at || "")).map(item => (
                        <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 flex items-center gap-3">
                          <span className="text-xs text-blue-600 font-mono w-20 shrink-0">
                            {item.publish_at ? new Date(item.publish_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                          </span>
                          <p className="text-sm text-white flex-1 truncate">{item.title}</p>
                          {item.category && <span className="text-xs text-gray-500 shrink-0">{item.category}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* PUBLISHED TAB */}
        {activeTab === "published" && (
          <div className="space-y-3">
            {publishedLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-500" /></div>
            ) : published.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Check size={40} className="mx-auto mb-3 opacity-30" />
                <p>Nothing published yet.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-400 mb-2">{published.length} item{published.length !== 1 ? "s" : ""} live</p>
                {published.map(draft => (
                  <div key={draft.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <ContentTypePill type={draft.content_type} />
                          {draft.category && <span className="text-xs text-gray-500">{draft.category}</span>}
                          {draft.show_tag && <span className="text-xs text-purple-400">{draft.show_tag}</span>}
                          {draft.featured_date && (
                            <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full">
                              Featured: {draft.featured_date}
                            </span>
                          )}
                          {draft.published_at && (
                            <span className="text-xs text-gray-600">
                              Published {new Date(draft.published_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-white leading-snug">{draft.title}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {draft.options.map((opt, i) => (
                            <span key={i} className={`text-xs px-2 py-0.5 rounded-full border ${draft.correct_answer === opt ? "border-green-700 text-green-400" : "border-gray-700 text-gray-500"}`}>
                              {opt}{draft.correct_answer === opt && " ✓"}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => deleteDraft(draft.id)} className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Extracted draft card for cleanliness
function DraftCard({
  draft, editing, rejecting,
  editTitle, editOptions, editCorrectAnswer, editCategory, editShowTag, editMediaTitle, editPointsReward,
  rejectFeedback, expandedNotes,
  onEdit, onSaveEdit, onCancelEdit, onApprove, onStartReject, onConfirmReject, onCancelReject, onDelete, onToggleNotes,
  setEditTitle, setEditOptions, setEditCorrectAnswer, setEditCategory, setEditShowTag, setEditMediaTitle, setEditPointsReward, setRejectFeedback,
}: any) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <ContentTypePill type={draft.content_type} />
            {draft.difficulty && <DifficultyBadge difficulty={draft.difficulty} />}
            {draft.category && <span className="text-xs text-gray-500">{draft.category}</span>}
            {draft.show_tag && <span className="text-xs text-purple-400">{draft.show_tag}</span>}
            {draft.partner_tag && <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full">{draft.partner_tag}</span>}
          </div>

          {editing ? (
            <div className="space-y-2">
              <Textarea
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white text-sm min-h-[60px]"
                placeholder="Question text"
              />
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500">Options (one per line)</label>
                {editOptions.map((opt: string, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={opt}
                      onChange={e => {
                        const next = [...editOptions];
                        next[i] = e.target.value;
                        setEditOptions(next);
                      }}
                      className="bg-gray-800 border-gray-700 text-white text-sm h-8"
                      placeholder={`Option ${i + 1}`}
                    />
                    {draft.content_type === "trivia" && (
                      <button
                        onClick={() => setEditCorrectAnswer(opt)}
                        className={`text-xs px-2 py-1 rounded border flex-shrink-0 transition-all ${editCorrectAnswer === opt ? "border-green-600 bg-green-900/40 text-green-300" : "border-gray-700 text-gray-500 hover:border-gray-500"}`}
                      >
                        Correct
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Category</label>
                  <Input value={editCategory} onChange={e => setEditCategory(e.target.value)} className="bg-gray-800 border-gray-700 text-white text-sm h-8" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Show / Media tag</label>
                  <Input value={editShowTag} onChange={e => setEditShowTag(e.target.value)} className="bg-gray-800 border-gray-700 text-white text-sm h-8" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Points</label>
                  <Input type="number" value={editPointsReward} onChange={e => setEditPointsReward(Number(e.target.value))} className="bg-gray-800 border-gray-700 text-white text-sm h-8" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Media title override{" "}
                  <span className="text-gray-600">
                    (exact title on TMDB/Spotify — drives the rate-after-trivia strip; defaults to Show tag if blank)
                  </span>
                </label>
                <Input
                  value={editMediaTitle}
                  onChange={e => setEditMediaTitle(e.target.value)}
                  placeholder={editShowTag || "e.g. The Dark Knight"}
                  className="bg-gray-800 border-gray-700 text-white text-sm h-8"
                />
                {editMediaTitle && editMediaTitle !== editShowTag && (
                  <p className="text-[10px] text-amber-400 mt-1">
                    Saving will update the Show tag to "{editMediaTitle}"
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={onSaveEdit} size="sm" className="bg-purple-600 hover:bg-purple-700 text-white">Save</Button>
                <Button onClick={onCancelEdit} variant="outline" size="sm" className="border-gray-700 text-gray-400">Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-white leading-snug mb-2">{draft.title}</p>
              <div className="flex flex-wrap gap-1">
                {(draft.options || []).map((opt: string, i: number) => (
                  <span key={i} className={`text-xs px-2 py-0.5 rounded-full border ${draft.correct_answer === opt ? "border-green-600 bg-green-900/30 text-green-300" : "border-gray-700 text-gray-500"}`}>
                    {opt}{draft.correct_answer === opt && " ✓"}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {!editing && (
          <div className="flex flex-col gap-1 flex-shrink-0">
            <button onClick={onEdit} className="text-gray-500 hover:text-white transition-colors"><Pencil size={14} /></button>
            <button onClick={onDelete} className="text-gray-600 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
          </div>
        )}
      </div>

      {/* AI notes toggle */}
      {draft.ai_notes && !editing && (
        <button
          onClick={onToggleNotes}
          className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-400 transition-colors mt-1 mb-2"
        >
          {expandedNotes.has(draft.id) ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          AI notes
        </button>
      )}
      {expandedNotes.has(draft.id) && draft.ai_notes && (
        <p className="text-xs text-gray-500 italic mb-2 pl-2 border-l border-gray-700">{draft.ai_notes}</p>
      )}

      {/* Reject feedback */}
      {rejecting && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-purple-400 font-medium">Your feedback trains the AI — be specific so it doesn't repeat this mistake.</p>
          <Textarea
            value={rejectFeedback}
            onChange={e => setRejectFeedback(e.target.value)}
            placeholder={`e.g. "DNA moments should be casual, not formal surveys — rephrase as a direct question"\n"This trivia answer is wrong — it was actually..."\n"Too obscure, use more mainstream examples"`}
            className="bg-gray-800 border-gray-700 text-white text-xs min-h-[80px]"
          />
          <div className="flex gap-2">
            <Button onClick={onConfirmReject} size="sm" className="bg-red-700 hover:bg-red-600 text-white text-xs">Reject & Train AI</Button>
            <Button onClick={onCancelReject} variant="outline" size="sm" className="border-gray-700 text-gray-400 text-xs">Cancel</Button>
          </div>
        </div>
      )}

      {/* Actions */}
      {!editing && !rejecting && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-800">
          <Button onClick={onApprove} size="sm" className="bg-green-700 hover:bg-green-600 text-white text-xs h-7">
            <Check size={12} className="mr-1" /> Approve
          </Button>
          <Button onClick={onStartReject} variant="outline" size="sm" className="border-gray-700 text-gray-400 text-xs h-7 hover:border-red-700 hover:text-red-400">
            <X size={12} className="mr-1" /> Reject
          </Button>
        </div>
      )}
    </div>
  );
}
