import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Sparkles, Loader2, Check, X, CalendarDays, RefreshCw,
  Film, BookOpen, Zap, Send, Pencil, AlertTriangle, ShieldCheck,
  ListOrdered, ChevronRight,
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
  media_title: string | null;
  show_tag: string | null;
  difficulty: string | null;
  featured_date: string | null;
  status: string;
  created_at: string;
};

type SlotKey = "movie" | "book" | "pop";

type Slot = {
  key: SlotKey;
  label: string;
  icon: React.ReactNode;
  color: string;
  pillColor: string;
  mediaType: string;
  focusTopic: string;
  categoryHint: string;
};

const SLOTS: Slot[] = [
  {
    key: "movie",
    label: "Movie",
    icon: <Film size={14} />,
    color: "from-blue-900/40 to-blue-800/20 border-blue-700/40",
    pillColor: "bg-blue-500/20 text-blue-300",
    mediaType: "movie",
    focusTopic: "movies, films, cinema, box office, directors, actors",
    categoryHint: "Movies",
  },
  {
    key: "book",
    label: "Book",
    icon: <BookOpen size={14} />,
    color: "from-emerald-900/40 to-emerald-800/20 border-emerald-700/40",
    pillColor: "bg-emerald-500/20 text-emerald-300",
    mediaType: "book",
    focusTopic: "books, novels, authors, literature, bestsellers, book adaptations",
    categoryHint: "Books",
  },
  {
    key: "pop",
    label: "Pop Culture",
    icon: <Zap size={14} />,
    color: "from-purple-900/40 to-purple-800/20 border-purple-700/40",
    pillColor: "bg-purple-500/20 text-purple-300",
    mediaType: "mixed",
    focusTopic: "pop culture, music, celebrity, viral moments, award shows, TV, streaming",
    categoryHint: "Pop Culture",
  },
];

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return toLocalDateStr(d);
}

function CategoryPill({ slot }: { slot: Slot }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${slot.pillColor}`}>
      {slot.icon}
      {slot.label}
    </span>
  );
}

type EditState = { title: string; options: string[]; correct_answer: string };
type BatchProgress = { day: number; totalDays: number; date: string; slotLabel: string; stage: "generating" | "publishing" | "done" };
type BatchResult = { date: string; published: number; failed: number };

export default function AdminTodaysPlayPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"single" | "batch" | "queue">("single");

  // Single-set mode state
  const [selectedDate, setSelectedDate] = useState(toLocalDateStr(new Date()));
  const [slotDrafts, setSlotDrafts] = useState<Record<SlotKey, Draft | null>>({ movie: null, book: null, pop: null });
  const [generatingSlot, setGeneratingSlot] = useState<SlotKey | null>(null);
  const [publishingSet, setPublishingSet] = useState(false);
  const [forceOverwrite, setForceOverwrite] = useState(false);
  const [editingSlot, setEditingSlot] = useState<SlotKey | null>(null);
  const [editState, setEditState] = useState<EditState>({ title: "", options: [], correct_answer: "" });

  // Batch mode state
  const [batchStartDate, setBatchStartDate] = useState(toLocalDateStr(new Date()));
  const [batchDays, setBatchDays] = useState(7);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [batchSummary, setBatchSummary] = useState<BatchResult[] | null>(null);

  // Scheduled sets for queue + collision checks
  const { data: scheduledSets = [], refetch: refetchScheduled } = useQuery<{ date: string; questions: any[] }[]>({
    queryKey: ["todays-play-scheduled"],
    queryFn: async () => {
      const today = toLocalDateStr(new Date());
      const { data } = await supabase
        .from("prediction_pools")
        .select("id, title, category, featured_date, correct_answer")
        .eq("type", "trivia")
        .not("correct_answer", "is", null)
        .not("featured_date", "is", null)
        .gte("featured_date", today)
        .order("featured_date", { ascending: true })
        .limit(90);
      if (!data) return [];
      const byDate: Record<string, any[]> = {};
      for (const row of data) {
        const d = row.featured_date;
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(row);
      }
      return Object.entries(byDate).map(([date, questions]) => ({ date, questions }));
    },
  });

  const scheduledDates = new Set(scheduledSets.map(s => s.date));

  // ── Core helper: generate one slot, fetch the resulting draft by timestamp ──
  async function generateOneSlot(slot: Slot): Promise<Draft | null> {
    const { data: { session: s } } = await supabase.auth.getSession();
    const beforeTime = new Date().toISOString();

    const resp = await fetch(`${supabaseUrl}/functions/v1/generate-trivia-polls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${s?.access_token}`,
        "apikey": supabaseAnonKey,
      },
      body: JSON.stringify({
        contentType: "trivia",
        count: 1,
        mediaType: slot.mediaType,
        focusTopic: slot.focusTopic,
        difficulty: "medium",
      }),
    });
    const result = await resp.json();
    if (!resp.ok || !result.success) throw new Error(result.error || "Generation failed");
    if (result.generated === 0) throw new Error("Question was skipped by dedup — try again");

    // Fetch the draft that was just created (created_at >= beforeTime)
    const { data: newDrafts } = await supabase
      .from("trivia_poll_drafts")
      .select("id, title, options, correct_answer, category, media_title, show_tag, difficulty, featured_date, status, created_at")
      .eq("content_type", "trivia")
      .eq("status", "pending")
      .gte("created_at", beforeTime)
      .order("created_at", { ascending: false })
      .limit(1);

    return newDrafts?.[0] ?? null;
  }

  // ── Core helper: publish a draft directly to prediction_pools ──
  async function publishDraftDirect(draft: Draft, targetDate: string, slot: Slot) {
    const { data: { session: s } } = await supabase.auth.getSession();
    const poolData = {
      id: crypto.randomUUID(),
      title: draft.title,
      type: "trivia",
      options: draft.options,
      correct_answer: draft.correct_answer || null,
      category: slot.categoryHint,
      featured_date: targetDate,
      status: "open",
      origin_type: "consumed",
      inline: true,
      icon: "help-circle",
      points_reward: draft.difficulty === "easy" ? 5 : draft.difficulty === "chaotic" ? 20 : 10,
    };
    const resp = await fetch(`${supabaseUrl}/functions/v1/generate-trivia-polls`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s?.access_token}` },
      body: JSON.stringify({ action: "publish", poolData, draftId: draft.id }),
    });
    const result = await resp.json();
    if (!resp.ok || result.error) throw new Error(result.error || "Publish failed");
  }

  // ── Single mode: generate one slot and store in state ──
  async function generateSlot(slot: Slot) {
    setGeneratingSlot(slot.key);
    setSlotDrafts(s => ({ ...s, [slot.key]: null }));
    try {
      const draft = await generateOneSlot(slot);
      if (draft) {
        setSlotDrafts(s => ({ ...s, [slot.key]: draft }));
      } else {
        toast({ title: `${slot.label}: no draft returned`, description: "The AI may have deduped it. Try again.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: `${slot.label} generation failed`, description: err.message, variant: "destructive" });
    } finally {
      setGeneratingSlot(null);
    }
  }

  async function generateAll() {
    for (const slot of SLOTS) {
      await generateSlot(slot);
    }
  }

  // ── Single mode: publish the current slot drafts ──
  async function publishSet() {
    const readySlots = SLOTS.filter(s => slotDrafts[s.key] !== null);
    if (readySlots.length === 0) { toast({ title: "No drafts to publish", variant: "destructive" }); return; }
    setPublishingSet(true);
    let success = 0;
    for (const slot of readySlots) {
      const draft = slotDrafts[slot.key]!;
      try {
        await publishDraftDirect(draft, selectedDate, slot);
        success++;
      } catch (err: any) {
        toast({ title: `Failed to publish ${slot.label}`, description: err.message, variant: "destructive" });
      }
    }
    setPublishingSet(false);
    if (success > 0) {
      toast({ title: `Published ${success} question${success !== 1 ? "s" : ""} for ${selectedDate}` });
      setSlotDrafts({ movie: null, book: null, pop: null });
      setForceOverwrite(false);
      queryClient.invalidateQueries({ queryKey: ["todays-play-scheduled"] });
      setTab("queue");
    }
  }

  // ── Batch mode: generate + auto-publish all slots for a range of days ──
  async function runBatch() {
    setBatchRunning(true);
    setBatchSummary(null);
    const results: BatchResult[] = [];

    for (let dayIdx = 0; dayIdx < batchDays; dayIdx++) {
      const targetDate = addDays(batchStartDate, dayIdx);
      let published = 0, failed = 0;

      for (const slot of SLOTS) {
        setBatchProgress({ day: dayIdx + 1, totalDays: batchDays, date: targetDate, slotLabel: slot.label, stage: "generating" });
        try {
          const draft = await generateOneSlot(slot);
          if (!draft) { failed++; continue; }

          setBatchProgress(p => p ? { ...p, stage: "publishing" } : p);
          await publishDraftDirect(draft, targetDate, slot);
          published++;
        } catch {
          failed++;
        }
      }
      results.push({ date: targetDate, published, failed });
    }

    setBatchRunning(false);
    setBatchProgress(null);
    setBatchSummary(results);
    refetchScheduled();
    queryClient.invalidateQueries({ queryKey: ["todays-play-scheduled"] });
    const totalPublished = results.reduce((a, r) => a + r.published, 0);
    toast({ title: `Batch complete — ${totalPublished} questions published across ${batchDays} days` });
  }

  // ── Editing ──
  function startEdit(slot: Slot) {
    const draft = slotDrafts[slot.key];
    if (!draft) return;
    setEditingSlot(slot.key);
    setEditState({ title: draft.title, options: draft.options || [], correct_answer: draft.correct_answer || "" });
  }

  async function saveEdit(slot: Slot) {
    const draft = slotDrafts[slot.key];
    if (!draft) return;
    await supabase.from("trivia_poll_drafts").update({
      title: editState.title,
      options: editState.options,
      correct_answer: editState.correct_answer || null,
    }).eq("id", draft.id);
    setSlotDrafts(s => ({
      ...s,
      [slot.key]: { ...draft, title: editState.title, options: editState.options, correct_answer: editState.correct_answer || null },
    }));
    setEditingSlot(null);
  }

  async function removeSlotDraft(slot: Slot) {
    const draft = slotDrafts[slot.key];
    if (draft) await supabase.from("trivia_poll_drafts").delete().eq("id", draft.id);
    setSlotDrafts(s => ({ ...s, [slot.key]: null }));
  }

  const allGenerating = generatingSlot !== null;
  const dateHasSet = scheduledDates.has(selectedDate);
  const dateSetCount = scheduledSets.find(s => s.date === selectedDate)?.questions.length ?? 0;
  const readyCount = SLOTS.filter(s => slotDrafts[s.key] !== null).length;

  // Batch: dates in range that already have sets
  const batchConflicts = Array.from({ length: batchDays }, (_, i) => addDays(batchStartDate, i)).filter(d => scheduledDates.has(d));

  const TABS = [
    { key: "single" as const, label: "Single Day" },
    { key: "batch" as const, label: "Batch (Week+)" },
    { key: "queue" as const, label: `Queue (${scheduledSets.length})` },
  ];

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
            <p className="text-gray-400 text-sm mt-0.5">3-question trivia sets — movie, book, pop culture</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900 rounded-xl p-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${tab === t.key ? "bg-teal-500/20 text-teal-300" : "text-gray-400 hover:text-gray-200"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ─── SINGLE DAY TAB ─── */}
        {tab === "single" && (
          <div className="space-y-5">
            {/* Safeguards */}
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex items-start gap-3">
              <ShieldCheck size={15} className="text-teal-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-teal-300">Active safeguards</p>
                <p className="text-xs text-gray-400"><span className="text-gray-300 font-medium">Dedup:</span> AI is shown all existing questions and can't repeat them. A post-generation filter removes near-duplicates.</p>
                <p className="text-xs text-gray-400"><span className="text-gray-300 font-medium">Rejection learning:</span> Recently rejected questions are passed to the AI to avoid the same mistakes.</p>
              </div>
            </div>

            {/* Date picker */}
            <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-400 mb-3">Schedule Date</p>
              <div className="flex items-center gap-3">
                <CalendarDays size={16} className="text-gray-400" />
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={e => { setSelectedDate(e.target.value); setForceOverwrite(false); }}
                  className="bg-gray-800 border-gray-700 text-white h-9 text-sm flex-1"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">All 3 questions will be scheduled for this date</p>

              {dateHasSet && (
                <div className="mt-3 flex items-start gap-2 bg-orange-500/10 border border-orange-500/30 rounded-xl px-3 py-2.5">
                  <AlertTriangle size={14} className="text-orange-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-orange-300">Date already has {dateSetCount} question{dateSetCount !== 1 ? "s" : ""}</p>
                    <p className="text-xs text-orange-400/80 mt-0.5">Publishing will add on top. Pick a different date or confirm below.</p>
                    <button
                      onClick={() => setForceOverwrite(f => !f)}
                      className={`mt-2 text-xs font-semibold px-3 py-1 rounded-lg transition-all ${forceOverwrite ? "bg-orange-500/30 text-orange-200" : "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20"}`}
                    >
                      {forceOverwrite ? "Confirmed — proceed with caution" : "I understand, publish anyway"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Slot cards + Generate All */}
            <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Generate Questions</p>
                <Button
                  onClick={generateAll}
                  disabled={allGenerating}
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold"
                >
                  {allGenerating ? <Loader2 size={12} className="animate-spin mr-1" /> : <Sparkles size={12} className="mr-1" />}
                  Generate All 3
                </Button>
              </div>

              {SLOTS.map(slot => {
                const draft = slotDrafts[slot.key];
                const isGenerating = generatingSlot === slot.key;
                const isEditing = editingSlot === slot.key;

                return (
                  <div key={slot.key} className={`rounded-xl border bg-gradient-to-br p-4 ${slot.color}`}>
                    <div className="flex items-center justify-between mb-3">
                      <CategoryPill slot={slot} />
                      <div className="flex items-center gap-1.5">
                        {draft && !isEditing && (
                          <>
                            <button onClick={() => startEdit(slot)} className="p-1 text-gray-400 hover:text-white transition-colors" title="Edit">
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => generateSlot(slot)} disabled={allGenerating} className="p-1 text-gray-400 hover:text-white transition-colors" title="Regenerate">
                              <RefreshCw size={12} />
                            </button>
                            <button onClick={() => removeSlotDraft(slot)} className="p-1 text-red-400 hover:text-red-300 transition-colors" title="Remove">
                              <X size={12} />
                            </button>
                          </>
                        )}
                        {!draft && (
                          <button
                            onClick={() => generateSlot(slot)}
                            disabled={allGenerating}
                            className="text-xs font-medium text-gray-300 hover:text-white flex items-center gap-1 transition-colors disabled:opacity-40"
                          >
                            {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            Generate
                          </button>
                        )}
                      </div>
                    </div>

                    {isGenerating && !draft && (
                      <div className="flex items-center gap-2 text-gray-400 py-1">
                        <Loader2 size={13} className="animate-spin" />
                        <span className="text-sm">Generating {slot.label} question...</span>
                      </div>
                    )}

                    {!draft && !isGenerating && (
                      <p className="text-gray-500 text-sm italic">No question yet — click Generate</p>
                    )}

                    {draft && !isEditing && (
                      <div className="space-y-2">
                        <p className="text-sm text-white font-medium leading-snug">{draft.title}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {draft.options.map((opt, i) => (
                            <span
                              key={i}
                              className={`text-xs px-2.5 py-1 rounded-full ${opt === draft.correct_answer ? "bg-teal-500/30 text-teal-200 border border-teal-500/40" : "bg-white/10 text-gray-300"}`}
                            >
                              {opt === draft.correct_answer && <Check size={10} className="inline mr-0.5 mb-px" />}
                              {opt}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {draft && isEditing && (
                      <div className="space-y-3">
                        <Textarea
                          value={editState.title}
                          onChange={e => setEditState(s => ({ ...s, title: e.target.value }))}
                          className="bg-black/30 border-white/10 text-white text-sm resize-none h-16"
                        />
                        <div className="space-y-1.5">
                          {editState.options.map((opt, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <button
                                onClick={() => setEditState(s => ({ ...s, correct_answer: opt }))}
                                className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all ${editState.correct_answer === opt ? "border-teal-400 bg-teal-400" : "border-gray-500"}`}
                              />
                              <Input
                                value={opt}
                                onChange={e => {
                                  const newOpts = [...editState.options];
                                  newOpts[i] = e.target.value;
                                  setEditState(s => ({ ...s, options: newOpts }));
                                }}
                                className="bg-black/30 border-white/10 text-white text-xs h-7"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => saveEdit(slot)} size="sm" className="bg-teal-600 hover:bg-teal-500 text-white flex-1">
                            <Check size={12} className="mr-1" /> Save
                          </Button>
                          <Button onClick={() => setEditingSlot(null)} size="sm" variant="ghost" className="text-gray-400">Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Publish */}
            {readyCount > 0 && (
              <div className="space-y-2">
                <Button
                  onClick={publishSet}
                  disabled={publishingSet || (dateHasSet && !forceOverwrite)}
                  className={`w-full py-3 font-bold rounded-xl text-base text-white ${dateHasSet && !forceOverwrite ? "bg-gray-700 opacity-60 cursor-not-allowed" : "bg-teal-600 hover:bg-teal-500"}`}
                >
                  {publishingSet
                    ? <><Loader2 size={18} className="animate-spin mr-2" /> Publishing...</>
                    : <><Send size={18} className="mr-2" /> Publish {readyCount} Question{readyCount !== 1 ? "s" : ""} for {selectedDate}</>
                  }
                </Button>
                {dateHasSet && !forceOverwrite && (
                  <p className="text-center text-xs text-orange-400">Confirm the date collision above before publishing</p>
                )}
                {readyCount < 3 && (
                  <p className="text-center text-xs text-yellow-400">{3 - readyCount} more question{3 - readyCount !== 1 ? "s" : ""} needed for a full set</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── BATCH TAB ─── */}
        {tab === "batch" && (
          <div className="space-y-5">
            {!batchRunning && !batchSummary && (
              <>
                <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex items-start gap-3">
                  <ShieldCheck size={15} className="text-teal-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-teal-300">How batch works</p>
                    <p className="text-xs text-gray-400">Generates all 3 question types (Movie, Book, Pop Culture) for each day in the range — and publishes them directly. No draft review step. Each question is immediately live after generation.</p>
                  </div>
                </div>

                <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-teal-400">Batch Settings</p>

                  <div>
                    <label className="text-sm text-gray-300 mb-1.5 block">Starting date</label>
                    <div className="flex items-center gap-3">
                      <CalendarDays size={16} className="text-gray-400" />
                      <Input
                        type="date"
                        value={batchStartDate}
                        onChange={e => setBatchStartDate(e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white h-9 text-sm flex-1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-300 mb-2 block">Number of days</label>
                    <div className="flex gap-2">
                      {[3, 7, 10, 14].map(n => (
                        <button
                          key={n}
                          onClick={() => setBatchDays(n)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${batchDays === n ? "bg-teal-500/20 text-teal-300 border border-teal-500/40" : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200"}`}
                        >
                          {n}d
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">{batchDays} days × 3 questions = {batchDays * 3} total API calls</p>
                  </div>
                </div>

                {batchConflicts.length > 0 && (
                  <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3">
                    <AlertTriangle size={14} className="text-orange-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-orange-300">{batchConflicts.length} date{batchConflicts.length !== 1 ? "s" : ""} in this range already have questions</p>
                      <p className="text-xs text-orange-400/80 mt-1">{batchConflicts.join(", ")} — new questions will be added on top</p>
                    </div>
                  </div>
                )}

                {/* Preview the range */}
                <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Date Range Preview</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {Array.from({ length: batchDays }, (_, i) => {
                      const d = addDays(batchStartDate, i);
                      const hasSub = scheduledDates.has(d);
                      return (
                        <div key={d} className="flex items-center justify-between py-1">
                          <span className="text-sm text-gray-300">{d}</span>
                          {hasSub
                            ? <span className="text-xs text-orange-400 flex items-center gap-1"><AlertTriangle size={10} /> has questions</span>
                            : <span className="text-xs text-gray-600">—</span>
                          }
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Button
                  onClick={runBatch}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-base"
                >
                  <ListOrdered size={18} className="mr-2" />
                  Generate + Publish {batchDays}-Day Batch
                </Button>
              </>
            )}

            {/* Running progress */}
            {batchRunning && batchProgress && (
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-5">
                <div className="text-center">
                  <Loader2 size={32} className="animate-spin text-teal-400 mx-auto mb-3" />
                  <p className="text-base font-bold text-white">Generating batch...</p>
                  <p className="text-sm text-gray-400 mt-1">Day {batchProgress.day} of {batchProgress.totalDays} — {batchProgress.date}</p>
                </div>

                <div className="space-y-2">
                  {SLOTS.map(slot => {
                    const isActive = slot.label === batchProgress.slotLabel;
                    const activeDayIdx = batchProgress.day - 1;
                    const isDone = SLOTS.indexOf(slot) < SLOTS.findIndex(s => s.label === batchProgress.slotLabel);
                    return (
                      <div key={slot.key} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${isActive ? "bg-teal-500/10 border border-teal-500/30" : isDone ? "bg-gray-800/50 opacity-60" : "bg-gray-800/30 opacity-40"}`}>
                        <CategoryPill slot={slot} />
                        <div className="flex-1">
                          {isActive && (
                            <span className="text-xs text-teal-300">
                              {batchProgress.stage === "generating" ? "Generating..." : "Publishing..."}
                            </span>
                          )}
                          {isDone && <span className="text-xs text-gray-400">Done</span>}
                          {!isActive && !isDone && <span className="text-xs text-gray-600">Waiting</span>}
                        </div>
                        {isDone && <Check size={14} className="text-teal-400" />}
                        {isActive && <Loader2 size={14} className="animate-spin text-teal-400" />}
                      </div>
                    );
                  })}
                </div>

                {/* Overall progress bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Overall progress</span>
                    <span>{batchProgress.day - 1}/{batchProgress.totalDays} days complete</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full transition-all duration-500"
                      style={{ width: `${((batchProgress.day - 1) / batchProgress.totalDays) * 100}%` }}
                    />
                  </div>
                </div>

                <p className="text-xs text-center text-gray-500">Don't close this page — batch is running</p>
              </div>
            )}

            {/* Batch summary */}
            {!batchRunning && batchSummary && (
              <div className="space-y-4">
                <div className="bg-teal-900/30 border border-teal-700/40 rounded-2xl p-5">
                  <p className="text-base font-bold text-white mb-1">Batch complete</p>
                  <p className="text-sm text-gray-400">{batchSummary.reduce((a, r) => a + r.published, 0)} questions published across {batchSummary.length} days</p>
                </div>
                <div className="space-y-2">
                  {batchSummary.map(r => (
                    <div key={r.date} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5">
                      <span className="text-sm text-gray-200">{r.date}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-teal-400 font-medium">{r.published} published</span>
                        {r.failed > 0 && <span className="text-xs text-red-400">{r.failed} failed</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => { setBatchSummary(null); setTab("queue"); }} className="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-semibold">
                    View Queue <ChevronRight size={14} className="ml-1" />
                  </Button>
                  <Button onClick={() => setBatchSummary(null)} variant="ghost" className="text-gray-400">
                    Generate More
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── QUEUE TAB ─── */}
        {tab === "queue" && (
          <div className="space-y-4">
            {scheduledSets.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p className="font-medium">No sets scheduled yet</p>
                <p className="text-sm mt-1">Use Single Day or Batch to generate question sets</p>
              </div>
            )}
            {scheduledSets.map(({ date, questions }) => (
              <div key={date} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-white">{date}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${questions.length >= 3 ? "bg-teal-500/20 text-teal-300" : "bg-yellow-500/20 text-yellow-300"}`}>
                    {questions.length}/3 questions
                  </span>
                </div>
                <div className="space-y-2">
                  {questions.map(q => (
                    <div key={q.id} className="flex items-start gap-2">
                      <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded flex-shrink-0">{q.category || "?"}</span>
                      <p className="text-xs text-gray-300 line-clamp-1">{q.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
