import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import {
  Sparkles, Check, X, Clock, ChevronDown, ChevronUp,
  RefreshCw, Calendar, Star, MessageSquare, Flame,
  User, Loader2
} from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Draft = {
  id: string;
  persona_user_id: string;
  post_type: string;
  content: string;
  rating: number | null;
  media_title: string | null;
  media_type: string | null;
  media_creator: string | null;
  ai_notes: string | null;
  status: string;
  scheduled_for: string | null;
  created_at: string;
  persona?: { user_name: string; display_name: string };
};

type Persona = {
  id: string;
  user_name: string;
  display_name: string;
  persona_config: any;
};

// Stagger times: 4 slots per day — 8am, 11am, 2pm, 7pm
const DAILY_SLOTS = [8, 11, 14, 19];
const TIME_SLOT_LABELS = ["8:00 AM", "11:00 AM", "2:00 PM", "7:00 PM"];

function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function getTimezoneAbbr(): string {
  const tz = getUserTimezone();
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", { timeZoneName: "short", timeZone: tz }).formatToParts(now);
  return parts.find(p => p.type === "timeZoneName")?.value || tz;
}

function getStaggeredTime(draftIndex: number): Date {
  const dayOffset = Math.floor(draftIndex / DAILY_SLOTS.length) + 1;
  const slotIndex = draftIndex % DAILY_SLOTS.length;
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(DAILY_SLOTS[slotIndex], 0, 0, 0);
  return d;
}

function getStaggeredLabel(index: number): string {
  const dayOffset = Math.floor(index / DAILY_SLOTS.length) + 1;
  const slotHour = DAILY_SLOTS[index % DAILY_SLOTS.length];
  const ampm = slotHour >= 12 ? "pm" : "am";
  const displayHour = slotHour > 12 ? slotHour - 12 : slotHour;
  if (dayOffset === 1) return `tomorrow ${displayHour}${ampm}`;
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const targetDay = new Date();
  targetDay.setDate(targetDay.getDate() + dayOffset);
  return `${days[targetDay.getDay()]} ${displayHour}${ampm}`;
}

// Build ISO string from a local date string (YYYY-MM-DD) + hour
function buildScheduleISO(dateStr: string, hour: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

// Get local YYYY-MM-DD from a Date
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function postTypeBadge(type: string) {
  if (type === "hot_take") return <Badge className="bg-orange-500/20 text-orange-300 border-0 text-xs">Hot Take</Badge>;
  if (type === "review") return <Badge className="bg-yellow-500/20 text-yellow-300 border-0 text-xs">Review</Badge>;
  return <Badge className="bg-purple-500/20 text-purple-300 border-0 text-xs">Thought</Badge>;
}

function mediaTypeBadge(type: string | null) {
  if (!type) return null;
  const colors: Record<string, string> = {
    movie: "bg-blue-500/20 text-blue-300",
    tv: "bg-pink-500/20 text-pink-300",
    book: "bg-cyan-500/20 text-cyan-300",
    podcast: "bg-green-500/20 text-green-300",
    music: "bg-indigo-500/20 text-indigo-300",
    game: "bg-rose-500/20 text-rose-300",
  };
  return (
    <Badge className={`${colors[type] || "bg-gray-500/20 text-gray-300"} border-0 text-xs capitalize`}>
      {type}
    </Badge>
  );
}

function StarRating({ rating }: { rating: number }) {
  const stars = Math.round(rating * 2) / 2;
  return (
    <span className="text-yellow-400 text-xs ml-1">
      {stars.toFixed(1)}★
    </span>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [postsPerPersona, setPostsPerPersona] = useState(2);
  const [generating, setGenerating] = useState(false);
  const [editingDraft, setEditingDraft] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editRating, setEditRating] = useState<string>("");
  const [editDate, setEditDate] = useState<string>("");
  const [editHour, setEditHour] = useState<number>(11);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"drafts" | "scheduled">("drafts");

  const { data: currentProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["admin-profile-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("users")
        .select("id, user_name, is_admin")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!profileLoading && currentProfile && !currentProfile.is_admin) {
      setLocation("/");
    }
  }, [currentProfile, profileLoading]);

  const { data: personas = [] } = useQuery<Persona[]>({
    queryKey: ["admin-personas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, user_name, display_name, persona_config")
        .eq("is_persona", true)
        .order("display_name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: drafts = [], isLoading: draftsLoading, refetch: refetchDrafts } = useQuery<Draft[]>({
    queryKey: ["admin-drafts", activeTab],
    queryFn: async () => {
      const statusFilter = activeTab === "drafts" ? ["draft"] : ["approved"];
      const { data, error } = await supabase
        .from("persona_post_drafts")
        .select("*")
        .in("status", statusFilter)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      const userIds = [...new Set((data || []).map((d: any) => d.persona_user_id))];
      if (userIds.length === 0) return [];

      const { data: users } = await supabase
        .from("users")
        .select("id, user_name, display_name")
        .in("id", userIds);

      const userMap = new Map((users || []).map((u: any) => [u.id, u]));
      return (data || []).map((d: any) => ({
        ...d,
        persona: userMap.get(d.persona_user_id),
      }));
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, scheduledFor, overrideContent, overrideRating }: {
      id: string;
      scheduledFor: string;
      overrideContent?: string;
      overrideRating?: number | null;
    }) => {
      const draft = drafts.find(d => d.id === id);
      if (!draft) throw new Error("Draft not found");

      const content = overrideContent ?? draft.content;
      const rating = overrideRating !== undefined ? overrideRating : draft.rating;

      // Save any edits back to draft first
      if (overrideContent !== undefined || overrideRating !== undefined) {
        const { error: editError } = await supabase
          .from("persona_post_drafts")
          .update({ content, rating })
          .eq("id", id);
        if (editError) throw editError;
      }

      const { error: scheduleError } = await supabase
        .from("scheduled_persona_posts")
        .insert({
          persona_user_id: draft.persona_user_id,
          post_type: draft.post_type,
          content,
          rating,
          media_title: draft.media_title,
          media_type: draft.media_type,
          media_creator: draft.media_creator,
          contains_spoilers: false,
          scheduled_for: scheduledFor,
          posted: false,
        });
      if (scheduleError) throw scheduleError;

      const { error: updateError } = await supabase
        .from("persona_post_drafts")
        .update({ status: "approved", scheduled_for: scheduledFor, approved_at: new Date().toISOString() })
        .eq("id", id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast({ title: "Post approved and scheduled" });
      setEditingDraft(null);
      queryClient.invalidateQueries({ queryKey: ["admin-drafts"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to approve", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("persona_post_drafts")
        .update({ status: "rejected", rejected_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Draft rejected" });
      queryClient.invalidateQueries({ queryKey: ["admin-drafts"] });
    },
  });

  const handleGenerate = async () => {
    if (selectedPersonaIds.length === 0) {
      toast({ title: "Select at least one persona", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-persona-content`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ personaIds: selectedPersonaIds, postsPerPersona }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Generation failed");
      if (result.errors?.length) {
        console.warn("Generation warnings:", result.errors);
      }
      toast({ title: `Generated ${result.generated} drafts`, description: "Review them below" });
      queryClient.invalidateQueries({ queryKey: ["admin-drafts"] });
      setActiveTab("drafts");
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const togglePersona = (id: string) => {
    setSelectedPersonaIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const startEdit = (draft: Draft, draftIndex: number) => {
    setEditingDraft(draft.id);
    setEditContent(draft.content);
    setEditRating(draft.rating?.toString() || "");
    const defaultDate = getStaggeredTime(draftIndex);
    setEditDate(toLocalDateStr(defaultDate));
    setEditHour(DAILY_SLOTS[draftIndex % DAILY_SLOTS.length]);
  };

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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Admin</h1>
          <p className="text-gray-400 text-sm">Persona content generation and scheduling</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-purple-400" />
            <h2 className="font-semibold text-white">Generate Persona Posts</h2>
          </div>

          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Select personas</p>
            <div className="flex flex-wrap gap-2">
              {personas.map(p => (
                <button
                  key={p.id}
                  onClick={() => togglePersona(p.id)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                    selectedPersonaIds.includes(p.id)
                      ? "bg-purple-600 border-purple-500 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600"
                  }`}
                >
                  {p.display_name}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => setSelectedPersonaIds(personas.map(p => p.id))} className="text-xs text-purple-400 hover:text-purple-300">Select all</button>
              <span className="text-gray-600 text-xs">·</span>
              <button onClick={() => setSelectedPersonaIds([])} className="text-xs text-gray-400 hover:text-gray-300">Clear</button>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-5">
            <div>
              <p className="text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Posts per persona</p>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setPostsPerPersona(n)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                      postsPerPersona === n
                        ? "bg-purple-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating || selectedPersonaIds.length === 0}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {generating ? (
              <><Loader2 size={15} className="animate-spin mr-2" />Generating...</>
            ) : (
              <><Sparkles size={15} className="mr-2" />Generate {selectedPersonaIds.length > 0 ? `${selectedPersonaIds.length * postsPerPersona} drafts` : "drafts"}</>
            )}
          </Button>
        </div>

        <div className="flex items-center gap-1 mb-4">
          {(["drafts", "scheduled"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                activeTab === tab
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              {tab === "drafts" ? "Pending Drafts" : "Approved & Scheduled"}
              {tab === "drafts" && drafts.length > 0 && activeTab === "drafts" && (
                <span className="ml-2 bg-purple-600 text-white text-xs rounded-full px-1.5 py-0.5">{drafts.length}</span>
              )}
            </button>
          ))}
          <button onClick={() => refetchDrafts()} className="ml-auto text-gray-500 hover:text-gray-300">
            <RefreshCw size={14} />
          </button>
        </div>

        {draftsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-purple-400" />
          </div>
        ) : drafts.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-sm">{activeTab === "drafts" ? "No pending drafts. Generate some above." : "No approved posts yet."}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {drafts.map((draft, index) => {
              const isEditing = editingDraft === draft.id;
              const showNotes = expandedNotes.has(draft.id);
              const staggeredTime = getStaggeredTime(index);
              const staggerLabel = getStaggeredLabel(index);
              return (
                <div key={draft.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                        <User size={13} className="text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{draft.persona?.display_name}</p>
                        <p className="text-xs text-gray-500">@{draft.persona?.user_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {postTypeBadge(draft.post_type)}
                      {mediaTypeBadge(draft.media_type)}
                    </div>
                  </div>

                  {draft.media_title && (
                    <p className="text-xs text-gray-400 mb-2">
                      <span className="text-gray-500">Re:</span>{" "}
                      <span className="text-gray-300 font-medium">{draft.media_title}</span>
                      {draft.media_creator && <span className="text-gray-500"> · {draft.media_creator}</span>}
                      {draft.rating && <StarRating rating={draft.rating} />}
                    </p>
                  )}

                  {isEditing ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white resize-none text-sm min-h-[100px]"
                      />
                      <div className="flex items-center gap-3">
                        <div className="w-28">
                          <p className="text-xs text-gray-400 mb-1">Rating /5 (optional)</p>
                          <Input
                            type="number"
                            min="0.5" max="5" step="0.5"
                            value={editRating}
                            onChange={e => setEditRating(e.target.value)}
                            placeholder="4.5"
                            className="bg-gray-800 border-gray-700 text-white text-sm h-8"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-400 mb-1">Date</p>
                          <Input
                            type="date"
                            value={editDate}
                            onChange={e => setEditDate(e.target.value)}
                            className="bg-gray-800 border-gray-700 text-white text-sm h-8"
                          />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1.5">
                          Time <span className="text-gray-600">({getTimezoneAbbr()})</span>
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          {DAILY_SLOTS.map((hour, i) => (
                            <button
                              key={hour}
                              onClick={() => setEditHour(hour)}
                              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                                editHour === hour
                                  ? "bg-purple-600 text-white"
                                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                              }`}
                            >
                              {TIME_SLOT_LABELS[i]}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate({
                            id: draft.id,
                            scheduledFor: editDate ? buildScheduleISO(editDate, editHour) : staggeredTime.toISOString(),
                            overrideContent: editContent,
                            overrideRating: editRating ? parseFloat(editRating) : null,
                          })}
                          disabled={approveMutation.isPending || !editDate}
                          className="bg-green-700 hover:bg-green-600 text-white text-xs"
                        >
                          <Check size={12} className="mr-1" />
                          Approve & Schedule
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingDraft(null)}
                          className="text-gray-400 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-200 leading-relaxed mb-3 whitespace-pre-wrap">{draft.content}</p>
                      {draft.ai_notes && (
                        <div className="mb-3">
                          <button
                            onClick={() => setExpandedNotes(prev => {
                              const next = new Set(prev);
                              if (next.has(draft.id)) next.delete(draft.id); else next.add(draft.id);
                              return next;
                            })}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-400"
                          >
                            {showNotes ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            AI note
                          </button>
                          {showNotes && (
                            <p className="mt-1.5 text-xs text-gray-500 italic pl-2 border-l border-gray-700">{draft.ai_notes}</p>
                          )}
                        </div>
                      )}
                      {activeTab === "drafts" && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            onClick={() => startEdit(draft, index)}
                            className="bg-gray-800 hover:bg-gray-700 text-white text-xs border border-gray-700"
                          >
                            Edit & Schedule
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => approveMutation.mutate({ id: draft.id, scheduledFor: staggeredTime.toISOString() })}
                            disabled={approveMutation.isPending}
                            className="bg-green-700 hover:bg-green-600 text-white text-xs"
                          >
                            <Check size={12} className="mr-1" />
                            Approve ({staggerLabel})
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => rejectMutation.mutate(draft.id)}
                            disabled={rejectMutation.isPending}
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20 text-xs"
                          >
                            <X size={12} className="mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                      {activeTab === "scheduled" && draft.scheduled_for && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Calendar size={12} />
                          <span>Scheduled for {new Date(draft.scheduled_for).toLocaleString()}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
