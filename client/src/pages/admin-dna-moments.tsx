import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import {
  ArrowLeft, Plus, Trash2, ToggleLeft, ToggleRight, Dna,
  ChevronDown, ChevronUp, Loader2, CheckCircle2, CalendarDays, X, Sparkles, Rss, Star,
} from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const QUESTION_BANK: { category: string; label: string; questions: { q: string; a: string; b: string }[] }[] = [
  {
    category: "consumption_style", label: "Consumption Style",
    questions: [
      { q: "Binge it all or make it last?", a: "All at once, no question", b: "I drag it out on purpose" },
      { q: "Phone away or second screen?", a: "Fully locked in", b: "Always scrolling" },
      { q: "Background noise or full attention?", a: "It's on in the background", b: "Nothing else exists" },
      { q: "Subtitles on or off?", a: "Always on", b: "Only when I need them" },
      { q: "Watch in one sitting or spread it out?", a: "One sitting every time", b: "I take my time" },
    ],
  },
  {
    category: "discovery_behavior", label: "Discovery Behavior",
    questions: [
      { q: "Watch it when it drops or when everyone's talking about it?", a: "Day one", b: "When it's trending" },
      { q: "Find things early or join the conversation after?", a: "I find it first", b: "I hear about it first" },
      { q: "Trust reviews or trust your own gut?", a: "Reviews help me decide", b: "I go in blind" },
      { q: "Algorithm-fed or actively hunting?", a: "I let it find me", b: "I go looking" },
      { q: "Wait for the hype or ahead of the curve?", a: "I follow the hype", b: "I beat it" },
    ],
  },
  {
    category: "taste_identity", label: "Taste Identity",
    questions: [
      { q: "Critically acclaimed or widely loved?", a: "Critically acclaimed", b: "Widely loved" },
      { q: "Good taste or popular taste?", a: "Good taste", b: "Popular taste" },
      { q: "Watch what's important or what's fun?", a: "What's important", b: "What's fun" },
      { q: "Prestige drama or just want to be entertained?", a: "Prestige all the way", b: "Just entertain me" },
      { q: "Hidden gem or cultural moment?", a: "Hidden gem", b: "Cultural moment" },
    ],
  },
  {
    category: "commitment_style", label: "Commitment Style",
    questions: [
      { q: "Finish everything or drop it fast?", a: "I finish everything", b: "I drop it fast" },
      { q: "Stick through slow starts or bail by episode 2?", a: "I stick it out", b: "Gone by episode 2" },
      { q: "One show at a time or always juggling?", a: "One at a time", b: "Always juggling five" },
      { q: "Rewatch favorites or always something new?", a: "Rewatch constantly", b: "Always something new" },
    ],
  },
  {
    category: "social_behavior", label: "Social Behavior",
    questions: [
      { q: "Send recs constantly or keep your taste private?", a: "I send recs constantly", b: "I keep it to myself" },
      { q: "Talk about it after or just move on?", a: "Need to debrief", b: "Just move on" },
      { q: "Watch alone or make it an event?", a: "Always alone", b: "It's a whole thing" },
      { q: "Care what others think or trust your own instincts?", a: "Others' opinions matter", b: "I trust my own taste" },
      { q: "Recommend before or after they watch?", a: "Before — get ahead of it", b: "After — discuss it" },
    ],
  },
  {
    category: "genre_tv_film", label: "TV & Film",
    questions: [
      { q: "True crime deep dive or reality TV unwind?", a: "True crime always", b: "Reality TV is my comfort" },
      { q: "Slow burn character drama or fast-paced plot?", a: "Slow burn", b: "Fast-paced" },
      { q: "Horror that messes with your head or action that doesn't stop?", a: "Psychological horror", b: "Pure action" },
      { q: "Laugh out loud or cry it out?", a: "Comedy is my thing", b: "Give me the emotional wreck" },
      { q: "Superhero universe or completely done with it?", a: "Still in", b: "Completely done" },
      { q: "Foreign language content or English only?", a: "Love foreign content", b: "English only" },
      { q: "Documentary over drama or drama over everything?", a: "Documentary", b: "Drama every time" },
      { q: "Rom-com comfort or psychological thriller obsession?", a: "Rom-com", b: "Psychological thriller" },
      { q: "Fantasy worlds or real-life stories?", a: "Fantasy all the way", b: "Keep it real" },
    ],
  },
  {
    category: "genre_books", label: "Books",
    questions: [
      { q: "Literary fiction or genre fiction?", a: "Literary fiction", b: "Genre fiction" },
      { q: "Series or standalones?", a: "Series", b: "Standalones" },
      { q: "Read reviews first or go in blind?", a: "Reviews first", b: "Always blind" },
      { q: "Fiction or nonfiction?", a: "Fiction", b: "Nonfiction" },
      { q: "Self-help or pure storytelling?", a: "Self-help", b: "Pure story" },
    ],
  },
  {
    category: "genre_music", label: "Music",
    questions: [
      { q: "Albums front to back or playlist shuffle?", a: "Front to back", b: "Shuffle always" },
      { q: "Lyrics or vibe?", a: "Lyrics matter most", b: "Pure vibe" },
      { q: "Discover new or live in your favorites?", a: "Always discovering", b: "Living in my favorites" },
      { q: "One artist on repeat or constantly rotating?", a: "One artist obsessively", b: "Always rotating" },
      { q: "Concert person or studio recording purist?", a: "Live shows are everything", b: "Studio version only" },
    ],
  },
  {
    category: "genre_podcasts", label: "Podcasts",
    questions: [
      { q: "Background listening or full attention?", a: "Background always", b: "Full attention" },
      { q: "Follow hosts or follow topics?", a: "I follow hosts", b: "I follow topics" },
      { q: "Finish every episode or skip around?", a: "Every episode", b: "I skip around" },
    ],
  },
  {
    category: "genre_gaming", label: "Gaming",
    questions: [
      { q: "Story-driven or competitive multiplayer?", a: "Story all the way", b: "Competitive multiplayer" },
      { q: "Casual mobile or console committed?", a: "Mobile casual", b: "Console committed" },
      { q: "New releases or replay classics?", a: "Always new", b: "Replay the classics" },
      { q: "Solo campaign or online with others?", a: "Solo", b: "Online with others" },
    ],
  },
  {
    category: "media_identity", label: "Media Identity",
    questions: [
      { q: "Books first or screen first?", a: "Books first always", b: "Screen first" },
      { q: "One medium at a time or all at once?", a: "One at a time", b: "All at once" },
      { q: "Podcast listener or music only?", a: "Podcasts are essential", b: "Music only" },
      { q: "Documentary or drama when you want the real story?", a: "Documentary", b: "Drama" },
    ],
  },
  {
    category: "media_crossover", label: "Media Crossover",
    questions: [
      { q: "Read the book AND watch the show — or pick one?", a: "Both every time", b: "Always pick one" },
      { q: "Listen to the recap podcast after or just move on?", a: "Recap podcast is essential", b: "I move on" },
      { q: "Follow the cast on social or keep it separate?", a: "Always follow the cast", b: "Keep it separate" },
      { q: "Dive into fan theories or just watch it?", a: "Deep in the fan theories", b: "Just watch it" },
      { q: "Watch the behind the scenes or roll credits and leave?", a: "Behind the scenes always", b: "Credits and I'm out" },
      { q: "Rewatch before a sequel or go in fresh?", a: "Always rewatch first", b: "Go in fresh" },
      { q: "Buy the merch or just consume the content?", a: "I own the merch", b: "Content only" },
      { q: "One universe deep or spread across everything?", a: "One universe obsessively", b: "Spread across everything" },
    ],
  },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  QUESTION_BANK.map(c => [c.category, c.label])
);

type DnaMoment = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  category: string;
  is_active: boolean;
  display_date: string | null;
  display_type: string | null;
  created_at: string;
};

const DISPLAY_TYPE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  feed: { label: "Feed", color: "text-blue-400 bg-blue-900/30 border-blue-700/40", icon: Rss },
  featured: { label: "Featured", color: "text-amber-300 bg-amber-900/30 border-amber-700/40", icon: Star },
  both: { label: "Feed + Featured", color: "text-purple-400 bg-purple-900/30 border-purple-700/40", icon: Sparkles },
};

export default function AdminDnaMomentsPage() {
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"questions" | "add" | "bank" | "generate">("questions");
  const [filterCategory, setFilterCategory] = useState("all");
  const [expandedBank, setExpandedBank] = useState<string | null>(null);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [editingDateValue, setEditingDateValue] = useState("");

  const [newQ, setNewQ] = useState({ question_text: "", option_a: "", option_b: "", category: "consumption_style", display_date: "", display_type: "feed" });

  // Generate state
  const [genCategory, setGenCategory] = useState("consumption_style");
  const [genCount, setGenCount] = useState(5);
  const [genDisplayType, setGenDisplayType] = useState("feed");
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<DnaMoment[]>([]);

  const { data: moments = [], isLoading } = useQuery<DnaMoment[]>({
    queryKey: ["admin-dna-moments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dna_moments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("dna_moments").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-dna-moments"] }),
    onError: () => toast({ title: "Error", description: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dna_moments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-dna-moments"] });
      toast({ title: "Deleted", description: "Question removed" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: async (q: typeof newQ) => {
      const { display_date: dateStr, ...rest } = q;
      const { error } = await supabase.from("dna_moments").insert({
        ...rest,
        is_active: true,
        display_date: dateStr ? new Date(dateStr).toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-dna-moments"] });
      setNewQ({ question_text: "", option_a: "", option_b: "", category: "consumption_style", display_date: "", display_type: "feed" });
      toast({ title: "Added", description: "Question created and active" });
      setActiveTab("questions");
    },
    onError: () => toast({ title: "Error", description: "Failed to create", variant: "destructive" }),
  });

  const setDateMutation = useMutation({
    mutationFn: async ({ id, display_date }: { id: string; display_date: string | null }) => {
      const { error } = await supabase.from("dna_moments").update({ display_date }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-dna-moments"] });
      setEditingDateId(null);
      setEditingDateValue("");
    },
    onError: () => toast({ title: "Error", description: "Failed to update date", variant: "destructive" }),
  });

  const setDisplayTypeMutation = useMutation({
    mutationFn: async ({ id, display_type }: { id: string; display_type: string }) => {
      const { error } = await supabase.from("dna_moments").update({ display_type }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-dna-moments"] }),
    onError: () => toast({ title: "Error", description: "Failed to update display type", variant: "destructive" }),
  });

  const quickAddMutation = useMutation({
    mutationFn: async (q: { question_text: string; option_a: string; option_b: string; category: string }) => {
      const { error } = await supabase.from("dna_moments").insert({ ...q, is_active: true, display_type: 'feed' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-dna-moments"] }),
    onError: () => toast({ title: "Error", description: "Failed to add", variant: "destructive" }),
  });

  const handleGenerate = async () => {
    if (!session?.access_token) return;
    setIsGenerating(true);
    setLastGenerated([]);
    try {
      const res = await fetch(
        `${supabaseUrl}/functions/v1/generate-dna-moments`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ category: genCategory, count: genCount, display_type: genDisplayType }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setLastGenerated(data.questions || []);
      qc.invalidateQueries({ queryKey: ["admin-dna-moments"] });
      toast({ title: `Generated ${data.generated} questions`, description: `Added to ${DISPLAY_TYPE_LABELS[genDisplayType]?.label || genDisplayType} slot` });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const existingQuestions = new Set(moments.map(m => m.question_text.toLowerCase().trim()));

  const filtered = (filterCategory === "all" ? moments : moments.filter(m => m.category === filterCategory))
    .slice()
    .sort((a, b) => {
      if (a.display_date && !b.display_date) return -1;
      if (!a.display_date && b.display_date) return 1;
      if (a.display_date && b.display_date) return a.display_date.localeCompare(b.display_date);
      return 0;
    });
  const usedCategories = Array.from(new Set(moments.map(m => m.category)));

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => setLocation("/admin")} className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-900/60 flex items-center justify-center">
              <Dna size={16} className="text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">DNA Moments</h1>
              <p className="text-xs text-gray-500">{moments.length} questions · {moments.filter(m => m.is_active).length} active · {moments.filter(m => m.display_type === 'featured' || m.display_type === 'both').length} featured</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(["questions", "generate", "add", "bank"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab
                  ? tab === "generate" ? "bg-violet-600 text-white" : "bg-purple-600 text-white"
                  : "bg-gray-800/60 text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {tab === "questions" ? "All Questions" : tab === "generate" ? "✨ Generate" : tab === "add" ? "Add Custom" : "Question Bank"}
            </button>
          ))}
        </div>

        {/* ── Questions Tab ── */}
        {activeTab === "questions" && (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap mb-4">
              <button
                onClick={() => setFilterCategory("all")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${filterCategory === "all" ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
              >
                All ({moments.length})
              </button>
              {usedCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${filterCategory === cat ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
                >
                  {CATEGORY_LABELS[cat] || cat} ({moments.filter(m => m.category === cat).length})
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={24} className="animate-spin text-purple-400" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Dna size={32} className="mx-auto mb-3 opacity-30" />
                <p>No questions yet. Add some from the Question Bank or Generate with AI.</p>
              </div>
            ) : (
              filtered.map(m => {
                const featuredDate = m.display_date
                  ? new Date(m.display_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : null;
                const isEditingDate = editingDateId === m.id;
                const dt = m.display_type || 'feed';
                const dtInfo = DISPLAY_TYPE_LABELS[dt] || DISPLAY_TYPE_LABELS.feed;
                const DtIcon = dtInfo.icon;
                return (
                <div key={m.id} className={`rounded-2xl border p-4 transition-all ${m.is_active ? "bg-gray-900/60 border-gray-700/50" : "bg-gray-900/30 border-gray-800/50 opacity-60"}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm leading-snug">{m.question_text}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[10px] text-purple-400/70 font-medium">{CATEGORY_LABELS[m.category] || m.category}</span>
                        {/* Display type badge — click to cycle */}
                        <button
                          onClick={() => {
                            const cycle: Record<string, string> = { feed: 'featured', featured: 'both', both: 'feed' };
                            setDisplayTypeMutation.mutate({ id: m.id, display_type: cycle[dt] || 'feed' });
                          }}
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold border px-1.5 py-0.5 rounded-full transition-all hover:opacity-80 ${dtInfo.color}`}
                          title="Click to cycle: Feed → Featured → Both"
                        >
                          <DtIcon size={9} />
                          {dtInfo.label}
                        </button>
                        {featuredDate && !isEditingDate && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300 bg-amber-900/30 border border-amber-700/40 px-1.5 py-0.5 rounded-full">
                            <CalendarDays size={9} />
                            {featuredDate}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => {
                          if (isEditingDate) {
                            setEditingDateId(null);
                            setEditingDateValue("");
                          } else {
                            setEditingDateId(m.id);
                            setEditingDateValue(m.display_date ? m.display_date.slice(0, 10) : "");
                          }
                        }}
                        className={`transition-colors ${isEditingDate ? "text-amber-400" : "text-gray-500 hover:text-amber-400"}`}
                        title="Set featured date"
                      >
                        <CalendarDays size={16} />
                      </button>
                      <button
                        onClick={() => toggleMutation.mutate({ id: m.id, is_active: !m.is_active })}
                        className="text-gray-400 hover:text-purple-400 transition-colors"
                        title={m.is_active ? "Deactivate" : "Activate"}
                      >
                        {m.is_active ? <ToggleRight size={22} className="text-purple-400" /> : <ToggleLeft size={22} />}
                      </button>
                      <button
                        onClick={() => { if (confirm("Delete this question?")) deleteMutation.mutate(m.id); }}
                        className="text-gray-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {isEditingDate && (
                    <div className="mb-3 flex items-center gap-2 bg-gray-800/60 rounded-xl p-2.5">
                      <CalendarDays size={14} className="text-amber-400 flex-shrink-0" />
                      <input
                        type="date"
                        value={editingDateValue}
                        onChange={e => setEditingDateValue(e.target.value)}
                        className="flex-1 bg-transparent text-white text-xs focus:outline-none"
                      />
                      <button
                        onClick={() => setDateMutation.mutate({
                          id: m.id,
                          display_date: editingDateValue ? new Date(editingDateValue).toISOString() : null,
                        })}
                        disabled={setDateMutation.isPending}
                        className="text-[11px] font-semibold bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1 rounded-lg transition-colors"
                      >
                        {editingDateValue ? "Set" : "Clear"}
                      </button>
                      {m.display_date && (
                        <button
                          onClick={() => setDateMutation.mutate({ id: m.id, display_date: null })}
                          disabled={setDateMutation.isPending}
                          className="text-gray-400 hover:text-red-400 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <span className="text-xs text-gray-500 bg-gray-800/60 px-2.5 py-1 rounded-lg flex-1 truncate">A: {m.option_a}</span>
                    <span className="text-xs text-gray-500 bg-gray-800/60 px-2.5 py-1 rounded-lg flex-1 truncate">B: {m.option_b}</span>
                  </div>
                </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Generate Tab ── */}
        {activeTab === "generate" && (
          <div className="space-y-5">
            <div className="bg-violet-950/40 border border-violet-700/40 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={16} className="text-violet-400" />
                <h2 className="text-base font-semibold text-white">AI Question Generator</h2>
              </div>
              <p className="text-xs text-gray-400 mb-5">
                Generates fresh DNA Moment questions using your Entertainment DNA rules — questions that reveal consumption behavior, taste identity, and media habits.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Category</label>
                  <select
                    value={genCategory}
                    onChange={e => setGenCategory(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    {QUESTION_BANK.map(c => (
                      <option key={c.category} value={c.category}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Number of questions</label>
                  <div className="flex gap-2">
                    {[3, 5, 7, 10].map(n => (
                      <button
                        key={n}
                        onClick={() => setGenCount(n)}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${genCount === n ? "bg-violet-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Display slot</label>
                  <div className="flex gap-2">
                    {(["feed", "featured", "both"] as const).map(dt => {
                      const info = DISPLAY_TYPE_LABELS[dt];
                      const Icon = info.icon;
                      return (
                        <button
                          key={dt}
                          onClick={() => setGenDisplayType(dt)}
                          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 ${genDisplayType === dt ? "bg-violet-600 text-white border border-violet-500" : "bg-gray-800 text-gray-400 hover:bg-gray-700 border border-transparent"}`}
                        >
                          <Icon size={11} />
                          {info.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1.5">
                    Feed = shown inline in social feed · Featured = big daily card (like Daily Call) · Both = shown everywhere
                  </p>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold"
                >
                  {isGenerating ? (
                    <><Loader2 size={16} className="animate-spin mr-2" /> Generating with AI...</>
                  ) : (
                    <><Sparkles size={16} className="mr-2" /> Generate {genCount} Questions</>
                  )}
                </Button>
              </div>
            </div>

            {lastGenerated.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-medium">Just generated — now active in your library:</p>
                {lastGenerated.map((q: any) => (
                  <div key={q.id} className="bg-gray-900/60 border border-violet-700/30 rounded-xl p-3">
                    <p className="text-white text-sm font-medium">{q.question_text}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-xs text-gray-500 bg-gray-800/60 px-2 py-0.5 rounded truncate">A: {q.option_a}</span>
                      <span className="text-xs text-gray-500 bg-gray-800/60 px-2 py-0.5 rounded truncate">B: {q.option_b}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Add Custom Tab ── */}
        {activeTab === "add" && (
          <div className="bg-gray-900/60 border border-gray-700/50 rounded-2xl p-5 space-y-4">
            <h2 className="text-base font-semibold text-white">Custom Question</h2>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Question</label>
              <Textarea
                value={newQ.question_text}
                onChange={e => setNewQ(q => ({ ...q, question_text: e.target.value }))}
                placeholder="e.g. Binge it all or make it last?"
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-600 resize-none"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Option A</label>
                <Input
                  value={newQ.option_a}
                  onChange={e => setNewQ(q => ({ ...q, option_a: e.target.value }))}
                  placeholder="First option"
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-600"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Option B</label>
                <Input
                  value={newQ.option_b}
                  onChange={e => setNewQ(q => ({ ...q, option_b: e.target.value }))}
                  placeholder="Second option"
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-600"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Category</label>
              <select
                value={newQ.category}
                onChange={e => setNewQ(q => ({ ...q, category: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                {QUESTION_BANK.map(c => (
                  <option key={c.category} value={c.category}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Display Slot</label>
              <div className="flex gap-2">
                {(["feed", "featured", "both"] as const).map(dt => {
                  const info = DISPLAY_TYPE_LABELS[dt];
                  const Icon = info.icon;
                  return (
                    <button
                      key={dt}
                      onClick={() => setNewQ(q => ({ ...q, display_type: dt }))}
                      className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 ${newQ.display_type === dt ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                    >
                      <Icon size={11} />
                      {info.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
                <CalendarDays size={11} />
                Featured Date <span className="text-gray-600 ml-1">(optional)</span>
              </label>
              <input
                type="date"
                value={newQ.display_date}
                onChange={e => setNewQ(q => ({ ...q, display_date: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <Button
              onClick={() => createMutation.mutate(newQ)}
              disabled={!newQ.question_text.trim() || !newQ.option_a.trim() || !newQ.option_b.trim() || createMutation.isPending}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              {createMutation.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : <Plus size={16} className="mr-2" />}
              Add Question
            </Button>
          </div>
        )}

        {/* ── Question Bank Tab ── */}
        {activeTab === "bank" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 mb-4">Click any question to add it to the feed. Questions already in your library are marked.</p>
            {QUESTION_BANK.map(cat => (
              <div key={cat.category} className="bg-gray-900/60 border border-gray-700/40 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandedBank(expandedBank === cat.category ? null : cat.category)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800/40 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold text-sm">{cat.label}</span>
                    <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                      {cat.questions.filter(q => existingQuestions.has(q.q.toLowerCase().trim())).length}/{cat.questions.length} added
                    </span>
                  </div>
                  {expandedBank === cat.category ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </button>
                {expandedBank === cat.category && (
                  <div className="border-t border-gray-700/40 divide-y divide-gray-800/60">
                    {cat.questions.map((q, i) => {
                      const alreadyAdded = existingQuestions.has(q.q.toLowerCase().trim());
                      return (
                        <div key={i} className={`p-3 flex items-start gap-3 ${alreadyAdded ? "opacity-50" : "hover:bg-gray-800/30 transition-colors"}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium leading-snug">{q.q}</p>
                            <p className="text-gray-500 text-xs mt-0.5">{q.a} / {q.b}</p>
                          </div>
                          {alreadyAdded ? (
                            <CheckCircle2 size={18} className="text-green-500/60 flex-shrink-0 mt-0.5" />
                          ) : (
                            <button
                              onClick={() => quickAddMutation.mutate({ question_text: q.q, option_a: q.a, option_b: q.b, category: cat.category })}
                              disabled={quickAddMutation.isPending}
                              className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-full bg-purple-900/60 border border-purple-700/50 flex items-center justify-center hover:bg-purple-700 transition-all"
                            >
                              <Plus size={13} className="text-purple-300" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
