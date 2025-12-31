import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Play, Flame, Trophy, Swords, ChevronRight, Zap, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";

interface FeedHeroProps {
  onPlayChallenge?: () => void;
  variant?: "default" | "header";
}

export default function FeedHero({ onPlayChallenge, variant = "default" }: FeedHeroProps) {
  const { session, user } = useAuth();

  const { data: userStats } = useQuery<any>({
    queryKey: ['user-stats', user?.id],
    queryFn: async () => {
      if (!session?.access_token) return null;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/get-user-stats`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!session?.access_token && !!user?.id,
  });

  const { data: triviaData } = useQuery<any>({
    queryKey: ['daily-trivia'],
    queryFn: async () => {
      if (!session?.access_token) return null;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/gaming-search?category=trivia&limit=1`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!session?.access_token,
  });

  const dailyChallenge = triviaData?.games?.[0] || {
    title: "90s Movie Trivia",
    category: "Movies",
    icon: "🎬",
  };

  const streak = userStats?.dayStreak || 0;
  const totalPoints = userStats?.totalPoints || 0;
  
  // Calculate percentile based on points (psychological framing)
  const getPercentile = (points: number) => {
    if (points >= 1000) return "Top 5%";
    if (points >= 500) return "Top 10%";
    if (points >= 200) return "Top 20%";
    if (points >= 100) return "Top 30%";
    if (points >= 50) return "Top 40%";
    if (points >= 20) return "Top 50%";
    return "Rising";
  };
  
  const percentile = getPercentile(totalPoints);
  
  // Motivating message based on current standing
  const getMotivatingMessage = () => {
    if (totalPoints < 20) return "Play to start climbing";
    if (totalPoints < 50) return "Play to rise in your circle";
    if (totalPoints < 100) return "Play to pass 2 friends";
    if (totalPoints < 200) return "Play to break Top 30%";
    if (totalPoints < 500) return "Play to reach Top 20%";
    return "Play to stay on top";
  };
  
  const motivatingMessage = getMotivatingMessage();

  if (variant === "header") {
    return (
      <div className="space-y-4">
        <Link href="/play?tab=trivia">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-white cursor-pointer hover:bg-white/10 transition-all" data-testid="daily-challenge-card">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <span className="text-xs font-medium text-purple-300 uppercase tracking-wide">Daily Challenge</span>
                <h3 className="text-base font-semibold mt-1">{dailyChallenge.title}</h3>
                <p className="text-purple-300 text-xs mt-1">{motivatingMessage}</p>
              </div>
              <div className="text-purple-300 hover:text-white transition-colors">
                <Play size={28} fill="currentColor" />
              </div>
            </div>
          </div>
        </Link>

        <div className="flex items-center justify-around text-center">
          <div className="flex flex-col items-center" data-testid="points-card">
            <div className="flex items-center gap-1.5 text-white">
              <span className="text-lg font-bold">{totalPoints.toLocaleString()}</span>
            </div>
            <p className="text-xs text-purple-300 mt-0.5">total points</p>
          </div>

          <div className="w-px h-8 bg-white/20" />

          <Link href="/leaderboard">
            <div className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity" data-testid="leaderboard-card">
              <div className="flex items-center gap-1.5 text-white">
                <span className="text-sm font-semibold">{percentile}</span>
              </div>
              <p className="text-xs text-purple-300 mt-0.5">in your circle</p>
            </div>
          </Link>

          <div className="w-px h-8 bg-white/20" />

          <div className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity" data-testid="friend-challenge-card">
            <div className="flex items-center gap-1.5 text-white">
              <span className="text-sm font-semibold">Challenge</span>
            </div>
            <p className="text-xs text-purple-300 mt-0.5">Friends</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Link href="/play?tab=trivia">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-4 text-white shadow-lg cursor-pointer hover:shadow-xl transition-shadow" data-testid="daily-challenge-card">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={16} className="text-yellow-300" />
                <span className="text-xs font-medium text-purple-200 uppercase tracking-wide">Daily Challenge</span>
              </div>
              <h3 className="text-lg font-bold">{dailyChallenge.icon} {dailyChallenge.title}</h3>
              <p className="text-purple-200 text-sm mt-1">{motivatingMessage}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3 hover:bg-white/30 transition-colors">
              <Play size={24} fill="white" className="text-white" />
            </div>
          </div>
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm" data-testid="points-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
              <span className="text-purple-600 font-bold text-sm">pts</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalPoints.toLocaleString()}</p>
              <p className="text-xs text-gray-500">total points</p>
            </div>
          </div>
        </div>

        <Link href="/leaderboard">
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm cursor-pointer hover:border-purple-200 transition-colors" data-testid="leaderboard-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                <TrendingUp size={20} className="text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{percentile}</p>
                <p className="text-xs text-gray-500">in your circle</p>
              </div>
              <ChevronRight size={16} className="text-gray-400" />
            </div>
          </div>
        </Link>
      </div>

      <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-4 border border-pink-100" data-testid="friend-challenge-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
            <Swords size={20} className="text-pink-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Challenge a friend</p>
            <p className="text-xs text-gray-500">Create a trivia or prediction battle</p>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </div>
      </div>
    </div>
  );
}
