import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import {
  Sparkles, ArrowLeft, Loader2, Trash2, ChevronDown, ChevronUp,
  CheckCircle, Layers, Plus, Pencil, X, Save,
} from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Difficulty = "easy" | "medium" | "hard";

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
}

const DIFF_LABELS: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };
const DIFF_COLORS: Record<Difficulty, string> = {
  easy: "bg-emerald-500/20 text-emerald-300",
  medium: "bg-amber-500/20 text-amber-300",
  hard: "bg-red-500/20 text-red-300",
};

function QuestionEditor({
  question,
  onChange,
  onDelete,
}: {
  question: GeneratedQuestion;
  onChange: (q: GeneratedQuestion) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [localQ, setLocalQ] = useState(question);

  function save() {
    onChange(localQ);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="rounded-lg bg-gray-800/60 border border-gray-700/40 p-3 group">
        <div className="flex items-start justify-between gap-2">
          <p className="text-gray-200 text-sm flex-1">{question.question_text}</p>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button onClick={() => { setLocalQ(question); setEditing(true); }} className="p-1 text-gray-400 hover:text-gray-200">
              <Pencil size={13} />
            </button>
            <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-400">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {question.options.map((opt, i) => (
            <span
              key={i}
              className={`text-xs px-2 py-0.5 rounded-full border ${opt === question.correct_answer ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-gray-700/50 border-gray-600/40 text-gray-400"}`}
            >
              {opt}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-gray-800/80 border border-purple-500/30 p-3 space-y-2">
      <Textarea
        value={localQ.question_text}
        onChange={e => setLocalQ(q => ({ ...q, question_text: e.target.value }))}
        className="bg-gray-900/50 border-gray-700 text-gray-200 text-sm min-h-[60px]"
        placeholder="Question text..."
      />
      <div className="space-y-1.5">
        {localQ.options.map((opt, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              type="radio"
              checked={localQ.correct_answer === opt}
              onChange={() => setLocalQ(q => ({ ...q, correct_answer: opt }))}
              className="shrink-0 accent-emerald-500"
              title="Mark as correct answer"
            />
            <Input
              value={opt}
              onChange={e => {
                const newOpts = [...localQ.options];
                const wasCorrect = localQ.correct_answer === opt;
                newOpts[i] = e.target.value;
                setLocalQ(q => ({
                  ...q,
                  options: newOpts,
                  correct_answer: wasCorrect ? e.target.value : q.correct_answer,
                }));
              }}
              className="bg-gray-900/50 border-gray-700 text-gray-200 text-sm h-8"
            />
          </div>
        ))}
      </div>
      <p className="text-gray-500 text-xs">Radio = correct answer</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} className="bg-purple-600 hover:bg-purple-700 text-white h-7 text-xs px-3">
          <Save size={11} className="mr-1" /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="text-gray-400 h-7 text-xs px-3">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function QuestionSection({
  difficulty,
  questions,
  onChange,
}: {
  difficulty: Difficulty;
  questions: GeneratedQuestion[];
  onChange: (qs: GeneratedQuestion[]) => void;
}) {
  const [expanded, setExpanded] = useState(difficulty === "easy");

  function updateQ(i: number, updated: GeneratedQuestion) {
    const next = [...questions];
    next[i] = updated;
    onChange(next);
  }

  function deleteQ(i: number) {
    onChange(questions.filter((_, idx) => idx !== i));
  }

  return (
    <div className="rounded-xl border border-gray-700/40 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/40 hover:bg-gray-800/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DIFF_COLORS[difficulty]}`}>
            {DIFF_LABELS[difficulty]}
          </span>
          <span className="text-gray-400 text-sm">{questions.length} questions</span>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {expanded && (
        <div className="p-3 space-y-2 bg-gray-900/20">
          {questions.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No questions in this tier</p>
          ) : (
            questions.map((q, i) => (
              <QuestionEditor
                key={i}
                question={q}
                onChange={updated => updateQ(i, updated)}
                onDelete={() => deleteQ(i)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPoolsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"create" | "manage">("create");

  // Form state
  const [poolName, setPoolName] = useState("");
  const [showTag, setShowTag] = useState("");
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("TV & Movies");
  const [posterUrl, setPosterUrl] = useState("");
  const [emoji, setEmoji] = useState("🎮");

  // Auto-fill show_tag from pool name
  useEffect(() => {
    if (!showTag || showTag === poolName.slice(0, showTag.length)) {
      setShowTag(poolName);
    }
  }, [poolName]);

  // Generated questions
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestions | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Admin check
  const { data: currentProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["admin-profile-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("users").select("id, user_name, is_admin").eq("id", user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!profileLoading && currentProfile && !currentProfile.is_admin) {
      setLocation("/");
    }
  }, [currentProfile, profileLoading]);

  // Existing pools
  const { data: pools = [], isLoading: poolsLoading, refetch: refetchPools } = useQuery<PoolRow[]>({
    queryKey: ["challenge-pools-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenge_pools")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  async function handleGenerate() {
    if (!poolName.trim() || !topic.trim()) {
      toast({ title: "Fill in Pool Name and Topic first", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setGeneratedQuestions(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${supabaseUrl}/functions/v1/generate-challenge-pool`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
          "apikey": supabaseAnonKey,
        },
        body: JSON.stringify({ action: "generate", poolName, topic, category }),
      });
      const result = await resp.json();
      if (!resp.ok || !result.success) throw new Error(result.error || "Generation failed");
      setGeneratedQuestions(result.questions);
      toast({
        title: `Generated ${result.total} questions`,
        description: `${result.counts.easy} easy, ${result.counts.medium} medium, ${result.counts.hard} hard`,
      });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!generatedQuestions) return;
    if (!poolName.trim() || !showTag.trim()) {
      toast({ title: "Pool Name and Show Tag are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${supabaseUrl}/functions/v1/generate-challenge-pool`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
          "apikey": supabaseAnonKey,
        },
        body: JSON.stringify({
          action: "save",
          pool: {
            show_tag: showTag.trim(),
            title: poolName.trim(),
            description: description.trim() || null,
            category: category,
            poster_url: posterUrl.trim() || null,
            fallback_emoji: emoji || "🎮",
            accent_color: "#7c3aed",
          },
          questions: generatedQuestions,
        }),
      });
      const result = await resp.json();
      if (!resp.ok || !result.success) throw new Error(result.error || "Save failed");
      toast({ title: `${poolName} pool saved!`, description: "Players can now challenge themselves in this pool." });
      setPoolName("");
      setShowTag("");
      setDescription("");
      setTopic("");
      setPosterUrl("");
      setEmoji("🎮");
      setGeneratedQuestions(null);
      refetchPools();
      setActiveTab("manage");
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(poolId: string, title: string) {
    if (!confirm(`Delete "${title}" and all its questions? This cannot be undone.`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${supabaseUrl}/functions/v1/generate-challenge-pool`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
          "apikey": supabaseAnonKey,
        },
        body: JSON.stringify({ action: "delete", pool_id: poolId }),
      });
      const result = await resp.json();
      if (!resp.ok || !result.success) throw new Error(result.error || "Delete failed");
      toast({ title: `${title} deleted` });
      refetchPools();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  }

  if (profileLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-purple-400" />
      </div>
    );
  }

  if (!currentProfile?.is_admin) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Access restricted</p>
      </div>
    );
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
            <p className="text-gray-400 text-sm">Create AI-generated trivia pools for any show, movie, or franchise</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-900 rounded-xl mb-6">
          {(["create", "manage"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? "bg-gray-800 text-white" : "text-gray-400 hover:text-gray-200"}`}
            >
              {tab === "create" ? "Create Pool" : `Manage Pools ${pools.length > 0 ? `(${pools.length})` : ""}`}
            </button>
          ))}
        </div>

        {/* CREATE TAB */}
        {activeTab === "create" && (
          <div className="space-y-6">
            {/* Pool details form */}
            <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Pool Details</h2>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 mb-1.5 block">Pool Name *</label>
                  <Input
                    value={poolName}
                    onChange={e => setPoolName(e.target.value)}
                    placeholder='e.g. "The Office"'
                    className="bg-gray-800/50 border-gray-700 text-white"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs text-gray-400 mb-1.5 block">
                    Show Tag (URL key) *
                    <span className="text-gray-500 ml-1">— used for routing, e.g. "The Office"</span>
                  </label>
                  <Input
                    value={showTag}
                    onChange={e => setShowTag(e.target.value)}
                    placeholder="The Office"
                    className="bg-gray-800/50 border-gray-700 text-white"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs text-gray-400 mb-1.5 block">Short Description</label>
                  <Input
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder='e.g. "That&apos;s what she said — prove you watched every episode"'
                    className="bg-gray-800/50 border-gray-700 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Category</label>
                  <Input
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="TV & Movies"
                    className="bg-gray-800/50 border-gray-700 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Fallback Emoji</label>
                  <Input
                    value={emoji}
                    onChange={e => setEmoji(e.target.value)}
                    placeholder="🎮"
                    className="bg-gray-800/50 border-gray-700 text-white"
                    maxLength={4}
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs text-gray-400 mb-1.5 block">Poster URL (optional)</label>
                  <Input
                    value={posterUrl}
                    onChange={e => setPosterUrl(e.target.value)}
                    placeholder="https://image.tmdb.org/t/p/w200/..."
                    className="bg-gray-800/50 border-gray-700 text-white"
                  />
                </div>
              </div>
            </div>

            {/* AI generation form */}
            <div className="rounded-xl bg-gray-900/50 border border-gray-800 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">AI Question Generation</h2>

              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">
                  Topic context for AI *
                  <span className="text-gray-500 ml-1">— be specific: seasons, characters, lore</span>
                </label>
                <Textarea
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder={`e.g. "The Office US (2005–2013), all 9 seasons. Focus on Dunder Mifflin Scranton branch characters, episodes, quotes, relationships, and behind-the-scenes facts."`}
                  className="bg-gray-800/50 border-gray-700 text-white min-h-[90px]"
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generating || !poolName.trim() || !topic.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                {generating ? (
                  <><Loader2 size={16} className="mr-2 animate-spin" /> Generating 36 questions...</>
                ) : (
                  <><Sparkles size={16} className="mr-2" /> Generate 36 Questions (12 per tier)</>
                )}
              </Button>
            </div>

            {/* Preview */}
            {generatedQuestions && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={18} className="text-emerald-400" />
                    <h2 className="text-white font-semibold">{totalGenerated} questions generated</h2>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleGenerate}
                    disabled={generating}
                    className="text-gray-400 text-xs"
                  >
                    Regenerate
                  </Button>
                </div>

                <p className="text-gray-500 text-xs">
                  Review and edit any question below. Click the pencil icon to edit question text, options, or the correct answer (radio = correct).
                </p>

                {(["easy", "medium", "hard"] as Difficulty[]).map(diff => (
                  <QuestionSection
                    key={diff}
                    difficulty={diff}
                    questions={generatedQuestions[diff] || []}
                    onChange={qs => setGeneratedQuestions(prev => prev ? { ...prev, [diff]: qs } : prev)}
                  />
                ))}

                <Button
                  onClick={handleSave}
                  disabled={saving || !poolName.trim() || !showTag.trim()}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {saving ? (
                    <><Loader2 size={16} className="mr-2 animate-spin" /> Saving pool...</>
                  ) : (
                    <><Save size={16} className="mr-2" /> Save Pool to Database</>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* MANAGE TAB */}
        {activeTab === "manage" && (
          <div className="space-y-3">
            {poolsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-gray-500" />
              </div>
            ) : pools.length === 0 ? (
              <div className="text-center py-16">
                <Layers size={32} className="text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No pools created yet</p>
                <p className="text-gray-600 text-sm mt-1">Create your first pool in the Create tab</p>
                <Button
                  size="sm"
                  onClick={() => setActiveTab("create")}
                  className="mt-4 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Plus size={14} className="mr-1.5" /> Create a Pool
                </Button>
              </div>
            ) : (
              pools.map(pool => (
                <PoolCard key={pool.id} pool={pool} onDelete={handleDelete} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PoolCard({ pool, onDelete }: { pool: PoolRow; onDelete: (id: string, title: string) => void }) {
  const [questionCounts, setQuestionCounts] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function loadCounts() {
    if (questionCounts) { setExpanded(e => !e); return; }
    setLoading(true);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const sb = createClient(supabaseUrl, supabaseAnonKey);
    const { data } = await sb
      .from("challenge_questions")
      .select("difficulty")
      .eq("pool_id", pool.id);
    const counts: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
    for (const row of data || []) {
      if (row.difficulty in counts) counts[row.difficulty]++;
    }
    setQuestionCounts(counts);
    setLoading(false);
    setExpanded(true);
  }

  return (
    <div className="rounded-xl bg-gray-900/50 border border-gray-800 overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        {pool.poster_url ? (
          <img src={pool.poster_url} alt={pool.title} className="w-10 h-14 object-cover rounded-lg shrink-0" />
        ) : (
          <div className="w-10 h-14 bg-gray-800 rounded-lg flex items-center justify-center shrink-0 text-xl">
            {pool.fallback_emoji || "🎮"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold truncate">{pool.title}</p>
          <p className="text-gray-400 text-xs truncate">{pool.description || "No description"}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gray-500 text-xs">{pool.show_tag}</span>
            {pool.category && (
              <Badge variant="outline" className="text-gray-500 border-gray-700 text-xs py-0 h-4">
                {pool.category}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={loadCounts}
            className="p-2 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-gray-800 transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={() => onDelete(pool.id, pool.title)}
            className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {expanded && questionCounts && (
        <div className="px-4 pb-4 flex gap-2">
          {(["easy", "medium", "hard"] as Difficulty[]).map(diff => (
            <div key={diff} className={`flex-1 rounded-lg p-2 text-center ${DIFF_COLORS[diff]} bg-opacity-10`}>
              <p className="text-xs font-medium">{DIFF_LABELS[diff]}</p>
              <p className="text-lg font-bold">{questionCounts[diff]}</p>
              <p className="text-xs opacity-70">questions</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
