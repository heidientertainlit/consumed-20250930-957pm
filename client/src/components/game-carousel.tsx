import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Brain, Vote, Trophy, Gamepad2, X, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';
import SwipeableGameCards from './swipeable-game-cards';

interface Game {
  id: string;
  title: string;
  type: 'vote' | 'trivia' | 'predict';
  category?: string;
  media_title?: string;
}

interface GameCarouselProps {
  className?: string;
}

// Fisher-Yates shuffle with seed for consistent shuffling within session
function shuffleArray<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  let currentIndex = shuffled.length;
  let seededRandom = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  while (currentIndex > 0) {
    const randomIndex = Math.floor(seededRandom() * currentIndex);
    currentIndex--;
    [shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
  }
  return shuffled;
}

// Use session-based seed for consistent shuffling within page session
const sessionSeed = Math.floor(Date.now() / 60000); // Changes every minute

export default function GameCarousel({ className }: GameCarouselProps) {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);

  const { data: games = [], isLoading } = useQuery({
    queryKey: ['carousel-games'],
    queryFn: async () => {
      const { data: pools, error } = await supabase
        .from('prediction_pools')
        .select('id, title, type, category, media_title')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error('Failed to fetch games');
      // Shuffle games for variety
      return shuffleArray((pools || []) as Game[], sessionSeed);
    },
  });

  const { data: userPredictions = {} } = useQuery({
    queryKey: ['carousel-user-predictions'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {};
      const { data, error } = await supabase
        .from('user_predictions')
        .select('pool_id')
        .eq('user_id', user.id);
      if (error) return {};
      const predictions: Record<string, boolean> = {};
      data?.forEach((pred) => { predictions[pred.pool_id] = true; });
      return predictions;
    },
  });

  // Filter to only show curated Consumed content
  // MUST match SwipeableGameCards filtering to ensure clicked games are found
  const availableGames = games.filter((game) => {
    if (userPredictions[game.id]) return false;
    // Ensure game has required fields
    if (!game.id || !game.title || !game.type) return false;
    // Only show Consumed-curated content: official polls/predictions OR trivia
    if (!game.id.startsWith('consumed-') && game.type !== 'trivia') return false;
    return true;
  });

  const getGameIcon = (type: string) => {
    switch (type) {
      case 'trivia': return Brain;
      case 'vote': return Vote;
      case 'predict': return Trophy;
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

  const getGradient = (type: string) => {
    switch (type) {
      case 'trivia': return 'from-purple-500 to-indigo-600';
      case 'vote': return 'from-blue-500 to-purple-600';
      case 'predict': return 'from-indigo-500 to-blue-600';
      default: return 'from-purple-500 to-blue-600';
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    const container = document.getElementById('game-carousel-container');
    if (container) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (isLoading) {
    return (
      <div className={cn("bg-white rounded-2xl border border-gray-200 shadow-sm p-4", className)}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-3" />
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-shrink-0 w-28 h-40 bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (availableGames.length === 0) {
    return null;
  }

  return (
    <>
      <div className={cn("bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden", className)}>
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Gamepad2 className="text-purple-600" size={18} />
              <span className="font-semibold text-gray-900">Play</span>
              <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
                {availableGames.length} games
              </Badge>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => scroll('left')}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
                data-testid="button-scroll-left"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => scroll('right')}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
                data-testid="button-scroll-right"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>

        <div 
          id="game-carousel-container"
          className="flex gap-3 overflow-x-auto pb-4 px-4 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {availableGames.map((game, index) => {
            const Icon = getGameIcon(game.type);
            return (
              <button
                key={game.id}
                onClick={() => setSelectedGameId(game.id)}
                className="flex-shrink-0 w-28 group"
                data-testid={`game-card-${game.id}`}
              >
                <div className={cn(
                  "relative w-28 h-36 rounded-xl overflow-hidden mb-2 shadow-md group-hover:shadow-lg transition-shadow bg-gradient-to-br",
                  getGradient(game.type)
                )}>
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                    <Icon className="text-white mb-1" size={24} />
                    <span className="text-white text-xs font-semibold text-center line-clamp-2">
                      {game.title}
                    </span>
                  </div>
                  <Badge 
                    className="absolute top-1 right-1 bg-white/90 text-gray-700 text-[10px] px-1.5 py-0.5"
                  >
                    {getGameLabel(game.type)}
                  </Badge>
                </div>
              </button>
            );
          })}
          
          {/* Play more games link */}
          <Link 
            href="/play"
            className="flex-shrink-0 w-28 group"
            data-testid="link-play-more-games"
          >
            <div className="relative w-28 h-36 rounded-xl overflow-hidden mb-2 shadow-md group-hover:shadow-lg transition-shadow bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-dashed border-gray-300 group-hover:border-purple-400">
              <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                <ArrowRight className="text-purple-600 mb-1 group-hover:translate-x-1 transition-transform" size={24} />
                <span className="text-purple-600 text-xs font-semibold text-center">
                  Play more games
                </span>
              </div>
            </div>
          </Link>
        </div>
      </div>

      <Dialog open={selectedGameId !== null} onOpenChange={(open) => !open && setSelectedGameId(null)}>
        <DialogContent className="p-0 max-w-md border-0 bg-transparent shadow-none">
          <button
            onClick={() => setSelectedGameId(null)}
            className="absolute -top-10 right-0 text-white hover:text-gray-300 z-50"
            data-testid="button-close-game"
          >
            <X size={24} />
          </button>
          <SwipeableGameCards initialGameId={selectedGameId || undefined} />
        </DialogContent>
      </Dialog>
    </>
  );
}
