import { useLocation } from "wouter";
import Navigation from "@/components/navigation";
import { DailyChallengeCard } from "@/components/daily-challenge-card";
import { Target, HelpCircle, Vote, BarChart2, UserPlus, Moon, Trophy, ChevronRight } from "lucide-react";

const gameModes = [
  {
    id: "predictions",
    label: "Predictions",
    description: "Predict what happens next",
    icon: Target,
    color: "from-rose-500/20 to-pink-500/10",
    iconColor: "text-rose-400",
    borderColor: "border-rose-500/20",
    href: "/play/predictions",
  },
  {
    id: "trivia",
    label: "Trivia",
    description: "Test your entertainment knowledge",
    icon: HelpCircle,
    color: "from-blue-500/20 to-indigo-500/10",
    iconColor: "text-blue-400",
    borderColor: "border-blue-500/20",
    href: "/play/trivia",
  },
  {
    id: "polls",
    label: "Polls",
    description: "Vote and see what others think",
    icon: Vote,
    color: "from-violet-500/20 to-purple-500/10",
    iconColor: "text-violet-400",
    borderColor: "border-violet-500/20",
    href: "/play/polls",
  },
  {
    id: "ranks",
    label: "Debate the Rank",
    description: "Challenge each other's rankings",
    icon: BarChart2,
    color: "from-amber-500/20 to-orange-500/10",
    iconColor: "text-amber-400",
    borderColor: "border-amber-500/20",
    href: "/play/ranks",
  },
  {
    id: "cast",
    label: "Cast a Friend",
    description: "Who would play who?",
    icon: UserPlus,
    color: "from-teal-500/20 to-cyan-500/10",
    iconColor: "text-teal-400",
    borderColor: "border-teal-500/20",
    href: "/activity",
  },
  {
    id: "nightin",
    label: "Night In",
    description: "Set up a group game night",
    icon: Moon,
    color: "from-fuchsia-500/20 to-pink-500/10",
    iconColor: "text-fuchsia-400",
    borderColor: "border-fuchsia-500/20",
    href: "/pools",
  },
];

export default function PlayPage({ initialTab }: { initialTab?: string }) {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0a0f] pb-24">
      <Navigation />

      {/* Header */}
      <div className="bg-gradient-to-b from-[#1a0a2e] to-[#0a0a0f] px-4 pt-6 pb-5">
        <h1
          className="text-2xl font-bold text-white mb-0.5"
          style={{ fontFamily: "Poppins, sans-serif" }}
        >
          Play
        </h1>
        <p className="text-white/50 text-sm">Compete, predict, and earn rewards</p>
      </div>

      <div className="px-4 space-y-5">
        {/* Daily Featured */}
        <div>
          <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">
            Daily Featured
          </p>
          <DailyChallengeCard />
        </div>

        {/* Game Modes */}
        <div>
          <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">
            Choose a Mode
          </p>
          <div className="grid grid-cols-2 gap-3">
            {gameModes.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => setLocation(mode.href)}
                  className={`relative flex flex-col items-start p-4 rounded-2xl border bg-gradient-to-br ${mode.color} ${mode.borderColor} text-left active:scale-95 transition-transform`}
                >
                  <Icon size={26} className={`${mode.iconColor} mb-3`} />
                  <p className="text-white font-semibold text-sm leading-tight">{mode.label}</p>
                  <p className="text-white/50 text-xs mt-0.5 leading-tight">{mode.description}</p>
                  <ChevronRight size={14} className="absolute top-4 right-4 text-white/20" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Leaderboard shortcut */}
        <button
          onClick={() => setLocation("/leaderboard")}
          className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border border-yellow-500/20 bg-gradient-to-r from-yellow-500/10 to-amber-500/5 active:scale-95 transition-transform"
        >
          <div className="flex items-center gap-3">
            <Trophy size={20} className="text-yellow-400" />
            <div className="text-left">
              <p className="text-white font-semibold text-sm">Leaderboard</p>
              <p className="text-white/50 text-xs">See where you rank</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-white/30" />
        </button>
      </div>
    </div>
  );
}
