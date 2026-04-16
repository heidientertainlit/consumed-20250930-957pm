import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Lock, ChevronRight } from "lucide-react";
import Navigation from "@/components/navigation";

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

export default function PlayPoolsPage() {
  const [, setLocation] = useLocation();
  const [completionState, setCompletionState] = useState(0);

  useEffect(() => {
    setCompletionState(prev => prev + 1);
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
          Start a new challenge
        </p>

        {POOLS.map((pool) => {
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
                      {/* Difficulty dot */}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
