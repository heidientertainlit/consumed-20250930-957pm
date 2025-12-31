import { Link } from "wouter";
import { ChevronRight, Flame, Trophy, Swords } from "lucide-react";
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
  };

  const streak = userStats?.dayStreak || 0;

  if (variant === "header") {
    return (
      <div className="space-y-6">
        {/* Minimal Hero */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">consumed</h1>
          <p className="text-purple-200 text-sm">
            Where entertainment gets played
          </p>
          <p className="text-purple-300/80 text-xs mt-1">
            Trivia, predictions, and rankings with friends.
          </p>
        </div>

        {/* Editorial Daily Challenge */}
        <Link href="/play?tab=trivia">
          <div className="text-center cursor-pointer group" data-testid="daily-challenge-card">
            <p className="text-[10px] font-medium text-purple-300 uppercase tracking-widest mb-1">
              Daily Challenge
            </p>
            <p className="text-white font-medium group-hover:text-purple-200 transition-colors inline-flex items-center gap-1">
              {dailyChallenge.title}
              <ChevronRight size={16} className="text-purple-300" />
            </p>
          </div>
        </Link>

        {/* Your Play - Quiet tools section */}
        <div className="pt-4 border-t border-white/10">
          <p className="text-[10px] font-medium text-purple-400 uppercase tracking-widest mb-3">
            Your Play
          </p>
          <div className="flex items-center justify-between text-sm text-purple-200">
            <span className="flex items-center gap-1.5">
              <span className="text-purple-300">{streak}</span> day streak
            </span>
            <span className="text-purple-400">•</span>
            <Link href="/leaderboard">
              <span className="hover:text-white transition-colors cursor-pointer">Rankings</span>
            </Link>
            <span className="text-purple-400">•</span>
            <span className="hover:text-white transition-colors cursor-pointer">Challenge friends</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Minimal Hero */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">consumed</h1>
        <p className="text-gray-600 text-sm">
          Where entertainment gets played
        </p>
        <p className="text-gray-500 text-xs mt-1">
          Trivia, predictions, and rankings with friends.
        </p>
      </div>

      {/* Editorial Daily Challenge */}
      <Link href="/play?tab=trivia">
        <div className="text-center cursor-pointer group" data-testid="daily-challenge-card">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest mb-1">
            Daily Challenge
          </p>
          <p className="text-gray-900 font-medium group-hover:text-purple-700 transition-colors inline-flex items-center gap-1">
            {dailyChallenge.title}
            <ChevronRight size={16} className="text-gray-400 group-hover:text-purple-500" />
          </p>
        </div>
      </Link>

      {/* Your Play - Quiet tools section */}
      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest mb-3">
          Your Play
        </p>
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span className="flex items-center gap-1.5">
            <span className="font-medium text-gray-900">{streak}</span> day streak
          </span>
          <span className="text-gray-300">•</span>
          <Link href="/leaderboard">
            <span className="hover:text-purple-700 transition-colors cursor-pointer">Rankings</span>
          </Link>
          <span className="text-gray-300">•</span>
          <span className="hover:text-purple-700 transition-colors cursor-pointer">Challenge friends</span>
        </div>
      </div>
    </div>
  );
}
