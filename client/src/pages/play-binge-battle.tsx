import { useState, useEffect, useRef, useCallback } from "react";
import { APP_BASE } from "@/lib/share";
import { useLocation } from "wouter";
import { ChevronLeft, Search, Zap, CheckCircle2, Trophy, Share2, RotateCcw, MessageCircle, Loader2, Clock, Minus, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/navigation";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";

type View = "hub" | "new" | "sent" | "active" | "finished";

type MediaItem = {
  id: string;
  title: string;
  sub: string;
  type: string;
  poster: string;
  total: number;
  unit: string;
  external_id?: string;
  external_source?: string;
  series_count?: number;
};

type BattleRow = {
  id: string;
  challenger_id: string;
  opponent_id: string | null;
  media_title: string;
  media_type: string;
  media_poster: string | null;
  media_sub: string | null;
  media_total: number;
  media_unit: string;
  media_external_id: string;
  media_external_source: string;
  status: string;
  challenger_progress: number;
  opponent_progress: number;
  winner_id: string | null;
  created_at: string;
};

type UserInfo = {
  id: string;
  name: string;
  avatar: string;
  color: string;
};

const AVATAR_COLORS = ["#7c3aed", "#0891b2", "#d97706", "#059669", "#db2777", "#dc2626"];
function colorForId(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i++) n += id.charCodeAt(i);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

const EXAMPLE_MEDIA: MediaItem[] = [
  {
    id: "friends-tv",
    title: "Friends",
    sub: "Full Series · NBC · 10 seasons",
    type: "TV",
    poster: "https://image.tmdb.org/t/p/w200/f496cm9enuEsZkSPzCwnTESEK5s.jpg",
    total: 236,
    unit: "episodes",
    external_id: "1668",
    external_source: "tmdb",
  },
  {
    id: "hp-books",
    title: "Harry Potter Series",
    sub: "J.K. Rowling · 7 books",
    type: "Book",
    poster: "https://covers.openlibrary.org/b/id/10110415-M.jpg",
    total: 7,
    unit: "books",
    external_id: "OL82592W",
    external_source: "openlibrary",
  },
  {
    id: "good-hang",
    title: "Good Hang with Amy Poehler",
    sub: "Amy Poehler · Comedy · iHeart",
    type: "Podcast",
    poster: "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/f8/96/e8/f896e808-3b6c-bada-d3e6-39e51c7dbf00/mza_6234927437259781246.jpg/200x200bb.jpg",
    total: 50,
    unit: "episodes",
    external_id: "good-hang",
    external_source: "podcast",
  },
];

export default function PlayBingeBattle() {
  const [, setLocation] = useLocation();
  const { user, session } = useAuth();
  const { toast } = useToast();

  const [view, setView] = useState<View>("hub");
  const [selectedItems, setSelectedItems] = useState<MediaItem[]>([]);
  const [search, setSearch] = useState("");
  const [mediaResults, setMediaResults] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const mediaDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hub state
  const [battles, setBattles] = useState<BattleRow[]>([]);
  const [battlesLoading, setBattlesLoading] = useState(false);
  const [userMap, setUserMap] = useState<Record<string, UserInfo>>({});

  // Battle creation
  const [creating, setCreating] = useState(false);
  const [createdBattleId, setCreatedBattleId] = useState<string | null>(null);

  // Active/finished battle state
  const [currentBattle, setCurrentBattle] = useState<BattleRow | null>(null);
  const [myProgress, setMyProgress] = useState(0);
  const [updating, setUpdating] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // --- Media search ---
  const doMediaSearch = useCallback(async (query: string) => {
    if (!query.trim() || !session?.access_token) { setMediaResults([]); return; }
    setMediaLoading(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/media-search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, include_book_series: true }),
      });
      const data = await resp.json();
      const mapped: MediaItem[] = (data.results || []).slice(0, 20).map((r: any) => {
        const isBookSeries = r.type === "book_series";
        return {
          id: r.external_id || r.id || r.title,
          title: r.title,
          sub: isBookSeries
            ? [r.creator, r.series_count ? `${r.series_count} books` : null].filter(Boolean).join(" · ")
            : [r.creator || r.artist, r.year, r.network || r.platform].filter(Boolean).join(" · "),
          type: isBookSeries ? "Book Series" : (r.type ? (r.type.charAt(0).toUpperCase() + r.type.slice(1)) : "Media"),
          poster: r.image_url || r.poster_url || r.image || "",
          total: isBookSeries ? (r.series_count || 1) : (r.type === "book" ? 100 : r.type === "podcast" ? 20 : r.episodes || 10),
          unit: isBookSeries ? "books" : (r.type === "book" ? "% read" : "episodes"),
          external_id: r.external_id,
          external_source: r.external_source,
          series_count: r.series_count,
        };
      });
      setMediaResults(mapped);
    } catch {
      setMediaResults([]);
    } finally {
      setMediaLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!search.trim()) { setMediaResults([]); return; }
    if (mediaDebounce.current) clearTimeout(mediaDebounce.current);
    mediaDebounce.current = setTimeout(() => doMediaSearch(search), 400);
    return () => { if (mediaDebounce.current) clearTimeout(mediaDebounce.current); };
  }, [search, doMediaSearch]);

  const displayMedia = search.trim() ? mediaResults : EXAMPLE_MEDIA;

  // --- Load battles for hub ---
  async function loadBattles() {
    if (!user?.id) return;
    setBattlesLoading(true);
    const { data } = await supabase
      .from("binge_battles")
      .select("*")
      .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    const rows: BattleRow[] = data || [];
    setBattles(rows);

    // Load user info for all unique IDs
    const ids = [...new Set(rows.flatMap(b => [b.challenger_id, b.opponent_id]).filter(Boolean) as string[])];
    if (ids.length > 0) {
      const { data: usersData } = await supabase
        .from("users")
        .select("id, user_name, display_name")
        .in("id", ids);
      const map: Record<string, UserInfo> = {};
      (usersData || []).forEach((u: any) => {
        const name = u.display_name || u.user_name || "Friend";
        map[u.id] = {
          id: u.id,
          name,
          avatar: name[0].toUpperCase(),
          color: colorForId(u.id),
        };
      });
      setUserMap(map);
    }

    setBattlesLoading(false);
  }

  useEffect(() => {
    if (view === "hub") loadBattles();
  }, [view, user?.id]);

  // --- Combine multiple selected items into one battle entry ---
  function buildCombinedMedia(items: MediaItem[]) {
    if (items.length === 1) return items[0];
    const first = items[0];
    // Build a combined title: find common prefix or use "First Title + N more"
    const titles = items.map(i => i.title);
    const words = titles[0].split(/\s+/);
    let prefixLen = words.length;
    for (const t of titles.slice(1)) {
      const tw = t.split(/\s+/);
      let match = 0;
      for (let i = 0; i < Math.min(prefixLen, tw.length); i++) {
        if (words[i].toLowerCase() === tw[i].toLowerCase()) match = i + 1;
        else break;
      }
      prefixLen = match;
    }
    const commonPrefix = prefixLen >= 2 ? words.slice(0, prefixLen).join(" ") : "";

    // For multi-select: always count items, never "% read"
    const isAllBooks = items.every(i => i.unit === "% read" || i.unit === "books");
    const isAllEpisodes = items.every(i => i.unit === "episodes");
    const unit = isAllBooks ? "books" : isAllEpisodes ? "episodes" : "items";
    const total = items.length;

    const combinedTitle = commonPrefix
      ? `${commonPrefix} (${total} ${unit})`
      : `${titles[0]} + ${items.length - 1} more`;

    return {
      id: items.map(i => i.id).join("|"),
      title: combinedTitle,
      sub: items.map(i => i.title).join(", "),
      type: first.type,
      poster: first.poster,
      total,
      unit,
      external_id: items.map(i => i.external_id || i.id).join("|"),
      external_source: "multi",
    } as MediaItem;
  }

  // --- Create battle ---
  async function handleStartBattle() {
    if (selectedItems.length === 0 || !user?.id) return;
    const combined = buildCombinedMedia(selectedItems);
    setCreating(true);
    const { data, error } = await supabase
      .from("binge_battles")
      .insert({
        challenger_id: user.id,
        media_external_id: combined.external_id || combined.id,
        media_external_source: combined.external_source || "unknown",
        media_title: combined.title,
        media_type: combined.type,
        media_poster: combined.poster || null,
        media_sub: combined.sub || null,
        media_total: combined.total,
        media_unit: combined.unit,
        status: "pending",
      })
      .select()
      .single();

    setCreating(false);
    if (error || !data) {
      console.error("[BingeBattle] insert error:", JSON.stringify(error));
      toast({
        title: "Couldn't start battle",
        description: error?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
      return;
    }
    setCreatedBattleId(data.id);
    setCurrentBattle(data);
    setMyProgress(0);
    setView("sent");
  }

  // --- Load a specific battle ---
  async function loadBattle(id: string) {
    const { data } = await supabase
      .from("binge_battles")
      .select("*")
      .eq("id", id)
      .single();
    if (!data) return;
    setCurrentBattle(data);

    // Determine my progress
    const isChallenger = data.challenger_id === user?.id;
    setMyProgress(isChallenger ? data.challenger_progress : data.opponent_progress);

    // Load user info if needed
    const ids = [data.challenger_id, data.opponent_id].filter(Boolean) as string[];
    if (ids.some(id => !userMap[id])) {
      const { data: usersData } = await supabase
        .from("users")
        .select("id, user_name, display_name")
        .in("id", ids);
      const newMap = { ...userMap };
      (usersData || []).forEach((u: any) => {
        const name = u.display_name || u.user_name || "Friend";
        newMap[u.id] = { id: u.id, name, avatar: name[0].toUpperCase(), color: colorForId(u.id) };
      });
      setUserMap(newMap);
    }
  }

  // --- Update my progress ---
  async function handleUpdateProgress(newProgress: number) {
    if (!currentBattle || !user?.id || updating) return;
    const isChallenger = currentBattle.challenger_id === user.id;
    setMyProgress(newProgress);
    setUpdating(true);
    const field = isChallenger ? "challenger_progress" : "opponent_progress";
    const { error } = await supabase
      .from("binge_battles")
      .update({ [field]: newProgress, updated_at: new Date().toISOString() })
      .eq("id", currentBattle.id);
    setUpdating(false);
    if (error) {
      toast({
        title: "Couldn't save progress",
        description: "Your progress wasn't saved. Please try again.",
        variant: "destructive",
      });
      return;
    }
    // Refresh battle data to get opponent's latest progress
    const { data } = await supabase.from("binge_battles").select("*").eq("id", currentBattle.id).single();
    if (data) setCurrentBattle(data);
  }

  // --- Finish battle ---
  async function handleFinishBattle() {
    if (!currentBattle || !user?.id || finishing) return;
    setFinishing(true);
    const isChallenger = currentBattle.challenger_id === user.id;
    const field = isChallenger ? "challenger_progress" : "opponent_progress";
    const total = currentBattle.media_total;
    const { error } = await supabase
      .from("binge_battles")
      .update({
        [field]: total,
        status: "completed",
        winner_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentBattle.id);
    if (error) {
      setFinishing(false);
      toast({
        title: "Couldn't finish battle",
        description: "Something went wrong marking the winner. Please try again.",
        variant: "destructive",
      });
      return;
    }
    setMyProgress(total);
    const { data } = await supabase.from("binge_battles").select("*").eq("id", currentBattle.id).single();
    if (data) setCurrentBattle(data);

    // Insert social_posts entry so friends can see who won
    const opponentId = isChallenger ? currentBattle.opponent_id : currentBattle.challenger_id;
    const opponentInfo = opponentId ? userMap[opponentId] : null;
    const myInfo = userMap[user.id];
    const myName = myInfo?.name || user.user_metadata?.full_name || user.user_metadata?.display_name || user.email?.split("@")[0] || "Someone";
    const opponentName = opponentInfo?.name || "their opponent";

    const { error: postErr } = await supabase.from("social_posts").insert({
      user_id: user.id,
      post_type: "binge_battle",
      content: `${myName} just beat ${opponentName} in a Binge Battle on ${currentBattle.media_title}!`,
      media_title: currentBattle.media_title,
      media_type: currentBattle.media_type || null,
      image_url: currentBattle.media_poster || null,
      media_external_id: currentBattle.id,
      media_external_source: "binge_battle",
    });
    if (postErr) console.error("[BingeBattle] failed to post feed card on finish:", postErr.message);

    setFinishing(false);
    setView("finished");
  }

  // --- Cancel / delete battle ---
  async function handleDeleteBattle(battleId: string) {
    const { error } = await supabase.from("binge_battles").delete().eq("id", battleId);
    if (error) {
      toast({ title: "Couldn't remove battle", description: error.message, variant: "destructive" });
      return;
    }
    setBattles(prev => prev.filter(b => b.id !== battleId));
    if (currentBattle?.id === battleId) {
      setCurrentBattle(null);
      setView("hub");
    }
  }

  // --- View: Hub ---
  if (view === "hub") {
    const activeBattles = battles.filter(b => b.status === "active");
    const pendingBattles = battles.filter(b => b.status === "pending");
    const completedBattles = battles.filter(b => b.status === "completed");

    function BattleCard({ battle }: { battle: BattleRow }) {
      const isChallenger = battle.challenger_id === user?.id;
      const myProg = isChallenger ? battle.challenger_progress : battle.opponent_progress;
      const oppProg = isChallenger ? battle.opponent_progress : battle.challenger_progress;
      const opponentId = isChallenger ? battle.opponent_id : battle.challenger_id;
      const opponent = opponentId ? userMap[opponentId] : null;

      return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div
            className="flex gap-3 p-3 cursor-pointer active:opacity-80"
            onClick={async () => {
              await loadBattle(battle.id);
              if (battle.status === "completed") {
                setView("finished");
              } else {
                setView("active");
              }
            }}
          >
            {/* Poster thumbnail */}
            <div className="w-12 h-[72px] rounded-lg overflow-hidden bg-gray-100 shrink-0 relative">
              {battle.media_poster ? (
                <img
                  src={battle.media_poster}
                  alt={battle.media_title}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-[11px] font-black text-gray-300">{battle.media_type?.[0]}</span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[13px] font-bold text-gray-900 leading-snug truncate">{battle.media_title}</p>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full border shrink-0" style={{
                  background: battle.status === "active" ? "rgba(34,197,94,0.12)" : battle.status === "pending" ? "rgba(251,191,36,0.12)" : "rgba(0,0,0,0.06)",
                  borderColor: battle.status === "active" ? "rgba(34,197,94,0.35)" : battle.status === "pending" ? "rgba(251,191,36,0.35)" : "rgba(0,0,0,0.15)",
                }}>
                  {battle.status === "active" && <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                  {battle.status === "pending" && <Clock size={8} className="text-amber-400" />}
                  {battle.status === "completed" && <Trophy size={8} className="text-gray-400" />}
                  <span className="text-[9px] font-bold" style={{
                    color: battle.status === "active" ? "#16a34a" : battle.status === "pending" ? "#d97706" : "#9ca3af"
                  }}>
                    {battle.status === "active" ? "LIVE" : battle.status === "pending" ? "PENDING" : "DONE"}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 mb-2">
                {battle.status === "pending"
                  ? "Waiting for opponent to accept your link"
                  : `vs ${opponent?.name || "Opponent"} · First to finish`}
              </p>

            {battle.status !== "pending" && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-purple-600 font-bold w-4">Me</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-purple-500"
                      style={{ width: `${Math.min((myProg / battle.media_total) * 100, 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-purple-600 font-bold w-8 text-right">{myProg}/{battle.media_total}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 font-bold w-4">{opponent?.avatar || "?"}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gray-300"
                      style={{ width: `${Math.min((oppProg / battle.media_total) * 100, 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-400 font-bold w-8 text-right">{oppProg}/{battle.media_total}</span>
                </div>
              </div>
            )}
            </div>{/* end flex-1 content */}
          </div>{/* end flex gap-3 p-3 */}
          {/* Cancel / remove button */}
          {battle.status !== "completed" && (
            <div className="border-t border-gray-100 px-3 py-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteBattle(battle.id);
                }}
                className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={12} />
                {battle.status === "pending" ? "Cancel battle" : "Remove battle"}
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#f8f8fb]">
        <Navigation />
        <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] px-4 pt-14 pb-6">
          <button onClick={() => setLocation("/play")} className="flex items-center gap-1.5 text-white/60 text-sm mb-4">
            <ChevronLeft size={16} /> Play
          </button>
          <h1 className="text-2xl font-bold text-white text-center mb-1">Binge Battle</h1>
          <p className="text-sm text-white/50 text-center">
            Compete against friends for who finished the book, movie, podcast, album or game first.
          </p>
        </div>

        <div className="px-4 pt-5 pb-28 space-y-5">
          <button
            onClick={() => { setSelectedItems([]); setSearch(""); setView("new"); }}
            className="w-full py-4 rounded-2xl bg-purple-600 text-white font-bold text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-purple-200"
          >
            <Zap size={16} />
            Start a New Battle
          </button>

          {battlesLoading && (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-[13px]">Loading battles...</span>
            </div>
          )}

          {!battlesLoading && battles.length === 0 && (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-3">
                <Zap size={22} className="text-purple-300" />
              </div>
              <p className="text-[14px] font-semibold text-gray-600 mb-1">No battles yet</p>
              <p className="text-[12px] text-gray-400">Start a battle and send the challenge via text</p>
            </div>
          )}

          {!battlesLoading && activeBattles.length > 0 && (
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-3">Active Battles</p>
              <div className="space-y-3">
                {activeBattles.map(b => <BattleCard key={b.id} battle={b} />)}
              </div>
            </div>
          )}

          {!battlesLoading && pendingBattles.length > 0 && (
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-3">Pending</p>
              <div className="space-y-3">
                {pendingBattles.map(b => <BattleCard key={b.id} battle={b} />)}
              </div>
            </div>
          )}

          {!battlesLoading && completedBattles.length > 0 && (
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-3">Completed</p>
              <div className="space-y-3">
                {completedBattles.map(b => <BattleCard key={b.id} battle={b} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- View: New ---
  if (view === "new") {
    return (
      <div className="min-h-screen bg-[#f8f8fb] flex flex-col">
        <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] px-4 pt-14 pb-5">
          <button onClick={() => setView("hub")} className="flex items-center gap-1.5 text-white/60 text-sm mb-4">
            <ChevronLeft size={16} /> Binge Battle
          </button>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Zap size={16} className="text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">New Battle</h1>
          </div>
          <p className="text-sm text-white/50 ml-10.5">
            Pick the media below, then share the challenge via text.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-5 pb-10 space-y-5">
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-2 font-semibold">Pick the media</p>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 mb-2 shadow-sm">
              <Search size={14} className="text-gray-400 shrink-0" />
              <input
                className="flex-1 text-[13px] text-gray-700 bg-transparent outline-none placeholder:text-gray-400"
                placeholder="Search movies, TV, books, podcasts..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {mediaLoading && <Loader2 size={13} className="animate-spin text-gray-400 shrink-0" />}
            </div>

            {!search.trim() && (
              <p className="text-[11px] text-gray-400 mb-2">Examples</p>
            )}
            {search.trim() && !mediaLoading && mediaResults.length === 0 && (
              <p className="text-center text-[12px] text-gray-400 py-4">No results found</p>
            )}

            <div className="space-y-2">
              {displayMedia.map(item => {
                const isSelected = selectedItems.some(s => s.id === item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItems(prev =>
                      isSelected ? prev.filter(s => s.id !== item.id) : [...prev, item]
                    )}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      isSelected ? "bg-purple-50 border-purple-200" : "bg-white"
                    }`}
                    style={{ borderColor: isSelected ? undefined : "#ececf0" }}
                  >
                    <div className="w-9 h-12 rounded-lg overflow-hidden bg-purple-100 flex items-center justify-center relative shrink-0">
                      <span className="text-[10px] font-black text-purple-300">{item.type[0]}</span>
                      {item.poster && (
                        <img src={item.poster} alt={item.title} className="absolute inset-0 w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-gray-900 truncate">{item.title}</p>
                      <p className="text-[11px] text-gray-400 truncate">{item.sub}</p>
                      <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                        item.type === "Book Series"
                          ? "bg-amber-100 text-amber-700"
                          : isSelected
                            ? "bg-purple-100 text-purple-600"
                            : "bg-gray-100 text-gray-500"
                      }`}>
                        {item.type === "Book Series" ? "📚 Series" : item.type}
                      </span>
                    </div>
                    <div className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center ${
                      isSelected ? "bg-purple-600 border-purple-600" : "border-gray-300"
                    }`}>
                      {isSelected && <CheckCircle2 size={12} className="text-white fill-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-4 pb-10 pt-3 bg-[#f8f8fb] border-t border-gray-100 space-y-2.5">
          {selectedItems.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedItems.map(item => (
                <div key={item.id} className="flex items-center gap-1 bg-purple-100 rounded-full px-2 py-1">
                  <span className="text-[11px] font-semibold text-purple-700 max-w-[140px] truncate">{item.title}</span>
                  <button
                    onClick={() => setSelectedItems(prev => prev.filter(s => s.id !== item.id))}
                    className="text-purple-400 hover:text-purple-700 ml-0.5"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            disabled={selectedItems.length === 0 || creating}
            onClick={handleStartBattle}
            className={`w-full py-4 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 transition-all ${
              selectedItems.length > 0 && !creating
                ? "bg-purple-600 text-white shadow-lg shadow-purple-200"
                : "bg-gray-200 text-gray-400"
            }`}
          >
            {creating ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
            {creating
              ? "Creating..."
              : selectedItems.length > 1
                ? `Start Battle (${selectedItems.length} items)`
                : selectedItems.length === 1
                  ? "Start Battle"
                  : "Pick media first"}
          </button>
        </div>
      </div>
    );
  }

  // --- View: Sent (share) ---
  if (view === "sent") {
    const media = buildCombinedMedia(selectedItems.length > 0 ? selectedItems : EXAMPLE_MEDIA.slice(0, 1));
    const battleUrl = `${APP_BASE}/play/binge-battle/accept/${createdBattleId}`;
    const shareText = `Can you beat me? I'm challenging you to a Binge Battle on ${media.title} — first to finish wins. Join me on Consumed`;

    function sendChallenge() {
      if (navigator.share) {
        navigator.share({ title: "Binge Battle Challenge", text: shareText, url: battleUrl }).catch(() => {
          navigator.clipboard.writeText(`${shareText} ${battleUrl}`);
          toast({ title: "Link copied!", description: "Paste it in a text or DM to challenge your friend." });
        });
      } else {
        navigator.clipboard.writeText(`${shareText} ${battleUrl}`);
        toast({ title: "Link copied!", description: "Paste it in a text or DM to challenge your friend." });
      }
    }

    return (
      <div className="min-h-screen bg-[#f8f8fb] flex flex-col">
        <div className="flex items-center gap-3 px-4 pt-14 pb-3 bg-white border-b border-gray-100">
          <button onClick={() => setView("new")} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
            <ChevronLeft size={16} className="text-gray-600" />
          </button>
          <h1 className="text-[16px] font-bold text-gray-900">Send Challenge</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5 pb-16">
          <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200 px-4 py-3.5 shadow-sm w-full">
            <div className="w-10 h-14 rounded-lg overflow-hidden bg-purple-100 flex items-center justify-center relative shrink-0">
              <span className="text-[11px] font-black text-purple-300">{media.type[0]}</span>
              {media.poster && (
                <img src={media.poster} alt={media.title} className="absolute inset-0 w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-900 truncate">{media.title}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{media.sub}</p>
              <p className="text-[11px] text-purple-600 font-semibold mt-0.5">First to finish wins</p>
            </div>
          </div>

          <div className="w-full space-y-3">
            <button
              onClick={sendChallenge}
              className="w-full py-4 rounded-2xl font-bold text-[15px] bg-purple-600 text-white flex items-center justify-center gap-2.5 shadow-lg shadow-purple-200"
            >
              <MessageCircle size={17} />
              Send Challenge via Text
            </button>
            <p className="text-center text-[11px] text-gray-400">
              Your friend gets a link to join and start competing
            </p>
          </div>

          <div className="w-full flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[11px] text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <button
            onClick={() => {
              if (currentBattle) loadBattle(currentBattle.id);
              setView("active");
            }}
            className="w-full py-3.5 rounded-2xl font-bold text-[14px] border border-gray-200 text-gray-600 bg-white flex items-center justify-center gap-2"
          >
            <Zap size={14} className="text-purple-500" /> Go to My Battle
          </button>
        </div>
      </div>
    );
  }

  // --- View: Active ---
  if (view === "active") {
    const battle = currentBattle;
    if (!battle) {
      return (
        <div className="min-h-screen bg-[#f8f8fb] flex items-center justify-center">
          <Loader2 size={28} className="animate-spin text-purple-400" />
        </div>
      );
    }

    const isChallenger = battle.challenger_id === user?.id;
    const opponentId = isChallenger ? battle.opponent_id : battle.challenger_id;
    const opponent = opponentId ? userMap[opponentId] : null;
    const opponentProgress = isChallenger ? battle.opponent_progress : battle.challenger_progress;
    const lead = myProgress - opponentProgress;
    const isPending = battle.status === "pending";

    return (
      <div className="min-h-screen bg-[#f8f8fb] flex flex-col">
        <div className="flex items-center gap-3 px-4 pt-14 pb-3 bg-white border-b border-gray-100">
          <button onClick={() => setView("hub")} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
            <ChevronLeft size={16} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-[16px] font-bold text-gray-900">Binge Battle</h1>
            <p className="text-[11px] text-gray-400">{battle.media_title} · First to finish</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4 space-y-4">
          {isPending && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-[12px] text-amber-700 text-center font-medium">
                Waiting for your opponent to accept the challenge link
              </p>
            </div>
          )}

          <div className="rounded-2xl overflow-hidden relative h-[90px] bg-gray-800">
            {battle.media_poster && (
              <img src={battle.media_poster} alt={battle.media_title}
                className="absolute inset-0 w-full h-full object-cover opacity-50"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent p-4 flex items-end">
              <div>
                <p className="text-white font-bold text-[15px]">{battle.media_title}</p>
                {battle.media_sub && <p className="text-white/70 text-[11px]">{battle.media_sub}</p>}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Who's ahead</p>

          {/* You */}
          <div className="bg-white rounded-2xl p-4 border-2 border-purple-200 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-[14px] font-bold text-white">
                  {user?.user_metadata?.display_name?.[0] || "Y"}
                </div>
                {lead > 0 && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center">
                    <Zap size={8} className="text-white fill-white" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-bold text-gray-900">You</p>
                  {lead > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 font-bold uppercase tracking-wide">Leading</span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400">
                  {battle.media_unit === "episodes" ? `Ep ${myProgress} of ${battle.media_total}` : `${myProgress} of ${battle.media_total}`}
                  {" · "}{Math.round((myProgress / battle.media_total) * 100)}% done
                </p>
              </div>
              <p className="text-[22px] font-black text-purple-600">{myProgress}/{battle.media_total}</p>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all"
                style={{ width: `${Math.min((myProgress / battle.media_total) * 100, 100)}%` }} />
            </div>
          </div>

          <div className="flex items-center gap-3 px-2">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[11px] text-gray-400 font-bold">VS</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Opponent */}
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
            {isPending || !opponent ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <span className="text-[12px] text-gray-400 font-bold">?</span>
                </div>
                <div>
                  <p className="text-[13px] font-bold text-gray-400">Awaiting opponent</p>
                  <p className="text-[11px] text-gray-300">They need to accept your challenge link</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold text-white" style={{ background: opponent.color }}>
                    {opponent.avatar}
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold text-gray-900">{opponent.name}</p>
                    <p className="text-[11px] text-gray-400">
                      {battle.media_unit === "episodes" ? `Ep ${opponentProgress} of ${battle.media_total}` : `${opponentProgress} of ${battle.media_total}`}
                      {" · "}{Math.round((opponentProgress / battle.media_total) * 100)}% done
                    </p>
                  </div>
                  <p className="text-[22px] font-black text-gray-300">{opponentProgress}/{battle.media_total}</p>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gray-300" style={{ width: `${Math.min((opponentProgress / battle.media_total) * 100, 100)}%` }} />
                </div>
              </>
            )}
          </div>

          {/* Taunt */}
          {!isPending && opponent && lead > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-[12px] text-amber-700 text-center">
                You're <span className="font-bold">{lead} {battle.media_unit} ahead</span> of {opponent.name} — keep going!
              </p>
            </div>
          )}
          {!isPending && opponent && lead < 0 && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200">
              <p className="text-[12px] text-red-600 text-center">
                {opponent.name} is <span className="font-bold">{Math.abs(lead)} {battle.media_unit} ahead</span> — pick it up!
              </p>
            </div>
          )}
          {!isPending && opponent && lead === 0 && opponentProgress > 0 && (
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
              <p className="text-[12px] text-gray-600 text-center font-medium">You're neck and neck — anyone's game!</p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2.5 pt-1">
            {/* Progress stepper */}
            <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3 flex items-center gap-3">
              <button
                onClick={() => handleUpdateProgress(Math.max(0, myProgress - 1))}
                disabled={myProgress === 0 || updating}
                className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 disabled:opacity-30 shrink-0"
              >
                <Minus size={16} />
              </button>
              <div className="flex-1 text-center">
                <p className="text-[20px] font-black text-gray-900 leading-none">{myProgress}<span className="text-[13px] font-medium text-gray-400">/{battle.media_total}</span></p>
                <p className="text-[11px] text-gray-400 mt-0.5">{battle.media_unit} completed</p>
              </div>
              <button
                onClick={() => handleUpdateProgress(Math.min(myProgress + 1, battle.media_total))}
                disabled={myProgress >= battle.media_total || updating}
                className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white disabled:opacity-40 shrink-0"
              >
                {updating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={16} />}
              </button>
            </div>

            {/* Resend challenge link — only shown while waiting for opponent */}
            {isPending && isChallenger && (
              <button
                onClick={() => {
                  const battleUrl = `${APP_BASE}/play/binge-battle/accept/${battle.id}`;
                  const shareText = `Can you beat me? I'm challenging you to a Binge Battle on ${battle.media_title} — first to finish wins. Join me on Consumed`;
                  if (navigator.share) {
                    navigator.share({ title: "Binge Battle Challenge", text: shareText, url: battleUrl }).catch(() => {
                      navigator.clipboard.writeText(`${shareText} ${battleUrl}`);
                      toast({ title: "Link copied!", description: "Paste it in a text or DM." });
                    });
                  } else {
                    navigator.clipboard.writeText(`${shareText} ${battleUrl}`);
                    toast({ title: "Link copied!", description: "Paste it in a text or DM." });
                  }
                }}
                className="w-full py-3.5 rounded-2xl font-bold text-[14px] bg-purple-600 text-white flex items-center justify-center gap-2 shadow-lg shadow-purple-200"
              >
                <Share2 size={14} /> Resend Challenge Link
              </button>
            )}

            <button
              disabled={finishing}
              onClick={handleFinishBattle}
              className="w-full py-3.5 rounded-2xl font-bold text-[14px] border border-gray-200 text-gray-600 bg-white flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {finishing ? <Loader2 size={14} className="animate-spin" /> : <Trophy size={14} className="text-amber-500" />}
              {finishing ? "Saving..." : "I Finished First!"}
            </button>

            <button
              onClick={() => handleDeleteBattle(battle.id)}
              className="w-full py-2.5 text-[13px] text-gray-400 flex items-center justify-center gap-1.5"
            >
              <X size={13} /> Give up &amp; remove battle
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- View: Finished ---
  if (view === "finished") {
    const battle = currentBattle;
    if (!battle) return null;

    const isChallenger = battle.challenger_id === user?.id;
    const opponentId = isChallenger ? battle.opponent_id : battle.challenger_id;
    const opponent = opponentId ? userMap[opponentId] : null;
    const opponentProgress = isChallenger ? battle.opponent_progress : battle.challenger_progress;
    const iWon = battle.winner_id === user?.id;

    function shareResult() {
      const text = iWon
        ? `I just beat ${opponent?.name || "my opponent"} in a Binge Battle on ${battle!.media_title} on Consumed!`
        : `${opponent?.name || "My opponent"} beat me in a Binge Battle on ${battle!.media_title} on Consumed — rematch time!`;
      if (navigator.share) {
        navigator.share({ title: "Binge Battle Result", text }).catch(() => {
          navigator.clipboard.writeText(text);
          toast({ title: "Result copied!", description: "Share it with your friends." });
        });
      } else {
        navigator.clipboard.writeText(text);
        toast({ title: "Result copied!", description: "Share it with your friends." });
      }
    }

    return (
      <div className="min-h-screen bg-[#f8f8fb] flex flex-col">
        <div className="flex items-center gap-3 px-4 pt-14 pb-3 bg-white border-b border-gray-100">
          <button onClick={() => setView("hub")} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100">
            <ChevronLeft size={16} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-[16px] font-bold text-gray-900">Binge Battle</h1>
            <p className="text-[11px] text-gray-400">{battle.media_title} · Complete</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4 space-y-4">
          <div
            className="rounded-3xl p-6 text-center relative overflow-hidden"
            style={{ background: iWon ? "linear-gradient(135deg, #6d28d9, #7c3aed, #8b5cf6)" : "linear-gradient(135deg, #374151, #4b5563, #6b7280)" }}
          >
            <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.5), transparent 70%)" }} />
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2">
                <Trophy size={30} className={iWon ? "text-amber-300" : "text-gray-300"} />
              </div>
              <p className="text-[11px] text-white/70 uppercase tracking-widest font-bold mb-1">{iWon ? "Battle won" : "Battle over"}</p>
              <h2 className="text-[26px] font-black text-white mb-1">{iWon ? "First to Finish!" : "Better luck next time"}</h2>
              <p className="text-[13px] text-white/70">
                {iWon ? `You beat ${opponent?.name || "your opponent"}` : `${opponent?.name || "Your opponent"} finished first`}
              </p>
            </div>
          </div>

          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-3">Final standings</p>
            <div className="space-y-2">
              {/* Winner row */}
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border-2 border-purple-200 shadow-sm">
                <div className="w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center text-[12px] font-black text-amber-900">1</div>
                {iWon ? (
                  <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-[13px] font-bold text-white">
                    {user?.user_metadata?.display_name?.[0] || "Y"}
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white" style={{ background: opponent?.color || "#6b7280" }}>
                    {opponent?.avatar || "?"}
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-gray-900">{iWon ? "You" : opponent?.name || "Opponent"}</p>
                  <p className="text-[11px] text-gray-400">Finished first</p>
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-black text-purple-600">{battle.media_total}/{battle.media_total}</p>
                  <p className="text-[10px] text-gray-400">{battle.media_unit}</p>
                </div>
              </div>

              {/* Loser row */}
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-gray-200 shadow-sm">
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[12px] font-bold text-gray-400">2</div>
                {iWon ? (
                  opponent ? (
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white" style={{ background: opponent.color }}>
                      {opponent.avatar}
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-[13px] font-bold text-gray-400">?</div>
                  )
                ) : (
                  <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-[13px] font-bold text-white">
                    {user?.user_metadata?.display_name?.[0] || "Y"}
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-gray-500">{iWon ? opponent?.name || "Opponent" : "You"}</p>
                  <p className="text-[11px] text-gray-400">
                    {battle.media_unit === "episodes" ? `Ep ${opponentProgress}` : `${opponentProgress}%`} when finished
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-black text-gray-300">{opponentProgress}/{battle.media_total}</p>
                  <p className="text-[10px] text-gray-300">{battle.media_unit}</p>
                </div>
              </div>
            </div>
          </div>

          {iWon && (
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white border border-gray-200 shadow-sm">
              <Trophy size={15} className="text-purple-600" />
              <p className="text-[13px] text-gray-600">You earned <span className="font-black text-purple-600">+50 pts</span> for winning</p>
            </div>
          )}
        </div>

        <div className="px-4 pb-10 pt-3 bg-[#f8f8fb] border-t border-gray-100 space-y-2.5">
          <button
            onClick={() => { setSelectedItems([]); setCurrentBattle(null); setMyProgress(0); setCreatedBattleId(null); setView("new"); }}
            className="w-full py-3.5 rounded-2xl font-bold text-[14px] bg-purple-600 text-white flex items-center justify-center gap-2 shadow-md shadow-purple-100"
          >
            <RotateCcw size={14} />
            {opponent ? `Rematch ${opponent.name}` : "Start New Battle"}
          </button>
          <button
            onClick={shareResult}
            className="w-full py-3.5 rounded-2xl font-bold text-[14px] border border-gray-200 text-gray-600 bg-white flex items-center justify-center gap-2"
          >
            <Share2 size={14} />
            Share Result
          </button>
        </div>
      </div>
    );
  }

  return null;
}
