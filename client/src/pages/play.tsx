import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Navigation from "@/components/navigation";
import { DailyChallengeCard } from "@/components/daily-challenge-card";
import { Target, HelpCircle, Vote, BarChart2, UserPlus, Users, Trophy, ChevronRight, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

const gameModes = [
  {
    id: "nightin",
    label: "Rooms",
    description: "Host a group experience",
    icon: Users,
    color: "bg-fuchsia-50 border-fuchsia-100",
    iconColor: "text-fuchsia-500",
    href: "/rooms",
  },
  {
    id: "trivia",
    label: "Trivia",
    description: "Test your knowledge",
    icon: HelpCircle,
    color: "bg-blue-50 border-blue-100",
    iconColor: "text-blue-500",
    href: "/play/trivia",
  },
  {
    id: "polls",
    label: "Polls",
    description: "Vote and see what others think",
    icon: Vote,
    color: "bg-violet-50 border-violet-100",
    iconColor: "text-violet-500",
    href: "/play/polls",
  },
  {
    id: "ranks",
    label: "Debate the Rank",
    description: "Challenge each other's rankings",
    icon: BarChart2,
    color: "bg-amber-50 border-amber-100",
    iconColor: "text-amber-500",
    href: "/play/ranks",
  },
  {
    id: "cast",
    label: "Cast a Friend",
    description: "Who would play who?",
    icon: UserPlus,
    color: "bg-teal-50 border-teal-100",
    iconColor: "text-teal-500",
    href: "/play/cast",
  },
  {
    id: "predictions",
    label: "Predictions",
    description: "Predict what happens next",
    icon: Target,
    color: "bg-rose-50 border-rose-100",
    iconColor: "text-rose-500",
    href: "/play/predictions",
  },
];

export default function PlayPage({ initialTab }: { initialTab?: string }) {
  const [, setLocation] = useLocation();
  const { user, session } = useAuth();
  const [totalPoints, setTotalPoints] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.id || !session?.access_token) return;
    fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/calculate-user-points?user_id=${user.id}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.points?.all_time != null) setTotalPoints(data.points.all_time);
      })
      .catch(() => {});
  }, [user?.id, session?.access_token]);

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: '#0a0a0f' }}>
      <Navigation />

      {/* Purple hero — heading + points + Daily Call */}
      <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] px-4 pt-6 pb-6">
        <div className="flex items-center justify-between mb-4">
          <h1
            className="text-2xl font-bold text-white"
            style={{ fontFamily: "Poppins, sans-serif" }}
          >
            Play
          </h1>
          {totalPoints !== null && (
            <button
              onClick={() => setLocation("/points")}
              className="flex items-center gap-1.5 bg-white/10 active:bg-white/20 rounded-full px-3 py-1.5 transition-colors"
            >
              <Star size={13} className="text-amber-400" fill="currentColor" />
              <span className="text-white text-sm font-semibold">{totalPoints.toLocaleString()}</span>
              <span className="text-white/60 text-xs">pts</span>
            </button>
          )}
        </div>
        <DailyChallengeCard />
      </div>

      {/* Light section — game modes + leaderboard */}
      <div className="bg-gray-50 px-4 pt-5 pb-4 space-y-5">
        {/* Game Modes */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Choose a Mode
          </p>
          <div className="grid grid-cols-2 gap-3">
            {gameModes.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => setLocation(mode.href)}
                  className={`relative flex flex-col items-start p-4 rounded-2xl border ${mode.color} text-left active:scale-95 transition-transform`}
                >
                  <Icon size={26} className={`${mode.iconColor} mb-3`} />
                  <p className="text-gray-900 font-semibold text-sm leading-tight">{mode.label}</p>
                  <p className="text-gray-500 text-xs mt-0.5 leading-tight">{mode.description}</p>
                  <ChevronRight size={14} className="absolute top-4 right-4 text-gray-300" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Leaderboard shortcut */}
        <button
          onClick={() => setLocation("/leaderboard")}
          className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border border-amber-200 bg-amber-50 active:scale-95 transition-transform"
        >
          <div className="flex items-center gap-3">
            <Trophy size={20} className="text-amber-500" />
            <div className="text-left">
              <p className="text-gray-900 font-semibold text-sm">Leaderboard</p>
              <p className="text-gray-500 text-xs">See where you rank</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-gray-300" />
        </button>
      </div>
    </div>
  );
}
