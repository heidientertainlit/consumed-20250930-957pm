import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Sparkles, Loader2, Check, X, CalendarDays, Send,
  ChevronDown, ChevronUp, ShieldCheck, AlertTriangle, Film, BookOpen, Zap, Pencil,
  Tv, Music2, Headphones, Gamepad2, Shuffle, Plus,
} from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Draft = {
  id: string;
  title: string;
  options: string[];
  correct_answer: string | null;
  category: string;
  media_type: string | null;
  featured_date: string | null;
  status: string;
  created_at: string;
};

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
    categoryHint: "Podcast",
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
  if (draft.category === "Podcast") return EXTRA_SLOTS[2];
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

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editAnswer, setEditAnswer] = useState("");

  // Pending drafts
  const { data: drafts = [], refetch: refetchDrafts } = useQuery<Draft[]>({
    queryKey: ["todays-play-drafts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("trivia_poll_drafts")
        .select("id, title, options, correct_answer, category, media_type, featured_date, status, created_at")
        .eq("content_type", "trivia")
        .in("status", ["draft", "pending"])
        .order("created_at", { ascending: false })
        .limit(90);
      return data || [];
    },
  });

  // Published (past scheduled) trivia
  const { data: published = [] } = useQuery<{ date: string; questions: any[] }[]>({
    queryKey: ["todays-play-published"],
    queryFn: async () => {
      const today = toLocalDateStr(new Date());
      const { data } = await supabase
        .from("prediction_pools")
        .select("id, title, category, featured_date")
        .eq("type", "trivia")
        .not("featured_date", "is", null)
        .lt("featured_date", today)
        .order("featured_date", { ascending: false })
        .limit(60);
      if (!data) return [];
      const byDate: Record<string, any[]> = {};
      for (const row of data) {
        if (!byDate[row.featured_date]) byDate[row.featured_date] = [];
        byDate[row.featured_date].push(row);
      }
      return Object.entries(byDate).map(([date, questions]) => ({ date, questions }));
    },
  });

  // Scheduled (published) sets
  const { data: scheduled = [], refetch: refetchScheduled } = useQuery<{ date: string; questions: any[] }[]>({
    queryKey: ["todays-play-scheduled"],
    queryFn: async () => {
      const today = toLocalDateStr(new Date());
      const { data } = await supabase
        .from("prediction_pools")
        .select("id, title, category, featured_date")
        .eq("type", "trivia")
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

  function suggestDates() {
    // Only assign to drafts that don't already have a date pending and aren't duplicates
    const dupIds = new Set(computeDuplicateIds(drafts, scheduled, published));
    const unassigned = drafts.filter(d => !dates[d.id] && !dupIds.has(d.id));
    const movieDrafts = [...unassigned.filter(d => typeMeta(d).mediaType === "movie")];
    const bookDrafts  = [...unassigned.filter(d => typeMeta(d).mediaType === "book")];
    const tvDrafts    = [...unassigned.filter(d => typeMeta(d).mediaType === "tv")];
    const extraDrafts = [...unassigned.filter(d => !["movie", "book", "tv"].includes(typeMeta(d).mediaType))];
    const maxSets = Math.max(movieDrafts.length, bookDrafts.length, tvDrafts.length);

    // Count pending (state) assignments per date
    const pendingCount: Record<string, number> = {};
    Object.values(dates).forEach(ds => { if (ds) pendingCount[ds] = (pendingCount[ds] ?? 0) + 1; });

    // A date is "full" if it has 3+ scheduled (DB) OR 3+ pending draft assignments (state)
    const fullDates = new Set([
      ...scheduled.filter(s => s.questions.length >= 3).map(s => s.date),
      ...Object.entries(pendingCount).filter(([, c]) => c >= 3).map(([d]) => d),
    ]);

    const freeDates: string[] = [];
    const cursor = new Date();
    cursor.setDate(cursor.getDate() + 1);
    while (freeDates.length < maxSets && freeDates.length < 60) {
      const ds = toLocalDateStr(cursor);
      if (!fullDates.has(ds)) freeDates.push(ds);
      cursor.setDate(cursor.getDate() + 1);
    }

    const newDates: Record<string, string> = { ...dates };
    let mi = 0, bi = 0, ti = 0, ei = 0;

    for (let dayIdx = 0; dayIdx < freeDates.length; dayIdx++) {
      const dateStr = freeDates[dayIdx];
      // Every 3rd day (dayIdx 2, 5, 8…) swap one primary slot out for an extra
      const useExtra = extraDrafts.length > 0 && ei < extraDrafts.length && dayIdx % 3 === 2;

      if (useExtra) {
        // Which primary to drop rotates: 0=movie, 1=book, 2=tv
        const dropSlot = Math.floor(dayIdx / 3) % 3;
        newDates[extraDrafts[ei++].id] = dateStr;
        if (dropSlot !== 0 && movieDrafts[mi]) newDates[movieDrafts[mi++].id] = dateStr;
        if (dropSlot !== 1 && bookDrafts[bi])  newDates[bookDrafts[bi++].id]  = dateStr;
        if (dropSlot !== 2 && tvDrafts[ti])    newDates[tvDrafts[ti++].id]    = dateStr;
      } else {
        // Standard day: one of each primary
        if (movieDrafts[mi]) newDates[movieDrafts[mi++].id] = dateStr;
        if (bookDrafts[bi])  newDates[bookDrafts[bi++].id]  = dateStr;
        if (tvDrafts[ti])    newDates[tvDrafts[ti++].id]    = dateStr;
      }
    }

    setDates(newDates);
  }

  async function callGenerate(slot: SlotMeta, count = 14) {
    const { data: { session: s } } = await supabase.auth.getSession();
    const resp = await fetch(`${supabaseUrl}/functions/v1/generate-trivia-polls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${s?.access_token}`,
        "apikey": supabaseAnonKey,
      },
      body: JSON.stringify({
        contentType: "trivia",
        count,
        mediaType: slot.mediaType,
        focusTopic: slot.focusTopic,
        difficulty: "medium",
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

  async function handleGenerate() {
    setGenStage("movie");
    let movieCount = 0, bookCount = 0, tvCount = 0;
    try {
      const r1 = await callGenerate(PRIMARY_SLOTS[0]);
      movieCount = r1.generated ?? 0;
      setGenStage("book");
      const r2 = await callGenerate(PRIMARY_SLOTS[1]);
      bookCount = r2.generated ?? 0;
      setGenStage("tv");
      const r3 = await callGenerate(PRIMARY_SLOTS[2]);
      tvCount = r3.generated ?? 0;
      setGenStage("done");

      const refetchResult = await refetchDrafts();
      const removed = await purgeDuplicates(refetchResult.data ?? []);
      const total = movieCount + bookCount + tvCount;
      toast({
        title: `Generated ${total} questions${removed > 0 ? `, removed ${removed} duplicate${removed !== 1 ? "s" : ""}` : ""}`,
        description: `${movieCount} Movie · ${bookCount} Book · ${tvCount} TV — review in Drafts.`,
      });
      setTab("drafts");
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenStage("idle");
    }
  }

  async function handleGenerateExtras() {
    setExtrasStage("music");
    let musicCount = 0, podcastCount = 0, gamingCount = 0;
    try {
      const r1 = await callGenerate(EXTRA_SLOTS[0], 6);
      musicCount = r1.generated ?? 0;
      setExtrasStage("podcast");
      const r2 = await callGenerate(EXTRA_SLOTS[1], 6);
      podcastCount = r2.generated ?? 0;
      setExtrasStage("gaming");
      const r3 = await callGenerate(EXTRA_SLOTS[2], 6);
      gamingCount = r3.generated ?? 0;
      setExtrasStage("done");
      const refetchResult = await refetchDrafts();
      const removed = await purgeDuplicates(refetchResult.data ?? []);
      const total = musicCount + podcastCount + gamingCount;
      toast({
        title: `Generated ${total} extra questions${removed > 0 ? `, removed ${removed} duplicate${removed !== 1 ? "s" : ""}` : ""}`,
        description: `${musicCount} Music · ${podcastCount} Podcast · ${gamingCount} Gaming — review in Queue.`,
      });
      setTab("drafts");
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setExtrasStage("idle");
    }
  }

  async function publishDraft(draft: Draft) {
    const dateStr = dates[draft.id];
    if (!dateStr) { toast({ title: "Pick a date first", variant: "destructive" }); return; }
    setPublishingId(draft.id);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const meta = typeMeta(draft);
      const poolData = {
        id: crypto.randomUUID(),
        title: draft.title,
        type: "trivia",
        options: draft.options,
        correct_answer: draft.correct_answer || null,
        category: meta.categoryHint,
        featured_date: dateStr,
        status: "open",
        origin_type: "consumed",
        inline: true,
        icon: "help-circle",
        points_reward: 10,
      };
      const resp = await fetch(`${supabaseUrl}/functions/v1/generate-trivia-polls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${s?.access_token}`,
          "apikey": supabaseAnonKey,
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
    await refetchDrafts();
  }

  async function scheduleGroup(dateStr: string, groupDrafts: Draft[]) {
    // Block if this date already has any of the same categories (true duplicate prevention)
    const existingCategories = new Set(
      scheduled.find(s => s.date === dateStr)?.questions.map(q => q.category) ?? []
    );
    const incomingCategories = groupDrafts.map(d => typeMeta(d).categoryHint);
    const dupes = incomingCategories.filter(c => existingCategories.has(c));
    if (dupes.length > 0) {
      toast({
        title: "Duplicate categories on this date",
        description: `${dateStr} already has: ${dupes.join(", ")}. Change the date or remove the duplicates.`,
        variant: "destructive",
      });
      return;
    }

    setPublishingGroup(dateStr);
    let succeeded = 0;
    for (const draft of groupDrafts) {
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        const meta = typeMeta(draft);
        const poolData = {
          id: crypto.randomUUID(),
          title: draft.title,
          type: "trivia",
          options: draft.options,
          correct_answer: draft.correct_answer || null,
          category: meta.categoryHint,
          featured_date: dateStr,
          status: "open",
          origin_type: "consumed",
          inline: true,
          icon: "help-circle",
          points_reward: 10,
        };
        const resp = await fetch(`${supabaseUrl}/functions/v1/generate-trivia-polls`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${s?.access_token}`,
            "apikey": supabaseAnonKey,
          },
          body: JSON.stringify({ action: "publish", poolData, draftId: draft.id }),
        });
        const result = await resp.json();
        if (resp.ok && !result.error) succeeded++;
      } catch { /* continue */ }
    }
    setPublishingGroup(null);
    toast({ title: `Scheduled ${succeeded}/${groupDrafts.length} questions for ${dateStr}` });
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
      const resp = await fetch(`${supabaseUrl}/functions/v1/generate-trivia-polls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${s?.access_token}`,
          "apikey": supabaseAnonKey,
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

  function startEdit(draft: Draft) {
    setEditingId(draft.id);
    setEditTitle(draft.title);
    setEditOptions(draft.options || []);
    setEditAnswer(draft.correct_answer || "");
  }

  async function saveEdit(draft: Draft) {
    await supabase.from("trivia_poll_drafts").update({
      title: editTitle,
      options: editOptions,
      correct_answer: editAnswer || null,
    }).eq("id", draft.id);
    setEditingId(null);
    await refetchDrafts();
  }

  const generating = !["idle", "done"].includes(genStage);
  const generatingExtras = !["idle", "done"].includes(extrasStage);

  const PRIMARY_STAGE_ORDER = ["movie", "book", "tv"];
  const EXTRA_STAGE_ORDER = ["music", "podcast", "gaming"];

  const STAGE_LABELS: Record<string, string> = {
    movie: "Generating Movie questions...",
    book: "Generating Book questions...",
    tv: "Generating TV / Shows questions...",
    pop: "Generating Pop Culture questions...",
    music: "Generating Music questions...",
    podcast: "Generating Podcast questions...",
    gaming: "Generating Gaming questions...",
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
            <p className="text-gray-400 text-sm mt-0.5">3-question trivia sets — movie, book, TV</p>
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

            {/* Primary slots */}
            <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Daily core (14 each)</p>
              {PRIMARY_SLOTS.map(meta => (
                <div key={meta.mediaType} className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.pillClass}`}>
                    {meta.icon} {meta.label}
                  </span>
                  <span className="text-xs text-gray-500">14 questions</span>
                </div>
              ))}
              <p className="text-xs text-gray-500 pt-1 border-t border-gray-800">56 total — 4 per day: Movie + Book + TV + Pop Culture</p>
            </div>

            {/* Generate primary button */}
            {!generating && !generatingExtras && (
              <Button
                onClick={handleGenerate}
                className="w-full py-4 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-base"
              >
                <Sparkles size={18} className="mr-2" />
                Generate 14 Days of Questions
              </Button>
            )}

            {/* Primary progress */}
            {generating && (
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-5">
                <div className="text-center">
                  <Loader2 size={28} className="animate-spin text-teal-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-white">{STAGE_LABELS[genStage] || "Working..."}</p>
                </div>
                <div className="space-y-2">
                  {PRIMARY_SLOTS.map((meta, i) => {
                    const stageIdx = PRIMARY_STAGE_ORDER.indexOf(genStage);
                    const isDone = i < stageIdx;
                    const isActive = i === stageIdx;
                    return (
                      <div key={meta.mediaType} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${isActive ? "bg-teal-500/10 border border-teal-500/30" : isDone ? "opacity-50" : "opacity-30"}`}>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${meta.pillClass}`}>
                          {meta.icon} {meta.label}
                        </span>
                        <span className="flex-1 text-xs text-gray-500">14 questions</span>
                        {isDone && <Check size={14} className="text-teal-400" />}
                        {isActive && <Loader2 size={14} className="animate-spin text-teal-400" />}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-center text-gray-600">Don't close this page while generating</p>
              </div>
            )}

            {/* Extra slots */}
            <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Extras — less frequent (6 each)</p>
              {EXTRA_SLOTS.map(meta => (
                <div key={meta.mediaType} className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.pillClass}`}>
                    {meta.icon} {meta.label}
                  </span>
                  <span className="text-xs text-gray-500">6 questions</span>
                </div>
              ))}
              <p className="text-xs text-gray-500 pt-1 border-t border-gray-800">Mix into the schedule manually — swap in occasionally for variety.</p>
            </div>

            {/* Generate extras button */}
            {!generating && !generatingExtras && (
              <Button
                onClick={handleGenerateExtras}
                variant="outline"
                className="w-full py-3 border-purple-600 bg-purple-950/60 text-purple-200 hover:bg-purple-900/60 hover:text-white hover:border-purple-500 rounded-xl"
              >
                <Sparkles size={15} className="mr-2" />
                Generate Extras (Music · Podcast · Gaming)
              </Button>
            )}

            {/* Extras progress */}
            {generatingExtras && (
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-5">
                <div className="text-center">
                  <Loader2 size={28} className="animate-spin text-purple-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-white">{STAGE_LABELS[extrasStage] || "Working..."}</p>
                </div>
                <div className="space-y-2">
                  {EXTRA_SLOTS.map((meta, i) => {
                    const stageIdx = EXTRA_STAGE_ORDER.indexOf(extrasStage);
                    const isDone = i < stageIdx;
                    const isActive = i === stageIdx;
                    return (
                      <div key={meta.mediaType} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${isActive ? "bg-purple-500/10 border border-purple-500/30" : isDone ? "opacity-50" : "opacity-30"}`}>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${meta.pillClass}`}>
                          {meta.icon} {meta.label}
                        </span>
                        <span className="flex-1 text-xs text-gray-500">6 questions</span>
                        {isDone && <Check size={14} className="text-teal-400" />}
                        {isActive && <Loader2 size={14} className="animate-spin text-purple-400" />}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-center text-gray-600">Don't close this page while generating</p>
              </div>
            )}

            {/* Scheduled queue preview */}
            {scheduled.length > 0 && (
              <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Already scheduled</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {scheduled.map(({ date, questions }) => (
                    <div key={date} className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">{date}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${questions.length >= 3 ? "bg-teal-500/20 text-teal-300" : "bg-yellow-500/20 text-yellow-300"}`}>
                        {questions.length}/3
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
                      onClick={suggestDates}
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
                            <p className="text-sm text-white font-medium line-clamp-1 flex-1">{draft.title}</p>
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
                                  <Button onClick={() => publishDraft(draft)} disabled={publishingId === draft.id || !pickedDate} size="sm" className="bg-teal-600 hover:bg-teal-500 text-white font-semibold flex-1">
                                    {publishingId === draft.id ? <Loader2 size={13} className="animate-spin mr-1" /> : <Send size={13} className="mr-1" />}
                                    Schedule
                                  </Button>
                                  <Button onClick={() => deleteDraft(draft.id)} size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10"><X size={13} /></Button>
                                </div>
                              </>
                            )}
                            {!showDatePicker && (
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
                                  <option value="__ungroup__">Remove from group (unassign)</option>
                                </select>
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
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${questions.length >= 3 ? "bg-teal-500/20 text-teal-300" : "bg-yellow-500/20 text-yellow-300"}`}>
                            {questions.length}/3
                          </span>
                          <button
                            onClick={() => {
                              if (isEditingThis) {
                                setEditingScheduledDate(null);
                                setNewDateForEdit("");
                              } else {
                                setEditingScheduledDate(date);
                                setNewDateForEdit(date);
                              }
                            }}
                            className="text-gray-500 hover:text-teal-400 transition-colors"
                            title="Change date"
                          >
                            <Pencil size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Inline date editor */}
                      {isEditingThis && (
                        <div className="flex items-center gap-2 mb-3 p-2 bg-gray-800/60 rounded-lg">
                          <CalendarDays size={13} className="text-teal-400 flex-shrink-0" />
                          <Input
                            type="date"
                            value={newDateForEdit}
                            onChange={e => setNewDateForEdit(e.target.value)}
                            className="bg-gray-900 border-gray-700 text-white h-7 text-xs flex-1"
                          />
                          <Button
                            onClick={() => moveScheduledDate(date, newDateForEdit)}
                            disabled={movingDate || !newDateForEdit || newDateForEdit === date}
                            size="sm"
                            className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold h-7 px-3 whitespace-nowrap"
                          >
                            {movingDate ? <Loader2 size={11} className="animate-spin" /> : "Move"}
                          </Button>
                          <button onClick={() => { setEditingScheduledDate(null); setNewDateForEdit(""); }} className="text-gray-500 hover:text-white transition-colors">
                            <X size={13} />
                          </button>
                        </div>
                      )}

                      <div className="space-y-1">
                        {questions.map(q => (
                          <div key={q.id} className="flex items-start gap-2">
                            <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded flex-shrink-0">{q.category || "?"}</span>
                            <p className="text-xs text-gray-400 line-clamp-1">{q.title}</p>
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
                <p className="font-medium">No published sets yet</p>
                <p className="text-sm mt-1">Past scheduled dates will appear here</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{published.length} dates played</p>
                {published.map(({ date, questions }) => (
                  <div key={date} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 opacity-70">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-white">{date}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-700 text-gray-400">
                        {questions.length} played
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
