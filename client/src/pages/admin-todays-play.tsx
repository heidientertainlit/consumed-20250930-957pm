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

const SLOT_METAS: SlotMeta[] = [
  {
    mediaType: "movie",
    focusTopic: "movies, films, cinema, box office, directors, actors",
    categoryHint: "Movies",
    label: "Movie",
    icon: <Film size={11} />,
    pillClass: "bg-blue-500/20 text-blue-300",
  },
  {
    mediaType: "book",
    focusTopic: "books, novels, authors, literature, bestsellers, book adaptations",
    categoryHint: "Books",
    label: "Book",
    icon: <BookOpen size={11} />,
    pillClass: "bg-emerald-500/20 text-emerald-300",
  },
  {
    mediaType: "mixed",
    focusTopic: "pop culture, music, celebrity, viral moments, award shows, TV, streaming",
    categoryHint: "Pop Culture",
    label: "Pop Culture",
    icon: <Zap size={11} />,
    pillClass: "bg-purple-500/20 text-purple-300",
  },
];

function typeMeta(draft: Draft): SlotMeta {
  if (draft.category === "Books") return SLOT_METAS[1];
  if (draft.category === "Pop Culture") return SLOT_METAS[2];
  return SLOT_METAS[0];
}

export default function AdminTodaysPlayPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"generate" | "queue">("generate");
  const [genStage, setGenStage] = useState<"idle" | "movie" | "book" | "pop" | "done">("idle");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [publishingId, setPublishingId] = useState<string | null>(null);

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

  async function callGenerate(slot: SlotMeta) {
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
        count: 14,
        mediaType: slot.mediaType,
        focusTopic: slot.focusTopic,
        difficulty: "medium",
      }),
    });
    const result = await resp.json();
    if (!resp.ok || !result.success) throw new Error(result.error || "Generation failed");
    return result;
  }

  async function handleGenerate() {
    setGenStage("movie");
    let movieCount = 0, bookCount = 0, popCount = 0;
    try {
      const r1 = await callGenerate(SLOT_METAS[0]);
      movieCount = r1.generated ?? 0;
      setGenStage("book");
      const r2 = await callGenerate(SLOT_METAS[1]);
      bookCount = r2.generated ?? 0;
      setGenStage("pop");
      const r3 = await callGenerate(SLOT_METAS[2]);
      popCount = r3.generated ?? 0;
      setGenStage("done");

      const total = movieCount + bookCount + popCount;
      toast({
        title: `Generated ${total} questions`,
        description: `${movieCount} Movie · ${bookCount} Book · ${popCount} Pop Culture — review them in the Queue.`,
      });
      await refetchDrafts();
      setTab("queue");
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenStage("idle");
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

  const generating = genStage !== "idle" && genStage !== "done";

  const STAGE_LABELS: Record<string, string> = {
    movie: "Generating Movie questions...",
    book: "Generating Book questions...",
    pop: "Generating Pop Culture questions...",
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
            <p className="text-gray-400 text-sm mt-0.5">3-question trivia sets — movie, book, pop culture</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900 rounded-xl p-1">
          {[
            { key: "generate" as const, label: "Generate" },
            { key: "queue" as const, label: `Queue (${drafts.length})` },
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
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">What gets generated</p>
              {SLOT_METAS.map(meta => (
                <div key={meta.mediaType} className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.pillClass}`}>
                    {meta.icon}
                    {meta.label}
                  </span>
                  <span className="text-xs text-gray-500">14 questions → pending drafts</span>
                </div>
              ))}
              <p className="text-xs text-gray-500 pt-1 border-t border-gray-800">42 total questions go into the Queue where you assign dates and publish them.</p>
            </div>

            {/* Generate button */}
            {!generating && (
              <Button
                onClick={handleGenerate}
                className="w-full py-4 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-base"
              >
                <Sparkles size={18} className="mr-2" />
                Generate 14 Days of Questions
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
                  {SLOT_METAS.map((meta, i) => {
                    const stageIdx = { movie: 0, book: 1, pop: 2 }[genStage] ?? -1;
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

        {/* ─── QUEUE TAB ─── */}
        {tab === "queue" && (
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
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{drafts.length} Pending Questions</p>
                {drafts.map(draft => {
                  const meta = typeMeta(draft);
                  const isEditing = editingId === draft.id;
                  const pickedDate = dates[draft.id] || "";
                  const dateTaken = pickedDate ? scheduledDates.has(pickedDate) : false;
                  const dateSetCount = pickedDate ? (scheduled.find(s => s.date === pickedDate)?.questions.length ?? 0) : 0;

                  return (
                    <div key={draft.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                      {/* Header row */}
                      <button
                        onClick={() => setExpandedId(expandedId === draft.id ? null : draft.id)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${meta.pillClass}`}>
                            {meta.icon} {meta.label}
                          </span>
                          <p className="text-sm text-white font-medium line-clamp-1 flex-1">{draft.title}</p>
                        </div>
                        {expandedId === draft.id ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0 ml-2" /> : <ChevronDown size={14} className="text-gray-400 flex-shrink-0 ml-2" />}
                      </button>

                      {expandedId === draft.id && (
                        <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-3">

                          {/* View mode */}
                          {!isEditing && (
                            <>
                              <div className="flex flex-wrap gap-1.5">
                                {draft.options.map((opt, i) => (
                                  <span
                                    key={i}
                                    className={`text-xs px-2.5 py-1 rounded-full ${opt === draft.correct_answer ? "bg-teal-500/30 text-teal-200 border border-teal-500/40" : "bg-gray-800 text-gray-300"}`}
                                  >
                                    {opt === draft.correct_answer && <Check size={9} className="inline mr-0.5 mb-px" />}
                                    {opt}
                                  </span>
                                ))}
                              </div>
                              <button
                                onClick={() => startEdit(draft)}
                                className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
                              >
                                <Pencil size={11} /> Edit question
                              </button>
                            </>
                          )}

                          {/* Edit mode */}
                          {isEditing && (
                            <div className="space-y-3">
                              <Textarea
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                className="bg-black/30 border-white/10 text-white text-sm resize-none h-16"
                              />
                              <div className="space-y-1.5">
                                {editOptions.map((opt, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <button
                                      onClick={() => setEditAnswer(opt)}
                                      className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all ${editAnswer === opt ? "border-teal-400 bg-teal-400" : "border-gray-600"}`}
                                    />
                                    <Input
                                      value={opt}
                                      onChange={e => {
                                        const o = [...editOptions];
                                        o[i] = e.target.value;
                                        setEditOptions(o);
                                      }}
                                      className="bg-black/30 border-white/10 text-white text-xs h-7"
                                    />
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={() => saveEdit(draft)} size="sm" className="bg-teal-600 hover:bg-teal-500 text-white flex-1">
                                  <Check size={12} className="mr-1" /> Save
                                </Button>
                                <Button onClick={() => setEditingId(null)} size="sm" variant="ghost" className="text-gray-400">Cancel</Button>
                              </div>
                            </div>
                          )}

                          {/* Date picker */}
                          <div className="flex items-center gap-2">
                            <CalendarDays size={14} className="text-gray-400 flex-shrink-0" />
                            <Input
                              type="date"
                              value={pickedDate}
                              onChange={e => setDates(d => ({ ...d, [draft.id]: e.target.value }))}
                              className={`bg-gray-800 border-gray-700 text-white h-8 text-sm flex-1 ${dateTaken ? "border-orange-500/50" : ""}`}
                            />
                          </div>
                          {dateTaken && (
                            <div className="flex items-center gap-1.5 text-orange-400">
                              <AlertTriangle size={11} />
                              <p className="text-xs">{dateSetCount} question{dateSetCount !== 1 ? "s" : ""} already scheduled for {pickedDate}</p>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2">
                            <Button
                              onClick={() => publishDraft(draft)}
                              disabled={publishingId === draft.id || !pickedDate}
                              size="sm"
                              className="bg-teal-600 hover:bg-teal-500 text-white font-semibold flex-1"
                            >
                              {publishingId === draft.id
                                ? <Loader2 size={13} className="animate-spin mr-1" />
                                : <Send size={13} className="mr-1" />}
                              Schedule
                            </Button>
                            <Button
                              onClick={() => deleteDraft(draft.id)}
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                              <X size={13} />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* Already scheduled */}
            {scheduled.length > 0 && (
              <div className="mt-6 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Scheduled</p>
                {scheduled.map(({ date, questions }) => (
                  <div key={date} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-white">{date}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${questions.length >= 3 ? "bg-teal-500/20 text-teal-300" : "bg-yellow-500/20 text-yellow-300"}`}>
                        {questions.length}/3
                      </span>
                    </div>
                    <div className="space-y-1">
                      {questions.map(q => (
                        <div key={q.id} className="flex items-start gap-2">
                          <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded flex-shrink-0">{q.category || "?"}</span>
                          <p className="text-xs text-gray-400 line-clamp-1">{q.title}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
