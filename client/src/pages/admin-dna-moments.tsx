import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, Trash2, ToggleLeft, ToggleRight, Dna,
  CalendarDays, Loader2, Sparkles, Rss, Star, FileText, Clock, CheckCircle,
} from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  consumption_style: "Consumption Style",
  discovery_behavior: "Discovery Behavior",
  taste_identity: "Taste Identity",
  commitment_style: "Commitment Style",
  social_behavior: "Social Behavior",
  genre_tv_film: "TV & Film",
  genre_books: "Books",
  genre_music: "Music",
  genre_podcasts: "Podcasts",
  genre_gaming: "Gaming",
  media_identity: "Media Identity",
  media_crossover: "Media Crossover",
};

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

const today = new Date().toISOString().split("T")[0];

function getStatus(m: DnaMoment): "draft" | "scheduled" | "published" {
  if (!m.is_active) return "draft";
  if (m.display_date && m.display_date.slice(0, 10) > today) return "scheduled";
  return "published";
}

function MomentCard({
  m,
  onToggle,
  onDelete,
  onCycleDisplayType,
  onSetDate,
}: {
  m: DnaMoment;
  onToggle: () => void;
  onDelete: () => void;
  onCycleDisplayType: () => void;
  onSetDate: (date: string | null) => void;
}) {
  const [editingDate, setEditingDate] = useState(false);
  const [dateValue, setDateValue] = useState(m.display_date ? m.display_date.slice(0, 10) : "");
  const dt = m.display_type || "feed";
  const dtInfo = DISPLAY_TYPE_LABELS[dt] || DISPLAY_TYPE_LABELS.feed;
  const DtIcon = dtInfo.icon;
  const featuredDate = m.display_date
    ? new Date(m.display_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  return (
    <div className={`rounded-2xl border p-4 transition-all ${m.is_active ? "bg-gray-900/60 border-gray-700/50" : "bg-gray-900/30 border-gray-800/50 opacity-60"}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm leading-snug">{m.question_text}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] text-purple-400/70 font-medium">{CATEGORY_LABELS[m.category] || m.category}</span>
            <button
              onClick={onCycleDisplayType}
              className={`inline-flex items-center gap-1 text-[10px] font-semibold border px-1.5 py-0.5 rounded-full transition-all hover:opacity-80 ${dtInfo.color}`}
              title="Click to cycle: Feed → Featured → Both"
            >
              <DtIcon size={9} />
              {dtInfo.label}
            </button>
            {featuredDate && !editingDate && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300 bg-amber-900/30 border border-amber-700/40 px-1.5 py-0.5 rounded-full">
                <CalendarDays size={9} />
                {featuredDate}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => { setEditingDate(e => !e); setDateValue(m.display_date ? m.display_date.slice(0, 10) : ""); }}
            className={`transition-colors ${editingDate ? "text-amber-400" : "text-gray-500 hover:text-amber-400"}`}
            title="Set scheduled date"
          >
            <CalendarDays size={16} />
          </button>
          <button onClick={onToggle} className="text-gray-400 hover:text-purple-400 transition-colors" title={m.is_active ? "Move to draft" : "Publish"}>
            {m.is_active ? <ToggleRight size={22} className="text-purple-400" /> : <ToggleLeft size={22} />}
          </button>
          <button onClick={onDelete} className="text-gray-600 hover:text-red-400 transition-colors">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {editingDate && (
        <div className="mb-3 flex items-center gap-2 bg-gray-800/60 rounded-xl p-2.5">
          <CalendarDays size={14} className="text-amber-400 flex-shrink-0" />
          <input
            type="date"
            value={dateValue}
            onChange={e => setDateValue(e.target.value)}
            className="flex-1 bg-transparent text-white text-xs focus:outline-none"
          />
          <button
            onClick={() => { onSetDate(dateValue ? new Date(dateValue).toISOString() : null); setEditingDate(false); }}
            className="text-[11px] font-semibold bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1 rounded-lg transition-colors"
          >
            {dateValue ? "Set" : "Clear"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {[m.option_a, m.option_b].map((opt, i) => (
          <div key={i} className="bg-gray-800/50 rounded-xl px-3 py-2">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{i === 0 ? "A" : "B"}</span>
            <p className="text-xs text-gray-200 mt-0.5">{opt}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDnaMomentsPage() {
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"generate" | "drafts" | "scheduled" | "published">("generate");
  const [genCount, setGenCount] = useState(5);
  const [genDisplayType, setGenDisplayType] = useState<"feed" | "featured">("feed");
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<DnaMoment[]>([]);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-dna-moments"] }); toast({ title: "Deleted" }); },
    onError: () => toast({ title: "Error", description: "Failed to delete", variant: "destructive" }),
  });

  const setDateMutation = useMutation({
    mutationFn: async ({ id, display_date }: { id: string; display_date: string | null }) => {
      const { error } = await supabase.from("dna_moments").update({ display_date }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-dna-moments"] }); setEditingDateId(null); },
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

  const handleGenerate = async () => {
    if (!session?.access_token) return;
    setIsGenerating(true);
    setLastGenerated([]);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-dna-moments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ count: genCount, display_type: genDisplayType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setLastGenerated(data.questions || []);
      qc.invalidateQueries({ queryKey: ["admin-dna-moments"] });
      toast({ title: `Generated ${data.generated} questions`, description: `Added as drafts — activate them below` });
      setActiveTab("drafts");
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const drafts = moments.filter(m => getStatus(m) === "draft");
  const scheduled = moments.filter(m => getStatus(m) === "scheduled").sort((a, b) => (a.display_date || "").localeCompare(b.display_date || ""));
  const published = moments.filter(m => getStatus(m) === "published");

  const tabs = [
    { key: "generate" as const, label: "Generate", icon: Sparkles, count: null },
    { key: "drafts" as const, label: "Drafts", icon: FileText, count: drafts.length },
    { key: "scheduled" as const, label: "Scheduled", icon: Clock, count: scheduled.length },
    { key: "published" as const, label: "Published", icon: CheckCircle, count: published.length },
  ];

  const listForTab = activeTab === "drafts" ? drafts : activeTab === "scheduled" ? scheduled : activeTab === "published" ? published : [];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
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
              <p className="text-xs text-gray-500">
                {published.length} published · {scheduled.length} scheduled · {drafts.length} drafts
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? tab.key === "generate" ? "bg-violet-600 text-white" : "bg-purple-600 text-white"
                    : "bg-gray-800/60 text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <Icon size={14} />
                {tab.label}
                {tab.count !== null && (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.key ? "bg-white/20" : "bg-gray-700 text-gray-300"}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Generate Tab ── */}
        {activeTab === "generate" && (
          <div className="space-y-6">
            {/* Info strip */}
            <div className="bg-purple-900/20 border border-purple-700/30 rounded-2xl p-4">
              <p className="text-xs text-purple-300 font-medium mb-1">Auto-balanced generation</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                Questions are spread evenly across all 12 DNA categories — consumption style, discovery behavior, taste identity, commitment, social behavior, TV & Film, Books, Music, Podcasts, Gaming, Media Identity, and Media Crossover. No need to pick a category.
              </p>
            </div>

            {/* Controls */}
            <div className="bg-gray-900/60 border border-gray-700/50 rounded-2xl p-5 space-y-5">
              <div>
                <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-2">How many to generate</label>
                <div className="flex gap-2 flex-wrap">
                  {[3, 5, 8, 10].map(n => (
                    <button
                      key={n}
                      onClick={() => setGenCount(n)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${genCount === n ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-2">Show in</label>
                <div className="flex gap-2">
                  {(["feed", "featured"] as const).map(type => {
                    const info = DISPLAY_TYPE_LABELS[type];
                    const Icon = info.icon;
                    return (
                      <button
                        key={type}
                        onClick={() => setGenDisplayType(type)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                          genDisplayType === type
                            ? `${info.color} border-current`
                            : "bg-gray-800 text-gray-400 border-gray-700 hover:text-white"
                        }`}
                      >
                        <Icon size={13} />
                        {info.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {isGenerating ? "Generating…" : `Generate ${genCount} DNA Moments`}
              </button>
            </div>

            {/* Last generated preview */}
            {lastGenerated.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-3">Just generated — switch to Drafts to manage</p>
                <div className="space-y-2">
                  {lastGenerated.map((m, i) => (
                    <div key={i} className="bg-gray-900/40 border border-gray-800/50 rounded-xl p-3">
                      <p className="text-sm text-white">{m.question_text}</p>
                      <div className="flex gap-2 mt-1.5">
                        <span className="text-[10px] text-purple-400/70">{CATEGORY_LABELS[m.category] || m.category}</span>
                        <span className="text-[10px] text-gray-500">·</span>
                        <span className="text-[10px] text-gray-400">{m.option_a} / {m.option_b}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── List Tabs (Drafts / Scheduled / Published) ── */}
        {activeTab !== "generate" && (
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={24} className="animate-spin text-purple-400" />
              </div>
            ) : listForTab.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Dna size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">
                  {activeTab === "drafts" && "No drafts. Generate some questions to get started."}
                  {activeTab === "scheduled" && "No scheduled questions. Set a date on a question to schedule it."}
                  {activeTab === "published" && "No published questions yet. Toggle drafts to publish them."}
                </p>
                {activeTab === "drafts" && (
                  <button onClick={() => setActiveTab("generate")} className="mt-3 text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors">
                    Go to Generate →
                  </button>
                )}
              </div>
            ) : (
              listForTab.map(m => (
                <MomentCard
                  key={m.id}
                  m={m}
                  onToggle={() => toggleMutation.mutate({ id: m.id, is_active: !m.is_active })}
                  onDelete={() => { if (confirm("Delete this question?")) deleteMutation.mutate(m.id); }}
                  onCycleDisplayType={() => {
                    const cycle: Record<string, string> = { feed: "featured", featured: "both", both: "feed" };
                    const dt = m.display_type || "feed";
                    setDisplayTypeMutation.mutate({ id: m.id, display_type: cycle[dt] || "feed" });
                  }}
                  onSetDate={(date) => setDateMutation.mutate({ id: m.id, display_date: date })}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
