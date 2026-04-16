import { useLocation } from "wouter";
import { ChevronLeft, Trophy, Zap, ChevronRight } from "lucide-react";
import Navigation from "@/components/navigation";

interface Pool {
  id: string;
  showTag: string;
  title: string;
  description: string;
  emoji: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  rounds: { label: string; questionCount: number; status: "available" | "coming_soon" }[];
  totalQuestions: number;
  category: string;
}

const POOLS: Pool[] = [
  {
    id: "harry-potter",
    showTag: "Harry Potter",
    title: "Harry Potter",
    description: "How well do you know the wizarding world? Test your knowledge across all 7 books.",
    emoji: "⚡",
    accentColor: "#7c3aed",
    gradientFrom: "#3b0764",
    gradientTo: "#1e1b4b",
    rounds: [
      { label: "Sorcerer's Stone", questionCount: 12, status: "available" },
      { label: "Chamber of Secrets", questionCount: 12, status: "coming_soon" },
      { label: "Prisoner of Azkaban", questionCount: 12, status: "coming_soon" },
    ],
    totalQuestions: 12,
    category: "Movies & TV",
  },
  {
    id: "friends",
    showTag: "Friends",
    title: "Friends",
    description: "Could you BE any more of a fan? Prove it with trivia from all 10 seasons.",
    emoji: "☕",
    accentColor: "#d97706",
    gradientFrom: "#78350f",
    gradientTo: "#1c1917",
    rounds: [
      { label: "The One With The Pilot", questionCount: 12, status: "available" },
      { label: "The One With More Trivia", questionCount: 12, status: "coming_soon" },
    ],
    totalQuestions: 12,
    category: "Movies & TV",
  },
];

export default function PlayPoolsPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gray-950">
      <Navigation />

      {/* Header */}
      <div className="px-4 pt-5 pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/play")}
            className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0"
          >
            <ChevronLeft size={14} className="text-white/60" />
          </button>
          <div>
            <h1 className="text-white text-xl font-bold leading-tight">Pools</h1>
            <p className="text-white/40 text-xs mt-0.5">Pick a pool, play the rounds</p>
          </div>
        </div>
      </div>

      {/* Pool Cards */}
      <div className="px-4 pt-5 pb-28 space-y-4">
        {POOLS.map((pool) => (
          <div
            key={pool.id}
            className="rounded-3xl overflow-hidden"
            style={{
              background: `linear-gradient(160deg, ${pool.gradientFrom} 0%, ${pool.gradientTo} 100%)`,
              border: `1px solid ${pool.accentColor}30`,
            }}
          >
            {/* Pool Header */}
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                    style={{ background: `${pool.accentColor}25`, border: `1px solid ${pool.accentColor}40` }}
                  >
                    {pool.emoji}
                  </div>
                  <div>
                    <p className="text-white text-[17px] font-bold leading-tight">{pool.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `${pool.accentColor}25`, color: pool.accentColor }}
                      >
                        {pool.category}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Trophy size={11} className="text-amber-400" />
                  <span className="text-amber-400 text-[10px] font-semibold">Points</span>
                </div>
              </div>
              <p className="text-white/50 text-xs mt-3 leading-relaxed">{pool.description}</p>
            </div>

            {/* Divider */}
            <div className="mx-5 border-t border-white/8" />

            {/* Rounds */}
            <div className="px-5 pt-3 pb-4 space-y-2">
              <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest mb-2.5">Rounds</p>
              {pool.rounds.map((round, i) => {
                const available = round.status === "available";
                return (
                  <button
                    key={i}
                    onClick={() => {
                      if (available) setLocation(`/play/challenge/${encodeURIComponent(pool.showTag)}`);
                    }}
                    disabled={!available}
                    className="w-full flex items-center justify-between px-3.5 py-3 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50"
                    style={{
                      background: available ? `${pool.accentColor}18` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${available ? pool.accentColor + "30" : "rgba(255,255,255,0.06)"}`,
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                        style={{
                          background: available ? pool.accentColor : "rgba(255,255,255,0.1)",
                          color: "white",
                        }}
                      >
                        {i + 1}
                      </div>
                      <div className="text-left">
                        <p className="text-white text-xs font-semibold">{round.label}</p>
                        <p className="text-white/40 text-[10px]">{round.questionCount} questions</p>
                      </div>
                    </div>
                    {available ? (
                      <div className="flex items-center gap-1">
                        <Zap size={10} style={{ color: pool.accentColor }} />
                        <span className="text-[10px] font-bold" style={{ color: pool.accentColor }}>Play</span>
                        <ChevronRight size={11} style={{ color: pool.accentColor }} />
                      </div>
                    ) : (
                      <span className="text-white/25 text-[10px] font-medium">Coming soon</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
