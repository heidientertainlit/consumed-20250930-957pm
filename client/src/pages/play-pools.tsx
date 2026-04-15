import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Flame, Users, Zap, Share2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import Navigation from "@/components/navigation";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";

const POOL_EMOJIS: Record<string, string> = {
  "Binge Watch Battle": "🎬",
  "Harry Potter": "⚡",
  "Reelz True Crime": "🔍",
  "Reelz Official Room": "📺",
  "The Traitors S3": "🗡️",
  "Stranger Things": "🔦",
};

function poolEmoji(name: string) {
  return POOL_EMOJIS[name] || "🎮";
}

function avatarColor(name: string) {
  const palette = ["bg-violet-500", "bg-fuchsia-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];
  return palette[(name || "?").charCodeAt(0) % palette.length];
}

function AvatarCluster({ names }: { names: string[] }) {
  const colors = ["bg-violet-500", "bg-fuchsia-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500"];
  return (
    <div className="flex -space-x-1.5">
      {names.slice(0, 3).map((n, i) => (
        <div key={n} className={`w-5 h-5 ${colors[i % colors.length]} rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2 border-white shrink-0`}>
          {n[0]}
        </div>
      ))}
    </div>
  );
}

function formatDeadline(isoDate: string) {
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff < 0) return { label: "Closed", urgent: false };
  const h = Math.floor(diff / 3600000);
  if (h < 24) return { label: `${h}h`, urgent: h < 12 };
  return { label: `${Math.floor(h / 24)}d`, urgent: false };
}

interface PoolRow {
  id: string;
  name: string;
  description: string | null;
  accent_color: string | null;
  partner_name: string | null;
  partner_logo_url: string | null;
  is_official: boolean;
  rounds: { id: string; title: string; status: string; lock_time: string | null }[];
  memberCount: number;
  friendNames: string[];
}

interface FriendActivity {
  user_id: string;
  name: string;
  poolId: string;
  poolName: string;
}

export default function PlayPoolsPage() {
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const [pools, setPools] = useState<PoolRow[]>([]);
  const [friends, setFriends] = useState<FriendActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id || !session?.access_token) return;
    const userId = session.user.id;
    const token = session.access_token;

    async function load() {
      try {
        // 1. Get pools from edge function (bypasses RLS, uses service role)
        const res = await fetch(`${SUPABASE_URL}/functions/v1/get-user-pools`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const myPools: any[] = data?.myRooms || data?.pools || [];
        const publicPools: any[] = data?.publicRooms || [];
        const allRaw = [...myPools, ...publicPools.filter((p: any) => !myPools.find((m: any) => m.id === p.id))];

        if (!allRaw.length) { setLoading(false); return; }

        const poolIds = allRaw.map((p) => p.id);

        // 2. Fetch rounds (service role via edge fn would be ideal; try direct query since we're members)
        const { data: rounds } = await supabase
          .from("pool_rounds")
          .select("id, pool_id, title, status, lock_time")
          .in("pool_id", poolIds);

        // 3. Fetch member counts
        const { data: members } = await supabase
          .from("pool_members")
          .select("pool_id, user_id")
          .in("pool_id", poolIds);

        // 4. Friends
        const { data: friendships } = await supabase
          .from("friendships")
          .select("user_id, friend_id")
          .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
          .eq("status", "accepted");

        const friendIds = new Set(
          (friendships || []).map((f: any) => f.user_id === userId ? f.friend_id : f.user_id)
        );

        let friendUsers: Record<string, string> = {};
        if (friendIds.size > 0) {
          const { data: uf } = await supabase
            .from("users")
            .select("id, display_name, user_name")
            .in("id", [...friendIds]);
          (uf || []).forEach((u: any) => { friendUsers[u.id] = u.display_name || u.user_name || "Friend"; });
        }

        // 5. Build pool rows
        const enriched: PoolRow[] = allRaw.map((p) => {
          const poolRounds = (rounds || []).filter((r: any) => r.pool_id === p.id);
          const poolMembers = (members || []).filter((m: any) => m.pool_id === p.id);
          const friendMemberNames = poolMembers
            .filter((m: any) => friendIds.has(m.user_id))
            .map((m: any) => friendUsers[m.user_id])
            .filter(Boolean);
          return {
            id: p.id,
            name: p.name,
            description: p.description,
            accent_color: p.accent_color,
            partner_name: p.partner_name,
            partner_logo_url: p.partner_logo_url,
            is_official: p.is_official || false,
            rounds: poolRounds,
            memberCount: poolMembers.length || p.member_count || 0,
            friendNames: friendMemberNames,
          };
        });

        // 6. Friend activity strip (friends in pools)
        const fa: FriendActivity[] = [];
        (members || []).forEach((m: any) => {
          if (friendIds.has(m.user_id) && friendUsers[m.user_id]) {
            const pool = allRaw.find((p) => p.id === m.pool_id);
            if (pool && !fa.find((f) => f.user_id === m.user_id && f.poolId === pool.id)) {
              fa.push({ user_id: m.user_id, name: friendUsers[m.user_id], poolId: pool.id, poolName: pool.name });
            }
          }
        });

        setPools(enriched);
        setFriends(fa.slice(0, 6));
      } catch (err) {
        console.error("[PlayPools] error:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [session]);

  const handleShare = async (pool: PoolRow, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/play/pools/${pool.id}`;
    try {
      if (navigator.share) await navigator.share({ title: pool.name, url });
      else await navigator.clipboard.writeText(url);
    } catch { /* dismissed */ }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      {/* Header — no tabs */}
      <div className="bg-white px-4 pt-5 pb-4" style={{ borderBottom: "0.5px solid #f3f4f6" }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/play")}
            className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0"
          >
            <ChevronLeft size={14} className="text-gray-500" />
          </button>
          <div>
            <h1 className="text-gray-900 text-xl font-bold leading-tight">Pools</h1>
            <p className="text-gray-400 text-xs mt-0.5">Compete with friends, round by round</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4 pb-28">

        {/* Friends Playing Now */}
        {friends.length > 0 && (
          <div className="mb-5">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2.5">Friends Playing Now</p>
            <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {friends.map((f, i) => (
                <button
                  key={`${f.user_id}-${i}`}
                  onClick={() => setLocation(`/play/pools/${f.poolId}`)}
                  className="shrink-0 bg-white rounded-2xl px-3 py-2.5 flex items-center gap-2.5 active:scale-95 transition-transform"
                  style={{ border: "0.5px solid #e5e7eb", minWidth: 160 }}
                >
                  <div className={`w-8 h-8 ${avatarColor(f.name)} rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                    {f.name[0]}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-gray-900 text-xs font-semibold leading-tight truncate">{f.name}</p>
                    <p className="text-gray-400 text-[10px] leading-tight truncate">{f.poolName}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active Rounds */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest">Active Rounds</p>
          </div>

          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-gray-200 animate-pulse" />)}
            </div>
          )}

          {!loading && pools.length === 0 && (
            <div className="bg-white rounded-2xl py-12 text-center" style={{ border: "0.5px solid #e5e7eb" }}>
              <p className="text-3xl mb-2">🎮</p>
              <p className="text-gray-400 text-sm font-medium">No active pools yet</p>
              <p className="text-gray-300 text-xs mt-1">Check back soon for new rounds</p>
            </div>
          )}

          <div className="space-y-3">
            {pools.map((pool) => {
              const accent = pool.accent_color || "#7c3aed";
              const openRound = pool.rounds.find((r) => r.status === "open") || pool.rounds[0];
              const roundCount = pool.rounds.length;
              const roundIndex = openRound ? pool.rounds.indexOf(openRound) + 1 : 1;
              const roundLabel = roundCount > 0
                ? `Round ${roundIndex} of ${roundCount}`
                : null;
              const deadline = openRound?.lock_time ? formatDeadline(openRound.lock_time) : null;
              const emoji = poolEmoji(pool.name);

              return (
                <button
                  key={pool.id}
                  onClick={() => setLocation(`/play/pools/${pool.id}`)}
                  className="w-full text-left rounded-2xl overflow-hidden relative active:scale-[0.98] transition-transform"
                  style={{
                    background: `linear-gradient(135deg, ${accent}0e 0%, ${accent}1a 100%)`,
                    border: `1px solid ${accent}28`,
                  }}
                >
                  {/* Official badge */}
                  {pool.is_official && (
                    <div
                      className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(251,191,36,0.15)", border: "0.5px solid rgba(251,191,36,0.4)" }}
                    >
                      <Zap size={9} className="text-amber-500" />
                      <span className="text-amber-600 text-[9px] font-bold uppercase tracking-wide">Official</span>
                    </div>
                  )}

                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl leading-none mt-0.5">{emoji}</span>
                      <div className="flex-1 min-w-0 pr-16">
                        <p className="text-gray-900 text-[15px] font-bold leading-tight">{pool.name}</p>
                        {pool.description && (
                          <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">{pool.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          {roundLabel && (
                            <span className="text-gray-400 text-[10px] font-medium">{roundLabel}</span>
                          )}
                          {deadline && (
                            <div className="flex items-center gap-1">
                              {deadline.urgent ? (
                                <Flame size={9} className="text-orange-400" />
                              ) : (
                                <div className="w-1 h-1 rounded-full bg-gray-300" />
                              )}
                              <span className={`text-[10px] font-semibold ${deadline.urgent ? "text-orange-500" : "text-gray-400"}`}>
                                Closes in {deadline.label}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer row */}
                    <div
                      className="flex items-center justify-between mt-3 pt-2.5"
                      style={{ borderTop: `0.5px solid ${accent}20` }}
                    >
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="flex items-center gap-1">
                          <Users size={10} className="text-gray-400" />
                          <span className="text-gray-400 text-[10px] font-medium">
                            {pool.memberCount > 0 ? `${pool.memberCount.toLocaleString()} playing` : "Be first to play"}
                          </span>
                        </div>
                        {pool.friendNames.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <AvatarCluster names={pool.friendNames} />
                            <span className="text-[10px] font-semibold" style={{ color: accent }}>
                              {pool.friendNames.length} friend{pool.friendNames.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => handleShare(pool, e)}
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: `${accent}18` }}
                        >
                          <Share2 size={12} style={{ color: accent }} />
                        </button>
                        <div
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                          style={{ background: accent }}
                        >
                          Play Now
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Challenge CTA */}
        {!loading && (
          <div className="mt-4">
            <button
              className="w-full rounded-2xl px-4 py-3.5 flex items-center gap-3"
              style={{ background: "rgba(124,58,237,0.05)", border: "0.5px dashed rgba(124,58,237,0.3)" }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(124,58,237,0.1)" }}>
                <Share2 size={16} className="text-purple-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-purple-700 text-sm font-semibold">Challenge your friends</p>
                <p className="text-purple-400 text-xs mt-0.5">Share a pool link and compete head-to-head</p>
              </div>
              <ChevronRight size={14} className="text-purple-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
