import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  Sparkles, ArrowLeft, Loader2, Trash2, ChevronDown, ChevronUp,
  CheckCircle, Layers, Plus, Pencil, Save, RefreshCw, ArrowRight,
  Search, Link2, X, LinkIcon,
} from "lucide-react";

type Difficulty = "easy" | "medium" | "hard";

const CATEGORIES = ["TV Shows", "Movies", "Music", "Books", "Pop Culture"] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_EMOJIS: Record<Category, string> = {
  "TV Shows": "📺",
  "Movies": "🎬",
  "Music": "🎵",
  "Books": "📚",
  "Pop Culture": "⭐",
};

const DIFF_LABELS: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };
const DIFF_COLORS: Record<Difficulty, string> = {
  easy: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  medium: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  hard: "bg-red-500/20 text-red-300 border-red-500/30",
};

interface Suggestion {
  title: string;
  category: Category;
  description: string;
  topic_context: string;
  emoji: string;
}

interface GeneratedQuestion {
  question_text: string;
  options: string[];
  correct_answer: string;
}

interface GeneratedQuestions {
  easy: GeneratedQuestion[];
  medium: GeneratedQuestion[];
  hard: GeneratedQuestion[];
}

interface PoolRow {
  id: string;
  show_tag: string;
  title: string;
  description: string | null;
  category: string | null;
  poster_url: string | null;
  fallback_emoji: string | null;
  is_active: boolean;
  created_at: string;
  media_external_id: string | null;
  media_external_source: string | null;
}

interface LinkedMedia {
  external_id: string;
  external_source: string;
  title: string;
  poster_url: string;
  type: string;
  year?: string;
}

const CATEGORY_TO_MEDIA_TYPE: Record<string, string> = {
  "TV Shows": "tv",
  "Movies": "movie",
  "Music": "music",
  "Books": "books",
  "Pop Culture": "",
};

// ── Question editor (inline) ──────────────────────────────────────────────────
function QuestionEditor({
  question,
  onChange,
  onDelete,
  autoEdit = false,
}: {
  question: GeneratedQuestion;
  onChange: (q: GeneratedQuestion) => void;
  onDelete: () => void;
  autoEdit?: boolean;
}) {
  const [editing, setEditing] = useState(autoEdit);
  const [local, setLocal] = useState(question);

  function save() { onChange(local); setEditing(false); }

  if (!editing) {
    return (
      <div className="rounded-lg bg-gray-800/60 border border-gray-700/40 p-3 group">
        <div className="flex items-start justify-between gap-2">
          <p className="text-gray-200 text-sm flex-1 leading-snug">{question.question_text}</p>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
            <button onClick={() => { setLocal(question); setEditing(true); }} className="p-1 text-gray-400 hover:text-gray-200"><Pencil size={13} /></button>
            <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-400"><Trash2 size={13} /></button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {question.options.map((opt, i) => (
            <span key={i} className={`text-xs px-2 py-0.5 rounded-full border ${opt === question.correct_answer ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-gray-700/40 border-gray-600/30 text-gray-400"}`}>
              {opt}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-gray-800/80 border border-purple-500/30 p-3 space-y-2">
      <Textarea value={local.question_text} onChange={e => setLocal(q => ({ ...q, question_text: e.target.value }))} className="bg-gray-900/50 border-gray-700 text-gray-200 text-sm min-h-[56px]" />
      <div className="space-y-1.5">
        {local.options.map((opt, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input type="radio" checked={local.correct_answer === opt} onChange={() => setLocal(q => ({ ...q, correct_answer: opt }))} className="shrink-0 accent-emerald-500" title="Correct answer" />
            <Input value={opt} onChange={e => { const o = [...local.options]; const wasCorrect = local.correct_answer === opt; o[i] = e.target.value; setLocal(q => ({ ...q, options: o, correct_answer: wasCorrect ? e.target.value : q.correct_answer })); }} className="bg-gray-900/50 border-gray-700 text-gray-200 text-sm h-8" />
          </div>
        ))}
      </div>
      <p className="text-gray-500 text-[11px]">Radio selects the correct answer</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} className="bg-purple-600 hover:bg-purple-700 text-white h-7 text-xs px-3"><Save size={11} className="mr-1" />Save</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="text-gray-400 h-7 text-xs px-3">Cancel</Button>
      </div>
    </div>
  );
}

function QuestionSection({ difficulty, questions, onChange }: { difficulty: Difficulty; questions: GeneratedQuestion[]; onChange: (qs: GeneratedQuestion[]) => void }) {
  const [expanded, setExpanded] = useState(difficulty === "easy");
  const [newIdx, setNewIdx] = useState<number | null>(null);

  function addBlank() {
    const blank: GeneratedQuestion = { question_text: "", options: ["", "", "", ""], correct_answer: "" };
    const next = [...questions, blank];
    onChange(next);
    setNewIdx(next.length - 1);
    setExpanded(true);
  }

  return (
    <div className="rounded-xl border border-gray-700/40 overflow-hidden">
      <button onClick={() => setExpanded(e => !e)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/40 hover:bg-gray-800/60 transition-colors">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${DIFF_COLORS[difficulty]}`}>{DIFF_LABELS[difficulty]}</span>
          <span className="text-gray-400 text-sm">{questions.length} questions</span>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {expanded && (
        <div className="p-3 space-y-2 bg-gray-900/20">
          {questions.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-2">No questions yet — add one below</p>
          )}
          {questions.map((q, i) => (
            <QuestionEditor
              key={i}
              question={q}
              autoEdit={i === newIdx}
              onChange={updated => { const n = [...questions]; n[i] = updated; onChange(n); setNewIdx(null); }}
              onDelete={() => { onChange(questions.filter((_, idx) => idx !== i)); if (newIdx === i) setNewIdx(null); }}
            />
          ))}
          <button
            onClick={addBlank}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            <Plus size={14} /> Add question
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminPoolsPage() {
  const { user, session } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"create" | "manage">("create");
  const [step, setStep] = useState<"suggest" | "form" | "preview">("suggest");

  // When set, we're adding more questions to an existing pool (not creating new)
  const [appendTarget, setAppendTarget] = useState<{ id: string; title: string; category: string } | null>(null);

  // Media item linking
  const [linkedMedia, setLinkedMedia] = useState<LinkedMedia | null>(null);
  const [mediaQuery, setMediaQuery] = useState("");
  const [mediaResults, setMediaResults] = useState<LinkedMedia[]>([]);
  const [mediaSearching, setMediaSearching] = useState(false);
  const mediaDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Suggestion state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");

  // Form state
  const [poolName, setPoolName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("TV Shows");
  const [topic, setTopic] = useState("");
  const [emoji, setEmoji] = useState("📺");
  const [posterUrl, setPosterUrl] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Generated questions
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestions | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Admin check
  const { data: currentProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["admin-profile-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("users").select("id, is_admin").eq("id", user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!profileLoading && currentProfile && !currentProfile.is_admin) setLocation("/");
  }, [currentProfile, profileLoading]);

  // Pools list
  const { data: pools = [], isLoading: poolsLoading, refetch: refetchPools } = useQuery<PoolRow[]>({
    queryKey: ["challenge-pools-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("challenge_pools").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Sync emoji when category changes
  useEffect(() => {
    setEmoji(CATEGORY_EMOJIS[category] || "🎮");
  }, [category]);

  async function callEdgeFunction(payload: object) {
    const { data: { session } } = await supabase.auth.getSession();
    const resp = await fetch(`${supabaseUrl}/functions/v1/generate-challenge-pool`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}`, "apikey": supabaseAnonKey },
      body: JSON.stringify(payload),
    });
    const result = await resp.json();
    if (!resp.ok || result.error) throw new Error(result.error || "Request failed");
    return result;
  }

  async function handleSuggest() {
    setSuggestLoading(true);
    setSuggestions([]);
    try {
      const result = await callEdgeFunction({ action: "suggest_topics", categoryFilter: categoryFilter === "all" ? "" : categoryFilter });
      setSuggestions(result.suggestions || []);
    } catch (err: any) {
      toast({ title: "Couldn't load suggestions", description: err.message, variant: "destructive" });
    } finally {
      setSuggestLoading(false);
    }
  }

  const searchMedia = useCallback(async (query: string, cat: string) => {
    if (!query.trim() || !session?.access_token) { setMediaResults([]); return; }
    setMediaSearching(true);
    try {
      const mediaType = CATEGORY_TO_MEDIA_TYPE[cat] || "";
      const body: Record<string, string> = { query };
      if (mediaType) body.type = mediaType;
      const resp = await fetch(`${supabaseUrl}/functions/v1/media-search`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) { setMediaResults([]); return; }
      const data = await resp.json();
      const results: LinkedMedia[] = (data.results || []).slice(0, 6).map((r: any) => ({
        external_id: r.external_id,
        external_source: r.external_source,
        title: r.title,
        poster_url: r.image_url || r.poster_url || r.image || "",
        type: r.type || "",
        year: r.year || "",
      }));
      setMediaResults(results);
    } catch {
      setMediaResults([]);
    } finally {
      setMediaSearching(false);
    }
  }, [session?.access_token]);

  function triggerMediaSearch(query: string, cat: string) {
    if (mediaDebounceRef.current) clearTimeout(mediaDebounceRef.current);
    mediaDebounceRef.current = setTimeout(() => searchMedia(query, cat), 400);
  }

  function selectSuggestion(s: Suggestion) {
    setPoolName(s.title);
    setDescription(s.description);
    setCategory(s.category as Category);
    setTopic(s.topic_context);
    setEmoji(s.emoji || CATEGORY_EMOJIS[s.category as Category] || "🎮");
    setPosterUrl("");
    setLinkedMedia(null);
    setMediaQuery(s.title);
    setMediaResults([]);
    setStep("form");
    // Auto-trigger search with the suggestion title
    triggerMediaSearch(s.title, s.category);
  }

  function startCustom() {
    setAppendTarget(null);
    setPoolName(""); setDescription(""); setTopic(""); setPosterUrl("");
    setCategory("TV Shows"); setEmoji("📺");
    setLinkedMedia(null); setMediaQuery(""); setMediaResults([]);
    setStep("form");
  }

  function startAddQuestions(pool: PoolRow) {
    setAppendTarget({ id: pool.id, title: pool.title, category: pool.category || "TV Shows" });
    setPoolName(pool.title);
    setCategory((pool.category as Category) || "TV Shows");
    setDescription("");
    setTopic("");
    setPosterUrl("");
    setGeneratedQuestions(null);
    // Pre-fill existing media link if any
    if (pool.media_external_id && pool.media_external_source) {
      setLinkedMedia({ external_id: pool.media_external_id, external_source: pool.media_external_source, title: pool.title, poster_url: pool.poster_url || "", type: "" });
    } else {
      setLinkedMedia(null);
      setMediaQuery(pool.title);
      triggerMediaSearch(pool.title, pool.category || "TV Shows");
    }
    setMediaResults([]);
    setStep("form");
    setActiveTab("create");
  }

  async function handleGenerate() {
    if (!poolName.trim() || !topic.trim()) {
      toast({ title: "Fill in the Pool Name and Topic first", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setGeneratedQuestions(null);
    try {
      const result = await callEdgeFunction({ action: "generate", poolName, topic, category });
      setGeneratedQuestions(result.questions);
      toast({ title: `${result.total} questions generated`, description: `${result.counts.easy} easy · ${result.counts.medium} medium · ${result.counts.hard} hard` });
      setStep("preview");
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!generatedQuestions || !poolName.trim()) return;
    setSaving(true);
    try {
      if (appendTarget) {
        // Add questions to existing pool
        const result = await callEdgeFunction({
          action: "append_questions",
          pool_id: appendTarget.id,
          questions: generatedQuestions,
        });
        toast({ title: `${result.added} questions added to "${appendTarget.title}"!`, description: "Players will now see the expanded question bank with random selection each round." });
      } else {
        // Create brand-new pool
        await callEdgeFunction({
          action: "save",
          pool: {
            show_tag: poolName.trim(),
            title: poolName.trim(),
            description: description.trim() || null,
            category,
            poster_url: posterUrl.trim() || linkedMedia?.poster_url || null,
            fallback_emoji: emoji,
            accent_color: "#7c3aed",
            media_external_id: linkedMedia?.external_id || null,
            media_external_source: linkedMedia?.external_source || null,
          },
          questions: generatedQuestions,
        });
        toast({ title: `"${poolName}" saved!`, description: "It will now appear in the Pools list for players." });
      }
      setPoolName(""); setDescription(""); setTopic(""); setPosterUrl(""); setGeneratedQuestions(null);
      setLinkedMedia(null); setMediaQuery(""); setMediaResults([]);
      setStep("suggest"); setSuggestions([]); setAppendTarget(null);
      refetchPools();
      setActiveTab("manage");
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(poolId: string, title: string) {
    if (!confirm(`Delete "${title}" and all its questions?`)) return;
    try {
      await callEdgeFunction({ action: "delete", pool_id: poolId });
      toast({ title: `"${title}" deleted` });
      refetchPools();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  }

  if (profileLoading || !user) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-purple-400" /></div>;
  }
  if (!currentProfile?.is_admin) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><p className="text-gray-400">Access restricted</p></div>;
  }

  const totalGenerated = generatedQuestions
    ? (generatedQuestions.easy?.length || 0) + (generatedQuestions.medium?.length || 0) + (generatedQuestions.hard?.length || 0)
    : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8 pb-24">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => setLocation("/admin")} className="p-2 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-gray-800/50 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Challenge Pools</h1>
            <p className="text-gray-400 text-sm">AI-generated trivia pools — no code changes needed</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-900 rounded-xl mb-6">
          {(["create", "manage"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? "bg-gray-800 text-white" : "text-gray-400 hover:text-gray-200"}`}>
              {tab === "create" ? "Create Pool" : `Manage ${pools.length > 0 ? `(${pools.length})` : ""}`}
            </button>
          ))}
        </div>

        {/* ── CREATE TAB ─────────────────────────────────────────────── */}
        {activeTab === "create" && (
          <div className="space-y-5">

            {/* STEP: SUGGEST */}
            {step === "suggest" && (
              <div className="space-y-5">
                {/* Suggest button + filter */}
                <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-5 space-y-4">
                  <div>
                    <h2 className="text-white font-semibold mb-1">Let AI suggest popular topics</h2>
                    <p className="text-gray-400 text-sm">Pick a category or leave it mixed, then hit Suggest and choose one to build.</p>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {(["all", ...CATEGORIES] as const).map(c => (
                      <button key={c} onClick={() => setCategoryFilter(c as any)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${categoryFilter === c ? "bg-purple-600 border-purple-500 text-white" : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300"}`}>
                        {c === "all" ? "All categories" : c}
                      </button>
                    ))}
                  </div>

                  <Button onClick={handleSuggest} disabled={suggestLoading} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                    {suggestLoading ? <><Loader2 size={16} className="mr-2 animate-spin" />Thinking up topics...</> : <><Sparkles size={16} className="mr-2" />Suggest Pool Ideas</>}
                  </Button>
                </div>

                {/* Suggestion cards */}
                {suggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-gray-400 text-xs px-1">Click any topic to start building it</p>
                    {suggestions.map((s, i) => (
                      <button key={i} onClick={() => selectSuggestion(s)}
                        className="w-full text-left rounded-xl bg-gray-900/50 border border-gray-800 hover:border-purple-500/40 hover:bg-gray-800/60 p-4 transition-all group">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl shrink-0">{s.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-white font-semibold text-sm">{s.title}</p>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 shrink-0">{s.category}</span>
                            </div>
                            <p className="text-gray-400 text-xs leading-snug">{s.description}</p>
                          </div>
                          <ArrowRight size={16} className="text-gray-600 group-hover:text-purple-400 transition-colors shrink-0" />
                        </div>
                      </button>
                    ))}
                    <Button variant="ghost" onClick={() => handleSuggest()} disabled={suggestLoading} className="w-full text-gray-400 text-sm">
                      <RefreshCw size={14} className="mr-1.5" /> Refresh suggestions
                    </Button>
                  </div>
                )}

                {/* Divider + manual option */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-800" /></div>
                  <div className="relative flex justify-center">
                    <span className="bg-gray-950 px-3 text-gray-500 text-xs">or</span>
                  </div>
                </div>
                <Button variant="outline" onClick={startCustom} className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
                  <Plus size={16} className="mr-2" /> Create a pool from scratch
                </Button>
              </div>
            )}

            {/* STEP: FORM */}
            {step === "form" && (
              <div className="space-y-4">
                <button
                  onClick={() => { setAppendTarget(null); setStep("suggest"); }}
                  className="flex items-center gap-1.5 text-gray-400 hover:text-gray-200 text-sm transition-colors"
                >
                  <ArrowLeft size={14} /> {appendTarget ? "Cancel" : "Back to suggestions"}
                </button>

                {appendTarget && (
                  <div className="rounded-xl bg-purple-900/20 border border-purple-700/40 px-4 py-3 flex items-start gap-3">
                    <Plus size={16} className="text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-purple-300 text-sm font-medium">Adding questions to "{appendTarget.title}"</p>
                      <p className="text-purple-400/70 text-xs mt-0.5">Generate 36 new questions — they'll be added to the existing bank. Players get a random 12 each session.</p>
                    </div>
                  </div>
                )}

                <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-5 space-y-4">
                  <h2 className="text-white font-semibold">{appendTarget ? "Question details" : "Pool details"}</h2>

                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">Pool name *</label>
                    <Input
                      value={poolName}
                      onChange={e => !appendTarget && setPoolName(e.target.value)}
                      readOnly={!!appendTarget}
                      placeholder='e.g. "Breaking Bad"'
                      className={`bg-gray-800/50 border-gray-700 text-white ${appendTarget ? "opacity-60 cursor-not-allowed" : ""}`}
                    />
                    {appendTarget && <p className="text-xs text-gray-500 mt-1">Pool name is locked — questions will be added to this pool.</p>}
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">Category *</label>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {CATEGORIES.map(c => (
                        <button key={c} onClick={() => setCategory(c)}
                          className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-medium transition-all ${category === c ? "bg-purple-600/20 border-purple-500/50 text-purple-300" : "border-gray-700 text-gray-400 hover:border-gray-500"}`}>
                          <span className="text-lg">{CATEGORY_EMOJIS[c]}</span>
                          <span className="leading-tight text-center">{c.replace(" & ", " &\n")}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">Short description</label>
                    <Input value={description} onChange={e => setDescription(e.target.value)} placeholder='e.g. "Say my name — if you can answer all 36 questions."' className="bg-gray-800/50 border-gray-700 text-white" />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">
                      Topic context for AI *
                      <span className="text-gray-600 ml-1">— the more specific, the better</span>
                    </label>
                    <Textarea value={topic} onChange={e => setTopic(e.target.value)}
                      placeholder='e.g. "Breaking Bad (2008–2013), all 5 seasons. Walter White, Jesse Pinkman, Heisenberg, chemistry, cartel, Skyler, Hank, the desert, key episodes like Ozymandias."'
                      className="bg-gray-800/50 border-gray-700 text-white min-h-[80px]" />
                  </div>

                  {/* ── Media item link ── */}
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5">
                      <Link2 size={11} />
                      Link to media item
                      <span className="text-gray-600">— connects engagement to your media database</span>
                    </label>

                    {linkedMedia ? (
                      <div className="flex items-center gap-3 rounded-xl bg-emerald-900/20 border border-emerald-700/30 px-3 py-2.5">
                        {linkedMedia.poster_url
                          ? <img src={linkedMedia.poster_url} alt={linkedMedia.title} className="w-8 h-10 object-cover rounded shrink-0" />
                          : <div className="w-8 h-10 bg-gray-800 rounded shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-emerald-300 text-sm font-medium truncate">{linkedMedia.title}</p>
                          <p className="text-gray-500 text-xs">{linkedMedia.external_source} · {linkedMedia.external_id}</p>
                        </div>
                        <button onClick={() => { setLinkedMedia(null); setMediaResults([]); }} className="p-1 text-gray-500 hover:text-gray-300 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="relative">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                          <Input
                            value={mediaQuery}
                            onChange={e => { setMediaQuery(e.target.value); triggerMediaSearch(e.target.value, category); }}
                            placeholder={`Search ${category}...`}
                            className="pl-8 bg-gray-800/50 border-gray-700 text-white text-sm"
                          />
                          {mediaSearching && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-500" />}
                        </div>
                        {mediaResults.length > 0 && (
                          <div className="rounded-xl border border-gray-700 overflow-hidden divide-y divide-gray-700/50">
                            {mediaResults.map((r, i) => (
                              <button key={i} onClick={() => { setLinkedMedia(r); setMediaResults([]); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-800/60 transition-colors text-left">
                                {r.poster_url
                                  ? <img src={r.poster_url} alt={r.title} className="w-7 h-9 object-cover rounded shrink-0" />
                                  : <div className="w-7 h-9 bg-gray-700 rounded shrink-0" />}
                                <div className="min-w-0">
                                  <p className="text-white text-sm truncate">{r.title}</p>
                                  <p className="text-gray-500 text-xs">{r.external_source}{r.year ? ` · ${r.year}` : ""}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        {!linkedMedia && (
                          <p className="text-xs text-gray-600">Optional — but highly recommended so analytics can track engagement per title.</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Advanced (hidden by default) */}
                  <button onClick={() => setShowAdvanced(a => !a)} className="text-gray-500 text-xs flex items-center gap-1 hover:text-gray-400 transition-colors">
                    {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {showAdvanced ? "Hide" : "Show"} advanced options (emoji, poster URL)
                  </button>
                  {showAdvanced && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 mb-1.5 block">Emoji</label>
                        <Input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={4} className="bg-gray-800/50 border-gray-700 text-white" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-gray-400 mb-1.5 block">Poster URL (optional)</label>
                        <Input value={posterUrl} onChange={e => setPosterUrl(e.target.value)} placeholder="https://image.tmdb.org/t/p/w200/..." className="bg-gray-800/50 border-gray-700 text-white" />
                      </div>
                    </div>
                  )}
                </div>

                <Button onClick={handleGenerate} disabled={generating || !poolName.trim() || !topic.trim()} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                  {generating
                    ? <><Loader2 size={16} className="mr-2 animate-spin" />Generating 36 questions...</>
                    : <><Sparkles size={16} className="mr-2" />Generate 36 Questions with AI</>}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-800" /></div>
                  <div className="relative flex justify-center">
                    <span className="bg-gray-950 px-3 text-gray-500 text-xs">or</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  disabled={!poolName.trim()}
                  onClick={() => {
                    if (!poolName.trim()) {
                      toast({ title: "Fill in the Pool Name first", variant: "destructive" });
                      return;
                    }
                    setGeneratedQuestions({ easy: [], medium: [], hard: [] });
                    setStep("preview");
                  }}
                  className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
                >
                  <Pencil size={15} className="mr-2" /> Write questions myself
                </Button>
              </div>
            )}

            {/* STEP: PREVIEW */}
            {step === "preview" && generatedQuestions && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <button onClick={() => setStep("form")} className="flex items-center gap-1.5 text-gray-400 hover:text-gray-200 text-sm transition-colors">
                    <ArrowLeft size={14} /> Back to form
                  </button>
                  {totalGenerated > 0 && (
                    <Button size="sm" variant="ghost" onClick={handleGenerate} disabled={generating} className="text-gray-400 text-xs">
                      <RefreshCw size={13} className="mr-1" />Regenerate
                    </Button>
                  )}
                </div>

                {/* Pool summary */}
                <div className="flex items-center gap-3 rounded-xl bg-gray-900/50 border border-gray-800 p-4">
                  <span className="text-3xl">{emoji}</span>
                  <div>
                    <p className="text-white font-bold">{poolName}</p>
                    <p className="text-gray-400 text-xs">{category} · {totalGenerated} question{totalGenerated !== 1 ? "s" : ""}</p>
                    {description && <p className="text-gray-500 text-xs mt-0.5 italic">{description}</p>}
                  </div>
                </div>

                {totalGenerated > 0 ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                    <p className="text-gray-300 text-sm">{totalGenerated} questions ready — review and edit any below</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl bg-blue-900/20 border border-blue-700/30 px-4 py-3">
                    <Pencil size={15} className="text-blue-400 shrink-0" />
                    <p className="text-blue-300 text-sm">Add your questions below — use Easy, Medium, and Hard tiers to organise by difficulty.</p>
                  </div>
                )}
                {totalGenerated > 0 && (
                  <p className="text-gray-500 text-xs px-0.5">Hover a question and click the pencil to edit it. The radio button marks the correct answer.</p>
                )}

                {(["easy", "medium", "hard"] as Difficulty[]).map(diff => (
                  <QuestionSection key={diff} difficulty={diff} questions={generatedQuestions[diff] || []}
                    onChange={qs => setGeneratedQuestions(prev => prev ? { ...prev, [diff]: qs } : prev)} />
                ))}

                <Button onClick={handleSave} disabled={saving || !poolName.trim()} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                  {saving
                    ? <><Loader2 size={16} className="mr-2 animate-spin" />{appendTarget ? "Adding questions..." : "Saving..."}</>
                    : appendTarget
                      ? <><Plus size={16} className="mr-2" />Add {totalGenerated} Questions to "{appendTarget.title}"</>
                      : <><Save size={16} className="mr-2" />Save Pool to Database</>
                  }
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── MANAGE TAB ─────────────────────────────────────────────── */}
        {activeTab === "manage" && (
          <div className="space-y-3">
            {poolsLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-500" /></div>
            ) : pools.length === 0 ? (
              <div className="text-center py-16">
                <Layers size={32} className="text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No pools created yet</p>
                <Button size="sm" onClick={() => setActiveTab("create")} className="mt-4 bg-purple-600 hover:bg-purple-700 text-white">
                  <Plus size={14} className="mr-1.5" />Create a Pool
                </Button>
              </div>
            ) : (
              pools.map(pool => <PoolCard key={pool.id} pool={pool} onDelete={handleDelete} onAddQuestions={startAddQuestions} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pool card in manage tab ───────────────────────────────────────────────────
function PoolCard({ pool, onDelete, onAddQuestions }: { pool: PoolRow; onDelete: (id: string, title: string) => void; onAddQuestions: (pool: PoolRow) => void }) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function toggle() {
    if (counts) { setExpanded(e => !e); return; }
    setLoading(true);
    const { data } = await supabase.from("challenge_questions").select("difficulty").eq("pool_id", pool.id);
    const c: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
    for (const row of data || []) if (row.difficulty in c) c[row.difficulty]++;
    setCounts(c);
    setLoading(false);
    setExpanded(true);
  }

  return (
    <div className="rounded-xl bg-gray-900/50 border border-gray-800 overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        {pool.poster_url
          ? <img src={pool.poster_url} alt={pool.title} className="w-10 h-14 object-cover rounded-lg shrink-0" />
          : <div className="w-10 h-14 bg-gray-800 rounded-lg flex items-center justify-center shrink-0 text-xl">{pool.fallback_emoji || "🎮"}</div>}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold truncate">{pool.title}</p>
          <p className="text-gray-400 text-xs truncate">{pool.description || "No description"}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-gray-600 text-xs">{pool.category}</p>
            {pool.media_external_id
              ? <span className="flex items-center gap-1 text-emerald-500/80 text-xs"><LinkIcon size={9} />{pool.media_external_source}</span>
              : <span className="flex items-center gap-1 text-amber-600/60 text-xs"><LinkIcon size={9} />not linked</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onAddQuestions(pool)}
            title="Add more questions to this pool"
            className="p-2 text-gray-400 hover:text-purple-400 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus size={16} />
          </button>
          <button onClick={toggle} className="p-2 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-gray-800 transition-colors">
            {loading ? <Loader2 size={16} className="animate-spin" /> : expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button onClick={() => onDelete(pool.id, pool.title)} className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {expanded && counts && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex gap-2">
            {(["easy", "medium", "hard"] as Difficulty[]).map(diff => (
              <div key={diff} className={`flex-1 rounded-lg p-2 text-center border ${DIFF_COLORS[diff]}`}>
                <p className="text-xs font-medium">{DIFF_LABELS[diff]}</p>
                <p className="text-lg font-bold">{counts[diff]}</p>
                <p className="text-xs opacity-60">questions</p>
              </div>
            ))}
          </div>
          {Object.values(counts).some(c => c > 12) && (
            <p className="text-xs text-purple-400/80 flex items-center gap-1.5">
              <RefreshCw size={11} />
              This pool has more than 12 questions per tier — players get a random 12 each play, so each session feels fresh.
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddQuestions(pool)}
            className="w-full border-purple-700/40 text-purple-300 hover:bg-purple-900/30 text-xs"
          >
            <Plus size={12} className="mr-1.5" />Add 36 More Questions
          </Button>
        </div>
      )}
    </div>
  );
}
