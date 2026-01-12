import { useQuery } from '@tanstack/react-query';
import { Trophy, ChevronRight } from 'lucide-react';
import { Link } from 'wouter';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarUrl?: string;
  points: number;
  isCurrentUser: boolean;
}

interface LeaderboardFeedCardProps {
  className?: string;
}

export default function LeaderboardFeedCard({ className }: LeaderboardFeedCardProps) {
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url')
        .eq('auth_id', user.id)
        .single();
      return profile;
    },
  });

  const { data: session } = useQuery({
    queryKey: ['session-for-leaderboard'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    },
  });

  const { data: leaderboard = [], isLoading } = useQuery({
    queryKey: ['weekly-leaderboard-feed', session?.access_token],
    queryFn: async () => {
      if (!session?.access_token) return [];
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-leaderboards?category=all&scope=global&period=week`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      const data = await response.json();
      // Use trivia category or overall for the feed card
      return data?.categories?.trivia || data?.categories?.overall || [];
    },
    enabled: !!session?.access_token,
  });

  const entries: LeaderboardEntry[] = (leaderboard || []).map((entry: any, index: number) => ({
    rank: entry.rank || index + 1,
    userId: entry.user_id || entry.id,
    username: entry.display_name || entry.username || 'Unknown',
    avatarUrl: entry.avatar_url,
    points: entry.score || entry.total_points || entry.points || 0,
    isCurrentUser: currentUser?.id === (entry.user_id || entry.id),
  }));

  const top3 = entries.slice(0, 3);
  const currentUserEntry = entries.find(e => e.isCurrentUser);
  const currentUserRank = currentUserEntry?.rank || 0;
  const userAbove = currentUserRank > 1 ? entries[currentUserRank - 2] : null;
  const pointsToNextRank = userAbove ? userAbove.points - (currentUserEntry?.points || 0) : 0;

  if (isLoading) {
    return (
      <div className={cn("bg-gradient-to-b from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-200/50", className)}>
        <div className="animate-pulse">
          <div className="h-5 bg-amber-200/50 rounded w-1/3 mb-4" />
          <div className="space-y-3">
            <div className="h-12 bg-amber-200/30 rounded-xl" />
            <div className="h-12 bg-amber-200/30 rounded-xl" />
            <div className="h-12 bg-amber-200/30 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (top3.length === 0) return null;

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-amber-400 text-amber-900';
      case 2: return 'bg-gray-300 text-gray-700';
      case 3: return 'bg-orange-300 text-orange-800';
      default: return 'bg-gray-200 text-gray-600';
    }
  };

  return (
    <div className={cn(
      "bg-gradient-to-b from-amber-50 to-orange-50 rounded-2xl border border-amber-200/50 overflow-hidden",
      className
    )}>
      <div className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="text-amber-500" size={18} />
            <span className="font-semibold text-gray-800 text-sm">WEEKLY LEADERBOARD</span>
          </div>
          <Link href="/leaderboard" className="text-purple-600 text-sm font-medium flex items-center gap-0.5 hover:underline">
            View All <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      <div className="px-4 pb-3 space-y-2">
        {top3.map((entry) => (
          <div 
            key={entry.userId}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl transition-colors",
              entry.isCurrentUser 
                ? "bg-purple-100 border border-purple-200" 
                : "bg-white/60"
            )}
          >
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold",
              getRankBadgeColor(entry.rank)
            )}>
              {entry.rank}
            </div>
            
            <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
              {entry.avatarUrl ? (
                <img src={entry.avatarUrl} alt={entry.username} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg">
                  👤
                </div>
              )}
            </div>
            
            <span className={cn(
              "flex-1 font-medium truncate",
              entry.isCurrentUser ? "text-purple-700" : "text-gray-800"
            )}>
              {entry.isCurrentUser ? 'You' : entry.username}
            </span>
            
            <span className="font-semibold text-gray-700">
              {entry.points.toLocaleString()} XP
            </span>
          </div>
        ))}
      </div>

      {currentUserEntry && currentUserRank > 1 && pointsToNextRank > 0 && (
        <div className="px-4 pb-4 text-center">
          <p className="text-gray-600 text-sm">
            You're <span className="font-semibold text-purple-600">{pointsToNextRank.toLocaleString()} XP</span> away from #{currentUserRank - 1}! 🚀
          </p>
        </div>
      )}
    </div>
  );
}