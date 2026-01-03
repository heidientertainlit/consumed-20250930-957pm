import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';

interface PointsAchievement {
  userId: string;
  userName: string;
  displayName?: string;
  profileImage?: string;
  pointsToday: number;
  rank: number;
}

interface PointsAchievementCardProps {
  className?: string;
  cardIndex?: number;
}

export default function PointsAchievementCard({ className, cardIndex = 0 }: PointsAchievementCardProps) {
  const { data: achievements = [], isLoading } = useQuery({
    queryKey: ['points-achievements-today'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('user_predictions')
        .select('user_id, points_earned, created_at')
        .gte('created_at', today.toISOString())
        .gt('points_earned', 0);
      
      if (error) {
        console.error('Error fetching points:', error);
        return [];
      }
      
      const pointsByUser: Record<string, number> = {};
      (data || []).forEach((pred: any) => {
        if (pred.user_id && pred.points_earned) {
          pointsByUser[pred.user_id] = (pointsByUser[pred.user_id] || 0) + pred.points_earned;
        }
      });
      
      const userIds = Object.keys(pointsByUser).filter(id => pointsByUser[id] >= 2);
      if (userIds.length === 0) return [];
      
      const { data: users } = await supabase
        .from('users')
        .select('id, user_name, display_name, avatar')
        .in('id', userIds);
      
      const userMap = new Map((users || []).map((u: any) => [u.id, u]));
      
      const sorted = userIds
        .map(userId => {
          const user = userMap.get(userId) as any;
          return {
            userId,
            userName: user?.user_name || 'User',
            displayName: user?.display_name,
            profileImage: user?.avatar,
            pointsToday: pointsByUser[userId]
          };
        })
        .sort((a, b) => b.pointsToday - a.pointsToday);
      
      return sorted.map((a, idx) => ({ ...a, rank: idx + 1 })) as PointsAchievement[];
    },
    staleTime: 60000,
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: myPointsToday = 0 } = useQuery({
    queryKey: ['my-points-today', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data } = await supabase
        .from('user_predictions')
        .select('points_earned')
        .eq('user_id', currentUser.id)
        .gte('created_at', today.toISOString())
        .gt('points_earned', 0);
      
      return (data || []).reduce((sum, p) => sum + (p.points_earned || 0), 0);
    },
    enabled: !!currentUser?.id,
  });

  const selectedAchiever = useMemo(() => {
    if (achievements.length === 0) return null;
    const filteredAchievements = achievements.filter(a => a.userId !== currentUser?.id);
    if (filteredAchievements.length === 0) return null;
    const index = cardIndex % filteredAchievements.length;
    return filteredAchievements[index];
  }, [achievements, cardIndex, currentUser?.id]);

  if (isLoading || !selectedAchiever) {
    return null;
  }

  const pointsDiff = selectedAchiever.pointsToday - myPointsToday;
  const isAhead = myPointsToday > selectedAchiever.pointsToday;
  const isTied = myPointsToday === selectedAchiever.pointsToday;

  const getCompetitiveMessage = () => {
    if (isAhead) {
      return `You're ahead! Keep playing to stay on top`;
    } else if (isTied) {
      return `You're tied! Play to take the lead`;
    } else if (pointsDiff <= 10) {
      return `Earn ${pointsDiff} more pts to beat them`;
    } else {
      return `Play to climb the leaderboard`;
    }
  };

  return (
    <div className={cn("bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl border border-purple-200 p-3", className)} data-testid="points-achievement-card">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-sm">
          <Trophy size={14} className="text-purple-500" />
          <Link href={`/profile/${selectedAchiever.userId}`} className="font-semibold text-gray-900 hover:underline">
            {selectedAchiever.userName}
          </Link>
          <span className="text-gray-600">earned</span>
          <span className="font-bold text-purple-600">{selectedAchiever.pointsToday} pts</span>
          <span className="text-gray-600">today</span>
        </div>
        <Link 
          href="/play" 
          className="text-xs font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1"
          data-testid="points-cta-play"
        >
          {getCompetitiveMessage()} →
        </Link>
      </div>
    </div>
  );
}
