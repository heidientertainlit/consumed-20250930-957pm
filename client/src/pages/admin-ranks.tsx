import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, Loader2, Trash2, Plus, ChevronUp, ChevronDown,
  CheckCircle, BarChart3, Sparkles, ChevronRight, RefreshCw,
  Calendar, FileText, Globe,
} from "lucide-react";

const CATEGORIES = [
  { value: "movies", label: "Movies", emoji: "🎬" },
  { value: "tv", label: "TV", emoji: "📺" },
  { value: "music", label: "Music", emoji: "🎵" },
  { value: "books", label: "Books", emoji: "📚" },
  { value: "podcasts", label: "Podcasts", emoji: "🎙️" },
  { value: "pop_culture", label: "Pop Culture", emoji: "⭐" },
  { value: "gaming", label: "Gaming", emoji: "🎮" },
];

const MEDIA_TYPES: Record<string, string> = {
  movies: "movie",
  tv: "tv",
  music: "music",
  books: "book",
  podcasts: "podcast",
  pop_culture: "mixed",
  gaming: "game",
};

interface RankItem {
  title: string;
  creator: string;
  year: string;
  mediaType: string;
}

interface RankIdea {
  title: string;
  description: string;
}

interface ExistingRank {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  max_items: number | null;
  created_at: string;
  status: string | null;
  scheduled_date: string | null;
  item_count?: number;
  items?: { position: number; title: string; creator: string | null; year: string | null }[];
}

type Step = "setup" | "items" | "preview";
type Tab = "create" | "manage";
type ManageSubTab = "published" | "scheduled" | "drafts";

export default function AdminRanksPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("create");
  const [step, setStep] = useState<Step>("setup");
  const [manageSubTab, setManageSubTab] = useState<ManageSubTab>("published");

  // Setup fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("movies");
  const [maxItems, setMaxItems] = useState(10);

  // Items
  const [items, setItems] = useState<RankItem[]>([]);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemCreator, setNewItemCreator] = useState("");
  const [newItemYear, setNewItemYear] = useState("");

  // AI idea suggestions (step 1)
  const [ideasGenerating, setIdeasGenerating] = useState(false);
  const [suggestedIdeas, setSuggestedIdeas] = useState<RankIdea[]>([]);

  // AI item generation (step 2)
  const [aiGenerating, setAiGenerating] = useState(false);

  // Publish / scheduling
  const [publishing, setPublishing] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");

  // Manage — expanded rank view
  const [expandedRankId, setExpandedRankId] = useState<string | null>(null);

  const { data: currentProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["admin-profile-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("users")
        .select("id, is_admin")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: existingRanks = [], isLoading: ranksLoading, isError: ranksError, refetch: refetchRanks } = useQuery<ExistingRank[]>({
    queryKey: ["admin-consumed-ranks"],
    queryFn: async () => {
      // Try with new columns first; fall back to base columns if schema cache hasn't updated
      let ranks: any[] | null = null;
      const { data: ranksNew, error: errNew } = await supabase
        .from("ranks")
        .select("id, title, description, category, max_items, created_at, status, scheduled_date")
        .eq("origin_type", "consumed")
        .order("created_at", { ascending: false });

      if (errNew) {
        // Fallback: query without new columns (schema cache may not have refreshed yet)
        const { data: ranksFallback, error: errFallback } = await supabase
          .from("ranks")
          .select("id, title, description, category, max_items, created_at")
          .eq("origin_type", "consumed")
          .order("created_at", { ascending: false });
        if (errFallback) throw errFallback;
        ranks = (ranksFallback || []).map((r: any) => ({ ...r, status: "published", scheduled_date: null }));
      } else {
        ranks = ranksNew || [];
      }

      const rankIds = ranks.map((r: any) => r.id);
      if (rankIds.length === 0) return [];

      const { data: itemCounts } = await supabase
        .from("rank_items")
        .select("rank_id")
        .in("rank_id", rankIds);

      const countMap: Record<string, number> = {};
      (itemCounts || []).forEach((i: any) => {
        countMap[i.rank_id] = (countMap[i.rank_id] || 0) + 1;
      });

      return ranks.map((r: any) => ({
        ...r,
        status: r.status || "published",
        item_count: countMap[r.id] || 0,
      }));
    },
    enabled: activeTab === "manage",
  });

  if (!profileLoading && currentProfile && !currentProfile.is_admin) {
    setLocation("/");
    return null;
  }

  if (profileLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-purple-400" />
      </div>
    );
  }

  function addItem() {
    if (!newItemTitle.trim()) return;
    setItems((prev) => [
      ...prev,
      {
        title: newItemTitle.trim(),
        creator: newItemCreator.trim(),
        year: newItemYear.trim(),
        mediaType: MEDIA_TYPES[category] || "mixed",
      },
    ]);
    setNewItemTitle("");
    setNewItemCreator("");
    setNewItemYear("");
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function moveItem(index: number, dir: "up" | "down") {
    setItems((prev) => {
      const next = [...prev];
      const target = dir === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSuggestIdeas() {
    setIdeasGenerating(true);
    setSuggestedIdeas([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const catLabel = CATEGORIES.find((c) => c.value === category)?.label || category;

      const resp = await fetch(`${supabaseUrl}/functions/v1/generate-challenge-pool`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ action: "suggest_ranks", category: catLabel }),
      });

      const raw = await resp.json();
      const ideas: RankIdea[] = raw?.ideas || [];

      if (ideas.length > 0) {
        setSuggestedIdeas(ideas.slice(0, 6));
      } else {
        toast({ title: "Couldn't generate ideas", description: raw?.error || "Try again or enter your own title.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "AI suggestion failed", description: err.message, variant: "destructive" });
    } finally {
      setIdeasGenerating(false);
    }
  }

  async function handleAiGenerate() {
    if (!title.trim()) {
      toast({ title: "Add a title first", description: "The AI needs a title to generate items.", variant: "destructive" });
      return;
    }
    setAiGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const catLabel = CATEGORIES.find((c) => c.value === category)?.label || category;

      const resp = await fetch(`${supabaseUrl}/functions/v1/generate-challenge-pool`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ action: "suggest_rank_items", rankTitle: title, category: catLabel, maxItems }),
      });

      const raw = await resp.json();
      const generated: { title: string; creator: string; year?: string }[] = raw?.items || [];

      if (generated.length > 0) {
        const mediaType = MEDIA_TYPES[category] || "mixed";
        setItems(
          generated.slice(0, maxItems).map((g) => ({
            title: g.title || "",
            creator: g.creator || "",
            year: g.year || "",
            mediaType,
          }))
        );
        toast({ title: `Generated ${generated.length} items`, description: "Review and adjust the list below." });
      } else {
        toast({ title: "Couldn't generate items", description: raw?.error || "Try entering items manually.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "AI generation failed", description: err.message, variant: "destructive" });
    } finally {
      setAiGenerating(false);
    }
  }

  async function handlePublish(status: "published" | "scheduled" | "draft" = "published") {
    if (!title.trim() || items.length < 2) {
      toast({ title: "Need a title and at least 2 items", variant: "destructive" });
      return;
    }
    if (status === "scheduled" && !scheduleDate) {
      toast({ title: "Pick a schedule date first", variant: "destructive" });
      return;
    }
    setPublishing(true);
    try {
      const { data: rank, error: rankErr } = await supabase
        .from("ranks")
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          category,
          visibility: status === "draft" ? "private" : "public",
          origin_type: "consumed",
          max_items: maxItems,
          status,
          scheduled_date: status === "scheduled" ? scheduleDate : null,
        })
        .select("id")
        .single();

      if (rankErr || !rank) throw rankErr || new Error("Failed to create rank");

      const itemRows = items.map((item, idx) => ({
        rank_id: rank.id,
        user_id: user.id,
        position: idx + 1,
        title: item.title,
        creator: item.creator || null,
        year: item.year || null,
        media_type: item.mediaType,
        up_vote_count: 0,
        down_vote_count: 0,
      }));

      const { error: itemsErr } = await supabase.from("rank_items").insert(itemRows);
      if (itemsErr) throw itemsErr;

      if (status === "published") {
        const { error: postErr } = await supabase.from("social_posts").insert({
          user_id: user.id,
          rank_id: rank.id,
          post_type: "rank_share",
          visibility: "public",
          media_title: title.trim(),
          media_type: "rank",
        });
        if (postErr) console.error("Feed post creation failed:", postErr.message);
      }

      const statusLabels = {
        published: { title: "Rank published!", desc: `"${title}" is now live in the Debate the Rank carousel.` },
        scheduled: { title: "Rank scheduled!", desc: `"${title}" will go live on ${new Date(scheduleDate).toLocaleDateString()}.` },
        draft: { title: "Saved as draft", desc: `"${title}" is saved. Publish it from the Manage tab when ready.` },
      };
      toast({ title: statusLabels[status].title, description: statusLabels[status].desc });
      queryClient.invalidateQueries({ queryKey: ["consumed-ranks-carousel"] });
      queryClient.invalidateQueries({ queryKey: ["admin-consumed-ranks"] });

      // Reset
      setTitle("");
      setDescription("");
      setCategory("movies");
      setMaxItems(10);
      setItems([]);
      setScheduleDate("");
      setStep("setup");
      setActiveTab("manage");
      setManageSubTab(status === "scheduled" ? "scheduled" : status === "draft" ? "drafts" : "published");
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  }

  async function handleDeleteRank(rankId: string, rankTitle: string) {
    if (!confirm(`Delete "${rankTitle}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("ranks").delete().eq("id", rankId);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Rank deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-consumed-ranks"] });
      queryClient.invalidateQueries({ queryKey: ["consumed-ranks-carousel"] });
      if (expandedRankId === rankId) setExpandedRankId(null);
      refetchRanks();
    }
  }

  async function handlePublishDraft(rankId: string) {
    const { error } = await supabase
      .from("ranks")
      .update({ status: "published", visibility: "public", scheduled_date: null })
      .eq("id", rankId);
    if (error) {
      toast({ title: "Publish failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Rank published!" });
      queryClient.invalidateQueries({ queryKey: ["admin-consumed-ranks"] });
      queryClient.invalidateQueries({ queryKey: ["consumed-ranks-carousel"] });
      refetchRanks();
    }
  }

  async function loadRankItems(rankId: string): Promise<{ position: number; title: string; creator: string | null; year: string | null }[]> {
    const { data, error } = await supabase
      .from("rank_items")
      .select("position, title, creator, year")
      .eq("rank_id", rankId)
      .order("position", { ascending: true });
    if (error) {
      // Fallback without year column if schema cache hasn't refreshed
      const { data: fallback } = await supabase
        .from("rank_items")
        .select("position, title, creator")
        .eq("rank_id", rankId)
        .order("position", { ascending: true });
      return (fallback || []).map((i: any) => ({ ...i, year: null }));
    }
    return data || [];
  }

  async function toggleExpand(rank: ExistingRank) {
    if (expandedRankId === rank.id) {
      setExpandedRankId(null);
      return;
    }
    setExpandedRankId(rank.id);
    if (!rank.items) {
      const loaded = await loadRankItems(rank.id);
      queryClient.setQueryData(["admin-consumed-ranks"], (old: ExistingRank[] | undefined) =>
        (old || []).map((r) => r.id === rank.id ? { ...r, items: loaded } : r)
      );
    }
  }

  const catEmoji = CATEGORIES.find((c) => c.value === category)?.emoji || "🎬";
  const catLabel = CATEGORIES.find((c) => c.value === category)?.label || category;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => setLocation("/admin")} className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors">
            <ArrowLeft size={18} className="text-gray-300" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Debate the Rank Builder</h1>
            <p className="text-gray-400 text-sm">Create platform-owned ranked lists for the community to debate</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 bg-gray-900 p-1 rounded-xl">
          {(["create", "manage"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setStep("setup"); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                activeTab === tab ? "bg-purple-600 text-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab === "create" ? "Create Rank" : "Manage Ranks"}
            </button>
          ))}
        </div>

        {/* ── CREATE TAB ── */}
        {activeTab === "create" && (
          <div>
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-8">
              {(["setup", "items", "preview"] as Step[]).map((s, i) => {
                const done = (step === "items" && s === "setup") || (step === "preview" && s !== "preview");
                const active = step === s;
                return (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      done ? "bg-purple-600 text-white" : active ? "bg-purple-500 text-white ring-2 ring-purple-400/40" : "bg-gray-800 text-gray-500"
                    }`}>
                      {done ? <CheckCircle size={14} /> : i + 1}
                    </div>
                    <span className={`text-sm font-medium capitalize ${active ? "text-white" : "text-gray-500"}`}>
                      {s === "setup" ? "Setup" : s === "items" ? "Add Items" : "Preview"}
                    </span>
                    {i < 2 && <ChevronRight size={14} className="text-gray-600" />}
                  </div>
                );
              })}
            </div>

            {/* Step 1: Setup */}
            {step === "setup" && (
              <div className="space-y-5">

                {/* AI Suggest Ideas */}
                <div className="bg-gray-900/60 border border-purple-500/20 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Need inspiration?</p>
                      <p className="text-xs text-gray-400 mt-0.5">AI will suggest rank ideas for the selected category</p>
                    </div>
                    <button
                      onClick={() => { setSuggestedIdeas([]); handleSuggestIdeas(); }}
                      disabled={ideasGenerating}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-semibold transition-all disabled:opacity-50 flex-shrink-0"
                    >
                      {ideasGenerating ? (
                        <><Loader2 size={13} className="animate-spin" /> Thinking…</>
                      ) : (
                        <><Sparkles size={13} /> Suggest Ideas</>
                      )}
                    </button>
                  </div>

                  {suggestedIdeas.length > 0 && (
                    <div className="grid grid-cols-1 gap-2">
                      {suggestedIdeas.map((idea, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setTitle(idea.title);
                            setDescription(idea.description);
                            setSuggestedIdeas([]);
                          }}
                          className="text-left px-3 py-2.5 rounded-xl bg-gray-800 hover:bg-purple-600/20 border border-gray-700 hover:border-purple-500/50 transition-all group"
                        >
                          <p className="text-white text-sm font-medium group-hover:text-purple-200 transition-colors">{idea.title}</p>
                          {idea.description && (
                            <p className="text-gray-500 text-xs mt-0.5 group-hover:text-gray-400">{idea.description}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Rank Title *</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Best 90s Movies, GOAT Albums of All Time"
                    className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Description <span className="text-gray-500 font-normal">(optional)</span></label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="A short description of this rank..."
                    rows={3}
                    className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 focus:border-purple-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3">Category *</label>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        onClick={() => { setCategory(cat.value); setSuggestedIdeas([]); }}
                        className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                          category === cat.value
                            ? "bg-purple-600/20 border-purple-500 text-purple-300"
                            : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"
                        }`}
                      >
                        <span className="text-lg">{cat.emoji}</span>
                        <span className="text-xs">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-3">List Size</label>
                  <div className="flex gap-2">
                    {[5, 10, 15, 20].map((n) => (
                      <button
                        key={n}
                        onClick={() => setMaxItems(n)}
                        className={`flex-1 py-2 rounded-xl border text-sm font-semibold transition-all ${
                          maxItems === n
                            ? "bg-purple-600/20 border-purple-500 text-purple-300"
                            : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"
                        }`}
                      >
                        Top {n}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={() => {
                    if (!title.trim()) {
                      toast({ title: "Title is required", variant: "destructive" });
                      return;
                    }
                    setStep("items");
                  }}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl"
                >
                  Next: Add Items <ChevronRight size={16} className="ml-1" />
                </Button>
              </div>
            )}

            {/* Step 2: Add Items */}
            {step === "items" && (
              <div className="space-y-5">
                {/* Summary */}
                <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold text-sm">{title}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{catEmoji} {catLabel} · Top {maxItems}</p>
                  </div>
                  <button onClick={() => setStep("setup")} className="text-xs text-purple-400 hover:text-purple-300 font-medium">Edit</button>
                </div>

                {/* AI Generate */}
                <button
                  onClick={handleAiGenerate}
                  disabled={aiGenerating}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-purple-500/40 bg-purple-600/10 hover:bg-purple-600/20 text-purple-300 text-sm font-semibold transition-all disabled:opacity-50"
                >
                  {aiGenerating ? (
                    <><Loader2 size={16} className="animate-spin" /> Generating {maxItems} items…</>
                  ) : (
                    <><Sparkles size={16} /> AI Generate All {maxItems} Items</>
                  )}
                </button>

                <div className="relative flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-800" />
                  <span className="text-gray-600 text-xs font-medium">or add manually</span>
                  <div className="flex-1 h-px bg-gray-800" />
                </div>

                {/* Manual add */}
                <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-300">Add an Item</p>
                  <Input
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addItem()}
                    placeholder="Title (e.g. Pulp Fiction)"
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-purple-500"
                  />
                  <div className="flex gap-2">
                    <Input
                      value={newItemCreator}
                      onChange={(e) => setNewItemCreator(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addItem()}
                      placeholder="Creator — optional"
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-purple-500 flex-1"
                    />
                    <Input
                      value={newItemYear}
                      onChange={(e) => setNewItemYear(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addItem()}
                      placeholder="Year"
                      maxLength={4}
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-purple-500 w-20"
                    />
                  </div>
                  <Button
                    onClick={addItem}
                    disabled={!newItemTitle.trim()}
                    className="w-full bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-xl"
                  >
                    <Plus size={15} className="mr-1" /> Add to List
                  </Button>
                </div>

                {/* Current item list */}
                {items.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-300">{items.length} item{items.length !== 1 ? "s" : ""} · drag to reorder</p>
                    {items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5"
                      >
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{item.title}</p>
                          <p className="text-gray-400 text-xs truncate">
                            {[item.creator, item.year].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => moveItem(idx, "up")}
                            disabled={idx === 0}
                            className="w-6 h-6 rounded bg-gray-800 hover:bg-gray-700 flex items-center justify-center disabled:opacity-30 transition-colors"
                          >
                            <ChevronUp size={13} className="text-gray-400" />
                          </button>
                          <button
                            onClick={() => moveItem(idx, "down")}
                            disabled={idx === items.length - 1}
                            className="w-6 h-6 rounded bg-gray-800 hover:bg-gray-700 flex items-center justify-center disabled:opacity-30 transition-colors"
                          >
                            <ChevronDown size={13} className="text-gray-400" />
                          </button>
                          <button
                            onClick={() => removeItem(idx)}
                            className="w-6 h-6 rounded bg-gray-800 hover:bg-red-900/50 flex items-center justify-center transition-colors"
                          >
                            <Trash2 size={12} className="text-gray-500 hover:text-red-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {items.length === 0 && (
                  <div className="text-center py-8 bg-gray-900/50 rounded-2xl border border-dashed border-gray-700">
                    <BarChart3 size={32} className="mx-auto mb-2 text-gray-600" />
                    <p className="text-gray-500 text-sm">No items yet — use AI or add manually above</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep("setup")}
                    className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white rounded-xl"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => {
                      if (items.length < 2) {
                        toast({ title: "Add at least 2 items", variant: "destructive" });
                        return;
                      }
                      setStep("preview");
                    }}
                    disabled={items.length < 2}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl"
                  >
                    Preview <ChevronRight size={16} className="ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Preview & Publish */}
            {step === "preview" && (
              <div className="space-y-5">
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  {/* Rank card preview (matches ranks-carousel style) */}
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 size={16} className="text-teal-500" />
                    <span className="text-[11px] font-bold text-gray-500 tracking-wide uppercase">Debate the Rank</span>
                    <span className="ml-auto text-[11px] text-gray-400 font-medium">{catEmoji} {catLabel}</span>
                  </div>
                  <h3 className="text-gray-900 font-bold text-base mb-1">{title}</h3>
                  {description && <p className="text-gray-500 text-xs mb-3">{description}</p>}
                  <div className="space-y-1.5 mt-3">
                    {items.slice(0, 6).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2.5 py-2 px-2.5 rounded-xl bg-gray-50 border border-gray-100">
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold ${
                          idx === 0 ? "bg-gradient-to-br from-teal-500 to-emerald-600 text-white" :
                          idx === 1 ? "bg-gradient-to-br from-teal-400 to-emerald-500 text-white" :
                          "bg-gradient-to-br from-teal-300 to-emerald-400 text-white"
                        }`}>
                          {idx + 1}
                        </div>
                        <span className="text-gray-900 text-sm font-medium flex-1 truncate">{item.title}</span>
                        {item.creator && <span className="text-gray-400 text-xs truncate max-w-[100px]">{item.creator}</span>}
                      </div>
                    ))}
                    {items.length > 6 && (
                      <p className="text-gray-400 text-xs text-center pt-1">+{items.length - 6} more items</p>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-teal-600 font-semibold">🏆 Consumed</span>
                    <span className="text-xs text-gray-400">{items.length} items</span>
                  </div>
                </div>

                {/* Schedule date picker (only shown when scheduling) */}
                <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-4 space-y-3">
                  <p className="text-sm text-gray-400">
                    Choose how to save this rank:
                  </p>
                  <div className="space-y-2">
                    <label className="text-xs text-gray-500 font-medium">Schedule date (optional — for timed publish)</label>
                    <Input
                      type="datetime-local"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white focus:border-purple-500 text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep("items")}
                    className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white rounded-xl px-3"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => handlePublish("draft")}
                    disabled={publishing}
                    variant="outline"
                    className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white rounded-xl text-sm"
                  >
                    <FileText size={14} className="mr-1.5" /> Save Draft
                  </Button>
                  <Button
                    onClick={() => handlePublish("scheduled")}
                    disabled={publishing || !scheduleDate}
                    variant="outline"
                    className="flex-1 border-blue-700 text-blue-300 hover:bg-blue-900/30 rounded-xl text-sm disabled:opacity-40"
                  >
                    <Calendar size={14} className="mr-1.5" /> Schedule
                  </Button>
                  <Button
                    onClick={() => handlePublish("published")}
                    disabled={publishing}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl text-sm"
                  >
                    {publishing ? (
                      <Loader2 size={14} className="animate-spin mr-1.5" />
                    ) : (
                      <Globe size={14} className="mr-1.5" />
                    )}
                    Publish
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MANAGE TAB ── */}
        {activeTab === "manage" && (
          <div>
            {/* Sub-tabs */}
            <div className="flex items-center gap-1 bg-gray-900 rounded-xl p-1 mb-5">
              {(["published", "scheduled", "drafts"] as ManageSubTab[]).map((tab) => {
                const counts = {
                  published: existingRanks.filter((r) => (r.status || "published") === "published").length,
                  scheduled: existingRanks.filter((r) => r.status === "scheduled").length,
                  drafts: existingRanks.filter((r) => r.status === "draft").length,
                };
                const labels = { published: "Published", scheduled: "Scheduled", drafts: "Drafts" };
                return (
                  <button
                    key={tab}
                    onClick={() => setManageSubTab(tab)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      manageSubTab === tab
                        ? "bg-purple-600 text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {labels[tab]}
                    {counts[tab] > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        manageSubTab === tab ? "bg-white/20 text-white" : "bg-gray-700 text-gray-300"
                      }`}>{counts[tab]}</span>
                    )}
                  </button>
                );
              })}
              <button onClick={() => refetchRanks()} className="p-2 rounded-lg hover:bg-gray-800 transition-colors ml-1">
                <RefreshCw size={13} className="text-gray-400" />
              </button>
            </div>

            {ranksLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-purple-400" />
              </div>
            )}

            {ranksError && !ranksLoading && (
              <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-4 flex items-center justify-between">
                <p className="text-red-400 text-sm">Failed to load ranks</p>
                <button onClick={() => refetchRanks()} className="text-red-300 hover:text-white text-xs font-medium flex items-center gap-1">
                  <RefreshCw size={12} /> Retry
                </button>
              </div>
            )}

            {(() => {
              const filtered = existingRanks.filter((r) => {
                const s = r.status || "published";
                if (manageSubTab === "published") return s === "published";
                if (manageSubTab === "scheduled") return s === "scheduled";
                return s === "draft";
              });

              if (!ranksLoading && filtered.length === 0) {
                return (
                  <div className="text-center py-12 bg-gray-900/50 rounded-2xl border border-dashed border-gray-700">
                    <BarChart3 size={32} className="mx-auto mb-2 text-gray-600" />
                    <p className="text-gray-500 text-sm">
                      {manageSubTab === "published" && "No published ranks yet"}
                      {manageSubTab === "scheduled" && "No scheduled ranks"}
                      {manageSubTab === "drafts" && "No drafts saved"}
                    </p>
                    <button
                      onClick={() => setActiveTab("create")}
                      className="mt-3 text-purple-400 hover:text-purple-300 text-sm font-medium"
                    >
                      Create a rank →
                    </button>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {filtered.map((rank) => {
                    const cat = CATEGORIES.find((c) => c.value === rank.category);
                    const isExpanded = expandedRankId === rank.id;
                    return (
                      <div key={rank.id} className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
                        {/* Rank header row — click to expand */}
                        <div
                          className="p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-800/50 transition-colors"
                          onClick={() => toggleExpand(rank)}
                        >
                          <div className="text-2xl flex-shrink-0">{cat?.emoji || "📋"}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold text-sm truncate">{rank.title}</p>
                            <p className="text-gray-400 text-xs mt-0.5">
                              {cat?.label || rank.category} · {rank.item_count ?? 0} items
                              {" · "}
                              {rank.status === "scheduled" && rank.scheduled_date
                                ? `Scheduled ${new Date(rank.scheduled_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                                : new Date(rank.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              }
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {rank.status === "draft" && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handlePublishDraft(rank.id); }}
                                className="px-2 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 text-xs font-semibold transition-colors"
                              >
                                Publish
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteRank(rank.id, rank.title); }}
                              className="p-1.5 rounded-lg hover:bg-red-900/30 transition-colors"
                            >
                              <Trash2 size={14} className="text-gray-600 hover:text-red-400 transition-colors" />
                            </button>
                            <ChevronDown
                              size={15}
                              className={`text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </div>
                        </div>

                        {/* Expanded item list */}
                        {isExpanded && (
                          <div className="border-t border-gray-700/60 px-4 pb-4 pt-3 space-y-1.5">
                            {!rank.items ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 size={18} className="animate-spin text-gray-500" />
                              </div>
                            ) : rank.items.length === 0 ? (
                              <p className="text-gray-500 text-xs text-center py-3">No items in this rank</p>
                            ) : (
                              rank.items.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg bg-gray-800/50">
                                  <span className={`w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                                    idx === 0 ? "bg-teal-500 text-white" :
                                    idx === 1 ? "bg-teal-600/70 text-white" :
                                    "bg-gray-700 text-gray-400"
                                  }`}>{item.position}</span>
                                  <span className="text-white text-sm font-medium flex-1 truncate">{item.title}</span>
                                  <span className="text-gray-500 text-xs truncate">
                                    {[item.creator, item.year].filter(Boolean).join(" · ")}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
