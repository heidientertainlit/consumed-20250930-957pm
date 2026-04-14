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
  User, Loader2, Trash2, Pencil, ArrowLeft, TrendingUp
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

type ScheduledPost = {
  id: string;
  persona_user_id: string;
  post_type: string;
  content: string;
  rating: number | null;
  media_title: string | null;
  media_type: string | null;
  media_creator: string | null;
  scheduled_for: string;
  posted: boolean;
  resulting_post_id: string | null;
  persona?: { user_name: string; display_name: string };
};

type Persona = {
  id: string;
  user_name: string;
  display_name: string;
  persona_config: any;
};

// Stagger times: 4 slots per day with natural-looking random minutes
const DAILY_SLOTS = [
  { hour: 8,  minute: 23, label: "8:23 AM"  },
  { hour: 11, minute: 7,  label: "11:07 AM" },
  { hour: 14, minute: 41, label: "2:41 PM"  },
  { hour: 19, minute: 15, label: "7:15 PM"  },
];

// Extra per-draft minute jitter so no two drafts land at the same second
const JITTER_MINS = [0, 3, 7, 11, 14, 18, 22, 25, 29, 33, 37, 40, 44, 48, 51, 55];

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
  const slot = DAILY_SLOTS[draftIndex % DAILY_SLOTS.length];
  const jitter = JITTER_MINS[draftIndex % JITTER_MINS.length];
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(slot.hour, slot.minute + jitter, 0, 0);
  return d;
}

function getStaggeredLabel(index: number): string {
  const dayOffset = Math.floor(index / DAILY_SLOTS.length) + 1;
  const slot = DAILY_SLOTS[index % DAILY_SLOTS.length];
  const hour = slot.hour;
  const ampm = hour >= 12 ? "pm" : "am";
  const displayHour = hour > 12 ? hour - 12 : hour;
  if (dayOffset === 1) return `tomorrow ${displayHour}:${String(slot.minute).padStart(2,"0")}${ampm}`;
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const targetDay = new Date();
  targetDay.setDate(targetDay.getDate() + dayOffset);
  return `${days[targetDay.getDay()]} ${displayHour}:${String(slot.minute).padStart(2,"0")}${ampm}`;
}

// Build ISO string from a local date string (YYYY-MM-DD) + time string (HH:MM)
function buildScheduleISO(dateStr: string, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(dateStr + "T00:00:00");
  d.setHours(h, m || 0, 0, 0);
  return d.toISOString();
}

function slotToTimeStr(slot: { hour: number; minute: number }): string {
  return `${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}`;
}

// Keep backward compat for the time input default
function hourToTimeStr(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
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

export default function AdminPersonasPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [postsPerPersona, setPostsPerPersona] = useState(2);
  const [useTrending, setUseTrending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [editingDraft, setEditingDraft] = useState<string | null>(null);
  const [editingScheduled, setEditingScheduled] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState<string>("");
  const [editContent, setEditContent] = useState("");
  const [editRating, setEditRating] = useState<string>("");
  const [editDate, setEditDate] = useState<string>("");
  const [editTime, setEditTime] = useState<string>("11:00");
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"drafts" | "scheduled" | "published">("drafts");

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
    queryKey: ["admin-drafts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("persona_post_drafts")
        .select("*")
        .eq("status", "draft")
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
    enabled: activeTab === "drafts",
  });

  const { data: scheduledPosts = [], isLoading: scheduledLoading, refetch: refetchScheduled } = useQuery<ScheduledPost[]>({
    queryKey: ["admin-scheduled"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_persona_posts")
        .select("*")
        .order("scheduled_for", { ascending: true })
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
    enabled: activeTab === "scheduled",
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, scheduledFor, overrideContent, overrideRating }: {
      id: string;
      scheduledFor: string;
      overrideContent?: string;
      overrideRating?: number | null;
    }) => {
      const { data, error } = await supabase.functions.invoke("admin-approve-draft", {
        body: {
          draft_id: id,
          scheduled_for: scheduledFor,
          content_override: overrideContent,
          rating_override: overrideRating,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: "Post approved and scheduled" });
      setEditingDraft(null);
      queryClient.invalidateQueries({ queryKey: ["admin-drafts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-scheduled"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to approve", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("persona_post_drafts")
        .update({
          status: "rejected",
          rejected_at: new Date().toISOString(),
          rejection_reason: reason || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Draft rejected" });
      setRejectingId(null);
      setRejectFeedback("");
      queryClient.invalidateQueries({ queryKey: ["admin-drafts"] });
    },
  });

  const deleteScheduledMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("scheduled_persona_posts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Scheduled post deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-scheduled"] });
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const editScheduledMutation = useMutation({
    mutationFn: async ({ id, content, rating, scheduledFor }: {
      id: string; content: string; rating: number | null; scheduledFor: string;
    }) => {
      const { error } = await supabase
        .from("scheduled_persona_posts")
        .update({ content, rating, scheduled_for: scheduledFor })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Post updated" });
      setEditingScheduled(null);
      queryClient.invalidateQueries({ queryKey: ["admin-scheduled"] });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const { data: publishedPosts = [], isLoading: publishedLoading, refetch: refetchPublished } = useQuery<any[]>({
    queryKey: ["admin-published"],
    queryFn: async () => {
      // Get all persona user IDs first
      const { data: personaUsers } = await supabase
        .from("users")
        .select("id, user_name, display_name")
        .eq("is_persona", true);

      if (!personaUsers || personaUsers.length === 0) return [];

      const personaIds = personaUsers.map((u: any) => u.id);
      const userMap = new Map(personaUsers.map((u: any) => [u.id, u]));

      const { data, error } = await supabase
        .from("social_posts")
        .select("id, user_id, post_type, content, rating, media_title, media_type, media_creator, created_at")
        .in("user_id", personaIds)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []).map((p: any) => ({ ...p, persona: userMap.get(p.user_id) }));
    },
    enabled: activeTab === "published",
  });

  const deletePostMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/admin-delete-post`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ postId: id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Delete failed");
    },
    onSuccess: () => {
      toast({ title: "Post deleted from feed" });
      queryClient.invalidateQueries({ queryKey: ["admin-published"] });
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  // Delete a published post from the Scheduled tab (looks up social_posts by content match)
  const deletePublishedScheduledMutation = useMutation({
    mutationFn: async (scheduledPost: ScheduledPost) => {
      const { data: { session } } = await supabase.auth.getSession();

      // Find the matching social_post by user + content
      const { data: matches } = await supabase
        .from("social_posts")
        .select("id")
        .eq("user_id", scheduledPost.persona_user_id)
        .eq("content", scheduledPost.content)
        .limit(1);

      if (matches && matches.length > 0) {
        const res = await fetch(`${supabaseUrl}/functions/v1/admin-delete-post`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ postId: matches[0].id }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Delete failed");
      }

      // Also remove from scheduled_persona_posts
      await supabase.from("scheduled_persona_posts").delete().eq("id", scheduledPost.id);
    },
    onSuccess: () => {
      toast({ title: "Post deleted from feed" });
      queryClient.invalidateQueries({ queryKey: ["admin-scheduled"] });
      queryClient.invalidateQueries({ queryKey: ["admin-published"] });
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const startEditScheduled = (post: ScheduledPost) => {
    setEditingScheduled(post.id);
    setEditContent(post.content);
    setEditRating(post.rating?.toString() || "");
    const d = new Date(post.scheduled_for);
    setEditDate(toLocalDateStr(d));
    setEditTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/post-scheduled-content`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Publish failed");
      if (result.processed === 0) {
        toast({ title: "Nothing to publish yet", description: "No approved posts are due yet — check their scheduled times." });
      } else {
        toast({ title: `Published ${result.successful} of ${result.processed} posts`, description: "Check the feed to see them live." });
        queryClient.invalidateQueries({ queryKey: ["admin-drafts"] });
      }
    } catch (err: any) {
      toast({ title: "Publish failed", description: err.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

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
        body: JSON.stringify({ personaIds: selectedPersonaIds, postsPerPersona, useTrending }),
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
    setEditTime(slotToTimeStr(DAILY_SLOTS[draftIndex % DAILY_SLOTS.length]));
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
          <button onClick={() => setLocation("/admin")} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-2 transition-colors">
            <ArrowLeft size={14} />Back to Admin
          </button>
          <h1 className="text-2xl font-bold text-white mb-1">Generate Persona Posts</h1>
          <p className="text-gray-400 text-sm">AI-powered persona content generation and scheduling</p>
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

          <div className="flex items-center gap-4 mb-4">
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

          <div className="mb-5">
            <button
              type="button"
              onClick={() => setUseTrending(v => !v)}
              className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg border transition-colors ${useTrending ? "bg-purple-600/20 border-purple-500 text-purple-300" : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"}`}
            >
              <TrendingUp size={14} />
              {useTrending ? "Trending mode ON — posts will react to what's hot right now" : "Generate from trending (TMDB + Open Library)"}
            </button>
            {useTrending && (
              <p className="text-xs text-purple-400/70 mt-1.5">Each persona will write reactions to this week's trending TV, movies, and books — making posts feel timely and culturally relevant.</p>
            )}
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

        <div className="flex items-center gap-1 mb-4 overflow-x-auto">
          {([
            { key: "drafts", label: "Pending Drafts" },
            { key: "scheduled", label: "Scheduled" },
            { key: "published", label: "Published" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === key
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              {label}
              {key === "drafts" && drafts.length > 0 && (
                <span className="ml-2 bg-purple-600 text-white text-xs rounded-full px-1.5 py-0.5">{drafts.length}</span>
              )}
            </button>
          ))}
          <button
            onClick={() => activeTab === "drafts" ? refetchDrafts() : activeTab === "scheduled" ? refetchScheduled() : refetchPublished()}
            className="ml-auto text-gray-500 hover:text-gray-300 flex-shrink-0"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Pending Drafts Tab */}
        {activeTab === "drafts" && (
          draftsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-purple-400" />
            </div>
          ) : drafts.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-sm">No pending drafts. Generate some above.</p>
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
                              type="number" min="0.5" max="5" step="0.5"
                              value={editRating}
                              onChange={e => setEditRating(e.target.value)}
                              placeholder="4.5"
                              className="bg-gray-800 border-gray-700 text-white text-sm h-8"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-gray-400 mb-1">Date</p>
                            <Input
                              type="date" value={editDate}
                              onChange={e => setEditDate(e.target.value)}
                              className="bg-gray-800 border-gray-700 text-white text-sm h-8"
                            />
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-1.5">Time <span className="text-gray-600">({getTimezoneAbbr()})</span></p>
                          <div className="flex gap-2 flex-wrap items-center">
                            {DAILY_SLOTS.map((slot) => (
                              <button
                                key={slot.label}
                                onClick={() => setEditTime(slotToTimeStr(slot))}
                                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${editTime === slotToTimeStr(slot) ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                              >
                                {slot.label}
                              </button>
                            ))}
                            <input
                              type="time" value={editTime}
                              onChange={e => setEditTime(e.target.value)}
                              className="bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1 h-7 w-28 focus:outline-none focus:border-purple-500"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            onClick={() => approveMutation.mutate({
                              id: draft.id,
                              scheduledFor: editDate ? buildScheduleISO(editDate, editTime) : staggeredTime.toISOString(),
                              overrideContent: editContent,
                              overrideRating: editRating ? parseFloat(editRating) : null,
                            })}
                            disabled={approveMutation.isPending || !editDate}
                            className="bg-green-700 hover:bg-green-600 text-white text-xs"
                          >
                            <Check size={12} className="mr-1" />Approve & Schedule
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingDraft(null)} className="text-gray-400 text-xs">
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
                              onClick={() => setExpandedNotes(prev => { const next = new Set(prev); if (next.has(draft.id)) next.delete(draft.id); else next.add(draft.id); return next; })}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-400"
                            >
                              {showNotes ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              AI note
                            </button>
                            {showNotes && <p className="mt-1.5 text-xs text-gray-500 italic pl-2 border-l border-gray-700">{draft.ai_notes}</p>}
                          </div>
                        )}
                        {rejectingId === draft.id ? (
                          <div className="space-y-2">
                            <p className="text-xs text-gray-400">Why are you rejecting this? (optional — helps improve future posts)</p>
                            <Textarea
                              value={rejectFeedback}
                              onChange={e => setRejectFeedback(e.target.value)}
                              placeholder="e.g. Too descriptive — reads like a synopsis, not a reaction. We want opinions, not summaries."
                              className="bg-gray-800 border-gray-700 text-white resize-none text-xs min-h-[72px]"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => rejectMutation.mutate({ id: draft.id, reason: rejectFeedback })}
                                disabled={rejectMutation.isPending}
                                className="bg-red-800 hover:bg-red-700 text-white text-xs"
                              >
                                <X size={11} className="mr-1" />Confirm reject
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setRejectingId(null); setRejectFeedback(""); }} className="text-gray-400 text-xs">
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button size="sm" onClick={() => startEdit(draft, index)} className="bg-gray-800 hover:bg-gray-700 text-white text-xs border border-gray-700">
                              Edit & Schedule
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => approveMutation.mutate({ id: draft.id, scheduledFor: staggeredTime.toISOString() })}
                              disabled={approveMutation.isPending}
                              className="bg-green-700 hover:bg-green-600 text-white text-xs"
                            >
                              <Check size={12} className="mr-1" />Approve ({staggerLabel})
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              onClick={() => { setRejectingId(draft.id); setRejectFeedback(""); }}
                              className="text-red-400 hover:text-red-300 hover:bg-red-900/20 text-xs"
                            >
                              <X size={12} className="mr-1" />Reject
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Approved & Scheduled Tab */}
        {activeTab === "scheduled" && (
          scheduledLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-purple-400" />
            </div>
          ) : scheduledPosts.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-sm">No approved posts yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduledPosts.map((post) => {
                const isEditing = editingScheduled === post.id;
                return (
                  <div key={post.id} className={`bg-gray-900 border rounded-2xl p-5 ${post.posted ? "border-green-800/50" : "border-gray-800"}`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                          <User size={13} className="text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{post.persona?.display_name}</p>
                          <p className="text-xs text-gray-500">@{post.persona?.user_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {post.posted ? (
                          <Badge className="bg-green-800/50 text-green-300 border-0 text-xs">Published</Badge>
                        ) : (
                          <Badge className="bg-yellow-800/40 text-yellow-300 border-0 text-xs">Pending</Badge>
                        )}
                        {postTypeBadge(post.post_type)}
                        {mediaTypeBadge(post.media_type)}
                      </div>
                    </div>

                    {post.media_title && (
                      <p className="text-xs text-gray-400 mb-2">
                        <span className="text-gray-500">Re:</span>{" "}
                        <span className="text-gray-300 font-medium">{post.media_title}</span>
                        {post.media_creator && <span className="text-gray-500"> · {post.media_creator}</span>}
                        {post.rating && <StarRating rating={post.rating} />}
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
                              type="number" min="0.5" max="5" step="0.5"
                              value={editRating}
                              onChange={e => setEditRating(e.target.value)}
                              placeholder="4.5"
                              className="bg-gray-800 border-gray-700 text-white text-sm h-8"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-gray-400 mb-1">Date</p>
                            <Input
                              type="date" value={editDate}
                              onChange={e => setEditDate(e.target.value)}
                              className="bg-gray-800 border-gray-700 text-white text-sm h-8"
                            />
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-1.5">Time <span className="text-gray-600">({getTimezoneAbbr()})</span></p>
                          <div className="flex gap-2 flex-wrap items-center">
                            {DAILY_SLOTS.map((slot) => (
                              <button
                                key={slot.label}
                                onClick={() => setEditTime(slotToTimeStr(slot))}
                                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${editTime === slotToTimeStr(slot) ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                              >
                                {slot.label}
                              </button>
                            ))}
                            <input
                              type="time" value={editTime}
                              onChange={e => setEditTime(e.target.value)}
                              className="bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1 h-7 w-28 focus:outline-none focus:border-purple-500"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            onClick={() => editScheduledMutation.mutate({
                              id: post.id,
                              content: editContent,
                              rating: editRating ? parseFloat(editRating) : null,
                              scheduledFor: editDate ? buildScheduleISO(editDate, editTime) : post.scheduled_for,
                            })}
                            disabled={editScheduledMutation.isPending}
                            className="bg-purple-700 hover:bg-purple-600 text-white text-xs"
                          >
                            <Check size={12} className="mr-1" />Save Changes
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingScheduled(null)} className="text-gray-400 text-xs">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-gray-200 leading-relaxed mb-3 whitespace-pre-wrap">{post.content}</p>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Calendar size={12} />
                            <span>{post.posted ? "Published" : "Scheduled for"} {new Date(post.scheduled_for).toLocaleString()}</span>
                          </div>
                          {post.posted ? (
                            <Button
                              size="sm" variant="ghost"
                              onClick={() => deletePublishedScheduledMutation.mutate(post)}
                              disabled={deletePublishedScheduledMutation.isPending}
                              className="text-red-400 hover:text-red-300 hover:bg-red-900/20 text-xs h-7 px-2"
                            >
                              <Trash2 size={11} className="mr-1" />Delete from feed
                            </Button>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm" variant="ghost"
                                onClick={() => startEditScheduled(post)}
                                className="text-gray-400 hover:text-white hover:bg-gray-800 text-xs h-7 px-2"
                              >
                                <Pencil size={11} className="mr-1" />Edit
                              </Button>
                              <Button
                                size="sm" variant="ghost"
                                onClick={() => deleteScheduledMutation.mutate(post.id)}
                                disabled={deleteScheduledMutation.isPending}
                                className="text-red-400 hover:text-red-300 hover:bg-red-900/20 text-xs h-7 px-2"
                              >
                                <Trash2 size={11} className="mr-1" />Delete
                              </Button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
        {/* Published Posts Tab */}
        {activeTab === "published" && (
          publishedLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-purple-400" />
            </div>
          ) : publishedPosts.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-sm">No published bot posts found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {publishedPosts.map((post: any) => (
                <div key={post.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                        <User size={13} className="text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{post.persona?.display_name}</p>
                        <p className="text-xs text-gray-500">@{post.persona?.user_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {postTypeBadge(post.post_type)}
                      {mediaTypeBadge(post.media_type)}
                    </div>
                  </div>

                  {post.media_title && (
                    <p className="text-xs text-gray-400 mb-2">
                      <span className="text-gray-500">Re:</span>{" "}
                      <span className="text-gray-300 font-medium">{post.media_title}</span>
                      {post.media_creator && <span className="text-gray-500"> · {post.media_creator}</span>}
                      {post.rating && <StarRating rating={post.rating} />}
                    </p>
                  )}

                  <p className="text-sm text-gray-200 leading-relaxed mb-3 whitespace-pre-wrap">{post.content}</p>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Calendar size={12} />
                      <span>{new Date(post.created_at).toLocaleString()}</span>
                    </div>
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => deletePostMutation.mutate(post.id)}
                      disabled={deletePostMutation.isPending}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20 text-xs h-7 px-2"
                    >
                      <Trash2 size={11} className="mr-1" />Delete from feed
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
