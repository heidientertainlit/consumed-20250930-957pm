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
  ArrowLeft, Sparkles, Loader2, Check, X, CalendarDays, ChevronDown, ChevronUp, Send,
  ShieldCheck, AlertTriangle, Pencil, Plus, Minus,
} from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Draft = {
  id: string;
  title: string;
  options: string[];
  category: string;
  featured_date: string | null;
  status: string;
  created_at: string;
};

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AdminDailyCallPage() {
  const { user, session } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"generate" | "drafts" | "scheduled" | "published">("generate");
  const [generating, setGenerating] = useState(false);
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(14);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dates, setDates] = useState<Record<string, string>>({});

  const [showManualForm, setShowManualForm] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualOptions, setManualOptions] = useState(["", ""]);
  const [manualCategory, setManualCategory] = useState("Pop Culture");
  const [savingManual, setSavingManual] = useState(false);

  const { data: drafts = [], isLoading } = useQuery<Draft[]>({
    queryKey: ["daily-call-drafts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("trivia_poll_drafts")
        .select("id, title, options, category, featured_date, status, created_at")
        .eq("content_type", "featured_play")
        .in("status", ["draft", "pending"])
        .order("created_at", { ascending: false })
        .limit(60);
      return data || [];
    },
  });

  const { data: upcoming = [] } = useQuery<any[]>({
    queryKey: ["daily-call-upcoming"],
    queryFn: async () => {
      const today = toLocalDateStr(new Date());
      const { data } = await supabase
        .from("prediction_pools")
        .select("id, title, featured_date, options, category")
        .eq("type", "predict")
        .gte("featured_date", today)
        .order("featured_date", { ascending: true })
        .limit(60);
      return data || [];
    },
  });

  const { data: pastPublished = [] } = useQuery<any[]>({
    queryKey: ["daily-call-published"],
    queryFn: async () => {
      const today = toLocalDateStr(new Date());
      const { data } = await supabase
        .from("prediction_pools")
        .select("id, title, featured_date, category")
        .eq("type", "predict")
        .not("featured_date", "is", null)
        .lt("featured_date", today)
        .order("featured_date", { ascending: false })
        .limit(60);
      return data || [];
    },
  });

  async function handleGenerate() {
    setGenerating(true);
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
          contentType: "featured_play",
          count,
          mediaType: "mixed",
          focusTopic: topic || "hot entertainment takes, trending drama, cultural moments",
          useTrending: true,
        }),
      });
      const result = await resp.json();
      if (!resp.ok || !result.success) throw new Error(result.error || "Generation failed");
      toast({ title: `Generated ${result.generated} Daily Calls`, description: "Review them in the Drafts tab." });
      queryClient.invalidateQueries({ queryKey: ["daily-call-drafts"] });
      setTab("drafts");
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function publishDraft(draft: Draft) {
    const dateStr = dates[draft.id];
    if (!dateStr) {
      toast({ title: "Pick a date first", variant: "destructive" });
      return;
    }
    setPublishingId(draft.id);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      const poolData = {
        id: crypto.randomUUID(),
        title: draft.title,
        type: "predict",
        options: draft.options,
        correct_answer: null,
        category: draft.category || "Pop Culture",
        featured_date: dateStr,
        status: "open",
        origin_type: "consumed",
        inline: false,
        icon: "⭐",
        points_reward: 10,
      };
      const resp = await fetch(`${supabaseUrl}/functions/v1/generate-trivia-polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s?.access_token}` },
        body: JSON.stringify({ action: "publish", poolData, draftId: draft.id }),
      });
      const result = await resp.json();
      if (!resp.ok || result.error) throw new Error(result.error || "Publish failed");
      toast({ title: "Published!", description: `Daily Call scheduled for ${dateStr}` });
      queryClient.invalidateQueries({ queryKey: ["daily-call-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["daily-call-upcoming"] });
    } catch (err: any) {
      toast({ title: "Publish failed", description: err.message, variant: "destructive" });
    } finally {
      setPublishingId(null);
    }
  }

  async function deleteDraft(id: string) {
    await supabase.from("trivia_poll_drafts").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["daily-call-drafts"] });
  }

  async function handleSaveManualDraft() {
    const filledOptions = manualOptions.filter(o => o.trim());
    if (!manualTitle.trim() || filledOptions.length < 2) {
      toast({ title: "Add a question and at least 2 options", variant: "destructive" });
      return;
    }
    setSavingManual(true);
    try {
      const { error } = await supabase.from("trivia_poll_drafts").insert({
        id: crypto.randomUUID(),
        title: manualTitle.trim(),
        options: filledOptions,
        category: manualCategory,
        content_type: "featured_play",
        status: "draft",
      });
      if (error) throw error;
      toast({ title: "Saved to Drafts!", description: "Go to Drafts tab to schedule it." });
      setManualTitle("");
      setManualOptions(["", ""]);
      setManualCategory("Pop Culture");
      setShowManualForm(false);
      queryClient.invalidateQueries({ queryKey: ["daily-call-drafts"] });
      setTab("drafts");
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingManual(false);
    }
  }

  const nextFreeDate = (() => {
    if (upcoming.length === 0) return toLocalDateStr(new Date());
    const last = upcoming[upcoming.length - 1].featured_date;
    const d = new Date(last + "T12:00:00");
    d.setDate(d.getDate() + 1);
    return toLocalDateStr(d);
  })();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => setLocation("/admin")} className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Daily Call Generator</h1>
            <p className="text-gray-400 text-sm mt-0.5">Predictive / opinion polls — one per day</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900 rounded-xl p-1">
          {[
            { key: "generate" as const, label: "Generate" },
            { key: "drafts" as const, label: `Drafts (${drafts.length})` },
            { key: "scheduled" as const, label: `Scheduled (${upcoming.length})` },
            { key: "published" as const, label: "Published" },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${tab === t.key ? "bg-yellow-500/20 text-yellow-300" : "text-gray-400 hover:text-gray-200"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "generate" && (
          <div className="space-y-5">
            {/* Safeguards info */}
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800 flex items-start gap-3">
              <ShieldCheck size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-yellow-300">Active safeguards</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  <span className="text-gray-300 font-medium">Dedup:</span> AI is shown all existing prediction pool questions and blocked from repeating any of them. A post-generation filter removes near-duplicates.
                </p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  <span className="text-gray-300 font-medium">Rejection learning:</span> Recently rejected content (with rejection reasons) is passed to the AI so the same mistakes aren't repeated.
                </p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  <span className="text-gray-300 font-medium">Date collision:</span> A warning appears in the queue if you try to schedule two Daily Calls on the same date.
                </p>
              </div>
            </div>

            <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
              <p className="text-xs font-semibold uppercase tracking-wider text-yellow-400 mb-4">Generate Daily Calls</p>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-300 mb-1.5 block">Topic / Vibe (optional)</label>
                  <Textarea
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="e.g. reality TV drama, Oscar predictions, streaming wars..."
                    className="bg-gray-800 border-gray-700 text-white resize-none h-20 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave blank for mixed trending entertainment takes</p>
                </div>

                <div>
                  <label className="text-sm text-gray-300 mb-1.5 block">Number to generate</label>
                  <div className="flex gap-2">
                    {[7, 14, 21, 30].map(n => (
                      <button
                        key={n}
                        onClick={() => setCount(n)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${count === n ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40" : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200"}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{count} questions = ~{count} days of Daily Calls</p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl text-base"
            >
              {generating ? <><Loader2 size={18} className="animate-spin mr-2" /> Generating...</> : <><Sparkles size={18} className="mr-2" /> Generate {count} Daily Calls</>}
            </Button>

            {/* Write Your Own */}
            <div className="mt-2">
              <button
                onClick={() => setShowManualForm(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Pencil size={14} className="text-yellow-400" />
                  <span className="text-sm font-medium text-gray-300">Write your own Daily Call</span>
                </div>
                {showManualForm ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
              </button>

              {showManualForm && (
                <div className="mt-2 bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Question / Prediction prompt</label>
                    <Textarea
                      value={manualTitle}
                      onChange={e => setManualTitle(e.target.value)}
                      placeholder="e.g. Who will win the Super Bowl this year?"
                      className="bg-gray-800 border-gray-700 text-white resize-none h-20 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Options</label>
                    <div className="space-y-2">
                      {manualOptions.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            value={opt}
                            onChange={e => setManualOptions(prev => prev.map((o, idx) => idx === i ? e.target.value : o))}
                            placeholder={`Option ${i + 1}`}
                            className="bg-gray-800 border-gray-700 text-white text-sm flex-1"
                          />
                          {manualOptions.length > 2 && (
                            <button onClick={() => setManualOptions(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-500 hover:text-red-400">
                              <Minus size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                      {manualOptions.length < 4 && (
                        <button onClick={() => setManualOptions(prev => [...prev, ""])} className="flex items-center gap-1.5 text-xs text-yellow-400 hover:text-yellow-300 mt-1">
                          <Plus size={12} /> Add option
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Category</label>
                    <div className="flex flex-wrap gap-2">
                      {["Pop Culture", "Movies", "TV", "Books", "Music"].map(cat => (
                        <button
                          key={cat}
                          onClick={() => setManualCategory(cat)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${manualCategory === cat ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40" : "bg-gray-800 text-gray-400 border border-gray-700 hover:text-gray-200"}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleSaveManualDraft}
                    disabled={savingManual}
                    className="w-full bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/40 font-semibold rounded-xl"
                  >
                    {savingManual ? <><Loader2 size={14} className="animate-spin mr-2" /> Saving...</> : <><Send size={14} className="mr-2" /> Save to Drafts</>}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "drafts" && (
          <div className="space-y-3">
            {isLoading && <div className="text-center py-8"><Loader2 size={20} className="animate-spin text-gray-400 mx-auto" /></div>}
            {!isLoading && drafts.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p className="font-medium">No pending drafts</p>
                <p className="text-sm mt-1">Generate some Daily Calls first</p>
              </div>
            )}
            {drafts.map(draft => (
              <div key={draft.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandedId(expandedId === draft.id ? null : draft.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800/40 transition-colors"
                >
                  <p className="text-sm text-white font-medium line-clamp-2 flex-1 mr-3">{draft.title}</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] font-semibold uppercase text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full">Daily Call</span>
                    {expandedId === draft.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {expandedId === draft.id && (
                  <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {draft.options.map((opt, i) => (
                        <span key={i} className="bg-gray-800 text-gray-300 text-sm px-3 py-1 rounded-full">{opt}</span>
                      ))}
                    </div>

                    {(() => {
                      const pickedDate = dates[draft.id];
                      const dateTaken = pickedDate ? upcoming.some(u => u.featured_date === pickedDate) : false;
                      return (
                        <>
                          <div className="flex items-center gap-2">
                            <CalendarDays size={14} className="text-gray-400" />
                            <Input
                              type="date"
                              value={pickedDate || ""}
                              onChange={e => setDates(d => ({ ...d, [draft.id]: e.target.value }))}
                              className={`bg-gray-800 border-gray-700 text-white h-8 text-sm flex-1 ${dateTaken ? "border-orange-500/60" : ""}`}
                            />
                          </div>
                          {dateTaken && (
                            <div className="flex items-center gap-1.5 text-orange-400">
                              <AlertTriangle size={12} />
                              <p className="text-xs">A Daily Call is already scheduled for {pickedDate}. Pick a different date or publish to stack.</p>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    <div className="flex gap-2">
                      <Button
                        onClick={() => publishDraft(draft)}
                        disabled={publishingId === draft.id || !dates[draft.id]}
                        size="sm"
                        className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold flex-1"
                      >
                        {publishingId === draft.id ? <Loader2 size={14} className="animate-spin mr-1" /> : <Send size={14} className="mr-1" />}
                        Schedule
                      </Button>
                      <Button
                        onClick={() => deleteDraft(draft.id)}
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ─── SCHEDULED TAB ─── */}
        {tab === "scheduled" && (
          <div className="space-y-3">
            {upcoming.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="font-medium">Nothing scheduled yet</p>
                <p className="text-sm mt-1">Assign dates to drafts and publish them</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{upcoming.length} upcoming</p>
                  <p className="text-xs text-yellow-400 font-medium">Next free: {nextFreeDate}</p>
                </div>
                {upcoming.map(u => (
                  <div key={u.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
                    <p className="text-sm text-white font-medium line-clamp-2 flex-1 mr-3">{u.title}</p>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-xs text-yellow-400 font-semibold">{u.featured_date}</span>
                      {u.category && (
                        <span className="text-[10px] font-medium text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{u.category}</span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ─── PUBLISHED TAB ─── */}
        {tab === "published" && (
          <div className="space-y-3">
            {pastPublished.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="font-medium">No past Daily Calls yet</p>
                <p className="text-sm mt-1">Completed Daily Calls will appear here</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{pastPublished.length} completed</p>
                {pastPublished.map(u => (
                  <div key={u.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-between opacity-70">
                    <p className="text-sm text-gray-300 line-clamp-2 flex-1 mr-3">{u.title}</p>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-xs text-gray-500 font-semibold">{u.featured_date}</span>
                      {u.category && (
                        <span className="text-[10px] font-medium text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">{u.category}</span>
                      )}
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
