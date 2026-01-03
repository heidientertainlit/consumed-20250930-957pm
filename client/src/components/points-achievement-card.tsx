import { useQuery } from '@tanstack/react-query';
import { Trophy, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';

interface PointsAchievement {
  userId: string;
  userName: string;
  displayName?: string;
  profileImage?: string;
  pointsToday: number;
}

interface PointsAchievementCardProps {
  className?: string;
}

export default function PointsAchievementCard({ className }: PointsAchievementCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
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
      
      return userIds
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
        .sort((a, b) => b.pointsToday - a.pointsToday)
        .slice(0, 10) as PointsAchievement[];
    },
    staleTime: 60000,
  });

  if (isLoading || achievements.length === 0) {
    return null;
  }

  const currentAchiever = achievements[currentIndex];
  if (!currentAchiever) return null;

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < achievements.length - 1;

  return (
    <div className={cn("bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-200 p-3 relative", className)} data-testid="points-achievement-card">
      {canGoPrev && (
        <button
          onClick={() => setCurrentIndex(i => i - 1)}
          className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/80 shadow flex items-center justify-center hover:bg-white"
          data-testid="points-nav-prev"
        >
          <ChevronLeft size={14} className="text-gray-600" />
        </button>
      )}
      {canGoNext && (
        <button
          onClick={() => setCurrentIndex(i => i + 1)}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/80 shadow flex items-center justify-center hover:bg-white"
          data-testid="points-nav-next"
        >
          <ChevronRight size={14} className="text-gray-600" />
        </button>
      )}
      
      <div className="flex items-center gap-3 px-4">
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Trophy size={16} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-sm flex-wrap">
            <Link href={`/profile/${currentAchiever.userId}`} className="font-semibold text-gray-900 hover:underline truncate">
              {currentAchiever.displayName || currentAchiever.userName}
            </Link>
            <span className="text-gray-600">earned</span>
            <span className="font-bold text-amber-600">{currentAchiever.pointsToday} pts</span>
            <span className="text-gray-600">today</span>
          </div>
        </div>
      </div>
    </div>
  );
}
