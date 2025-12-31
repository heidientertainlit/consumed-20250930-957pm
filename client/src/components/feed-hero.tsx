import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Play, Flame, Trophy, Swords, ChevronRight, Zap } from "lucide-react";
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

  if (variant === "header") {
    return (
      <div className="space-y-3">
        <Link href="/play?tab=trivia">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 text-white cursor-pointer hover:bg-white/15 transition-all" data-testid="daily-challenge-card">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={16} className="text-yellow-300" />
                  <span className="text-xs font-medium text-purple-200 uppercase tracking-wide">Daily Challenge</span>
                </div>
                <h3 className="text-lg font-bold">{dailyChallenge.icon} {dailyChallenge.title}</h3>
                <p className="text-purple-200 text-sm mt-1">Test your {dailyChallenge.category?.toLowerCase() || 'entertainment'} knowledge</p>
              </div>
              <div className="bg-purple-500 rounded-full p-3 hover:bg-purple-400 transition-colors">
                <Play size={24} fill="white" className="text-white" />
              </div>
            </div>
          </div>
        </Link>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-3 text-center" data-testid="streak-card">
            <div className="flex flex-col items-center gap-1">
              <Flame size={20} className="text-orange-400" />
              <p className="text-xl font-bold text-white">{streak}</p>
              <p className="text-xs text-purple-200">day streak</p>
            </div>
          </div>

          <Link href="/leaderboard">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-3 text-center cursor-pointer hover:bg-white/15 transition-all" data-testid="leaderboard-card">
              <div className="flex flex-col items-center gap-1">
                <Trophy size={20} className="text-yellow-400" />
                <p className="text-sm font-semibold text-white">Rankings</p>
                <p className="text-xs text-purple-200">View all</p>
              </div>
            </div>
          </Link>

          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-3 text-center cursor-pointer hover:bg-white/15 transition-all" data-testid="friend-challenge-card">
            <div className="flex flex-col items-center gap-1">
              <Swords size={20} className="text-pink-400" />
              <p className="text-sm font-semibold text-white">Challenge</p>
              <p className="text-xs text-purple-200">Friends</p>
            </div>
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
              <p className="text-purple-200 text-sm mt-1">Test your {dailyChallenge.category?.toLowerCase() || 'entertainment'} knowledge</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3 hover:bg-white/30 transition-colors">
              <Play size={24} fill="white" className="text-white" />
            </div>
          </div>
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm" data-testid="streak-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
              <Flame size={20} className="text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{streak}</p>
              <p className="text-xs text-gray-500">day streak</p>
            </div>
          </div>
        </div>

        <Link href="/leaderboard">
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm cursor-pointer hover:border-purple-200 transition-colors" data-testid="leaderboard-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                <Trophy size={20} className="text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">Leaderboard</p>
                <p className="text-xs text-gray-500">See rankings</p>
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
