import { useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";
import Navigation from "@/components/navigation";
import { useAuth } from "@/lib/auth";

interface Pool {
  id: string;
  showTag: string;
  title: string;
  description: string;
  emoji: string;
  accentColor: string;
  questionCount: number;
  category: string;
  playersThisWeek: number;
}

const POOLS: Pool[] = [
  {
    id: "harry-potter",
    showTag: "Harry Potter",
    title: "Harry Potter",
    description: "Test your wizarding world knowledge",
    emoji: "⚡",
    accentColor: "#7c3aed",
    questionCount: 12,
    category: "Movies & TV",
    playersThisWeek: 1204,
  },
  {
    id: "friends",
    showTag: "Friends",
    title: "Friends",
    description: "Could you BE any more of a fan?",
    emoji: "☕",
    accentColor: "#7c3aed",
    questionCount: 12,
    category: "TV",
    playersThisWeek: 847,
  },
];

export default function PlayPoolsPage() {
  const [, setLocation] = useLocation();
  const { session } = useAuth();

  const userPoints = 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      {/* Dark Header */}
      <div
        className="px-5 pt-5 pb-6"
        style={{ background: "linear-gradient(160deg, #1a1033 0%, #0f0a1e 100%)" }}
      >
        <div className="flex items-start justify-between mb-3">
          <button
            onClick={() => setLocation("/play")}
            className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5"
          >
            <ChevronLeft size={14} className="text-white/60" />
          </button>
          {userPoints > 0 && (
            <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
              <span className="text-amber-400 text-sm">★</span>
              <span className="text-white text-xs font-semibold">{userPoints.toLocaleString()} pts</span>
            </div>
          )}
        </div>
        <h1 className="text-white text-[28px] font-bold leading-tight">Pools</h1>
        <p className="text-white/50 text-sm mt-1">Compete with friends, round by round</p>
      </div>

      {/* Content */}
      <div className="px-4 pt-5 pb-28">

        {/* Start a New Challenge */}
        <p className="text-purple-600 text-[11px] font-bold uppercase tracking-widest mb-3">
          Start a new challenge
        </p>

        <div className="space-y-2.5">
          {POOLS.map((pool) => (
            <div
              key={pool.id}
              className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3.5"
              style={{ border: "0.5px solid #e5e7eb" }}
            >
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                style={{ background: "#ede9fe" }}
              >
                {pool.emoji}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 text-[15px] font-bold leading-tight">{pool.title}</p>
                <p className="text-gray-400 text-xs mt-0.5">
                  {pool.questionCount} questions · {pool.category}
                </p>
                <p className="text-purple-600 text-xs font-semibold mt-0.5">
                  {pool.playersThisWeek.toLocaleString()} players this week
                </p>
              </div>

              {/* Challenge Button */}
              <button
                onClick={() => setLocation(`/play/challenge/${encodeURIComponent(pool.showTag)}`)}
                className="shrink-0 px-4 py-2 rounded-full text-sm font-bold text-white"
                style={{ background: "#5b21b6" }}
              >
                Challenge
              </button>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
