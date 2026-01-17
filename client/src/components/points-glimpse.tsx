import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Zap, TrendingUp, Trophy } from 'lucide-react';

interface PointsActivity {
  user_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  points_today: number;
}

export function PointsGlimpse() {
  const { session, user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['points-glimpse'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: activities, error } = await supabase
        .from('user_predictions')
        .select(`
          user_id,
          points_earned,
          created_at,
          user:profiles!user_predictions_user_id_fkey(username, display_name, avatar_url)
        `)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      const userPoints = new Map<string, PointsActivity>();
      for (const activity of (activities || [])) {
        const userId = activity.user_id;
        const userData = Array.isArray(activity.user) ? activity.user[0] : activity.user;
        
        if (!userPoints.has(userId)) {
          userPoints.set(userId, {
            user_id: userId,
            username: userData?.username || 'Unknown',
            display_name: userData?.display_name,
            avatar_url: userData?.avatar_url,
            points_today: 0
          });
        }
        
        const existing = userPoints.get(userId)!;
        existing.points_today += activity.points_earned || 0;
      }
      
      const sorted = Array.from(userPoints.values())
        .filter(u => u.user_id !== user?.id)
        .sort((a, b) => b.points_today - a.points_today)
        .slice(0, 3);
      
      return sorted;
    },
    enabled: !!session?.access_token
  });

  if (!session || isLoading || !data || data.length === 0) return null;

  const topScorer = data[0];
  
  return (
    <Card className="bg-gradient-to-r from-green-500 to-emerald-500 border-0 rounded-2xl p-4 shadow-lg mb-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          {topScorer.avatar_url ? (
            <img src={topScorer.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            <span className="text-white font-bold">
              {(topScorer.display_name || topScorer.username)[0].toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-300 fill-yellow-300" />
            <span className="text-white font-semibold text-sm">
              {topScorer.display_name || topScorer.username} scored {topScorer.points_today} today!
            </span>
          </div>
          <p className="text-white/70 text-xs mt-0.5">Play more to beat them</p>
        </div>
        <Link href="/play">
          <button className="px-3 py-1.5 bg-white/20 rounded-full text-white text-xs font-medium hover:bg-white/30 transition-colors">
            Play Now
          </button>
        </Link>
      </div>
    </Card>
  );
}
