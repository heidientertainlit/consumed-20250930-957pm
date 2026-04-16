import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Lock, ChevronRight, Trophy, X, Loader2 } from "lucide-react";
import Navigation from "@/components/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

type Difficulty = "easy" | "medium" | "hard";

interface Round {
  difficulty: Difficulty;
  label: string;
  questionCount: number;
  pointsEach: number;
  color: string;
}

interface Pool {
  id: string;
  showTag: string;
  title: string;
  description: string;
  fallbackEmoji: string;
  posterUrl: string;
  category: string;
  playersThisWeek: number;
  rounds: Round[];
}

interface LeaderboardEntry {
  display_name: string;
  user_name: string;
  total_points: number;
  isCurrentUser?: boolean;
}

const ROUNDS: Round[] = [
  { difficulty: "easy",   label: "Easy",   questionCount: 12, pointsEach: 10, color: "#22c55e" },
  { difficulty: "medium", label: "Medium", questionCount: 12, pointsEach: 15, color: "#f59e0b" },
  { difficulty: "hard",   label: "Hard",   questionCount: 12, pointsEach: 25, color: "#ef4444" },
];

const POOLS: Pool[] = [
  {
    id: "harry-potter",
    showTag: "Harry Potter",
    title: "Harry Potter",
    description: "Test your wizarding world knowledge",
    fallbackEmoji: "⚡",
    posterUrl: "https://image.tmdb.org/t/p/w200/wuMc08IPKEatf9rnMNXvIDxqP4W.jpg",
    category: "Movies & TV",
    playersThisWeek: 1204,
    rounds: ROUNDS,
  },
  {
    id: "friends",
    showTag: "Friends",
    title: "Friends",
    description: "Could you BE any more of a fan?",
    fallbackEmoji: "☕",
    posterUrl: "https://image.tmdb.org/t/p/w200/f496cm9enuEsZkSPzCwnTESEK5s.jpg",
    category: "TV",
    playersThisWeek: 847,
    rounds: ROUNDS,
  },
];

function completionKey(showTag: string, difficulty: Difficulty) {
  return `challenge-completed-${showTag}-${difficulty}`;
}
function isCompleted(showTag: string, difficulty: Difficulty) {
  return localStorage.getItem(completionKey(showTag, difficulty)) === "1";
}
function isUnlocked(showTag: string, difficulty: Difficulty) {
  if (difficulty === "easy") return true;
  if (difficulty === "medium") return isCompleted(showTag, "easy");
  if (difficulty === "hard") return isCompleted(showTag, "medium");
  return false;
}

function PosterImage({ posterUrl, fallbackEmoji, alt }: { posterUrl: string; fallbackEmoji: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!failed && posterUrl) {
    return (
      <img
        src={posterUrl}
        alt={alt}
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
    );
  }
  return <span className="text-2xl">{fallbackEmoji}</span>;
}

function medalColor(rank: number) {
  if (rank === 1) return "#f59e0b";
  if (rank === 2) return "#9ca3af";
  if (rank === 3) return "#92400e";
  return "#6b7280";
}

function LeaderboardSheet({ pool, onClose }: { pool: Pool; onClose: () => void }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data: scores, error: scoresError } = await supabase
          .from("challenge_scores")
          .select("user_id, points_earned")
          .eq("show_tag", pool.showTag);

        if (scoresError) console.error("[Leaderboard] scores error:", scoresError);

        if (!scores || scores.length === 0) {
          setLoading(false);
          return;
        }

        const totals: Record<string, number> = {};
        for (const s of scores) {
          totals[s.user_id] = (totals[s.user_id] || 0) + (s.points_earned || 0);
        }

        const userIds = Object.keys(totals);
        const { data: users } = await supabase
          .from("users")
          .select("id, display_name, user_name")
          .in("id", userIds);

        const enriched: LeaderboardEntry[] = userIds.map(uid => {
          const u = (users || []).find((x: any) => x.id === uid);
          return {
            display_name: u?.display_name || u?.user_name || "Player",
            user_name: u?.user_name || "",
            total_points: totals[uid],
            isCurrentUser: uid === user?.id,
          };
        }).sort((a, b) => b.total_points - a.total_points);

        setEntries(enriched);
      } catch (e) {
        console.error("[Leaderboard] error:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [pool.showTag, user?.id]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl pb-10"
        style={{ maxHeight: "80vh", overflowY: "auto" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center shrink-0">
              <PosterImage posterUrl={pool.posterUrl} fallbackEmoji={pool.fallbackEmoji} alt={pool.title} />
            </div>
            <div>
              <p className="text-gray-900 text-sm font-bold">{pool.title}</p>
              <p className="text-gray-400 text-xs">Leaderboard</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={14} className="text-gray-500" />
          </button>
        </div>

        <div className="px-5 pt-4">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 rounded-2xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && entries.length === 0 && (
            <div className="py-12 text-center">
              <Trophy size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">No scores yet</p>
              <p className="text-gray-400 text-xs mt-1">Be the first to complete a round!</p>
            </div>
          )}

          {!loading && entries.length > 0 && (
            <div className="space-y-2.5">
              {entries.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                  style={{
                    background: entry.isCurrentUser ? "#ede9fe" : "#f9fafb",
                    border: entry.isCurrentUser ? "1px solid #c4b5fd" : "1px solid #f3f4f6",
                  }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
                    style={{ background: medalColor(i + 1) + "20", color: medalColor(i + 1) }}
                  >
                    {i + 1}
                  </div>
                  <p className="flex-1 text-gray-900 text-sm font-semibold truncate">
                    {entry.display_name}
                    {entry.isCurrentUser && (
                      <span className="text-purple-500 text-[10px] font-bold ml-1.5">YOU</span>
                    )}
                  </p>
                  <p className="text-sm font-bold shrink-0" style={{ color: "#7c3aed" }}>
                    {entry.total_points} pts
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function PlayPoolsPage() {
  const [, setLocation] = useLocation();
  const [leaderboardPool, setLeaderboardPool] = useState<Pool | null>(null);
  const [, forceUpdate] = useState(0);
  const [dbPools, setDbPools] = useState<Pool[]>([]);
  const [poolsLoading, setPoolsLoading] = useState(true);

  useEffect(() => {
    forceUpdate(n => n + 1);
  }, []);

  // Fetch pools from DB, fall back to hardcoded POOLS for any not in DB
  useEffect(() => {
    async function loadPools() {
      setPoolsLoading(true);
      try {
        const { data, error } = await supabase
          .from("challenge_pools")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: true });

        if (!error && data && data.length > 0) {
          const dbShowTags = new Set(data.map((p: any) => p.show_tag));
          const dbMapped: Pool[] = data.map((p: any) => ({
            id: p.id,
            showTag: p.show_tag,
            title: p.title,
            description: p.description || "",
            fallbackEmoji: p.fallback_emoji || "🎮",
            posterUrl: p.poster_url || "",
            category: p.category || "TV & Movies",
            playersThisWeek: 0,
            rounds: ROUNDS,
          }));
          // Append any hardcoded pools not already in DB
          const hardcodedExtras = POOLS.filter(p => !dbShowTags.has(p.showTag));
          setDbPools([...dbMapped, ...hardcodedExtras]);
        } else {
          // No DB pools — use hardcoded
          setDbPools(POOLS);
        }
      } catch (e) {
        setDbPools(POOLS);
      } finally {
        setPoolsLoading(false);
      }
    }
    loadPools();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      {/* Dark Header */}
      <div
        className="px-5 pt-5 pb-6"
        style={{ background: "linear-gradient(160deg, #1a1033 0%, #0f0a1e 100%)" }}
      >
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setLocation("/play")}
            className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0"
          >
            <ChevronLeft size={14} className="text-white/60" />
          </button>
        </div>
        <h1 className="text-white text-[28px] font-bold leading-tight">Pools</h1>
        <p className="text-white/50 text-sm mt-1">Compete with friends, round by round</p>
      </div>

      {/* Pool List */}
      <div className="px-4 pt-5 pb-28 space-y-4">

        <p className="text-purple-600 text-[11px] font-bold uppercase tracking-widest">
          Pick a Pool
        </p>

        {poolsLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-purple-400" />
          </div>
        )}

        {!poolsLoading && dbPools.map((pool) => {
          const completedCount = pool.rounds.filter(r => isCompleted(pool.showTag, r.difficulty)).length;

          return (
            <div
              key={pool.id}
              className="bg-white rounded-2xl overflow-hidden"
              style={{ border: "0.5px solid #e5e7eb" }}
            >
              {/* Pool Header Row */}
              <div className="px-4 py-3.5 flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center">
                  <PosterImage
                    posterUrl={pool.posterUrl}
                    fallbackEmoji={pool.fallbackEmoji}
                    alt={pool.title}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 text-[15px] font-bold leading-tight">{pool.title}</p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {pool.rounds.length * pool.rounds[0].questionCount} questions · {pool.category}
                  </p>
                  <p className="text-purple-600 text-xs font-semibold mt-0.5">
                    {pool.playersThisWeek.toLocaleString()} players this week
                  </p>
                </div>

                {completedCount > 0 && (
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] text-gray-400">{completedCount}/{pool.rounds.length} done</p>
                  </div>
                )}
              </div>

              {/* Rounds */}
              <div className="border-t border-gray-100 px-4 py-3 space-y-2">
                {pool.rounds.map((round) => {
                  const unlocked = isUnlocked(pool.showTag, round.difficulty);
                  const completed = isCompleted(pool.showTag, round.difficulty);

                  return (
                    <button
                      key={round.difficulty}
                      disabled={!unlocked}
                      onClick={() => setLocation(`/play/challenge/${encodeURIComponent(pool.showTag)}/${round.difficulty}`)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all active:scale-[0.98]"
                      style={{
                        background: unlocked ? round.color + "0f" : "#f9fafb",
                        border: `1px solid ${unlocked ? round.color + "25" : "#e5e7eb"}`,
                        opacity: unlocked ? 1 : 0.6,
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: unlocked ? round.color : "#d1d5db" }}
                      />
                      <div className="flex-1 text-left">
                        <span className="text-gray-900 text-[13px] font-semibold">{round.label}</span>
                        <span className="text-gray-400 text-[11px] ml-1.5">
                          {round.questionCount} questions · {round.pointsEach} pts each
                        </span>
                      </div>
                      {completed ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: round.color + "15", color: round.color }}>
                          Done
                        </span>
                      ) : unlocked ? (
                        <ChevronRight size={14} className="text-gray-400 shrink-0" />
                      ) : (
                        <Lock size={12} className="text-gray-300 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Leaderboard Bar */}
              <button
                onClick={() => setLeaderboardPool(pool)}
                className="w-full flex items-center justify-between px-4 py-2.5 border-t border-gray-100 active:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Trophy size={13} className="text-amber-500" />
                  <span className="text-gray-500 text-xs font-semibold">See Leaderboard</span>
                </div>
                <ChevronRight size={13} className="text-gray-300" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Leaderboard Sheet */}
      {leaderboardPool && (
        <LeaderboardSheet pool={leaderboardPool} onClose={() => setLeaderboardPool(null)} />
      )}
    </div>
  );
}
