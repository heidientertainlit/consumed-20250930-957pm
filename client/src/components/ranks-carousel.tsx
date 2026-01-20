import { useState, useRef } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Trophy, ChevronLeft, ChevronRight, Loader2, ThumbsUp, ThumbsDown } from 'lucide-react';

interface RankItem {
  id: string;
  position: number;
  title: string;
  media_type: string;
  image_url?: string;
  up_vote_count: number;
  down_vote_count: number;
}

interface RankData {
  id: string;
  title: string;
  description?: string;
  category: string;
  items: RankItem[];
}

interface RanksCarouselProps {
  expanded?: boolean;
}

export function RanksCarousel({ expanded = false }: RanksCarouselProps) {
  const { session } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data: ranks, isLoading } = useQuery({
    queryKey: ['consumed-ranks-carousel'],
    queryFn: async () => {
      const { data: ranksData, error: ranksError } = await supabase
        .from('ranks')
        .select('*')
        .eq('origin_type', 'consumed')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false });
      
      if (ranksError) throw ranksError;
      
      const ranksWithItems: RankData[] = [];
      
      for (const rank of ranksData || []) {
        const { data: items } = await supabase
          .from('rank_items')
          .select('*')
          .eq('rank_id', rank.id)
          .order('position', { ascending: true })
          .limit(5);
        
        ranksWithItems.push({
          id: rank.id,
          title: rank.title,
          description: rank.description,
          category: rank.category,
          items: items || []
        });
      }
      
      return ranksWithItems;
    },
    enabled: !!session?.access_token
  });

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current || !ranks) return;
    const newIndex = direction === 'left' 
      ? Math.max(0, currentIndex - 1)
      : Math.min(ranks.length - 1, currentIndex + 1);
    setCurrentIndex(newIndex);
    
    const cardWidth = scrollRef.current.offsetWidth;
    scrollRef.current.scrollTo({
      left: newIndex * cardWidth,
      behavior: 'smooth'
    });
  };

  if (isLoading) {
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3 px-1">
          <Trophy className="w-5 h-5 text-purple-400" />
          <span className="text-white font-semibold text-sm">Consumed Rankings</span>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (!ranks || ranks.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-purple-400" />
          <span className="text-white font-semibold text-sm">Consumed Rankings</span>
          <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
            {ranks.length}
          </span>
        </div>
        <Link href="/ranks" className="text-purple-400 text-xs hover:underline">
          See all
        </Link>
      </div>

      <div className="relative">
        {currentIndex > 0 && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/60 hover:bg-black/80 rounded-full p-1.5 text-white"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        
        {ranks && currentIndex < ranks.length - 1 && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/60 hover:bg-black/80 rounded-full p-1.5 text-white"
          >
            <ChevronRight size={18} />
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {ranks.map((rank) => (
            <Card
              key={rank.id}
              className="flex-shrink-0 w-full snap-center bg-gradient-to-br from-slate-800/90 to-purple-900/40 border-purple-500/30 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-purple-600 p-1 rounded">
                  <Trophy className="w-4 h-4 text-white" />
                </div>
                <span className="text-purple-300 text-xs font-medium">Consumed</span>
                <span className="text-gray-500 text-xs">shared a ranked list</span>
              </div>

              <h3 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-purple-400" />
                {rank.title}
              </h3>

              <div className="space-y-2 mb-3">
                {rank.items.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 bg-white/5 rounded-lg p-2"
                  >
                    <div className={`w-7 h-7 rounded flex items-center justify-center text-sm font-bold ${
                      item.position === 1 ? 'bg-amber-500 text-black' :
                      item.position === 2 ? 'bg-gray-400 text-black' :
                      'bg-amber-700 text-white'
                    }`}>
                      {item.position}
                    </div>
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-8 h-10 object-cover rounded"
                      />
                    )}
                    <span className="text-white text-sm font-medium flex-1 truncate">
                      {item.title}
                    </span>
                    <div className="flex items-center gap-2 text-gray-400 text-xs">
                      <span className="flex items-center gap-0.5">
                        <ThumbsUp size={12} /> {item.up_vote_count}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <ThumbsDown size={12} /> {item.down_vote_count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {rank.items.length > 3 && (
                <Link
                  href={`/rank/${rank.id}`}
                  className="text-purple-400 text-sm hover:underline block text-center"
                >
                  Show all {rank.items.length} items
                </Link>
              )}
            </Card>
          ))}
        </div>

        {ranks.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-3">
            {ranks.map((_, idx) => (
              <div
                key={idx}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  idx === currentIndex ? 'bg-purple-400' : 'bg-gray-600'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
