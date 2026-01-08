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

  const { data: dailyChallengeData } = useQuery<any>({
    queryKey: ['daily-challenge'],
    queryFn: async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/daily-challenge`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}` 
        },
        body: JSON.stringify({ action: 'getToday' })
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.challenge || null;
    },
  });

  const dailyChallenge = dailyChallengeData || {
    title: "Daily Challenge",
    category: "Play",
    icon: "🎯",
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
    return "New";
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
        <Link href="/play">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-white cursor-pointer hover:bg-white/10 transition-all" data-testid="daily-challenge-card">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <span className="text-xs font-medium text-purple-300 uppercase tracking-wide">Daily Challenge</span>
                <h3 className="text-base font-semibold mt-1">{dailyChallenge.icon} {dailyChallenge.title}</h3>
              </div>
              <div className="text-purple-300 hover:text-white transition-colors">
                <Play size={28} fill="currentColor" />
              </div>
            </div>
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Link href="/play">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-4 text-white shadow-lg cursor-pointer hover:shadow-xl transition-shadow" data-testid="daily-challenge-card">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={16} className="text-yellow-300" />
                <span className="text-xs font-medium text-purple-200 uppercase tracking-wide">Daily Challenge</span>
              </div>
              <h3 className="text-lg font-bold">{dailyChallenge.icon} {dailyChallenge.title}</h3>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3 hover:bg-white/30 transition-colors">
              <Play size={24} fill="white" className="text-white" />
            </div>
          </div>
        </div>
      </Link>


    </div>
  );
}
