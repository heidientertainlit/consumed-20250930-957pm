import { useRef, useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Gamepad2, Brain, Vote, Target, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface GameItem {
  id: string;
  title: string;
  type: 'trivia' | 'vote' | 'predict';
  category?: string;
  pointsReward: number;
  icon: string;
}

const typeIcons: Record<string, any> = {
  trivia: Brain,
  vote: Vote,
  predict: Target
};

const typeColors: Record<string, string> = {
  trivia: 'from-purple-600 to-indigo-600',
  vote: 'from-blue-600 to-cyan-600',
  predict: 'from-green-600 to-emerald-600'
};

export function GeneralPlayCarousel() {
  const { session } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: games, isLoading } = useQuery({
    queryKey: ['general-play-carousel'],
    queryFn: async () => {
      const { data: pools, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('status', 'open')
        .in('type', ['trivia', 'vote', 'predict'])
        .order('created_at', { ascending: false })
        .limit(30);
      
      if (error) throw error;
      
      const uniqueTitles = new Map<string, any>();
      for (const pool of (pools || [])) {
        if (!uniqueTitles.has(pool.title) && pool.options?.length >= 2) {
          uniqueTitles.set(pool.title, pool);
        }
      }
      
      const items: GameItem[] = Array.from(uniqueTitles.values()).slice(0, 10).map(pool => ({
        id: pool.id,
        title: pool.title,
        type: pool.type,
        category: pool.category,
        pointsReward: pool.points_reward || 5,
        icon: pool.icon || 'gamepad'
      }));
      
      return items;
    },
    enabled: !!session?.access_token
  });

  const scrollToNext = () => {
    if (scrollRef.current && games && currentIndex < games.length - 1) {
      const cardWidth = 180;
      scrollRef.current.scrollBy({ left: cardWidth + 12, behavior: 'smooth' });
      setCurrentIndex(prev => Math.min(prev + 1, games.length - 1));
    }
  };

  const scrollToPrev = () => {
    if (scrollRef.current && currentIndex > 0) {
      const cardWidth = 180;
      scrollRef.current.scrollBy({ left: -(cardWidth + 12), behavior: 'smooth' });
      setCurrentIndex(prev => Math.max(prev - 1, 0));
    }
  };

  if (!session) return null;
  if (isLoading) {
    return (
      <Card className="bg-gradient-to-r from-slate-800 to-slate-700 border-0 rounded-2xl p-4 shadow-lg mb-4">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-white" />
        </div>
      </Card>
    );
  }
  if (!games || games.length === 0) return null;

  return (
    <Card className="bg-gradient-to-r from-slate-800 to-slate-700 border-0 rounded-2xl p-4 shadow-lg mb-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            <Gamepad2 className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">More Games</p>
            <p className="text-[10px] text-white/70">Play and earn points</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {currentIndex > 0 && (
            <button onClick={scrollToPrev} className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30">
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
          )}
          {games && currentIndex < games.length - 3 && (
            <button onClick={scrollToNext} className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30">
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
        {games.map((game) => {
          const Icon = typeIcons[game.type] || Gamepad2;
          const gradientColor = typeColors[game.type] || 'from-purple-600 to-indigo-600';
          
          return (
            <Link key={game.id} href={`/play?game=${game.id}`}>
              <div className={`flex-shrink-0 w-44 rounded-xl bg-gradient-to-br ${gradientColor} p-3 cursor-pointer hover:scale-[1.02] transition-transform`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon className="w-3.5 h-3.5 text-white/80" />
                  <span className="text-[10px] text-white/80 uppercase font-medium">{game.type}</span>
                </div>
                <p className="text-white text-sm font-medium line-clamp-2 leading-tight mb-2">{game.title}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/60">{game.category || 'General'}</span>
                  <span className="text-xs text-white font-bold">+{game.pointsReward}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <Link href="/play">
        <div className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-white/20 cursor-pointer hover:opacity-80">
          <Gamepad2 className="w-3.5 h-3.5 text-white/80" />
          <span className="text-xs text-white/80 font-medium">See all games</span>
          <ChevronRight className="w-3.5 h-3.5 text-white/80" />
        </div>
      </Link>
    </Card>
  );
}
