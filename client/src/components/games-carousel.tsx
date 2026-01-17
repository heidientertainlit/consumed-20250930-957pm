import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Gamepad2, ChevronRight, Target, BarChart3, Brain, Trophy, Loader2 } from 'lucide-react';

interface GameItem {
  id: string;
  title: string;
  type: 'trivia' | 'vote' | 'predict';
  category?: string;
  points_reward: number;
  participants?: number;
}

const getGameIcon = (type: string) => {
  switch (type) {
    case 'trivia': return Brain;
    case 'vote': return BarChart3;
    case 'predict': return Target;
    default: return Gamepad2;
  }
};

const getGameLabel = (type: string) => {
  switch (type) {
    case 'trivia': return 'Trivia';
    case 'vote': return 'Poll';
    case 'predict': return 'Prediction';
    default: return 'Game';
  }
};

export function GamesCarousel() {
  const { session } = useAuth();

  const { data: games, isLoading } = useQuery({
    queryKey: ['games-carousel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prediction_pools')
        .select('id, title, type, category, points_reward, participants')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      const uniqueGames = new Map<string, GameItem>();
      for (const game of (data || [])) {
        if (!uniqueGames.has(game.title)) {
          uniqueGames.set(game.title, game as GameItem);
        }
      }
      
      return Array.from(uniqueGames.values()).slice(0, 6);
    },
    enabled: !!session?.access_token
  });

  if (!session || isLoading) return null;
  if (!games || games.length === 0) return null;

  return (
    <Card className="bg-gradient-to-r from-indigo-600 to-purple-600 border-0 rounded-2xl p-4 shadow-lg mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            <Gamepad2 className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">More Games</p>
            <p className="text-[10px] text-white/70">Play & earn points</p>
          </div>
        </div>
        <Link href="/play">
          <div className="flex items-center gap-1 text-white/80 hover:text-white cursor-pointer">
            <span className="text-xs font-medium">See All</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
        {games.map((game) => {
          const Icon = getGameIcon(game.type);
          return (
            <Link key={game.id} href="/play">
              <div className="flex-shrink-0 w-36 bg-white/15 rounded-xl p-3 cursor-pointer hover:bg-white/25 transition-colors">
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon className="w-3.5 h-3.5 text-white/80" />
                  <span className="text-[10px] text-white/70 font-medium">{getGameLabel(game.type)}</span>
                </div>
                <p className="text-sm text-white font-medium line-clamp-2 mb-2">{game.title}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/60">{game.category}</span>
                  <div className="flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-yellow-400" />
                    <span className="text-[10px] text-yellow-300 font-medium">+{game.points_reward}</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
