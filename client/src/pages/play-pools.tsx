import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Users, Share2, ChevronRight, Globe, Flame } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import Navigation from "@/components/navigation";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";

function avatarColor(name: string) {
  const palette = ["bg-violet-500", "bg-fuchsia-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];
  return palette[(name || "?").charCodeAt(0) % palette.length];
}

function AvatarCluster({ members, max = 3 }: { members: { display_name?: string; username?: string }[]; max?: number }) {
  return (
    <div className="flex -space-x-1">
      {members.slice(0, max).map((m, i) => {
        const name = m.display_name || m.username || "?";
        return (
          <div
            key={i}
            className={`w-5 h-5 ${avatarColor(name)} rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2 border-white shrink-0`}
          >
            {name[0].toUpperCase()}
          </div>
        );
      })}
    </div>
  );
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
  friendMembers?: { display_name?: string; username?: string; user_id: string }[];
}

interface FriendActivity {
  user_id: string;
  display_name: string;
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
          const { data: members } = await supabase
            .from("pool_members")
            .select("user_id, pool_id, users:user_id(display_name, username)")
            .in("user_id", friendIds)
            .in("pool_id", poolIds);

          if (members && members.length > 0) {
            const enriched = allPools.map((pool) => ({
              ...pool,
              friendMembers: members
                .filter((m: any) => m.pool_id === pool.id)
                .map((m: any) => ({ user_id: m.user_id, display_name: m.users?.display_name, username: m.users?.username })),
            }));

            const activity: FriendActivity[] = [];
            members.forEach((m: any) => {
              const pool = allPools.find((p) => p.id === m.pool_id);
              if (pool) {
                activity.push({
                  user_id: m.user_id,
                  display_name: m.users?.display_name || m.users?.username || "Friend",
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

  const handleShare = async (pool: Pool, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/play/pools/${pool.id}`;
    try {
      if (navigator.share) await navigator.share({ title: pool.name, url });
      else await navigator.clipboard.writeText(url);
    } catch { /* dismissed */ }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f9fafb" }}>
      <Navigation />

      {/* Dark gradient header — matches play.tsx */}
      <div
        className="px-4 pt-6 pb-5"
        style={{ background: "linear-gradient(to right, #0a0a0f, #12121f, #2d1f4e)" }}
      >
        <div className="flex items-center gap-3 mb-0.5">
          <button
            onClick={() => setLocation("/play")}
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            <ChevronLeft size={14} className="text-white/70" />
          </button>
          <h1 className="text-white text-xl font-bold" style={{ fontFamily: "Poppins, sans-serif" }}>
            Pools
          </h1>
        </div>
        <p className="text-white/40 text-sm ml-10">Play rounds, compete with friends</p>
      </div>

      {/* Light content area */}
      <div className="bg-gray-50 min-h-screen px-4 pt-4 pb-28">

        {/* Friends strip */}
        {!loading && friendActivity.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2.5">Friends Playing Now</p>
            <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {friendActivity.map((f, i) => (
                <button
                  key={`${f.user_id}-${i}`}
                  onClick={() => setLocation(`/play/pools/${f.poolId}`)}
                  className="shrink-0 bg-white rounded-2xl px-3 py-2.5 flex items-center gap-2.5 active:scale-95 transition-transform shadow-sm"
                  style={{ border: "0.5px solid #e5e7eb", minWidth: 150 }}
                >
                  <div className={`w-8 h-8 ${avatarColor(f.display_name)} rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                    {f.display_name[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-gray-900 text-xs font-semibold leading-tight truncate">{f.display_name}</p>
                    <p className="text-gray-400 text-[10px] leading-tight truncate">{f.poolName}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3 mt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-gray-200 animate-pulse" />
            ))}
          </div>
        )}

        {/* Pool cards */}
        {!loading && pools.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Active Rounds</p>
            <div className="space-y-3">
              {pools.map((pool) => {
                const accent = pool.accent_color || "#7c3aed";
                const accentLight = accent + "18";
                const friends = pool.friendMembers || [];

                return (
                  <button
                    key={pool.id}
                    onClick={() => setLocation(`/play/pools/${pool.id}`)}
                    className="w-full bg-white rounded-2xl overflow-hidden text-left active:scale-[0.98] transition-transform shadow-sm"
                    style={{ border: `1px solid ${accent}30` }}
                  >
                    <div className="flex items-center gap-3 p-4">
                      {/* Logo / accent circle */}
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: accentLight }}
                      >
                        {pool.partner_logo_url ? (
                          <img
                            src={pool.partner_logo_url}
                            alt={pool.partner_name || pool.name}
                            className="w-7 h-7 object-contain rounded"
                          />
                        ) : (
                          <Globe size={18} style={{ color: accent }} />
                        )}
                      </div>

                      {/* Pool info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 font-semibold text-[15px] leading-tight truncate">{pool.name}</p>
                        {pool.description && (
                          <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">{pool.description}</p>
                        )}

                        {/* Meta row */}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <div className="flex items-center gap-1">
                            <Users size={10} className="text-gray-400" />
                            <span className="text-gray-400 text-[10px]">{pool.member_count.toLocaleString()} playing</span>
                          </div>
                          {friends.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <AvatarCluster members={friends} />
                              <span className="text-[10px] font-medium" style={{ color: accent }}>
                                {friends.length} friend{friends.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => handleShare(pool, e)}
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ background: accentLight }}
                        >
                          <Share2 size={13} style={{ color: accent }} />
                        </button>
                        <div
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                          style={{ background: accent }}
                        >
                          Play
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
            <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center mb-4">
              <Globe size={26} className="text-purple-400" />
            </div>
            <p className="text-gray-500 text-sm font-medium">No active pools yet</p>
            <p className="text-gray-400 text-xs mt-1">Check back soon for new rounds</p>
          </div>
        )}

        {/* Challenge friends CTA */}
        {!loading && (
          <div className="mt-4">
            <div
              className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-sm"
              style={{ border: "0.5px dashed #c4b5fd" }}
            >
              <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                <Share2 size={16} className="text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 text-sm font-semibold">Challenge your friends</p>
                <p className="text-gray-400 text-xs mt-0.5">Share a pool link and compete head-to-head</p>
              </div>
              <ChevronRight size={14} className="text-gray-300 shrink-0" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
