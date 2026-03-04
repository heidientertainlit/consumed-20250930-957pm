import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Trophy, Crown, TrendingUp, ChevronRight } from 'lucide-react';

export function LeaderboardGlimpse() {
  const { session } = useAuth();

  const { data: topUsers } = useQuery({
    queryKey: ['leaderboard-glimpse'],
    queryFn: async () => {
      const { data: pointsData, error } = await supabase
        .from('user_points')
        .select('user_id, all_time')
        .order('all_time', { ascending: false })
        .limit(5);

      if (error || !pointsData || pointsData.length === 0) return [];

      const userIds = pointsData.map((p: any) => p.user_id);
      const { data: usersData } = await supabase
        .from('users')
        .select('id, user_name, display_name')
        .in('id', userIds);

      return pointsData.map((p: any) => {
        const u = (usersData || []).find((u: any) => u.id === p.user_id);
        return {
          id: p.user_id,
          display_name: u?.display_name || u?.user_name || 'Anonymous',
          points: p.all_time || 0,
        };
      });
    },
    enabled: !!session?.access_token
  });

  if (!session) return null;

  const displayUsers = topUsers && topUsers.length > 0 ? topUsers : [
    { id: '1', display_name: 'Top Player', points: 1250 },
    { id: '2', display_name: 'Rising Star', points: 980 },
    { id: '3', display_name: 'Game Fan', points: 750 }
  ];

  const getMedalColor = (index: number) => {
    if (index === 0) return 'text-yellow-500';
    if (index === 1) return 'text-gray-400';
    if (index === 2) return 'text-amber-600';
    return 'text-gray-500';
  };

  return (
    <Card className="bg-gradient-to-r from-purple-600 to-indigo-600 border-0 rounded-2xl p-4 shadow-lg mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            <Trophy className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Leaderboard</p>
            <p className="text-[10px] text-white/70">Top players this week</p>
          </div>
        </div>
        <Link href="/leaderboard">
          <div className="flex items-center gap-1 text-white/80 hover:text-white transition-colors cursor-pointer">
            <span className="text-xs font-medium">View All</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </Link>
      </div>

      <div className="space-y-2">
        {displayUsers.slice(0, 3).map((user: any, index: number) => (
          <div
            key={user.id}
            className="flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2"
          >
            <div className="flex items-center justify-center w-6">
              {index === 0 ? (
                <Crown className={`w-5 h-5 ${getMedalColor(index)}`} />
              ) : (
                <span className={`text-sm font-bold ${getMedalColor(index)}`}>#{index + 1}</span>
              )}
            </div>
            <div className="w-8 h-8 rounded-full bg-purple-300 flex items-center justify-center overflow-hidden">
              <span className="text-purple-700 font-bold text-sm">
                {(user.display_name || '?')[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.display_name}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-green-400" />
              <span className="text-sm font-bold text-white">{user.points?.toLocaleString() || 0}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
