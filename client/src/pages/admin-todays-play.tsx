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
  Film, BookOpen, Zap, Send, ChevronDown, ChevronUp, Pencil, AlertTriangle, ShieldCheck,
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

type Slot = {
  key: "movie" | "book" | "pop";
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

function CategoryPill({ slot }: { slot: Slot }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${slot.pillColor}`}>
      {slot.icon}
      {slot.label}
    </span>
  );
}

type EditState = {
  title: string;
  options: string[];
  correct_answer: string;
};

export default function AdminTodaysPlayPage() {
  const { user, session } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"generate" | "queue">("generate");
  const [selectedDate, setSelectedDate] = useState(toLocalDateStr(new Date()));
  const [generatingSlot, setGeneratingSlot] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [publishingSet, setPublishingSet] = useState(false);
  const [forceOverwrite, setForceOverwrite] = useState(false);

  // Editing state per slot
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ title: "", options: [], correct_answer: "" });

  // Fetch recent trivia drafts (for review after generation)
  const { data: recentDrafts = [], refetch: refetchDrafts } = useQuery<Draft[]>({
    queryKey: ["todays-play-recent-drafts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("trivia_poll_drafts")
        .select("id, title, options, correct_answer, category, media_title, show_tag, difficulty, featured_date, status, created_at")
        .eq("content_type", "trivia")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  // Fetch already-scheduled sets (to show queue)
  const { data: scheduledSets = [] } = useQuery<{ date: string; questions: any[] }[]>({
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
        .limit(60);
      if (!data) return [];
      // Group by date
      const byDate: Record<string, any[]> = {};
      for (const row of data) {
        const d = row.featured_date;
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(row);
      }
      return Object.entries(byDate).map(([date, questions]) => ({ date, questions }));
    },
  });

  // After generating, pick the 3 most recent drafts created around generatedAt
  const reviewDrafts = generatedAt
    ? recentDrafts.filter(d => new Date(d.created_at) >= generatedAt).slice(0, 3)
    : [];

  async function generateSlot(slot: Slot) {
    if (!generatedAt) setGeneratedAt(new Date());
    setGeneratingSlot(slot.key);
    try {
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
          count: 1,
          mediaType: slot.mediaType,
          focusTopic: slot.focusTopic,
          difficulty: "medium",
        }),
      });
      const result = await resp.json();
      if (!resp.ok || !result.success) throw new Error(result.error || "Generation failed");
      await refetchDrafts();
    } catch (err: any) {
      toast({ title: `Failed to generate ${slot.label}`, description: err.message, variant: "destructive" });
    } finally {
      setGeneratingSlot(null);
    }
  }

  async function generateAll() {
    const startTime = new Date();
    setGeneratedAt(startTime);
    for (const slot of SLOTS) {
      setGeneratingSlot(slot.key);
      try {
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
            count: 1,
            mediaType: slot.mediaType,
            focusTopic: slot.focusTopic,
            difficulty: "medium",
          }),
        });
        const result = await resp.json();
        if (!resp.ok || !result.success) throw new Error(result.error || "Generation failed");
        await refetchDrafts();
      } catch (err: any) {
        toast({ title: `Failed: ${slot.label}`, description: err.message, variant: "destructive" });
      }
    }
    setGeneratingSlot(null);
  }

  // Map reviewDrafts to slots (by position — first=movie, second=book, third=pop)
  function getDraftForSlotIndex(idx: number): Draft | null {
    return reviewDrafts[idx] || null;
  }

  function startEditSlot(slotIdx: number) {
    const draft = getDraftForSlotIndex(slotIdx);
    if (!draft) return;
    setEditingSlot(String(slotIdx));
    setEditState({
      title: draft.title,
      options: draft.options || [],
      correct_answer: draft.correct_answer || "",
    });
  }

  async function saveEditSlot(slotIdx: number) {
    const draft = getDraftForSlotIndex(slotIdx);
    if (!draft) return;
    await supabase.from("trivia_poll_drafts").update({
      title: editState.title,
      options: editState.options,
      correct_answer: editState.correct_answer || null,
    }).eq("id", draft.id);
    setEditingSlot(null);
    refetchDrafts();
  }

  async function removeDraftFromSet(slotIdx: number) {
    const draft = getDraftForSlotIndex(slotIdx);
    if (!draft) return;
    await supabase.from("trivia_poll_drafts").delete().eq("id", draft.id);
    refetchDrafts();
  }

  async function publishSet() {
    if (reviewDrafts.length < 1) {
      toast({ title: "No drafts to publish", variant: "destructive" });
      return;
    }
    setPublishingSet(true);
    const { data: { session: s } } = await supabase.auth.getSession();
    let success = 0;
    for (let i = 0; i < reviewDrafts.length; i++) {
      const draft = reviewDrafts[i];
      const slot = SLOTS[i] || SLOTS[2];
      try {
        const poolData = {
          id: crypto.randomUUID(),
          title: draft.title,
          type: "trivia",
          options: draft.options,
          correct_answer: draft.correct_answer || null,
          category: slot.categoryHint,
          featured_date: selectedDate,
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
        success++;
      } catch (err: any) {
        toast({ title: `Failed to publish question ${i + 1}`, description: err.message, variant: "destructive" });
      }
    }
    setPublishingSet(false);
    if (success > 0) {
      toast({ title: `Published ${success} question${success !== 1 ? "s" : ""} for ${selectedDate}` });
      queryClient.invalidateQueries({ queryKey: ["todays-play-scheduled"] });
      queryClient.invalidateQueries({ queryKey: ["todays-play-recent-drafts"] });
      setGeneratedAt(null);
      setTab("queue");
    }
  }

  const allGenerating = generatingSlot !== null;

  // Check if selected date already has a scheduled set
  const dateHasSet = scheduledSets.some(s => s.date === selectedDate);
  const dateSetCount = scheduledSets.find(s => s.date === selectedDate)?.questions.length ?? 0;

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
          {(["generate", "queue"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab === t ? "bg-teal-500/20 text-teal-300" : "text-gray-400 hover:text-gray-200"}`}
            >
              {t === "queue" ? `Scheduled Sets (${scheduledSets.length})` : "Generate"}
            </button>
          ))}
        </div>

        {tab === "generate" && (
          <div className="space-y-5">
            {/* Safeguards info */}
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex items-start gap-3">
              <ShieldCheck size={16} className="text-teal-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-teal-300">Active safeguards</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  <span className="text-gray-300 font-medium">Dedup:</span> AI is shown all existing questions and blocked from repeating them. A second post-generation filter removes near-duplicates.
                </p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  <span className="text-gray-300 font-medium">Rejection learning:</span> Recently rejected questions (and their rejection reasons) are fed to the AI so it doesn't repeat the same mistakes.
                </p>
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

              {/* Date collision warning */}
              {dateHasSet && (
                <div className="mt-3 flex items-start gap-2 bg-orange-500/10 border border-orange-500/30 rounded-xl px-3 py-2.5">
                  <AlertTriangle size={14} className="text-orange-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-orange-300">Date already has {dateSetCount} question{dateSetCount !== 1 ? "s" : ""}</p>
                    <p className="text-xs text-orange-400/80 mt-0.5">Publishing will add more questions on top. Pick a different date or confirm to overwrite.</p>
                    <button
                      onClick={() => setForceOverwrite(f => !f)}
                      className={`mt-2 text-xs font-semibold px-3 py-1 rounded-lg transition-all ${forceOverwrite ? "bg-orange-500/30 text-orange-200" : "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20"}`}
                    >
                      {forceOverwrite ? "Overwrite confirmed — proceed with caution" : "I understand, publish anyway"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Generate buttons */}
            <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 space-y-4">
              <div className="flex items-center justify-between mb-1">
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

              {SLOTS.map((slot, idx) => {
                const draft = getDraftForSlotIndex(idx);
                const isGenerating = generatingSlot === slot.key;
                const isEditing = editingSlot === String(idx);

                return (
                  <div key={slot.key} className={`rounded-xl border bg-gradient-to-br p-4 ${slot.color}`}>
                    <div className="flex items-center justify-between mb-3">
                      <CategoryPill slot={slot} />
                      <div className="flex items-center gap-1">
                        {draft && !isEditing && (
                          <>
                            <button onClick={() => startEditSlot(idx)} className="p-1 text-gray-400 hover:text-white transition-colors">
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => generateSlot(slot)} disabled={allGenerating} className="p-1 text-gray-400 hover:text-white transition-colors">
                              <RefreshCw size={12} />
                            </button>
                            <button onClick={() => removeDraftFromSet(idx)} className="p-1 text-red-400 hover:text-red-300 transition-colors">
                              <X size={12} />
                            </button>
                          </>
                        )}
                        {!draft && (
                          <button
                            onClick={() => generateSlot(slot)}
                            disabled={allGenerating}
                            className="text-xs font-medium text-gray-300 hover:text-white flex items-center gap-1 transition-colors"
                          >
                            {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            Generate
                          </button>
                        )}
                      </div>
                    </div>

                    {isGenerating && !draft && (
                      <div className="flex items-center gap-2 text-gray-400">
                        <Loader2 size={14} className="animate-spin" />
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
                        {draft.media_title && (
                          <p className="text-xs text-gray-400">Re: {draft.media_title}</p>
                        )}
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
                          <Button onClick={() => saveEditSlot(idx)} size="sm" className="bg-teal-600 hover:bg-teal-500 text-white flex-1">
                            <Check size={12} className="mr-1" /> Save
                          </Button>
                          <Button onClick={() => setEditingSlot(null)} size="sm" variant="ghost" className="text-gray-400">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Publish Set */}
            {reviewDrafts.length > 0 && (
              <Button
                onClick={publishSet}
                disabled={publishingSet || reviewDrafts.length === 0 || (dateHasSet && !forceOverwrite)}
                className={`w-full py-3 font-bold rounded-xl text-base text-white ${dateHasSet && !forceOverwrite ? "bg-gray-700 cursor-not-allowed opacity-60" : "bg-teal-600 hover:bg-teal-500"}`}
              >
                {publishingSet
                  ? <><Loader2 size={18} className="animate-spin mr-2" /> Publishing...</>
                  : <><Send size={18} className="mr-2" /> Publish {reviewDrafts.length} Question{reviewDrafts.length !== 1 ? "s" : ""} for {selectedDate}</>
                }
              </Button>
            )}
            {reviewDrafts.length > 0 && dateHasSet && !forceOverwrite && (
              <p className="text-center text-xs text-orange-400">Confirm the date collision above before publishing</p>
            )}

            {reviewDrafts.length > 0 && reviewDrafts.length < 3 && (
              <p className="text-center text-xs text-yellow-400">
                {3 - reviewDrafts.length} more question{3 - reviewDrafts.length !== 1 ? "s" : ""} needed for a full set
              </p>
            )}
          </div>
        )}

        {tab === "queue" && (
          <div className="space-y-4">
            {scheduledSets.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p className="font-medium">No sets scheduled</p>
                <p className="text-sm mt-1">Generate and publish question sets in the Generate tab</p>
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
