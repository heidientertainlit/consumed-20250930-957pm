import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, MoreHorizontal, Check, Plus, Copy,
  TrendingUp, MessageCircle,
  Brain, Vote, Tv, Flame, Bell, Users, X,
  Flag, EyeOff, BellOff, CircleHelp, Send, Loader2,
  Film, BookOpen, Mic, BadgeCheck,
} from "lucide-react";
import Navigation from "@/components/navigation";
import { QuickAddListSheet } from "@/components/quick-add-list-sheet";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { APP_BASE } from "@/lib/share";
import { formatDistanceToNow } from "date-fns";

const MEDIA_TYPE_META: Record<string, { label: string; Icon: any }> = {
  movie: { label: "Movie", Icon: Film },
  tv: { label: "TV", Icon: Tv },
  book: { label: "Book", Icon: BookOpen },
  podcast: { label: "Podcast", Icon: Mic },
};

// Parse a room's `examples` text ("Movies: A, B\nShows: C, D") into labeled
// groups. Splits each line on the FIRST colon so titles containing a colon
// (e.g. "Mission: Impossible") stay intact.
const EXAMPLE_GROUP_ICON: Record<string, any> = {
  movies: Film, movie: Film,
  shows: Tv, show: Tv, tv: Tv, series: Tv,
  books: BookOpen, book: BookOpen,
  podcasts: Mic, podcast: Mic,
};
function parseExamples(raw?: string | null): { label: string; Icon: any; items: string[] }[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const ci = line.indexOf(":");
      const hasLabel = ci > 0 && ci < 20;
      const rawLabel = hasLabel ? line.slice(0, ci).trim() : "Examples";
      const body = hasLabel ? line.slice(ci + 1) : line;
      const items = body.split(",").map((s) => s.trim()).filter(Boolean);
      const Icon = EXAMPLE_GROUP_ICON[rawLabel.toLowerCase()] || Film;
      return { label: rawLabel, Icon, items };
    })
    .filter((g) => g.items.length > 0);
}

/**
 * ROOM — the single room template for ALL rooms (genre / topic).
 * Wired to the real backend: pools (room), room_takes (discussions),
 * room_take_replies, room_take_votes, room_follows, user_activity (tracking),
 * user_dna_signals (real % match), room-explore (genre-based Explore discovery).
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";
const ACCENT = "#7c3aed";

// ── Play quick-launch round icons (placeholders — wired in a later pass) ──
const PLAY_ICONS = [
  { label: "Trivia", icon: Brain, bg: "#f3effe", fg: "#7c3aed" },
  { label: "Cast Vote", icon: Vote, bg: "#eaf1ff", fg: "#2563eb" },
  { label: "Predictions", icon: TrendingUp, bg: "#e7f9f0", fg: "#10b981" },
];
const VOTE_CARD = {
  question: "How would you describe the vibe of Paradise?",
  options: ["Political thriller first", "Murder mystery first", "Sci-fi first", "Equal parts all three"],
};
const TRIVIA_CARD = {
  tag: "PARADISE",
  question: "What is the name of Sterling K. Brown's character in Paradise?",
  options: ["Xavier", "Marcus", "Sterling", "Dele"],
};

// ── Optional conversation tags (everything is a discussion; tag is optional) ──
const TAGS = [
  { label: "Take", db: "take", icon: Flame, bg: "#fff1e8", fg: "#f97316" },
  { label: "Theory", db: "theory", icon: Brain, bg: "#f3effe", fg: "#7c3aed" },
  { label: "Question", db: "question", icon: CircleHelp, bg: "#eaf1ff", fg: "#2563eb" },
];
// Map a stored DB tag value (incl. legacy values) to a display tag, or null for no pill.
const dbToDisplay = (dbTag: string | null | undefined) => {
  if (!dbTag) return null;
  const t = String(dbTag).toLowerCase();
  if (t === "take" || t === "hot_take") return TAGS[0];
  if (t === "theory") return TAGS[1];
  if (t === "question") return TAGS[2];
  return null; // discussion / debate / unknown -> no pill
};

const AVATAR_COLORS = ["#f59e0b", "#a855f7", "#22d3ee", "#10b981", "#ef4d65", "#3b6df6"];
const initialOf = (u: any) =>
  (u?.display_name || u?.user_name || "?").trim().charAt(0).toUpperCase();
const nameOf = (u: any) => u?.display_name || u?.user_name || "Someone";
const timeAgo = (s: string) => {
  try { return formatDistanceToNow(new Date(s), { addSuffix: true }); } catch { return ""; }
};

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 mb-3">
      <p className="text-[13px] font-bold uppercase tracking-wider text-gray-500">{title}</p>
      {action && (
        <button onClick={onAction} className="text-[13px] font-semibold" style={{ color: ACCENT }}>{action}</button>
      )}
    </div>
  );
}

const TABS = ["Discuss", "Play", "Explore"] as const;
type Tab = (typeof TABS)[number];

export default function NewRoom() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const currentUserId = session?.user?.id ?? null;
  const token = session?.access_token ?? "";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>("Discuss");
  const [addMedia, setAddMedia] = useState<{ title: string; mediaType: string; imageUrl?: string; externalId?: string; externalSource?: string; creator?: string } | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerTitle, setComposerTitle] = useState("");
  const [composerBody, setComposerBody] = useState("");
  const [composerTag, setComposerTag] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [sort] = useState<"hot" | "new" | "replies">("hot");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [optimisticFollowing, setOptimisticFollowing] = useState<boolean | null>(null);
  const [activeTake, setActiveTake] = useState<any | null>(null);

  // Redirect if no room id (e.g. visiting /new-room directly)
  useEffect(() => {
    if (!roomId) setLocation("/rooms");
  }, [roomId, setLocation]);

  // ── Room (pool) ──────────────────────────────────────────────────────
  const { data: roomData, isLoading } = useQuery({
    queryKey: ["room", roomId],
    queryFn: async () => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-pool-details?pool_id=${roomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
    enabled: !!token && !!roomId,
  });
  const pool = roomData?.pool;
  const members: any[] = roomData?.members || [];

  // ── Takes (discussions) ──────────────────────────────────────────────
  const { data: takesData, refetch: refetchTakes } = useQuery({
    queryKey: ["room-takes", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_takes")
        .select("*, users:user_id(id, display_name, user_name)")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!roomId && !!token,
  });
  const takes: any[] = takesData || [];

  // ── Follow state ─────────────────────────────────────────────────────
  const { data: followData, refetch: refetchFollow } = useQuery({
    queryKey: ["room-follow", roomId, currentUserId],
    queryFn: async () => {
      if (!currentUserId || !roomId) return { following: false, count: 0 };
      const [{ count }, { data: mine }] = await Promise.all([
        supabase.from("room_follows").select("*", { count: "exact", head: true }).eq("room_id", roomId),
        supabase.from("room_follows").select("id").eq("room_id", roomId).eq("user_id", currentUserId).maybeSingle(),
      ]);
      return { following: !!mine, count: count || 0 };
    },
    enabled: !!roomId && !!currentUserId,
  });
  const serverFollowing = followData?.following ?? false;
  const isFollowing = optimisticFollowing !== null ? optimisticFollowing : serverFollowing;

  // ── My votes ─────────────────────────────────────────────────────────
  const { data: myVotesData, refetch: refetchMyVotes } = useQuery({
    queryKey: ["room-my-votes", currentUserId, roomId],
    queryFn: async () => {
      if (!currentUserId) return [];
      const { data } = await supabase.from("room_take_votes").select("*").eq("user_id", currentUserId);
      return data || [];
    },
    enabled: !!currentUserId,
  });
  const myVotes: any[] = myVotesData || [];

  // ── DNA genre signals (real % match) ─────────────────────────────────
  const { data: genreSignals } = useQuery({
    queryKey: ["room-dna-genre", currentUserId],
    queryFn: async () => {
      if (!currentUserId) return [];
      const { data } = await supabase
        .from("user_dna_signals")
        .select("signal_value, strength")
        .eq("user_id", currentUserId)
        .eq("signal_type", "genre");
      return data || [];
    },
    enabled: !!currentUserId,
  });

  const matchPct = useMemo<number | null>(() => {
    const sigs = genreSignals || [];
    if (!pool || sigs.length === 0) return null;
    const overallMax = Math.max(...sigs.map((s: any) => Number(s.strength) || 0));
    if (overallMax <= 0) return null;
    const text = `${pool.name || ""} ${pool.series_tag || ""}`.toLowerCase();
    const keywords = text.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    let matched = 0;
    for (const s of sigs) {
      const v = String(s.signal_value || "").toLowerCase();
      if (!v) continue;
      const hit = text.includes(v) || keywords.some((k) => v.includes(k) || k.includes(v));
      if (hit) matched = Math.max(matched, Number(s.strength) || 0);
    }
    if (matched <= 0) return null;
    return Math.min(100, Math.round((matched / overallMax) * 100));
  }, [genreSignals, pool]);

  // ── Room tracking (entry + actions) ──────────────────────────────────
  const logRoomEvent = async (action_type: string, metadata: Record<string, any> = {}) => {
    if (!currentUserId || !roomId) return;
    try {
      await supabase.from("user_activity").insert({
        user_id: currentUserId,
        action_type,
        target_type: "room",
        target_id: roomId,
        metadata,
      });
    } catch (e) {
      console.error("[room track]", e);
    }
  };

  const enteredRef = useRef(false);
  useEffect(() => {
    if (pool && currentUserId && !enteredRef.current) {
      enteredRef.current = true;
      logRoomEvent("room_enter", { room_name: pool.name, room_category: pool.room_category });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, currentUserId]);

  // ── Derived feeds ────────────────────────────────────────────────────
  const trending = useMemo(() => {
    const wk = Date.now() - 7 * 864e5;
    return takes
      .filter((t) => new Date(t.created_at).getTime() >= wk)
      .sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0))
      .slice(0, 6);
  }, [takes]);

  const sortedTakes = useMemo(() => {
    const arr = [...takes];
    if (sort === "new") arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sort === "replies") arr.sort((a, b) => (b.reply_count || 0) - (a.reply_count || 0));
    else arr.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
    return arr;
  }, [takes, sort]);

  // ── Explore: genre-based discovery via room-explore ──────────────────
  const exploreTag = pool?.series_tag || pool?.name || "";
  const parsedExamples = useMemo(() => parseExamples(pool?.examples), [pool?.examples]);
  // Flat list of example titles used to seed TMDB recommendations in Explore.
  const exploreSeeds = useMemo(
    () => parsedExamples.flatMap((g) => g.items).slice(0, 8).join("|"),
    [parsedExamples]
  );
  const { data: exploreData, isLoading: loadingExplore, isError: exploreError } = useQuery({
    queryKey: ["room-explore", exploreTag, pool?.media_type ?? "all", exploreSeeds],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (pool?.series_tag) qs.set("series_tag", pool.series_tag);
      if (pool?.name) qs.set("name", pool.name);
      if (pool?.media_type) qs.set("media_type", pool.media_type);
      if (exploreSeeds) qs.set("seeds", exploreSeeds);
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/room-explore?${qs.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`room-explore failed: ${res.status}`);
      return res.json();
    },
    enabled: !!token && !!exploreTag && tab === "Explore",
  });
  const exploreSections: { key: string; title: string; items: any[] }[] =
    exploreData?.sections || [];

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleFollow = async () => {
    if (!currentUserId) { toast({ title: "Sign in to follow rooms" }); return; }
    const next = !isFollowing;
    setOptimisticFollowing(next);
    if (next) {
      await supabase.from("room_follows").insert({ room_id: roomId, user_id: currentUserId });
      logRoomEvent("room_follow");
    } else {
      await supabase.from("room_follows").delete().eq("room_id", roomId).eq("user_id", currentUserId);
      logRoomEvent("room_unfollow");
    }
    await refetchFollow();
    setOptimisticFollowing(null);
  };

  const handleCopyInvite = () => {
    if (!pool?.invite_code) return;
    navigator.clipboard.writeText(`${APP_BASE}/room/join/${pool.invite_code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Invite link copied!" });
  };

  const handlePost = async () => {
    if (!composerTitle.trim() || !currentUserId) return;
    setPosting(true);
    const dbTag = TAGS.find((t) => t.label === composerTag)?.db ?? null;
    const { data: newTake, error } = await supabase
      .from("room_takes")
      .insert({
        room_id: roomId,
        user_id: currentUserId,
        title: composerTitle.trim(),
        body: composerBody.trim() || null,
        tag: dbTag,
      })
      .select("*, users:user_id(id, display_name, user_name)")
      .single();
    if (error) {
      toast({ title: "Could not post", description: error.message, variant: "destructive" });
      setPosting(false);
      return;
    }
    // Notify followers (excluding poster)
    try {
      const { data: followers } = await supabase
        .from("room_follows")
        .select("user_id")
        .eq("room_id", roomId)
        .neq("user_id", currentUserId);
      if (followers && followers.length > 0) {
        const notifs = followers.map((f: any) => ({
          user_id: f.user_id,
          type: "room_new_post",
          message: `New conversation in ${pool?.name || "a room"}`,
          read: false,
          list_id: roomId,
          action_url: `/room/${roomId}`,
        }));
        await supabase.from("notifications").insert(notifs);
      }
    } catch (e) {
      console.error("[room notify]", e);
    }
    logRoomEvent("room_post", { take_id: newTake?.id, tag: dbTag });
    setComposerTitle("");
    setComposerBody("");
    setComposerTag(null);
    setComposerOpen(false);
    await refetchTakes();
    setPosting(false);
    toast({ title: "Posted!" });
  };

  const hasAgreed = (takeId: string) =>
    myVotes.some((v) => v.take_id === takeId && !v.reply_id && v.vote === 1);

  const handleAgree = async (take: any) => {
    if (!currentUserId) { toast({ title: "Sign in to react" }); return; }
    const existing = myVotes.find((v) => v.take_id === take.id && !v.reply_id);
    if (existing) {
      if (existing.vote === 1) {
        await supabase.from("room_take_votes").delete().eq("id", existing.id);
        await supabase.from("room_takes").update({ upvotes: Math.max(0, (take.upvotes || 0) - 1) }).eq("id", take.id);
      } else {
        await supabase.from("room_take_votes").update({ vote: 1 }).eq("id", existing.id);
        await supabase.from("room_takes").update({ upvotes: (take.upvotes || 0) + 2 }).eq("id", take.id);
      }
    } else {
      await supabase.from("room_take_votes").insert({ take_id: take.id, user_id: currentUserId, vote: 1 });
      await supabase.from("room_takes").update({ upvotes: (take.upvotes || 0) + 1 }).eq("id", take.id);
      logRoomEvent("room_vote", { take_id: take.id });
    }
    refetchTakes();
    refetchMyVotes();
  };

  const followerCount = followData?.count ?? 0;
  const memberLabel = members.length > 0 ? `${members.length} member${members.length === 1 ? "" : "s"}` : `${followerCount} follower${followerCount === 1 ? "" : "s"}`;
  const avatarUsers = (members.length > 0 ? members.map((m) => m.users) : []).filter(Boolean).slice(0, 3);

  if (!roomId) return null;
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-purple-500" size={28} />
      </div>
    );
  }
  if (!pool) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-gray-700 font-semibold">{roomData?.error || "Room not found"}</p>
        <button onClick={() => setLocation("/rooms")} className="text-purple-600 font-semibold text-sm">Back to rooms</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto pb-28">

        {/* ── Purple gradient hero header ── */}
        <div className="relative pb-5" style={{ background: "linear-gradient(165deg, #14101f 0%, #1d1638 55%, #2d1f6e 100%)" }}>
          <div className="absolute inset-0 pointer-events-none opacity-40" style={{ background: "radial-gradient(circle at 85% 10%, rgba(168,85,247,0.45), transparent 55%)" }} />
          <div className="relative">
            <Navigation />
            <div className="px-4 pt-2">
              <div className="flex items-center justify-between mb-5">
                <button onClick={() => window.history.back()} className="p-1 -ml-1 active:scale-90 transition-transform">
                  <ChevronLeft size={26} className="text-white" />
                </button>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleFollow}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold active:scale-95 transition-all"
                    style={isFollowing
                      ? { background: "rgba(124,58,237,0.35)", border: "1px solid rgba(168,85,247,0.6)", color: "#e9d5ff" }
                      : { background: ACCENT, color: "#fff" }}
                  >
                    {isFollowing ? <><Check size={15} /> Following</> : <><Plus size={15} /> Follow</>}
                  </button>
                  <button onClick={handleCopyInvite} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold text-white/90 active:scale-95 transition-all" style={{ border: "1px solid rgba(255,255,255,0.2)" }}>
                    {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Invite</>}
                  </button>
                </div>
              </div>

              <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-purple-300/80 mb-1">Room</p>
              <div className="flex items-center gap-2">
                <h1 className="text-[30px] font-extrabold text-white leading-tight">{pool.name}</h1>
                {pool.is_official && <BadgeCheck size={24} className="text-blue-400 shrink-0" aria-label="Consumed Official" />}
              </div>

              {pool.description && (
                <p className="text-[14px] text-white/75 leading-relaxed mt-2.5">{pool.description}</p>
              )}
              {parsedExamples.length > 0 && (
                <div className="mt-4 space-y-2.5">
                  {parsedExamples.map((g, gi) => (
                    <div key={gi} className="flex items-start gap-2.5">
                      <div className="flex items-center gap-1.5 shrink-0 pt-1.5">
                        <g.Icon size={13} className="text-purple-300/80" />
                        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-purple-300/70 w-[52px]">{g.label}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {g.items.map((item, ii) => (
                          <span
                            key={ii}
                            className="text-[12px] text-white/85 bg-white/10 border border-white/10 rounded-full px-2.5 py-1 leading-none"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Member avatars */}
              <div className="flex items-center mt-3">
                {avatarUsers.length > 0 ? avatarUsers.map((u: any, idx: number) => (
                  <div
                    key={idx}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white ring-2"
                    style={{ background: AVATAR_COLORS[idx % AVATAR_COLORS.length], marginLeft: idx === 0 ? 0 : -8, ["--tw-ring-color" as any]: "#1d1638" }}
                  >
                    {initialOf(u)}
                  </div>
                )) : (
                  <Users size={18} className="text-white/40" />
                )}
                <span className="ml-3 text-[13px] text-white/50">{memberLabel}</span>
              </div>

            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="flex px-4">
            {TABS.map((t) => {
              const active = tab === t;
              return (
                <button key={t} onClick={() => setTab(t)} className={`relative flex-1 py-3.5 text-[14px] font-semibold transition-colors ${active ? "text-gray-900" : "text-gray-400"}`}>
                  {t}
                  {active && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-10 rounded-full" style={{ background: ACCENT }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ════════ PLAY (placeholder — wired next pass) ════════ */}
        {tab === "Play" && (
        <div className="pt-5 pb-2">
          <div className="grid grid-cols-3 gap-2 px-6 mb-5">
            {PLAY_ICONS.map((p, i) => {
              const Icon = p.icon;
              return (
                <button key={i} className="flex flex-col items-center gap-1.5 py-1 active:scale-95 transition-transform">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: p.bg }}>
                    <Icon size={22} style={{ color: p.fg }} />
                  </div>
                  <span className="text-[12px] font-semibold text-gray-700">{p.label}</span>
                </button>
              );
            })}
          </div>
          <div className="px-4">
            <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#eaf1ff" }}>
                    <Tv size={18} style={{ color: "#2563eb" }} />
                  </div>
                  <span className="text-[16px] font-bold text-gray-900">Cast Your Vote</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-gray-400">1/3</span>
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><ChevronRight size={16} className="text-gray-500" /></div>
                </div>
              </div>
              <p className="text-[19px] font-extrabold text-gray-900 leading-snug mb-4">{VOTE_CARD.question}</p>
              <div className="grid grid-cols-2 gap-2.5">
                {VOTE_CARD.options.map((o, i) => (
                  <button key={i} className="rounded-2xl bg-gray-50 border border-gray-100 px-3 py-4 text-[14px] font-medium text-gray-700 text-center active:scale-[0.98] transition-transform">{o}</button>
                ))}
              </div>
              <p className="text-right text-[13px] font-bold text-emerald-500 mt-3">+10 pts</p>
            </div>
          </div>
          <div className="px-4 mt-4">
            <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#f3effe" }}>
                    <Brain size={18} style={{ color: "#7c3aed" }} />
                  </div>
                  <div>
                    <p className="text-[16px] font-bold text-gray-900 leading-tight">Paradise Trivia</p>
                    <p className="text-[12px] text-gray-400">2 questions</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><ChevronRight size={16} className="text-gray-500" /></div>
                  <span className="text-[13px] text-gray-400">1/2</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mb-2">
                <Tv size={13} style={{ color: "#7c3aed" }} />
                <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#7c3aed" }}>{TRIVIA_CARD.tag}</span>
              </div>
              <p className="text-[19px] font-extrabold text-gray-900 leading-snug mb-4">{TRIVIA_CARD.question}</p>
              <div className="grid grid-cols-2 gap-2.5">
                {TRIVIA_CARD.options.map((o, i) => (
                  <button key={i} className="rounded-2xl bg-gray-50 border border-gray-100 px-3 py-4 text-[14px] font-medium text-gray-700 text-center active:scale-[0.98] transition-transform">{o}</button>
                ))}
              </div>
              <p className="text-right text-[13px] font-bold text-emerald-500 mt-3">+30 pts</p>
            </div>
          </div>
        </div>
        )}

        {/* ════════ EXPLORE ════════ */}
        {tab === "Explore" && (<>
          {loadingExplore ? (
            <div className="flex justify-center py-14"><Loader2 className="animate-spin text-purple-400" size={24} /></div>
          ) : exploreError ? (
            <p className="px-5 py-14 text-center text-[14px] text-gray-400">Couldn't load titles right now. Pull to refresh or try again in a moment.</p>
          ) : exploreSections.length === 0 ? (
            <p className="px-5 py-14 text-center text-[14px] text-gray-400">No titles to explore for this room yet.</p>
          ) : (
            exploreSections.map((section) => (
              <div
                key={section.key}
                className="pt-7"
              >
                <SectionHeader title={section.title} />
                <div className="flex items-start gap-3 px-5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                  {section.items.map((t: any, i: number) => {
                    const img = t.poster_url || t.image;
                    const meta = MEDIA_TYPE_META[t.type];
                    return (
                      <div
                        key={`${t.external_source}-${t.external_id}-${i}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          const type = t.type || "movie";
                          const source = t.external_source || t.source;
                          if (source && t.external_id) setLocation(`/media/${type}/${source}/${t.external_id}`);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            const type = t.type || "movie";
                            const source = t.external_source || t.source;
                            if (source && t.external_id) setLocation(`/media/${type}/${source}/${t.external_id}`);
                          }
                        }}
                        className="flex-shrink-0 w-[110px] text-left active:scale-95 transition-transform cursor-pointer"
                      >
                        <div className="relative w-[110px] h-[160px] rounded-xl overflow-hidden flex items-end p-2.5" style={{ background: img ? "#1a1530" : "linear-gradient(160deg,#3a2f5e,#1a1530)" }}>
                          {img && <img src={img} alt={t.title} className="absolute inset-0 w-full h-full object-cover" />}
                          {!img && <span className="relative text-white text-[13px] font-extrabold leading-tight drop-shadow">{t.title}</span>}
                          {meta && (
                            <span className="absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded-full bg-black/65 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-semibold text-white">
                              <meta.Icon size={9} />
                              {meta.label}
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddMedia({
                                title: t.title,
                                mediaType: t.type || "movie",
                                imageUrl: img,
                                externalId: t.external_id,
                                externalSource: t.external_source || t.source,
                                creator: t.creator,
                              });
                            }}
                            aria-label={`Add ${t.title} to a list`}
                            className="absolute bottom-1.5 right-1.5 flex items-center justify-center w-7 h-7 rounded-full bg-white/95 text-purple-700 shadow-md active:scale-90 transition-transform"
                          >
                            <Plus size={16} strokeWidth={2.5} />
                          </button>
                        </div>
                        <p className="text-[12px] font-medium text-gray-700 mt-1.5 text-center leading-tight">{t.title}{t.year ? ` (${t.year})` : ""}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </>)}

        {/* ════════ DISCUSS ════════ */}
        {tab === "Discuss" && (
        <div className="pt-7">
          {/* Trending this week */}
          {trending.length > 0 && (<>
            <SectionHeader title="Trending this week" />
            <div className="flex gap-3 overflow-x-auto px-4 pb-1 -mt-1 mb-6 scrollbar-hide">
              {trending.map((t: any) => (
                <button key={t.id} onClick={() => setActiveTake(t)} className="flex-shrink-0 w-[150px] rounded-2xl p-3.5 flex flex-col justify-between text-left" style={{ background: "#f3effe", minHeight: 96 }}>
                  <p className="text-[14px] font-bold text-gray-900 leading-snug line-clamp-2">{t.title}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[12px] text-gray-500">{t.reply_count || 0} replies</span>
                    <Flame size={15} className="text-orange-500" />
                  </div>
                </button>
              ))}
            </div>
          </>)}

          {/* Start a Conversation */}
          <div className="px-4">
            <button
              onClick={() => setComposerOpen(true)}
              className="w-full flex items-center justify-center gap-2 rounded-full border-2 py-3.5 text-[16px] font-bold active:scale-[0.99] transition-transform"
              style={{ borderColor: "rgba(124,58,237,0.4)", color: ACCENT }}
            >
              <Plus size={20} /> Start a Conversation
            </button>
          </div>

          {/* Composer */}
          {composerOpen && (
          <div className="px-4 mt-3">
            <div className="relative rounded-3xl border border-gray-100 shadow-sm bg-white overflow-hidden">
              <button onClick={() => setComposerOpen(false)} className="absolute top-3 right-3 p-1.5 rounded-full text-gray-400 active:bg-gray-100 transition-colors z-10" aria-label="Close composer">
                <X size={20} />
              </button>
              <div className="px-5 pt-5 pb-4 pr-12">
                <input
                  autoFocus
                  value={composerTitle}
                  onChange={(e) => setComposerTitle(e.target.value)}
                  placeholder="Add a title…"
                  className="w-full border-0 outline-none bg-transparent text-[17px] font-bold text-gray-900 placeholder:text-gray-300 mb-2"
                />
                <textarea
                  rows={3}
                  value={composerBody}
                  onChange={(e) => setComposerBody(e.target.value)}
                  placeholder="Start a discussion…"
                  className="w-full resize-none border-0 outline-none bg-transparent text-[15px] text-gray-900 placeholder:text-gray-400"
                />
              </div>
              <div className="border-t border-gray-100" />
              <div className="px-5 py-4">
                <p className="text-[12px] font-semibold text-gray-400 mb-2.5">Add a tag (optional)</p>
                <div className="flex flex-wrap gap-2">
                  {TAGS.map((s, i) => {
                    const Icon = s.icon;
                    const active = composerTag === s.label;
                    return (
                      <button
                        key={i}
                        onClick={() => setComposerTag(active ? null : s.label)}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold border transition-all active:scale-95"
                        style={active ? { background: s.bg, color: s.fg, borderColor: s.fg } : { background: "#fff", color: "#6b7280", borderColor: "#e5e7eb" }}
                      >
                        <Icon size={14} style={active ? { color: s.fg } : undefined} /> {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="px-4 pb-4">
                <button
                  onClick={handlePost}
                  disabled={posting || !composerTitle.trim()}
                  className="w-full rounded-full py-3 text-[15px] font-semibold bg-purple-50 text-purple-600 active:bg-purple-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {posting && <Loader2 size={16} className="animate-spin" />} Post
                </button>
              </div>
            </div>
          </div>
          )}

          {/* All conversations */}
          <div className="flex items-center justify-between px-5 mt-7 mb-3">
            <p className="text-[13px] font-bold uppercase tracking-wider text-gray-500">All conversations</p>
          </div>

          <div className="px-4 space-y-3">
            {sortedTakes.length === 0 && (
              <p className="text-center text-[14px] text-gray-400 py-8">No conversations yet — start one above.</p>
            )}
            {sortedTakes.map((t: any) => {
              const g = dbToDisplay(t.tag);
              const TagIcon = g?.icon;
              const agreed = hasAgreed(t.id);
              return (
              <div key={t.id} className="rounded-2xl border border-gray-100 p-4">
                {flagged.includes(t.id) ? (
                  <div className="flex items-center gap-2 py-2 text-[13px] text-gray-500">
                    <Flag size={15} className="text-gray-400" />
                    <span>Thanks — this conversation has been reported for review.</span>
                  </div>
                ) : (
                <>
                {g && TagIcon && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold mb-2" style={{ background: g.bg, color: g.fg }}>
                    <TagIcon size={12} /> {g.label}
                  </span>
                )}
                <button onClick={() => setActiveTake(t)} className="block w-full text-left">
                  <p className="text-[16px] font-bold text-gray-900 leading-snug">{t.title}</p>
                  {t.body && <p className="text-[14px] text-gray-500 leading-snug mt-1 line-clamp-3">{t.body}</p>}
                </button>
                <p className="text-[12px] text-gray-400 mt-2">{nameOf(t.users)} · {timeAgo(t.created_at)}</p>

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-3 text-[13px] text-gray-500">
                    <button onClick={() => handleAgree(t)} className="flex items-center gap-1 active:scale-95 transition-transform" style={agreed ? { color: ACCENT } : undefined}>
                      <Users size={14} /> {t.upvotes || 0} agree
                    </button>
                    <button onClick={() => setActiveTake(t)} className="flex items-center gap-1">
                      <MessageCircle size={14} /> {t.reply_count || 0} replies
                    </button>
                  </div>
                  <div className="relative flex items-center gap-3 text-gray-400">
                    <button className="active:text-gray-700"><Bell size={16} /></button>
                    <button onClick={() => setMenuFor(menuFor === t.id ? null : t.id)} aria-label="More options"><MoreHorizontal size={18} /></button>
                    {menuFor === t.id && (<>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                      <div className="absolute right-0 top-7 z-20 w-52 rounded-2xl border border-gray-100 bg-white shadow-lg overflow-hidden py-1">
                        <button onClick={() => { setFlagged((f) => [...f, t.id]); setMenuFor(null); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[14px] text-red-600 active:bg-gray-50">
                          <Flag size={16} /> Flag as inappropriate
                        </button>
                        <button onClick={() => setMenuFor(null)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[14px] text-gray-700 active:bg-gray-50">
                          <EyeOff size={16} className="text-gray-400" /> Not interested
                        </button>
                        <button onClick={() => setMenuFor(null)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[14px] text-gray-700 active:bg-gray-50">
                          <BellOff size={16} className="text-gray-400" /> Mute {nameOf(t.users)}
                        </button>
                      </div>
                    </>)}
                  </div>
                </div>
                </>
                )}
              </div>
              );
            })}
          </div>
        </div>
        )}

      </div>

      {/* ── Thread view ── */}
      {activeTake && (
        <ThreadSheet
          take={activeTake}
          currentUserId={currentUserId}
          myVotes={myVotes}
          onClose={() => setActiveTake(null)}
          onChanged={() => { refetchTakes(); refetchMyVotes(); }}
          logRoomEvent={logRoomEvent}
        />
      )}

      <QuickAddListSheet
        isOpen={!!addMedia}
        onClose={() => setAddMedia(null)}
        media={addMedia}
        elevated
      />
    </div>
  );
}

// ── Thread (take detail + replies) ─────────────────────────────────────
function ThreadSheet({ take, currentUserId, myVotes, onClose, onChanged, logRoomEvent }: {
  take: any;
  currentUserId: string | null;
  myVotes: any[];
  onClose: () => void;
  onChanged: () => void;
  logRoomEvent: (action_type: string, metadata?: Record<string, any>) => Promise<void>;
}) {
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const g = dbToDisplay(take.tag);
  const TagIcon = g?.icon;

  const { data: repliesData, refetch: refetchReplies } = useQuery({
    queryKey: ["take-replies", take.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("room_take_replies")
        .select("*, users:user_id(id, display_name, user_name)")
        .eq("take_id", take.id)
        .order("upvotes", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!take.id,
  });
  const replies: any[] = repliesData || [];

  const handleReply = async () => {
    if (!replyText.trim() || !currentUserId) return;
    setReplying(true);
    await supabase.from("room_take_replies").insert({
      take_id: take.id,
      parent_reply_id: null,
      user_id: currentUserId,
      content: replyText.trim(),
    });
    await supabase.from("room_takes").update({ reply_count: (take.reply_count || 0) + 1 }).eq("id", take.id);
    logRoomEvent("room_reply", { take_id: take.id });
    setReplyText("");
    setReplying(false);
    refetchReplies();
    onChanged();
  };

  const myReplyVote = (replyId: string) => myVotes.find((v) => v.reply_id === replyId);
  const handleReplyUpvote = async (reply: any) => {
    if (!currentUserId) return;
    const existing = myReplyVote(reply.id);
    if (existing) {
      if (existing.vote === 1) {
        await supabase.from("room_take_votes").delete().eq("id", existing.id);
        await supabase.from("room_take_replies").update({ upvotes: Math.max(0, (reply.upvotes || 0) - 1) }).eq("id", reply.id);
      } else {
        await supabase.from("room_take_votes").update({ vote: 1 }).eq("id", existing.id);
        await supabase.from("room_take_replies").update({ upvotes: (reply.upvotes || 0) + 1 }).eq("id", reply.id);
      }
    } else {
      await supabase.from("room_take_votes").insert({ reply_id: reply.id, user_id: currentUserId, vote: 1 });
      await supabase.from("room_take_replies").update({ upvotes: (reply.upvotes || 0) + 1 }).eq("id", reply.id);
    }
    refetchReplies();
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col">
      <div className="max-w-md w-full mx-auto flex flex-col h-full">
        {/* header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <button onClick={onClose} className="p-1 -ml-1 active:scale-90 transition-transform"><ChevronLeft size={24} className="text-gray-700" /></button>
          <p className="text-[15px] font-bold text-gray-900">Conversation</p>
        </div>

        {/* scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {g && TagIcon && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold mb-2" style={{ background: g.bg, color: g.fg }}>
              <TagIcon size={12} /> {g.label}
            </span>
          )}
          <p className="text-[19px] font-extrabold text-gray-900 leading-snug">{take.title}</p>
          {take.body && <p className="text-[15px] text-gray-600 leading-relaxed mt-2">{take.body}</p>}
          <p className="text-[12px] text-gray-400 mt-2">{nameOf(take.users)} · {timeAgo(take.created_at)}</p>
          <div className="flex items-center gap-4 text-[13px] text-gray-500 mt-3">
            <span className="flex items-center gap-1"><Users size={14} /> {take.upvotes || 0} agree</span>
            <span className="flex items-center gap-1"><MessageCircle size={14} /> {take.reply_count || 0} replies</span>
          </div>

          <div className="border-t border-gray-100 my-4" />

          <p className="text-[13px] font-bold uppercase tracking-wider text-gray-500 mb-3">Replies</p>
          {replies.length === 0 ? (
            <p className="text-[14px] text-gray-400 py-4">No replies yet — be the first.</p>
          ) : (
            <div className="space-y-3">
              {replies.map((r: any) => {
                const voted = myReplyVote(r.id)?.vote === 1;
                return (
                  <div key={r.id} className="rounded-2xl bg-gray-50 p-3.5">
                    <p className="text-[12px] font-semibold text-gray-700 mb-1">{nameOf(r.users)} · {timeAgo(r.created_at)}</p>
                    <p className="text-[14px] text-gray-800 leading-snug">{r.content}</p>
                    <button onClick={() => handleReplyUpvote(r)} className="flex items-center gap-1 text-[13px] mt-2 active:scale-95 transition-transform" style={voted ? { color: ACCENT } : { color: "#6b7280" }}>
                      <Users size={13} /> {r.upvotes || 0}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* reply composer */}
        <div className="border-t border-gray-100 px-3 py-3 flex items-center gap-2">
          <input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
            placeholder={currentUserId ? "Add a reply…" : "Sign in to reply"}
            disabled={!currentUserId || replying}
            className="flex-1 rounded-full bg-gray-100 px-4 py-2.5 text-[14px] outline-none disabled:opacity-60"
          />
          <button onClick={handleReply} disabled={!replyText.trim() || replying} className="w-10 h-10 rounded-full flex items-center justify-center text-white disabled:opacity-40" style={{ background: ACCENT }}>
            {replying ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
