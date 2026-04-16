import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Flame, Users, Zap, Share2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import Navigation from "@/components/navigation";

const POOL_EMOJIS: Record<string, string> = {
  "Harry Potter": "⚡",
  "Friends Pool": "☕",
  "Friends": "☕",
  "Reelz True Crime": "🔍",
  "Reelz Official Room": "📺",
  "Stranger Things": "🔦",
};

// Pools to hide from this page
const HIDDEN_POOL_NAMES = [
  "The Traitors Season 2",
  "The Traitors S2",
  "The Traitors S3",
  "Binge Watch Battle",
  "The Bottom",
];

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
  is_official: boolean;
  rounds: { id: string; title: string; status: string; lock_time: string | null }[];
  memberCount: number;
  friendNames: string[];
}

interface ChallengeGroup {
  showTag: string;
  questionCount: number;
  poolIds: string[];
}

const SHOW_CONFIG: Record<string, { emoji: string; accentColor: string; description: string }> = {
  "Harry Potter": { emoji: "⚡", accentColor: "#7c3aed", description: "Test your wizarding world knowledge" },
  "Friends": { emoji: "☕", accentColor: "#f59e0b", description: "Could you BE any more of a fan?" },
  "Friends Pool": { emoji: "☕", accentColor: "#f59e0b", description: "Could you BE any more of a fan?" },
  "Stranger Things": { emoji: "🔦", accentColor: "#ef4444", description: "Enter the Upside Down" },
  "Reelz True Crime": { emoji: "🔍", accentColor: "#0ea5e9", description: "True crime trivia" },
};
function showConfig(tag: string) {
  return SHOW_CONFIG[tag] || { emoji: "🎮", accentColor: "#7c3aed", description: `${tag} trivia` };
}

export default function PlayPoolsPage() {
  const [, setLocation] = useLocation();
  const { session } = useAuth();
  const [pools, setPools] = useState<PoolRow[]>([]);
  const [challenges, setChallenges] = useState<ChallengeGroup[]>([]);
  const [friendActivity, setFriendActivity] = useState<{ name: string; poolId: string; poolName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [challengesLoading, setChallengesLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;

    async function load() {
      try {
        // Step 1: Get the pool IDs the user is a member of (RLS always allows users to read their own rows)
        const { data: myMemberships } = await supabase
          .from("pool_members")
          .select("pool_id, total_points")
          .eq("user_id", userId);

        const myPoolIds: string[] = (myMemberships || []).map((m: any) => m.pool_id);

        if (!myPoolIds.length) { setLoading(false); return; }

        // Step 2: Fetch the actual pool records — RLS allows reads when you're a member
        const { data: rawPools, error: poolsError } = await supabase
          .from("pools")
          .select("id, name, description, accent_color, is_official, pool_type, status")
          .in("id", myPoolIds)
          .or("pool_type.is.null,pool_type.neq.room") // include null pool_type AND non-room types
          .eq("status", "open");

        if (poolsError) {
          console.error("[PlayPools] pools query error:", poolsError);
        }

        const standalonePools = rawPools || [];
        if (!standalonePools.length) { setLoading(false); return; }

        const poolIds = standalonePools.map((p: any) => p.id);

        // Step 3: Fetch rounds for these pools
        const { data: rounds } = await supabase
          .from("pool_rounds")
          .select("id, pool_id, title, status, lock_time")
          .in("pool_id", poolIds);

        // Step 4: Fetch all members of these pools (for counts + friend detection)
        const { data: allMembers } = await supabase
          .from("pool_members")
          .select("pool_id, user_id")
          .in("pool_id", poolIds);

        // Step 5: Friend IDs
        const { data: friendships } = await supabase
          .from("friendships")
          .select("user_id, friend_id")
          .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
          .eq("status", "accepted");

        const friendIds = new Set(
          (friendships || []).map((f: any) => f.user_id === userId ? f.friend_id : f.user_id)
        );

        // Step 6: Load friend display names
        let friendNames: Record<string, string> = {};
        if (friendIds.size > 0) {
          const { data: friendUsers } = await supabase
            .from("users")
            .select("id, display_name, user_name")
            .in("id", [...friendIds]);
          (friendUsers || []).forEach((u: any) => {
            friendNames[u.id] = u.display_name || u.user_name || "Friend";
          });
        }

        // Step 7: Assemble enriched pool rows
        const enriched: PoolRow[] = standalonePools.map((p: any) => {
          const poolRounds = (rounds || []).filter((r: any) => r.pool_id === p.id);
          const poolMembers = (allMembers || []).filter((m: any) => m.pool_id === p.id);
          const friendMemberNames = poolMembers
            .filter((m: any) => friendIds.has(m.user_id))
            .map((m: any) => friendNames[m.user_id])
            .filter(Boolean);
          return {
            id: p.id,
            name: p.name,
            description: p.description,
            accent_color: p.accent_color,
            is_official: p.is_official || false,
            rounds: poolRounds,
            memberCount: poolMembers.length,
            friendNames: friendMemberNames,
          };
        });

        // Step 8: Friend activity strip
        const fa: { name: string; poolId: string; poolName: string }[] = [];
        const seen = new Set<string>();
        (allMembers || []).forEach((m: any) => {
          const key = `${m.user_id}-${m.pool_id}`;
          if (friendIds.has(m.user_id) && friendNames[m.user_id] && !seen.has(key)) {
            seen.add(key);
            const pool = standalonePools.find((p: any) => p.id === m.pool_id);
            if (pool) fa.push({ name: friendNames[m.user_id], poolId: pool.id, poolName: pool.name });
          }
        });

        setPools(enriched.filter(p => !HIDDEN_POOL_NAMES.includes(p.name)));
        setFriendActivity(fa.slice(0, 6));
      } catch (err) {
        console.error("[PlayPools] load error:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [session?.user?.id]);

  useEffect(() => {
    async function loadChallenges() {
      setChallengesLoading(true);
      try {
        const { data: pools } = await supabase
          .from("prediction_pools")
          .select("id, show_tag, options, title")
          .eq("type", "trivia")
          .eq("status", "open")
          .not("show_tag", "is", null);

        if (!pools || pools.length === 0) { setChallengesLoading(false); return; }

        const grouped: Record<string, { poolIds: string[]; questionCount: number }> = {};
        for (const pool of pools) {
          const tag = pool.show_tag as string;
          if (!tag) continue;
          if (!grouped[tag]) grouped[tag] = { poolIds: [], questionCount: 0 };
          grouped[tag].poolIds.push(pool.id);
          if (pool.options && Array.isArray(pool.options)) {
            const firstOpt = pool.options[0];
            if (typeof firstOpt === "object" && firstOpt !== null && "question" in firstOpt) {
              grouped[tag].questionCount += pool.options.length;
            } else {
              grouped[tag].questionCount += 1;
            }
          }
        }

        const groups: ChallengeGroup[] = Object.entries(grouped)
          .map(([showTag, data]) => ({ showTag, ...data }))
          .filter(g => g.questionCount > 0)
          .sort((a, b) => b.questionCount - a.questionCount);

        setChallenges(groups);
      } catch (err) {
        console.error("[PlayPools] challenges error:", err);
      } finally {
        setChallengesLoading(false);
      }
    }
    loadChallenges();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      {/* Header */}
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
        {friendActivity.length > 0 && (
          <div className="mb-5">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2.5">Friends Playing Now</p>
            <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {friendActivity.map((f, i) => (
                <button
                  key={i}
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

        {/* Trivia Pools (from prediction_pools grouped by show_tag) */}
        {(challengesLoading || challenges.length > 0) && (
          <div className="mb-6">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">Trivia Pools</p>
            {challengesLoading && (
              <div className="space-y-3">
                {[1, 2].map(i => <div key={i} className="h-24 rounded-2xl bg-gray-200 animate-pulse" />)}
              </div>
            )}
            <div className="space-y-3">
              {challenges.map((group) => {
                const cfg = showConfig(group.showTag);
                const accent = cfg.accentColor;
                return (
                  <div
                    key={group.showTag}
                    onClick={() => setLocation(`/play/challenge/${encodeURIComponent(group.showTag)}`)}
                    className="rounded-2xl overflow-hidden relative cursor-pointer active:scale-[0.98] transition-transform"
                    style={{
                      background: `linear-gradient(135deg, ${accent}0e 0%, ${accent}1a 100%)`,
                      border: `1px solid ${accent}28`,
                    }}
                  >
                    <div className="px-4 pt-4 pb-3">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl leading-none mt-0.5">{cfg.emoji}</span>
                        <div className="flex-1 min-w-0 pr-20">
                          <p className="text-gray-900 text-[15px] font-bold leading-tight">{group.showTag}</p>
                          <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">{cfg.description}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-gray-400 text-[10px] font-medium">{group.questionCount} question{group.questionCount !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                      </div>
                      <div
                        className="flex items-center justify-end mt-3 pt-2.5"
                        style={{ borderTop: `0.5px solid ${accent}20` }}
                      >
                        <div
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                          style={{ background: accent }}
                        >
                          Play Now
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Rounds */}
        <div>
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-3">Active Rounds</p>

          {loading && (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-28 rounded-2xl bg-gray-200 animate-pulse" />)}
            </div>
          )}

          {!loading && pools.length === 0 && (
            <div className="bg-white rounded-2xl py-12 text-center" style={{ border: "0.5px solid #e5e7eb" }}>
              <p className="text-3xl mb-2">🎮</p>
              <p className="text-gray-500 text-sm font-medium">No active pools</p>
              <p className="text-gray-400 text-xs mt-1">Join a pool to start competing</p>
            </div>
          )}

          <div className="space-y-3">
            {pools.map((pool) => {
              const accent = pool.accent_color || "#7c3aed";
              const openRound = pool.rounds.find((r) => r.status === "open") || pool.rounds[0];
              const roundCount = pool.rounds.length;
              const roundIndex = openRound ? pool.rounds.indexOf(openRound) + 1 : 1;
              const roundLabel = roundCount > 0 ? `Round ${roundIndex} of ${roundCount}` : null;
              const deadline = openRound?.lock_time ? formatDeadline(openRound.lock_time) : null;
              const emoji = poolEmoji(pool.name);

              return (
                <div
                  key={pool.id}
                  onClick={() => setLocation(`/play/pools/${pool.id}`)}
                  className="rounded-2xl overflow-hidden relative cursor-pointer active:scale-[0.98] transition-transform"
                  style={{
                    background: `linear-gradient(135deg, ${accent}0e 0%, ${accent}1a 100%)`,
                    border: `1px solid ${accent}28`,
                  }}
                >
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
                              {deadline.urgent
                                ? <Flame size={9} className="text-orange-400" />
                                : <div className="w-1 h-1 rounded-full bg-gray-300" />
                              }
                              <span className={`text-[10px] font-semibold ${deadline.urgent ? "text-orange-500" : "text-gray-400"}`}>
                                Closes in {deadline.label}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
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
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: `${accent}18` }}
                          onClick={(e) => {
                            e.stopPropagation();
                            const url = `${window.location.origin}/play/pools/${pool.id}`;
                            if (navigator.share) navigator.share({ title: pool.name, url }).catch(() => {});
                            else navigator.clipboard.writeText(url);
                          }}
                        >
                          <Share2 size={12} style={{ color: accent }} />
                        </div>
                        <div
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                          style={{ background: accent }}
                        >
                          Play Now
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
