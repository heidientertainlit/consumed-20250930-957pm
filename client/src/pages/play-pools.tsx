import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Flame, Users, Share2, ChevronRight, Star, Zap, Globe } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";

function avatarColor(name: string) {
  const palette = ["bg-violet-500", "bg-fuchsia-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];
  return palette[(name || "?").charCodeAt(0) % palette.length];
}

function AvatarCluster({ members, max = 3 }: { members: { display_name?: string; username?: string }[]; max?: number }) {
  return (
    <div className="flex -space-x-1.5">
      {members.slice(0, max).map((m, i) => {
        const name = m.display_name || m.username || "?";
        return (
          <div
            key={i}
            className={`w-5 h-5 ${avatarColor(name)} rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2 shrink-0`}
            style={{ borderColor: "#09091a" }}
          >
            {name[0].toUpperCase()}
          </div>
        );
      })}
    </div>
  );
}

function poolGradient(accentColor?: string, index?: number): string {
  const gradients = [
    "linear-gradient(135deg, #1a0533 0%, #4a1272 50%, #7c3aed 100%)",
    "linear-gradient(135deg, #1a0a0a 0%, #7f1d1d 50%, #dc2626 100%)",
    "linear-gradient(135deg, #0a1628 0%, #1e3a5f 50%, #2563eb 100%)",
    "linear-gradient(135deg, #0a1a0a 0%, #14532d 50%, #16a34a 100%)",
    "linear-gradient(135deg, #1a1a0a 0%, #713f12 50%, #d97706 100%)",
    "linear-gradient(135deg, #1a0a1a 0%, #6b21a8 50%, #c026d3 100%)",
  ];
  if (accentColor) {
    const hex = accentColor.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `linear-gradient(135deg, rgba(${r},${g},${b},0.15) 0%, rgba(${r},${g},${b},0.4) 50%, rgba(${r},${g},${b},0.8) 100%)`;
  }
  return gradients[(index || 0) % gradients.length];
}

interface Pool {
  id: string;
  name: string;
  description?: string;
  accent_color?: string;
  partner_logo_url?: string;
  partner_name?: string;
  member_count: number;
  is_public: boolean;
  is_official?: boolean;
  friendMembers?: { display_name?: string; username?: string; user_id: string }[];
}

interface FriendActivity {
  user_id: string;
  display_name: string;
  username: string;
  poolName: string;
  poolId: string;
}

export default function PlayPoolsPage() {
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const [pools, setPools] = useState<Pool[]>([]);
  const [friendActivity, setFriendActivity] = useState<FriendActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token) return;

    async function load() {
      try {
        // 1. Fetch pools
        const poolsRes = await fetch(`${SUPABASE_URL}/functions/v1/get-user-pools`, {
          headers: { Authorization: `Bearer ${session!.access_token}` },
        });
        const poolsData = await poolsRes.json();
        const myRooms: any[] = poolsData?.myRooms || poolsData?.pools || [];
        const publicRooms: any[] = poolsData?.publicRooms || [];
        const allPools: Pool[] = [
          ...myRooms.filter((r) => r.is_public),
          ...publicRooms.filter((r) => !myRooms.some((m) => m.id === r.id)),
        ].map((p) => ({ ...p, friendMembers: [] }));

        // 2. Get friend IDs
        const userId = session!.user.id;
        const { data: friendships } = await supabase
          .from("friendships")
          .select("user_id, friend_id")
          .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
          .eq("status", "accepted");

        const friendIds: string[] = friendships
          ? [...new Set(friendships.map((f: any) => (f.user_id === userId ? f.friend_id : f.user_id)))]
          : [];

        if (friendIds.length > 0 && allPools.length > 0) {
          const poolIds = allPools.map((p) => p.id);

          // 3. Fetch pool members who are friends
          const { data: members } = await supabase
            .from("pool_members")
            .select("user_id, pool_id, users:user_id(display_name, username)")
            .in("user_id", friendIds)
            .in("pool_id", poolIds);

          if (members && members.length > 0) {
            // Attach friends to each pool
            const enriched = allPools.map((pool) => ({
              ...pool,
              friendMembers: members
                .filter((m: any) => m.pool_id === pool.id)
                .map((m: any) => ({
                  user_id: m.user_id,
                  display_name: m.users?.display_name,
                  username: m.users?.username,
                })),
            }));

            // Build friend activity list
            const activity: FriendActivity[] = [];
            members.forEach((m: any) => {
              const pool = allPools.find((p) => p.id === m.pool_id);
              if (pool) {
                activity.push({
                  user_id: m.user_id,
                  display_name: m.users?.display_name || m.users?.username || "Friend",
                  username: m.users?.username || "",
                  poolName: pool.name,
                  poolId: pool.id,
                });
              }
            });

            setFriendActivity(activity.slice(0, 6));
            setPools(enriched);
          } else {
            setPools(allPools);
          }
        } else {
          setPools(allPools);
        }
      } catch (err) {
        console.error("[PlayPools] load error:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [session]);

  const handleShare = async (pool: Pool) => {
    const url = `${window.location.origin}/room/${pool.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: pool.name, text: `Play ${pool.name} on Consumed`, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // dismissed
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#09091a" }}>
      {/* Header */}
      <div className="px-4 pt-12 pb-4 shrink-0" style={{ background: "linear-gradient(180deg, #0d0d24 0%, #09091a 100%)" }}>
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => setLocation("/play")}
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <ChevronLeft size={16} className="text-white/70" />
          </button>
          <h1 className="text-white text-xl font-bold" style={{ fontFamily: "Poppins, sans-serif" }}>
            Pools
          </h1>
        </div>
        <p className="text-white/40 text-sm ml-11">Play rounds, compete with friends</p>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 pb-28" style={{ scrollbarWidth: "none" }}>

        {/* Friends playing strip */}
        {!loading && friendActivity.length > 0 && (
          <div className="mb-6">
            <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-3">Friends Playing Now</p>
            <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {friendActivity.map((f, i) => (
                <button
                  key={`${f.user_id}-${i}`}
                  onClick={() => setLocation(`/room/${f.poolId}`)}
                  className="shrink-0 rounded-2xl px-3 py-2.5 flex items-center gap-2.5 active:scale-95 transition-transform"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "0.5px solid rgba(255,255,255,0.1)",
                    minWidth: 150,
                  }}
                >
                  <div
                    className={`w-8 h-8 ${avatarColor(f.display_name)} rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0`}
                  >
                    {f.display_name[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-white text-xs font-semibold leading-tight truncate">{f.display_name}</p>
                    <p className="text-white/40 text-[10px] leading-tight truncate">{f.poolName}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Skeleton loading */}
        {loading && (
          <div className="space-y-3 mt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
            ))}
          </div>
        )}

        {/* Pool cards */}
        {!loading && pools.length > 0 && (
          <div>
            <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-3">Active Rounds</p>
            <div className="space-y-3">
              {pools.map((pool, index) => {
                const gradient = poolGradient(pool.accent_color, index);
                const friends = pool.friendMembers || [];
                return (
                  <button
                    key={pool.id}
                    onClick={() => setLocation(`/room/${pool.id}`)}
                    className="w-full rounded-2xl overflow-hidden text-left active:scale-[0.98] transition-transform"
                    style={{
                      background: gradient,
                      border: "0.5px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    <div className="px-4 pt-4 pb-3">
                      {/* Pool name row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* Logo or fallback */}
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: "rgba(255,255,255,0.15)" }}
                          >
                            {pool.partner_logo_url ? (
                              <img
                                src={pool.partner_logo_url}
                                alt={pool.partner_name || pool.name}
                                className="w-6 h-6 object-contain rounded"
                              />
                            ) : (
                              <Globe size={16} className="text-white/70" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-[15px] font-bold leading-tight truncate">{pool.name}</p>
                            {pool.description && (
                              <p className="text-white/60 text-xs mt-0.5 line-clamp-1">{pool.description}</p>
                            )}
                          </div>
                        </div>
                        {pool.is_official && (
                          <div
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full shrink-0"
                            style={{ background: "rgba(0,0,0,0.35)", border: "0.5px solid rgba(255,255,255,0.2)" }}
                          >
                            <Zap size={9} className="text-amber-400" />
                            <span className="text-amber-300 text-[9px] font-bold uppercase tracking-wide">Official</span>
                          </div>
                        )}
                      </div>

                      {/* Footer row */}
                      <div
                        className="flex items-center justify-between mt-3 pt-2.5"
                        style={{ borderTop: "0.5px solid rgba(255,255,255,0.1)" }}
                      >
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-1">
                            <Users size={10} className="text-white/40" />
                            <span className="text-white/40 text-[10px] font-medium">
                              {pool.member_count.toLocaleString()} playing
                            </span>
                          </div>
                          {friends.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <AvatarCluster members={friends} />
                              <span className="text-purple-300 text-[10px] font-medium">
                                {friends.length} friend{friends.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleShare(pool); }}
                            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: "rgba(255,255,255,0.1)" }}
                          >
                            <Share2 size={12} className="text-white/60" />
                          </button>
                          <div
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                            style={{ background: "rgba(255,255,255,0.15)" }}
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
        )}

        {/* Empty state */}
        {!loading && pools.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "rgba(168,85,247,0.1)", border: "0.5px solid rgba(168,85,247,0.2)" }}
            >
              <Globe size={28} className="text-purple-400" />
            </div>
            <p className="text-white/60 text-sm font-medium">No active pools yet</p>
            <p className="text-white/30 text-xs mt-1">Check back soon for new rounds</p>
          </div>
        )}

        {/* Challenge friends CTA */}
        {!loading && (
          <div className="mt-5">
            <div
              className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
              style={{
                background: "rgba(168,85,247,0.08)",
                border: "0.5px dashed rgba(168,85,247,0.3)",
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(168,85,247,0.15)" }}
              >
                <Share2 size={16} className="text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-purple-300 text-sm font-semibold">Challenge your friends</p>
                <p className="text-purple-400/60 text-xs mt-0.5">Share a pool link and compete head-to-head</p>
              </div>
              <ChevronRight size={14} className="text-purple-400/60 shrink-0" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
