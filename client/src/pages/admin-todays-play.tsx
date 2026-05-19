import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import {
  ArrowLeft, Sparkles, Loader2, Check, X, CalendarDays, Send,
  ChevronDown, ChevronUp, ShieldCheck, AlertTriangle, Film, BookOpen, Zap, Pencil,
  Tv, Music2, Headphones, Gamepad2, Shuffle, Plus, Minus, Search,
} from "lucide-react";

type Draft = {
  id: string;
  title: string;
  content_type: string;
  options: string[];
  correct_answer: string | null;
  category: string;
  show_tag: string | null;
  media_tags: string[] | null;
  media_type: string | null;
  media_external_id: string | null;
  media_external_source: string | null;
  featured_date: string | null;
  status: string;
  created_at: string;
};

type MediaSearchResult = {
  title: string;
  external_id: string;
  external_source: string;
  type: string;
  poster_url?: string;
  image?: string;
  creator?: string;
  year?: string | number;
};

function MediaSearchPicker({
  mediaType,
  value,
  externalId,
  externalSource,
  onSelect,
}: {
  mediaType: string;
  value: string;
  externalId: string | null;
  externalSource: string | null;
  onSelect: (result: MediaSearchResult | null, rawTitle: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<MediaSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleInput(e: ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    onSelect(null, q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const searchType = (mediaType === "mixed" || !mediaType) ? undefined : mediaType;
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/media-search`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
          body: JSON.stringify({ query: q, ...(searchType ? { type: searchType } : {}) }),
        });
        const data = await resp.json();
        const items: MediaSearchResult[] = (Array.isArray(data) ? data : (data.results || [])).slice(0, 6);
        setResults(items);
        setOpen(items.length > 0);
      } catch { /* best-effort */ } finally { setSearching(false); }
    }, 400);
  }

  function select(item: MediaSearchResult) {
    setQuery(item.title);
    setOpen(false);
    setResults([]);
    onSelect(item, item.title);
  }

  const isVerified = !!externalId;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <Input
          value={query}
          onChange={handleInput}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search to link a real media item..."
          className="bg-black/30 border-white/10 text-white text-xs h-7 pl-6 pr-16"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {searching && <Loader2 size={10} className="animate-spin text-gray-400" />}
          {isVerified && !searching && (
            <span className="text-[9px] font-bold text-teal-400 flex items-center gap-0.5">
              <Check size={9} /> linked
            </span>
          )}
        </div>
      </div>
      {isVerified && externalSource && (
        <p className="text-[10px] text-teal-500/70 mt-0.5 pl-1">
          via {externalSource}
        </p>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {results.map((item, i) => (
            <button
              key={i}
              onMouseDown={() => select(item)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800 text-left transition-colors"
            >
              {(item.poster_url || item.image) ? (
                <img src={item.poster_url || item.image} alt="" className="w-6 h-8 object-cover rounded flex-shrink-0" />
              ) : (
                <div className="w-6 h-8 bg-gray-700 rounded flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs text-white font-medium truncate">{item.title}</p>
                <p className="text-[10px] text-gray-400 truncate">
                  {[item.creator, item.year, item.external_source].filter(Boolean).join(" · ")}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type SlotMeta = {
  mediaType: string;
  focusTopic: string;
  categoryHint: string;
  label: string;
  icon: React.ReactNode;
  pillClass: string;
};

const PRIMARY_SLOTS: SlotMeta[] = [
  {
    mediaType: "movie",
    focusTopic: "movies, films, cinema, box office, directors, actors, film franchises, movie history",
    categoryHint: "Movies",
    label: "Movie",
    icon: <Film size={11} />,
    pillClass: "bg-blue-500/20 text-blue-300",
  },
  {
    mediaType: "book",
    focusTopic: "books, novels, authors, literature, bestsellers, literary adaptations, book series",
    categoryHint: "Books",
    label: "Book",
    icon: <BookOpen size={11} />,
    pillClass: "bg-emerald-500/20 text-emerald-300",
  },
  {
    mediaType: "tv",
    focusTopic: "TV shows, streaming series, reality TV, sitcoms, drama series, TV finales, iconic TV moments, binge-worthy shows",
    categoryHint: "TV",
    label: "TV / Shows",
    icon: <Tv size={11} />,
    pillClass: "bg-amber-500/20 text-amber-300",
  },
];

const EXTRA_SLOTS: SlotMeta[] = [
  {
    mediaType: "mixed",
    focusTopic: "viral internet moments, celebrity news & tabloid drama (feuds, trials, controversies), fashion & consumer brand crazes (Stanley cups, Dupe culture, limited-edition drops), cultural mashup events (Barbenheimer, etc.), memes & phrases that defined a year, award show drama & moments, 'you had to be there' cultural events. IMPORTANT: only ask about things SO big that any casual pop culture fan would know the answer — no deep-cut niche knowledge. These are about The Conversation, not The Craft.",
    categoryHint: "Pop Culture",
    label: "Pop Culture",
    icon: <Zap size={11} />,
    pillClass: "bg-purple-500/20 text-purple-300",
  },
  {
    mediaType: "music",
    focusTopic: "music artists, hit songs, albums, chart records, Grammy moments, music videos, iconic performances, band history",
    categoryHint: "Music",
    label: "Music",
    icon: <Music2 size={11} />,
    pillClass: "bg-pink-500/20 text-pink-300",
  },
  {
    mediaType: "podcast",
    focusTopic: "popular podcasts, podcast hosts, true crime podcasts, comedy podcasts, famous podcast moments and episodes, widely-known podcast culture",
    categoryHint: "Podcasts",
    label: "Podcast",
    icon: <Headphones size={11} />,
    pillClass: "bg-sky-500/20 text-sky-300",
  },
  {
    mediaType: "gaming",
    focusTopic: "video games, iconic game characters, gaming milestones, Nintendo, PlayStation, Xbox, esports moments, widely-known game franchises",
    categoryHint: "Gaming",
    label: "Gaming",
    icon: <Gamepad2 size={11} />,
    pillClass: "bg-violet-500/20 text-violet-300",
  },
];

const SLOT_METAS = [...PRIMARY_SLOTS, ...EXTRA_SLOTS];

// ── Duplicate detection helpers ───────────────────────────────────────────────
const STOPWORDS = new Set([
  "who","what","when","where","which","how","the","a","an","in","of","did",
  "does","was","is","are","were","has","had","have","for","on","at","to","by",
  "do","with","from","that","this","these","those","and","or","but","year",
  "first","name","many","much","played","won","created","wrote","directed",
]);
function normWords(title: string): string[] {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(
    w => w.length > 2 && !STOPWORDS.has(w),
  );
}
function titlesSimilar(a: string, b: string, threshold = 2): boolean {
  if (a.toLowerCase().trim() === b.toLowerCase().trim()) return true;
  const wa = new Set(normWords(a));
  return normWords(b).filter(w => wa.has(w)).length >= threshold;
}
function computeDuplicateIds(
  draftList: Draft[],
  scheduledList: { questions: { title: string }[] }[],
  publishedList: { questions: { title: string }[] }[],
): string[] {
  const existing = [
    ...scheduledList.flatMap(s => s.questions),
    ...publishedList.flatMap(p => p.questions),
  ];
  const toDelete: string[] = [];
  const seenTitles: string[] = [];
  for (const draft of draftList) {
    let isDup = false;
    for (const eq of existing) {
      if (titlesSimilar(draft.title, eq.title)) { isDup = true; break; }
    }
    if (!isDup) {
      for (const seen of seenTitles) {
        if (titlesSimilar(draft.title, seen)) { isDup = true; break; }
      }
    }
    if (isDup) toDelete.push(draft.id);
    else seenTitles.push(draft.title);
  }
  return toDelete;
}
// ─────────────────────────────────────────────────────────────────────────────

function typeMeta(draft: Draft): SlotMeta {
  if (draft.category === "Books") return PRIMARY_SLOTS[1];
  if (draft.category === "TV") return PRIMARY_SLOTS[2];
  if (draft.category === "Pop Culture") return EXTRA_SLOTS[0];
  if (draft.category === "Music") return EXTRA_SLOTS[1];
  if (draft.category === "Podcast" || draft.category === "Podcasts") return EXTRA_SLOTS[2];
  if (draft.category === "Gaming") return EXTRA_SLOTS[3];
  return PRIMARY_SLOTS[0];
}

export default function AdminTodaysPlayPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"generate" | "drafts" | "scheduled" | "published">("generate");
  const [genStage, setGenStage] = useState<string>("idle");
  const [extrasStage, setExtrasStage] = useState<string>("idle");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishingGroup, setPublishingGroup] = useState<string | null>(null);
  const [addingToDate, setAddingToDate] = useState<string | null>(null);
  const [editingScheduledDate, setEditingScheduledDate] = useState<string | null>(null);
  const [newDateForEdit, setNewDateForEdit] = useState<string>("");
  const [movingDate, setMovingDate] = useState(false);
  const [unschedulingId, setUnschedulingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [contentBrief, setContentBrief] = useState("");

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editAnswer, setEditAnswer] = useState("");
  const [editShowTag, setEditShowTag] = useState("");
  const [editMediaType, setEditMediaType] = useState("tv");
  const [editMediaExternalId, setEditMediaExternalId] = useState<string | null>(null);
  const [editMediaExternalSource, setEditMediaExternalSource] = useState<string | null>(null);

  // Write your own state
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualPlayType, setManualPlayType] = useState<"trivia" | "poll" | "predict">("trivia");
  const [manualTitle, setManualTitle] = useState("");
  const [manualOptions, setManualOptions] = useState(["", "", "", ""]);
  const [manualAnswer, setManualAnswer] = useState("");
  const [manualShowTag, setManualShowTag] = useState("");
  const [manualMediaType, setManualMediaType] = useState("tv");
  const [manualMediaExternalId, setManualMediaExternalId] = useState<string | null>(null);
  const [manualMediaExternalSource, setManualMediaExternalSource] = useState<string | null>(null);
  const [manualFeaturedDate, setManualFeaturedDate] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  // Pending drafts
  const { data: drafts = [], refetch: refetchDrafts } = useQuery<Draft[]>({
    queryKey: ["todays-play-drafts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("trivia_poll_drafts")
        .select("id, title, content_type, options, correct_answer, category, show_tag, media_tags, media_type, media_external_id, media_external_source, featured_date, status, created_at")
        .in("content_type", ["trivia", "poll", "featured_play"])
        .in("status", ["draft", "pending"])
        .order("created_at", { ascending: false })
        .limit(120);
      return data || [];
    },
  });

  useEffect(() => {
    if (!drafts.length) return;
    const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && parseInt(s.slice(0, 4)) >= 2020;
    setDates(prev => {
      const next = { ...prev };

      // Step 1: restore any date already saved on the draft record in the DB
      for (const d of drafts) {
        if (!next[d.id] || !isValidDate(next[d.id])) {
          if (d.featured_date && isValidDate(d.featured_date)) {
            next[d.id] = d.featured_date;
          }
        }
      }

      // Step 2: auto-assign still-unassigned drafts — 1 per day starting tomorrow
      const takenDates = new Set(Object.values(next).filter(Boolean));
      const unassigned = drafts.filter(d => !next[d.id]);
      const cursor = new Date();
      cursor.setDate(cursor.getDate() + 1);
      for (const draft of unassigned) {
        while (cursor.getFullYear() <= 2027) {
          const ds = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
          cursor.setDate(cursor.getDate() + 1);
          if (!takenDates.has(ds)) {
            next[draft.id] = ds;
            takenDates.add(ds);
            break;
          }
        }
      }

      return next;
    });
  }, [drafts]);

  // Published (past + today scheduled)
  const { data: published = [] } = useQuery<{ date: string; questions: any[] }[]>({
    queryKey: ["todays-play-published"],
    queryFn: async () => {
      const today = toLocalDateStr(new Date());
      const { data } = await supabase
        .from("prediction_pools")
        .select("id, title, category, type, featured_date")
        .in("type", ["trivia", "poll", "predict"])
        .not("featured_date", "is", null)
        .eq("featured_date", today)
        .order("featured_date", { ascending: false })
        .limit(60);
      if (!data) return [];
      const byDate: Record<string, any[]> = {};
      for (const row of data) {
        if (!byDate[row.featured_date]) byDate[row.featured_date] = [];
        byDate[row.featured_date].push(row);
      }
      return Object.entries(byDate)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, questions]) => ({ date, questions }));
    },
  });

  // Scheduled (future) sets
  const { data: scheduled = [], refetch: refetchScheduled } = useQuery<{ date: string; questions: any[] }[]>({
    queryKey: ["todays-play-scheduled"],
    queryFn: async () => {
      const today = toLocalDateStr(new Date());
      const { data } = await supabase
        .from("prediction_pools")
        .select("id, title, category, type, featured_date")
        .in("type", ["trivia", "poll", "predict"])
        .not("featured_date", "is", null)
        .gte("featured_date", today)
        .order("featured_date", { ascending: true })
        .limit(90);
      if (!data) return [];
      const byDate: Record<string, any[]> = {};
      for (const row of data) {
        if (!byDate[row.featured_date]) byDate[row.featured_date] = [];
        byDate[row.featured_date].push(row);
      }
      return Object.entries(byDate).map(([date, questions]) => ({ date, questions }));
    },
  });

  const scheduledDates = new Set(scheduled.map(s => s.date));

  // Build duplicate map: draftId → description of the conflicting question
  const duplicateMap = new Map<string, string>();
  const existingQuestions: { title: string; date: string }[] = [
    ...scheduled.flatMap(s => s.questions.map((q: any) => ({ title: q.title, date: s.date }))),
    ...published.flatMap(p => p.questions.map((q: any) => ({ title: q.title, date: p.date }))),
  ];
  drafts.forEach((draft, i) => {
    if (duplicateMap.has(draft.id)) return;
    // Check against already-scheduled/published
    for (const eq of existingQuestions) {
      if (titlesSimilar(draft.title, eq.title)) {
        duplicateMap.set(draft.id, `Already scheduled on ${new Date(eq.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}: "${eq.title}"`);
        return;
      }
    }
    // Check against other drafts in this batch
    for (let j = 0; j < drafts.length; j++) {
      if (j === i) continue;
      if (titlesSimilar(draft.title, drafts[j].title)) {
        duplicateMap.set(draft.id, `Similar to another draft: "${drafts[j].title}"`);
        return;
      }
    }
  });

  function suggestDates(forceAll = false) {
    // One question per day — assign each draft its own free date sequentially
    const dupIds = new Set(computeDuplicateIds(drafts, scheduled, published));
    const unassigned = drafts.filter(d => !dupIds.has(d.id) && (forceAll || !dates[d.id]));

    // Dates already taken: either scheduled in DB or already assigned in state
    const takenDates = new Set([
      ...scheduled.filter(s => s.questions.length >= 1).map(s => s.date),
      ...Object.values(dates).filter(Boolean),
    ]);

    const newDates: Record<string, string> = { ...dates };
    const cursor = new Date();
    cursor.setDate(cursor.getDate() + 1);

    for (const draft of unassigned) {
      while (cursor.getFullYear() <= 2027) {
        const ds = toLocalDateStr(cursor);
        cursor.setDate(cursor.getDate() + 1);
        if (!takenDates.has(ds)) {
          newDates[draft.id] = ds;
          takenDates.add(ds);
          break;
        }
      }
    }

    setDates(newDates);
  }

  async function callGenerateDailyPlay(contentType: "trivia" | "poll" | "featured_play", count: number, brief?: string) {
    const { data: { session: s } } = await supabase.auth.getSession();
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/generate-trivia-polls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${s?.access_token}`,
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        contentType,
        count,
        mediaType: "mixed",
        useTrending: true,
        difficulty: "medium",
        ...(brief?.trim() ? { focusTopic: brief.trim() } : {}),
      }),
    });
    const result = await resp.json();
    if (!resp.ok || !result.success) throw new Error(result.error || "Generation failed");
    return result;
  }

  async function reshuffleAnswers() {
    let updated = 0;
    for (const draft of drafts) {
      if (!draft.correct_answer || !draft.options?.length) continue;
      const opts = [...draft.options];
      const correctIdx = opts.indexOf(draft.correct_answer);
      if (correctIdx === -1) continue;
      // Bias toward C (index 2) or D (index 3)
      const targets = [2, 3];
      const targetIdx = targets[Math.floor(Math.random() * targets.length)];
      if (correctIdx === targetIdx) continue;
      [opts[correctIdx], opts[targetIdx]] = [opts[targetIdx], opts[correctIdx]];
      await supabase.from("trivia_poll_drafts").update({ options: opts }).eq("id", draft.id);
      updated++;
    }
    await refetchDrafts();
    toast({ title: `Reshuffled ${updated} question${updated !== 1 ? "s" : ""}`, description: "Correct answers moved to C or D positions." });
  }

  async function purgeDuplicates(freshDrafts: Draft[]): Promise<number> {
    const ids = computeDuplicateIds(freshDrafts, scheduled, published);
    if (ids.length === 0) return 0;
    await supabase.from("trivia_poll_drafts").delete().in("id", ids);
    await refetchDrafts();
    return ids.length;
  }

  async function handleGenerateDailyPlays() {
    const brief = contentBrief.trim() || undefined;
    setGenStage("trivia");
    let triviaCount = 0, pollCount = 0, predictionCount = 0;
    try {
      const r1 = await callGenerateDailyPlay("trivia", 5, brief);
      triviaCount = r1.generated ?? 0;
      setGenStage("poll");
      const r2 = await callGenerateDailyPlay("poll", 5, brief);
      pollCount = r2.generated ?? 0;
      setGenStage("predict");
      const r3 = await callGenerateDailyPlay("featured_play", 4, brief);
      predictionCount = r3.generated ?? 0;
      setGenStage("done");
      const refetchResult = await refetchDrafts();
      const removed = await purgeDuplicates(refetchResult.data ?? []);
      const total = triviaCount + pollCount + predictionCount;
      toast({
        title: `Generated ${total} daily plays${removed > 0 ? `, removed ${removed} duplicate${removed !== 1 ? "s" : ""}` : ""}`,
        description: `${triviaCount} Trivia · ${pollCount} Polls · ${predictionCount} Predictions — review in Drafts.`,
      });
      setTab("drafts");
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenStage("idle");
    }
  }

  function getPoolType(draft: Draft): "trivia" | "poll" | "predict" {
    if (draft.content_type === "poll") return "poll";
    if (draft.content_type === "featured_play") return "predict";
    return "trivia";
  }

  async function publishDraft(draft: Draft) {
    const dateStr = dates[draft.id];
    if (!dateStr) { toast({ title: "Pick a date first", variant: "destructive" }); return; }
    setPublishingId(draft.id);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const meta = typeMeta(draft);
      const poolType = getPoolType(draft);
      const poolData = {
        id: crypto.randomUUID(),
        title: draft.title,
        type: poolType,
        options: draft.options,
        correct_answer: poolType === "trivia" ? (draft.correct_answer || null) : null,
        category: meta.categoryHint,
        show_tag: draft.show_tag || null,
        media_tags: draft.media_tags || (draft.show_tag ? [draft.show_tag] : null),
        media_type: draft.media_type || null,
        media_external_id: draft.media_external_id || null,
        media_external_source: draft.media_external_source || null,
        featured_date: dateStr,
        status: "open",
        origin_type: "consumed",
        inline: true,
        icon: poolType === "trivia" ? "help-circle" : poolType === "poll" ? "bar-chart-2" : "trending-up",
        points_reward: 10,
      };
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/generate-trivia-polls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${s?.access_token}`,
          "apikey": SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: "publish", poolData, draftId: draft.id }),
      });
      const result = await resp.json();
      if (!resp.ok || result.error) throw new Error(result.error || "Publish failed");
      toast({ title: `Published for ${dateStr}` });
      await refetchDrafts();
      await refetchScheduled();
      queryClient.invalidateQueries({ queryKey: ["todays-play-scheduled"] });
    } catch (err: any) {
      toast({ title: "Publish failed", description: err.message, variant: "destructive" });
    } finally {
      setPublishingId(null);
    }
  }

  async function deleteDraft(id: string) {
    await supabase.from("trivia_poll_drafts").delete().eq("id", id);
    setDates(d => { const u = { ...d }; delete u[id]; return u; });
    await refetchDrafts();
  }

  async function rejectDraft(id: string, reason: string) {
    await supabase
      .from("trivia_poll_drafts")
      .update({ status: "rejected", rejection_reason: reason.trim() || "No reason given" })
      .eq("id", id);
    setDates(d => { const u = { ...d }; delete u[id]; return u; });
    setRejectingId(null);
    setRejectReason("");
    await refetchDrafts();
    toast({ title: "Feedback saved — AI will avoid this next time" });
  }

  async function scheduleGroup(dateStr: string, groupDrafts: Draft[]) {
    // Block if this date already has a question scheduled
    const existingCount = scheduled.find(s => s.date === dateStr)?.questions.length ?? 0;
    if (existingCount >= 1) {
      toast({
        title: "Date already has a question",
        description: `${dateStr} already has ${existingCount} question scheduled. Pick a different date.`,
        variant: "destructive",
      });
      return;
    }

    // Trivia requires show_tag; polls and predictions don't
    const noTagDrafts = groupDrafts.filter(d => !d.show_tag && (!d.content_type || d.content_type === "trivia"));
    const schedulable = groupDrafts.filter(d => !!d.show_tag || (d.content_type && d.content_type !== "trivia"));

    if (noTagDrafts.length > 0 && schedulable.length === 0) {
      toast({
        title: "Cannot schedule — no media tags",
        description: `All ${noTagDrafts.length} question(s) are missing a media tag (show_tag). Edit each question to add one first.`,
        variant: "destructive",
      });
      return;
    }
    if (noTagDrafts.length > 0) {
      toast({
        title: `${noTagDrafts.length} question(s) skipped — no media tag`,
        description: `Skipped: ${noTagDrafts.map(d => d.title.slice(0, 40)).join("; ")}`,
        variant: "destructive",
      });
    }

    setPublishingGroup(dateStr);
    let succeeded = 0;
    const errors: string[] = [];
    for (const draft of schedulable) {
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        const meta = typeMeta(draft);
        const poolType = getPoolType(draft);
        const poolData = {
          id: crypto.randomUUID(),
          title: draft.title,
          type: poolType,
          options: draft.options,
          correct_answer: poolType === "trivia" ? (draft.correct_answer || null) : null,
          category: meta.categoryHint,
          show_tag: draft.show_tag || null,
          media_tags: draft.media_tags || (draft.show_tag ? [draft.show_tag] : null),
          media_type: draft.media_type || null,
          media_external_id: draft.media_external_id || null,
          media_external_source: draft.media_external_source || null,
          featured_date: dateStr,
          status: "open",
          origin_type: "consumed",
          inline: true,
          icon: poolType === "trivia" ? "help-circle" : poolType === "poll" ? "bar-chart-2" : "trending-up",
          points_reward: 10,
        };
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/generate-trivia-polls`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${s?.access_token}`,
            "apikey": SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ action: "publish", poolData, draftId: draft.id }),
        });
        const result = await resp.json().catch(() => ({}));
        if (resp.ok && !result.error) {
          succeeded++;
        } else {
          errors.push(result.error || result.message || `HTTP ${resp.status}`);
        }
      } catch (err: any) {
        errors.push(err?.message || "Network error");
      }
    }
    setPublishingGroup(null);

    if (succeeded === 0) {
      toast({
        title: `Failed to schedule questions for ${dateStr}`,
        description: errors.length > 0 ? errors[0] : "Unknown error — check that the edge function is deployed.",
        variant: "destructive",
      });
    } else {
      toast({ title: `Scheduled ${succeeded}/${schedulable.length} questions for ${dateStr}` });
      if (errors.length > 0) {
        toast({ title: `${errors.length} question(s) failed`, description: errors[0], variant: "destructive" });
      }
    }
    await refetchDrafts();
    await refetchScheduled();
    queryClient.invalidateQueries({ queryKey: ["todays-play-scheduled"] });
  }

  async function moveScheduledDate(oldDate: string, newDate: string) {
    if (!newDate || newDate === oldDate) return;
    const conflict = scheduled.find(s => s.date === newDate);
    if (conflict) {
      toast({
        title: "Date already has questions",
        description: `${newDate} already has ${conflict.questions.length} question(s) scheduled. Pick a free date.`,
        variant: "destructive",
      });
      return;
    }

    // Get the specific question IDs for this date — updating by ID avoids RLS issues
    const ids = scheduled.find(s => s.date === oldDate)?.questions.map(q => q.id) ?? [];
    if (ids.length === 0) {
      toast({ title: "No questions found for that date", variant: "destructive" });
      return;
    }

    setMovingDate(true);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const updates = ids.map(id => ({ id, featured_date: newDate }));
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/generate-trivia-polls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${s?.access_token}`,
          "apikey": SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: "reschedule_featured", updates }),
      });
      const result = await resp.json();
      if (!resp.ok || result.error) {
        toast({ title: "Move failed", description: result.error || "Unknown error", variant: "destructive" });
      } else {
        toast({ title: `Moved ${ids.length} question${ids.length !== 1 ? "s" : ""} to ${newDate}` });
        setEditingScheduledDate(null);
        setNewDateForEdit("");
        await refetchScheduled();
        queryClient.invalidateQueries({ queryKey: ["todays-play-scheduled"] });
      }
    } catch (err: any) {
      toast({ title: "Move failed", description: err.message, variant: "destructive" });
    } finally {
      setMovingDate(false);
    }
  }

  async function unscheduleQuestion(poolId: string) {
    setUnschedulingId(poolId);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/generate-trivia-polls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${s?.access_token}`,
          "apikey": SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: "unschedule", poolId }),
      });
      const result = await resp.json();
      if (!resp.ok || result.error) throw new Error(result.error || "Unschedule failed");
      await Promise.all([refetchScheduled(), refetchDrafts()]);
      queryClient.invalidateQueries({ queryKey: ["todays-play-scheduled"] });
      toast({ title: "Removed — question moved back to Drafts" });
    } catch (err: any) {
      toast({ title: "Failed to unschedule", description: err.message, variant: "destructive" });
    } finally {
      setUnschedulingId(null);
    }
  }

  function startEdit(draft: Draft) {
    setEditingId(draft.id);
    setEditTitle(draft.title);
    setEditOptions(draft.options || []);
    setEditAnswer(draft.correct_answer || "");
    setEditShowTag(draft.show_tag || "");
    const mtMap: Record<string, string> = { Movies: "movie", Books: "book", TV: "tv", Music: "music" };
    setEditMediaType(mtMap[draft.category] || draft.media_type || "tv");
    setEditMediaExternalId(draft.media_external_id || null);
    setEditMediaExternalSource(draft.media_external_source || null);
  }

  async function saveEdit(draft: Draft) {
    const categoryMap: Record<string, string> = { movie: "Movies", tv: "TV", book: "Books", music: "Music", podcast: "Podcasts", gaming: "Gaming", mixed: "Pop Culture" };
    await supabase.from("trivia_poll_drafts").update({
      title: editTitle,
      options: editOptions,
      correct_answer: editAnswer || null,
      show_tag: editShowTag.trim() || null,
      media_tags: editShowTag.trim() ? [editShowTag.trim()] : null,
      media_type: editMediaType,
      category: categoryMap[editMediaType] || draft.category,
      media_external_id: editMediaExternalId || null,
      media_external_source: editMediaExternalSource || null,
    }).eq("id", draft.id);
    setEditingId(null);
    await refetchDrafts();
  }

  function resetManualForm() {
    setManualTitle("");
    setManualOptions(["", "", "", ""]);
    setManualAnswer("");
    setManualShowTag("");
    setManualMediaType("tv");
    setManualMediaExternalId(null);
    setManualMediaExternalSource(null);
    setManualFeaturedDate("");
    setShowManualForm(false);
  }

  async function handleSaveManualTrivia() {
    const filled = manualOptions.filter(o => o.trim());
    if (!manualTitle.trim() || filled.length < 2 || !manualAnswer || !manualShowTag.trim()) {
      toast({ title: "Fill in question, options, correct answer, and show/media name", variant: "destructive" });
      return;
    }
    const categoryMap: Record<string, string> = { movie: "Movies", tv: "TV", book: "Books", music: "Music", podcast: "Podcasts", gaming: "Gaming", mixed: "Pop Culture" };
    setSavingManual(true);
    try {
      const { error } = await supabase.from("trivia_poll_drafts").insert({
        id: crypto.randomUUID(),
        title: manualTitle.trim(),
        options: filled,
        correct_answer: manualAnswer,
        show_tag: manualShowTag.trim(),
        media_tags: [manualShowTag.trim()],
        media_type: manualMediaType,
        category: categoryMap[manualMediaType] || "TV",
        media_external_id: manualMediaExternalId || null,
        media_external_source: manualMediaExternalSource || null,
        content_type: "trivia",
        status: "draft",
      });
      if (error) throw error;
      toast({ title: "Saved to Drafts!", description: "Go to Drafts tab to schedule it." });
      resetManualForm();
      await refetchDrafts();
      setTab("drafts");
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingManual(false);
    }
  }

  async function handleSaveManualOpinion() {
    const filled = manualOptions.filter(o => o.trim());
    if (!manualTitle.trim() || filled.length < 2 || !manualFeaturedDate) {
      toast({ title: "Fill in question, at least 2 options, and a featured date", variant: "destructive" });
      return;
    }
    const categoryMap: Record<string, string> = { movie: "Movies", tv: "TV", book: "Books", music: "Music", podcast: "Podcasts", gaming: "Gaming", mixed: "Pop Culture" };
    setSavingManual(true);
    try {
      const { error } = await supabase.from("prediction_pools").insert({
        id: crypto.randomUUID(),
        title: manualTitle.trim(),
        type: manualPlayType,
        options: filled,
        correct_answer: null,
        category: categoryMap[manualMediaType] || "TV",
        show_tag: manualShowTag.trim() || null,
        media_tags: manualShowTag.trim() ? [manualShowTag.trim()] : null,
        media_type: manualMediaType,
        media_external_id: manualMediaExternalId || null,
        media_external_source: manualMediaExternalSource || null,
        featured_date: manualFeaturedDate,
        status: "open",
        origin_type: "consumed",
        inline: true,
        points_reward: 10,
      });
      if (error) throw error;
      toast({ title: `Scheduled for ${manualFeaturedDate}!`, description: "Today's Play will show this question on that date." });
      resetManualForm();
      await refetchScheduled();
      queryClient.invalidateQueries({ queryKey: ["todays-play-scheduled"] });
      setTab("scheduled");
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingManual(false);
    }
  }

  const generating = !["idle", "done"].includes(genStage);
  const generatingExtras = !["idle", "done"].includes(extrasStage);

  const DAILY_STAGE_ORDER = ["trivia", "poll", "predict"];

  const STAGE_LABELS: Record<string, string> = {
    trivia: "Generating trivia questions...",
    poll: "Generating opinion polls...",
    predict: "Generating predictions...",
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => setLocation("/admin")} className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Today's Play Generator</h1>
            <p className="text-gray-400 text-sm mt-0.5">One question per day — trivia, poll, or prediction</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900 rounded-xl p-1">
          {[
            { key: "generate" as const, label: "Generate" },
            { key: "drafts" as const, label: `Drafts (${drafts.length})` },
            { key: "scheduled" as const, label: `Scheduled (${scheduled.length})` },
            { key: "published" as const, label: "Published" },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${tab === t.key ? "bg-teal-500/20 text-teal-300" : "text-gray-400 hover:text-gray-200"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ─── GENERATE TAB ─── */}
        {tab === "generate" && (
          <div className="space-y-5">
            {/* Safeguards */}
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex items-start gap-3">
              <ShieldCheck size={15} className="text-teal-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-teal-300">Active safeguards</p>
                <p className="text-xs text-gray-400"><span className="text-gray-300 font-medium">Dedup:</span> AI receives all existing questions — no repeats. A post-generation filter removes near-duplicates.</p>
                <p className="text-xs text-gray-400"><span className="text-gray-300 font-medium">Rejection learning:</span> Recently rejected questions are passed back so the AI avoids the same mistakes.</p>
              </div>
            </div>

            {/* What gets generated */}
            <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">What gets generated — 14 days, 1 per day</p>
              <div className="space-y-2.5">
                {[
                  { icon: <Zap size={11} />, label: "5 Trivia", desc: "Trendy facts, casting drama, chart history, iconic moments", pillClass: "bg-teal-500/20 text-teal-300" },
                  { icon: <Shuffle size={11} />, label: "5 Opinion Polls", desc: "Fan debates, hot takes, team picks, finale verdicts", pillClass: "bg-purple-500/20 text-purple-300" },
                  { icon: <Sparkles size={11} />, label: "4 Predictions", desc: "Trending spec — renewals, feuds, award season, comeback rumors", pillClass: "bg-pink-500/20 text-pink-300" },
                ].map(({ icon, label, desc, pillClass }) => (
                  <div key={label} className="flex items-start gap-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${pillClass}`}>
                      {icon} {label}
                    </span>
                    <p className="text-xs text-gray-500 leading-snug pt-0.5">{desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 pt-2 border-t border-gray-800">Pop culture + entertainment. Uses live trending data from TMDB + Open Library.</p>
            </div>

            {/* Content Brief */}
            <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Content Brief <span className="text-gray-600 normal-case font-normal">(optional)</span></p>
                {contentBrief && (
                  <button onClick={() => setContentBrief("")} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Clear</button>
                )}
              </div>
              <p className="text-xs text-gray-500">Direct the AI to focus on a specific topic, show, or client. Leave blank for the default mix.</p>

              {/* Quick presets */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "🎬 Heavy Movies", value: "Focus heavily on movies and cinema — multiple eras, multiple genres, cast trivia, director history, box office moments" },
                  { label: "📺 Heavy TV", value: "Focus heavily on TV shows and streaming series — both current hits and classic shows, fan debates, showrunner history" },
                  { label: "🎵 Music Focus", value: "Focus heavily on music — artists, albums, chart history, Grammy moments, music videos, iconic performances, band drama" },
                  { label: "📚 Books & YA", value: "Focus heavily on books — bestsellers, literary adaptations, YA series, author history, book-to-screen comparisons" },
                  { label: "🌐 Pop Culture", value: "Focus on viral cultural moments, celebrity drama, award show moments, memes and phrases that defined the year" },
                  { label: "🏆 Awards Season", value: "Focus on Oscar history, Emmy moments, Grammy drama, award show predictions, historic wins and snubs" },
                  { label: "📡 Streaming Wars", value: "Focus on Netflix, HBO, Disney+, Amazon Prime — originals, cancellations, streaming hits and flops, platform rivalries" },
                ].map(({ label, value }) => (
                  <button
                    key={label}
                    onClick={() => setContentBrief(contentBrief === value ? "" : value)}
                    className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${contentBrief === value ? "bg-teal-500/20 border-teal-400 text-teal-200" : "bg-gray-800 border-gray-700 text-gray-400 hover:border-teal-500/40 hover:text-teal-300"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Custom brief text area */}
              <Textarea
                value={contentBrief}
                onChange={e => setContentBrief(e.target.value)}
                placeholder={`Or type your own brief — e.g. "We have a partnership with HBO this week — skew heavily toward HBO shows, Succession, The Wire, Euphoria, White Lotus. Mix in some fun pop culture."`}
                className="bg-gray-950 border-gray-700 text-white text-xs min-h-[72px] resize-none placeholder:text-gray-600"
              />

              {contentBrief.trim() && (
                <div className="flex items-start gap-2 p-2.5 bg-teal-500/5 border border-teal-500/20 rounded-lg">
                  <Sparkles size={11} className="text-teal-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-teal-300">Brief active — all 3 generation stages (trivia, polls, predictions) will use this directive</p>
                </div>
              )}
            </div>

            {/* Generate button */}
            {!generating && (
              <Button
                onClick={handleGenerateDailyPlays}
                className={`w-full py-4 font-bold rounded-xl text-base ${contentBrief.trim() ? "bg-teal-700 hover:bg-teal-600" : "bg-teal-600 hover:bg-teal-500"} text-white`}
              >
                <Sparkles size={18} className="mr-2" />
                {contentBrief.trim() ? "Generate 14 Daily Plays (with brief)" : "Generate 14 Daily Plays"}
              </Button>
            )}

            {/* Progress */}
            {generating && (
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-5">
                <div className="text-center">
                  <Loader2 size={28} className="animate-spin text-teal-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-white">{STAGE_LABELS[genStage] || "Working..."}</p>
                </div>
                <div className="space-y-2">
                  {[
                    { stage: "trivia", label: "Trivia", count: "5 questions", icon: <Zap size={11} />, pillClass: "bg-teal-500/20 text-teal-300" },
                    { stage: "poll", label: "Opinion Polls", count: "5 questions", icon: <Shuffle size={11} />, pillClass: "bg-purple-500/20 text-purple-300" },
                    { stage: "predict", label: "Predictions", count: "4 questions", icon: <Sparkles size={11} />, pillClass: "bg-pink-500/20 text-pink-300" },
                  ].map(({ stage, label, count, icon, pillClass }) => {
                    const stageIdx = DAILY_STAGE_ORDER.indexOf(genStage);
                    const myIdx = DAILY_STAGE_ORDER.indexOf(stage);
                    const isDone = myIdx < stageIdx;
                    const isActive = myIdx === stageIdx;
                    return (
                      <div key={stage} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${isActive ? "bg-teal-500/10 border border-teal-500/30" : isDone ? "opacity-50" : "opacity-30"}`}>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${pillClass}`}>
                          {icon} {label}
                        </span>
                        <span className="flex-1 text-xs text-gray-500">{count}</span>
                        {isDone && <Check size={14} className="text-teal-400" />}
                        {isActive && <Loader2 size={14} className="animate-spin text-teal-400" />}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-center text-gray-600">Don't close this page while generating</p>
              </div>
            )}

            {/* Write Your Own */}
            <div className="mt-2">
              <button
                onClick={() => setShowManualForm(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Pencil size={14} className="text-teal-400" />
                  <span className="text-sm font-medium text-gray-300">Write your own Today's Play</span>
                </div>
                {showManualForm ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
              </button>

              {showManualForm && (
                <div className="mt-2 bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">

                  {/* Play type selector */}
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Play type</label>
                    <div className="flex gap-2">
                      {[
                        { value: "trivia" as const, label: "Trivia", desc: "Has a correct answer" },
                        { value: "poll" as const, label: "Opinion Poll", desc: "No right answer" },
                        { value: "predict" as const, label: "Prediction", desc: "Forecast outcome" },
                      ].map(t => (
                        <button
                          key={t.value}
                          onClick={() => setManualPlayType(t.value)}
                          className={`flex-1 py-2 px-2 rounded-xl border text-center transition-all ${manualPlayType === t.value ? "bg-teal-500/20 border-teal-500/40 text-teal-300" : "bg-gray-800 border-gray-700 text-gray-500"}`}
                        >
                          <p className="text-xs font-semibold">{t.label}</p>
                          <p className="text-[10px] opacity-60 mt-0.5">{t.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Question</label>
                    <Textarea
                      value={manualTitle}
                      onChange={e => setManualTitle(e.target.value)}
                      placeholder={manualPlayType === "trivia" ? "e.g. What is the name of the coffee shop in Friends?" : "e.g. Who will win the Emmy for Best Drama this year?"}
                      className="bg-gray-800 border-gray-700 text-white resize-none h-20 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Answer options</label>
                    <div className="space-y-2">
                      {manualOptions.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            value={opt}
                            onChange={e => setManualOptions(prev => prev.map((o, idx) => idx === i ? e.target.value : o))}
                            placeholder={`Option ${String.fromCharCode(65 + i)}`}
                            className="bg-gray-800 border-gray-700 text-white text-sm flex-1"
                          />
                          {manualOptions.length > 2 && (
                            <button onClick={() => setManualOptions(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-500 hover:text-red-400">
                              <Minus size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                      {manualOptions.length < 5 && (
                        <button onClick={() => setManualOptions(prev => [...prev, ""])} className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 mt-1">
                          <Plus size={12} /> Add option
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Correct answer — trivia only */}
                  {manualPlayType === "trivia" && (
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Correct answer</label>
                      <select
                        value={manualAnswer}
                        onChange={e => setManualAnswer(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
                      >
                        <option value="">— select the correct answer —</option>
                        {manualOptions.filter(o => o.trim()).map((opt, i) => (
                          <option key={i} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Featured date — opinion/prediction publish directly, no draft stage */}
                  {manualPlayType !== "trivia" && (
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Featured date</label>
                      <Input
                        type="date"
                        value={manualFeaturedDate}
                        onChange={e => setManualFeaturedDate(e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white text-sm"
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Today's Play will show this question on this date instead of trivia.</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Media type</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: "movie", label: "Movie", icon: <Film size={11} />, cls: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
                          { value: "tv", label: "TV", icon: <Tv size={11} />, cls: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
                          { value: "book", label: "Book", icon: <BookOpen size={11} />, cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" },
                          { value: "music", label: "Music", icon: <Music2 size={11} />, cls: "bg-pink-500/20 text-pink-300 border-pink-500/40" },
                          { value: "podcast", label: "Podcast", icon: <Headphones size={11} />, cls: "bg-sky-500/20 text-sky-300 border-sky-500/40" },
                          { value: "gaming", label: "Gaming", icon: <Gamepad2 size={11} />, cls: "bg-violet-500/20 text-violet-300 border-violet-500/40" },
                          { value: "mixed", label: "Pop Culture", icon: <Zap size={11} />, cls: "bg-purple-500/20 text-purple-300 border-purple-500/40" },
                        ].map(m => (
                          <button
                            key={m.value}
                            onClick={() => { setManualMediaType(m.value); setManualMediaExternalId(null); setManualMediaExternalSource(null); }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${manualMediaType === m.value ? m.cls : "bg-gray-800 text-gray-500 border-gray-700"}`}
                          >
                            {m.icon} {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Show / media name</label>
                      <MediaSearchPicker
                        mediaType={manualMediaType}
                        value={manualShowTag}
                        externalId={manualMediaExternalId}
                        externalSource={manualMediaExternalSource}
                        onSelect={(result, rawTitle) => {
                          setManualShowTag(rawTitle);
                          setManualMediaExternalId(result?.external_id || null);
                          setManualMediaExternalSource(result?.external_source || null);
                          if (result?.type && result.type !== "mixed") setManualMediaType(result.type);
                        }}
                      />
                    </div>
                  </div>

                  <Button
                    onClick={manualPlayType === "trivia" ? handleSaveManualTrivia : handleSaveManualOpinion}
                    disabled={savingManual}
                    className="w-full bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 font-semibold rounded-xl"
                  >
                    {savingManual
                      ? <><Loader2 size={14} className="animate-spin mr-2" /> Saving...</>
                      : manualPlayType === "trivia"
                        ? <><Send size={14} className="mr-2" /> Save to Drafts</>
                        : <><CalendarDays size={14} className="mr-2" /> Schedule Today's Play</>
                    }
                  </Button>
                </div>
              )}
            </div>

            {/* Scheduled queue preview */}
            {scheduled.length > 0 && (
              <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Already scheduled</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {scheduled.map(({ date, questions }) => (
                    <div key={date} className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">{date}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${questions.length >= 1 ? "bg-teal-500/20 text-teal-300" : "bg-yellow-500/20 text-yellow-300"}`}>
                        {questions.length} scheduled
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── DRAFTS TAB ─── */}
        {tab === "drafts" && (
          <div className="space-y-4">
            {drafts.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p className="font-medium">No pending drafts</p>
                <p className="text-sm mt-1">Go to Generate to create question sets</p>
              </div>
            )}

            {/* Pending drafts */}
            {drafts.length > 0 && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{drafts.length} Pending Questions</p>
                  <div className="flex items-center gap-3">
                    {duplicateMap.size > 0 && (
                      <button
                        onClick={async () => {
                          const removed = await purgeDuplicates(drafts);
                          if (removed > 0) toast({ title: `Removed ${removed} duplicate${removed !== 1 ? "s" : ""}` });
                          else toast({ title: "No duplicates to remove" });
                        }}
                        className="text-xs font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1.5 transition-colors"
                      >
                        <X size={12} />
                        Remove {duplicateMap.size} Duplicate{duplicateMap.size !== 1 ? "s" : ""}
                      </button>
                    )}
                    <button
                      onClick={reshuffleAnswers}
                      className="text-xs font-semibold text-gray-500 hover:text-gray-300 flex items-center gap-1.5 transition-colors"
                    >
                      <Shuffle size={12} />
                      Reshuffle Answers
                    </button>
                  </div>
                </div>

                {/* Step prompt — only shown when nothing has been grouped yet */}
                {Object.keys(dates).length === 0 && (
                  <div className="bg-teal-500/10 border border-teal-500/30 rounded-2xl p-4 flex items-start gap-3">
                    <CalendarDays size={18} className="text-teal-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-teal-300">Ready to schedule?</p>
                      <p className="text-xs text-gray-400 mt-0.5">Hit "Suggest Dates" and we'll group your questions into day sets — one Movie, Book, and TV per day. Then one tap schedules the whole day.</p>
                    </div>
                    <button
                      onClick={suggestDates}
                      className="flex-shrink-0 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <CalendarDays size={12} />
                      Suggest Dates
                    </button>
                  </div>
                )}

                {/* When dates are assigned, show a small re-suggest link */}
                {Object.keys(dates).length > 0 && (
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => suggestDates(true)}
                      className="text-xs text-gray-600 hover:text-teal-400 flex items-center gap-1 transition-colors"
                    >
                      <CalendarDays size={11} /> Re-suggest dates
                    </button>
                  </div>
                )}
                {(() => {
                  // Group drafts by assigned date
                  const grouped: Record<string, Draft[]> = {};
                  const ungrouped: Draft[] = [];
                  drafts.forEach(d => {
                    const ds = dates[d.id];
                    if (ds) { if (!grouped[ds]) grouped[ds] = []; grouped[ds].push(d); }
                    else ungrouped.push(d);
                  });
                  const sortedDates = Object.keys(grouped).sort();

                  // Reusable question card (expanded/edit)
                  const DraftCard = ({ draft, showDatePicker }: { draft: Draft; showDatePicker?: boolean }) => {
                    const meta = typeMeta(draft);
                    const isEditing = editingId === draft.id;
                    const pickedDate = dates[draft.id] || "";
                    const dateTaken = pickedDate ? scheduledDates.has(pickedDate) : false;
                    const dateSetCount = pickedDate ? (scheduled.find(s => s.date === pickedDate)?.questions.length ?? 0) : 0;
                    const dupWarning = duplicateMap.get(draft.id);
                    return (
                      <div className={`bg-gray-900 border rounded-2xl overflow-hidden ${dupWarning ? "border-orange-500/40" : "border-gray-800"}`}>
                        <button
                          onClick={() => setExpandedId(expandedId === draft.id ? null : draft.id)}
                          className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800/40 transition-colors"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${meta.pillClass}`}>
                              {meta.icon} {meta.label}
                            </span>
                            <p className="text-sm text-white font-medium flex-1">{draft.title}</p>
                            {!draft.show_tag && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30 flex-shrink-0" title="No show_tag — cannot publish">
                                <AlertTriangle size={9} /> No Media
                              </span>
                            )}
                            {dupWarning && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/30 flex-shrink-0">
                                <AlertTriangle size={9} /> Dup
                              </span>
                            )}
                          </div>
                          {expandedId === draft.id ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0 ml-2" /> : <ChevronDown size={14} className="text-gray-400 flex-shrink-0 ml-2" />}
                        </button>
                        {expandedId === draft.id && (
                          <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-3">
                            {!isEditing ? (
                              <>
                                {dupWarning && (
                                  <div className="flex items-start gap-1.5 bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-2">
                                    <AlertTriangle size={12} className="text-orange-400 flex-shrink-0 mt-px" />
                                    <p className="text-xs text-orange-300 leading-snug">{dupWarning}</p>
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-1.5">
                                  {draft.options.map((opt, i) => (
                                    <span key={i} className={`text-xs px-2.5 py-1 rounded-full ${opt === draft.correct_answer ? "bg-teal-500/30 text-teal-200 border border-teal-500/40" : "bg-gray-800 text-gray-300"}`}>
                                      {opt === draft.correct_answer && <Check size={9} className="inline mr-0.5 mb-px" />}
                                      {opt}
                                    </span>
                                  ))}
                                </div>
                                <button onClick={() => startEdit(draft)} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors">
                                  <Pencil size={11} /> Edit question
                                </button>
                              </>
                            ) : (
                              <div className="space-y-3">
                                <Textarea value={editTitle} onChange={e => setEditTitle(e.target.value)} className="bg-black/30 border-white/10 text-white text-sm resize-none h-16" />
                                <div className="space-y-1.5">
                                  {editOptions.map((opt, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                      <button onClick={() => setEditAnswer(opt)} className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all ${editAnswer === opt ? "border-teal-400 bg-teal-400" : "border-gray-600"}`} />
                                      <Input value={opt} onChange={e => { const o = [...editOptions]; o[i] = e.target.value; setEditOptions(o); }} className="bg-black/30 border-white/10 text-white text-xs h-7" />
                                    </div>
                                  ))}
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-xs text-gray-500">Media / Show tag</p>
                                    <select
                                      value={editMediaType}
                                      onChange={e => { setEditMediaType(e.target.value); setEditMediaExternalId(null); setEditMediaExternalSource(null); }}
                                      className="bg-black/30 border border-white/10 text-white text-xs rounded-md px-2 h-6 flex-shrink-0 ml-auto"
                                    >
                                      <option value="tv">TV</option>
                                      <option value="movie">Movie</option>
                                      <option value="book">Book</option>
                                      <option value="music">Music</option>
                                      <option value="podcast">Podcast</option>
                                      <option value="gaming">Gaming</option>
                                      <option value="mixed">Pop Culture</option>
                                    </select>
                                  </div>
                                  <MediaSearchPicker
                                    mediaType={editMediaType}
                                    value={editShowTag}
                                    externalId={editMediaExternalId}
                                    externalSource={editMediaExternalSource}
                                    onSelect={(result, rawTitle) => {
                                      setEditShowTag(rawTitle);
                                      setEditMediaExternalId(result?.external_id || null);
                                      setEditMediaExternalSource(result?.external_source || null);
                                      if (result?.type && result.type !== "mixed") setEditMediaType(result.type);
                                    }}
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button onClick={() => saveEdit(draft)} size="sm" className="bg-teal-600 hover:bg-teal-500 text-white flex-1"><Check size={12} className="mr-1" /> Save</Button>
                                  <Button onClick={() => setEditingId(null)} size="sm" variant="ghost" className="text-gray-400">Cancel</Button>
                                </div>
                              </div>
                            )}
                            {showDatePicker && (
                              <>
                                <div className="flex items-center gap-2">
                                  <CalendarDays size={14} className="text-gray-400 flex-shrink-0" />
                                  <Input type="date" value={pickedDate} onChange={e => setDates(d => ({ ...d, [draft.id]: e.target.value }))} className={`bg-gray-800 border-gray-700 text-white h-8 text-sm flex-1 ${dateTaken ? "border-orange-500/50" : ""}`} />
                                </div>
                                {dateTaken && <div className="flex items-center gap-1.5 text-orange-400"><AlertTriangle size={11} /><p className="text-xs">{dateSetCount} question{dateSetCount !== 1 ? "s" : ""} already on {pickedDate}</p></div>}
                                <div className="flex gap-2">
                                  <Button onClick={() => publishDraft(draft)} disabled={publishingId === draft.id || !pickedDate || !draft.show_tag} size="sm" className={`text-white font-semibold flex-1 ${draft.show_tag ? "bg-teal-600 hover:bg-teal-500" : "bg-gray-600 cursor-not-allowed opacity-50"}`} title={!draft.show_tag ? "Cannot schedule — no media tag (show_tag missing)" : undefined}>
                                    {publishingId === draft.id ? <Loader2 size={13} className="animate-spin mr-1" /> : <Send size={13} className="mr-1" />}
                                    Schedule
                                  </Button>
                                  <Button onClick={() => deleteDraft(draft.id)} size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10"><X size={13} /></Button>
                                </div>
                              </>
                            )}
                            {!showDatePicker && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <select
                                    defaultValue=""
                                    onChange={e => {
                                      const val = e.target.value;
                                      if (!val) return;
                                      if (val === "__ungroup__") {
                                        setDates(d => { const u = { ...d }; delete u[draft.id]; return u; });
                                      } else {
                                        setDates(d => ({ ...d, [draft.id]: val }));
                                      }
                                      e.currentTarget.value = "";
                                    }}
                                    className="flex-1 bg-gray-800 border border-gray-700 text-xs text-gray-300 rounded-lg px-2 py-1.5 h-8"
                                  >
                                    <option value="">Move to another day...</option>
                                    {sortedDates.filter(d => d !== dates[draft.id]).map(d => (
                                      <option key={d} value={d}>
                                        {new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                      </option>
                                    ))}
                                    <option value="__ungroup__">Remove date (leave unscheduled)</option>
                                  </select>
                                  <button
                                    onClick={() => { setRejectingId(rejectingId === draft.id ? null : draft.id); setRejectReason(""); }}
                                    className="text-xs px-2 py-1 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20 transition-colors flex-shrink-0"
                                    title="Reject with feedback for AI"
                                  >
                                    Reject
                                  </button>
                                  <Button
                                    onClick={() => deleteDraft(draft.id)}
                                    size="sm"
                                    variant="ghost"
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 flex-shrink-0"
                                    title="Delete question"
                                  >
                                    <X size={13} />
                                  </Button>
                                </div>

                                {/* Reject with reason — inline */}
                                {rejectingId === draft.id && (
                                  <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-3 space-y-2">
                                    <p className="text-xs text-orange-300 font-medium">Tell the AI why this isn't right — it'll avoid this next time</p>
                                    <div className="flex gap-2 flex-wrap">
                                      {[
                                        "Too much content about this show already",
                                        "Wrong topic — not what our audience watches",
                                        "Too obscure",
                                        "Too obvious / boring",
                                        "Bad answer options",
                                        "Factually wrong",
                                      ].map(preset => (
                                        <button
                                          key={preset}
                                          onClick={() => setRejectReason(preset)}
                                          className={`text-xs px-2 py-1 rounded-full border transition-colors ${rejectReason === preset ? "bg-orange-500/30 border-orange-400 text-orange-200" : "bg-gray-800 border-gray-700 text-gray-400 hover:border-orange-500/40 hover:text-orange-300"}`}
                                        >
                                          {preset}
                                        </button>
                                      ))}
                                    </div>
                                    <Input
                                      value={rejectReason}
                                      onChange={e => setRejectReason(e.target.value)}
                                      placeholder="Or type your own reason..."
                                      className="bg-gray-900 border-gray-700 text-white text-xs h-8"
                                    />
                                    <div className="flex gap-2">
                                      <Button
                                        onClick={() => rejectDraft(draft.id, rejectReason)}
                                        size="sm"
                                        className="bg-orange-600 hover:bg-orange-500 text-white text-xs"
                                      >
                                        Send Feedback &amp; Remove
                                      </Button>
                                      <Button
                                        onClick={() => { setRejectingId(null); setRejectReason(""); }}
                                        size="sm"
                                        variant="ghost"
                                        className="text-gray-400 text-xs"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  };

                  return (
                    <>
                      {/* ── Day Groups ── */}
                      {sortedDates.map(dateStr => {
                        const group = grouped[dateStr];
                        const isSchedulingGroup = publishingGroup === dateStr;
                        const dateLabel = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' });
                        const alreadyCount = scheduled.find(s => s.date === dateStr)?.questions.length ?? 0;
                        return (
                          <div key={dateStr} className="bg-gray-900/60 border border-teal-500/20 rounded-2xl overflow-hidden">
                            {/* Day header */}
                            <div className="flex items-center justify-between px-4 py-3 bg-teal-500/10 border-b border-teal-500/20">
                              <div>
                                <p className="text-sm font-bold text-teal-300">{dateLabel}</p>
                                <p className="text-xs text-gray-500">{group.length} question{group.length !== 1 ? "s" : ""}{alreadyCount > 0 ? ` · ${alreadyCount} already on this date` : ""}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="date"
                                  value={dateStr}
                                  onChange={e => {
                                    const newDate = e.target.value;
                                    if (!newDate) return;
                                    setDates(d => {
                                      const updated = { ...d };
                                      group.forEach(dr => { updated[dr.id] = newDate; });
                                      return updated;
                                    });
                                  }}
                                  className="bg-gray-800 border-gray-700 text-white h-7 text-xs w-36"
                                />
                                <Button
                                  onClick={() => scheduleGroup(dateStr, group)}
                                  disabled={isSchedulingGroup}
                                  size="sm"
                                  className="bg-teal-600 hover:bg-teal-500 text-white font-bold whitespace-nowrap"
                                >
                                  {isSchedulingGroup ? <Loader2 size={13} className="animate-spin mr-1" /> : <Send size={13} className="mr-1" />}
                                  Schedule Day
                                </Button>
                              </div>
                            </div>
                            {/* Questions in group */}
                            <div className="p-3 space-y-2">
                              {group.map(draft => <DraftCard key={draft.id} draft={draft} showDatePicker={false} />)}

                              {/* Add question to group */}
                              {ungrouped.length > 0 && addingToDate !== dateStr && (
                                <button
                                  onClick={() => setAddingToDate(dateStr)}
                                  className="w-full flex items-center justify-center gap-1.5 py-2 mt-1 rounded-xl border border-dashed border-gray-700 text-xs text-gray-500 hover:text-teal-400 hover:border-teal-500/40 transition-colors"
                                >
                                  <Plus size={12} /> Add question to this day
                                </button>
                              )}

                              {/* Picker — shows ungrouped drafts to assign */}
                              {addingToDate === dateStr && (
                                <div className="border border-teal-500/30 rounded-xl bg-gray-900/80 overflow-hidden mt-1">
                                  <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
                                    <p className="text-xs font-semibold text-teal-300">Pick a question to add</p>
                                    <button onClick={() => setAddingToDate(null)} className="text-gray-500 hover:text-white transition-colors"><X size={13} /></button>
                                  </div>
                                  <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                                    {ungrouped.map(ud => {
                                      const um = typeMeta(ud);
                                      return (
                                        <button
                                          key={ud.id}
                                          onClick={() => {
                                            setDates(d => ({ ...d, [ud.id]: dateStr }));
                                            setAddingToDate(null);
                                          }}
                                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-800 text-left transition-colors"
                                        >
                                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${um.pillClass}`}>
                                            {um.icon} {um.label}
                                          </span>
                                          <p className="text-xs text-gray-300 line-clamp-1 flex-1">{ud.title}</p>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* ── Ungrouped (no date assigned yet) ── */}
                      {ungrouped.length > 0 && (
                        <>
                          {sortedDates.length > 0 && (
                            <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold pt-2">Unassigned questions</p>
                          )}
                          {ungrouped.map(draft => <DraftCard key={draft.id} draft={draft} showDatePicker={true} />)}
                        </>
                      )}
                    </>
                  );
                })()}
              </>
            )}

          </div>
        )}

        {/* ─── SCHEDULED TAB ─── */}
        {tab === "scheduled" && (
          <div className="space-y-4">
            {scheduled.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="font-medium">Nothing scheduled yet</p>
                <p className="text-sm mt-1">Assign dates to drafts and publish them</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{scheduled.length} dates scheduled</p>
                  <button
                    onClick={suggestDates}
                    className="text-xs font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1.5 transition-colors"
                  >
                    <CalendarDays size={12} /> Suggest Dates
                  </button>
                </div>
                {scheduled.map(({ date, questions }) => {
                  const isEditingThis = editingScheduledDate === date;
                  return (
                    <div key={date} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-bold text-white">{date}</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${questions.length >= 1 ? "bg-teal-500/20 text-teal-300" : "bg-yellow-500/20 text-yellow-300"}`}>
                            {questions.length} scheduled
                          </span>
                          <button
                            onClick={() => {
                              if (isEditingThis) {
                                setEditingScheduledDate(null);
                                setNewDateForEdit("");
                              } else {
                                setEditingScheduledDate(date);
                                setNewDateForEdit("");
                              }
                            }}
                            className="text-xs px-2 py-0.5 rounded-md bg-gray-800 text-gray-400 hover:text-teal-300 hover:bg-gray-700 transition-colors border border-gray-700"
                          >
                            Reschedule
                          </button>
                        </div>
                      </div>

                      {/* Inline reschedule */}
                      {isEditingThis && (
                        <div className="mb-3 p-3 bg-gray-800/60 rounded-xl space-y-2">
                          <p className="text-xs text-gray-400">Pick a new date for this question:</p>
                          <div className="flex items-center gap-2">
                            <Input
                              type="date"
                              value={newDateForEdit}
                              min={toLocalDateStr(new Date())}
                              onChange={e => setNewDateForEdit(e.target.value)}
                              className="bg-gray-900 border-gray-700 text-white h-8 text-sm flex-1"
                            />
                            <Button
                              onClick={() => moveScheduledDate(date, newDateForEdit)}
                              disabled={movingDate || !newDateForEdit || newDateForEdit === date}
                              size="sm"
                              className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-4 whitespace-nowrap"
                            >
                              {movingDate ? <Loader2 size={11} className="animate-spin" /> : "Move"}
                            </Button>
                            <button onClick={() => { setEditingScheduledDate(null); setNewDateForEdit(""); }} className="text-gray-500 hover:text-white transition-colors flex-shrink-0">
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="space-y-1">
                        {questions.map(q => (
                          <div key={q.id} className="flex items-center gap-2 group">
                            <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded flex-shrink-0">{q.category || "?"}</span>
                            <p className="text-xs text-gray-400 line-clamp-1 flex-1">{q.title}</p>
                            <button
                              onClick={() => unscheduleQuestion(q.id)}
                              disabled={unschedulingId === q.id}
                              title="Remove — moves back to Drafts"
                              className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all disabled:opacity-50"
                            >
                              {unschedulingId === q.id
                                ? <Loader2 size={11} className="animate-spin text-gray-400" />
                                : <X size={11} />}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ─── PUBLISHED TAB ─── */}
        {tab === "published" && (
          <div className="space-y-4">
            {published.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="font-medium">Nothing live today</p>
                <p className="text-sm mt-1">Today's 3-question set will appear here once published</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Today's live set</p>
                {published.map(({ date, questions }) => (
                  <div key={date} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 opacity-70">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-white">{date}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-700 text-gray-400">
                        {questions.length} questions
                      </span>
                    </div>
                    <div className="space-y-1">
                      {questions.map(q => (
                        <div key={q.id} className="flex items-start gap-2">
                          <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded flex-shrink-0">{q.category || "?"}</span>
                          <p className="text-xs text-gray-500 line-clamp-1">{q.title}</p>
                        </div>
                      ))}
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
