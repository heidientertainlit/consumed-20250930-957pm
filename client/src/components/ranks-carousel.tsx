import { useState, useRef } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { BarChart3, ChevronLeft, ChevronRight, Loader2, ChevronUp, ChevronDown } from 'lucide-react';

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

  const scrollToNext = () => {
    if (scrollRef.current && ranks && currentIndex < ranks.length - 1) {
      const cardWidth = scrollRef.current.children[0]?.clientWidth || 280;
      scrollRef.current.scrollBy({ left: cardWidth + 12, behavior: 'smooth' });
      setCurrentIndex(prev => Math.min(prev + 1, ranks.length - 1));
    }
  };

  const scrollToPrev = () => {
    if (scrollRef.current && currentIndex > 0) {
      const cardWidth = scrollRef.current.children[0]?.clientWidth || 280;
      scrollRef.current.scrollBy({ left: -(cardWidth + 12), behavior: 'smooth' });
      setCurrentIndex(prev => Math.max(prev - 1, 0));
    }
  };

  const handleScroll = () => {
    if (scrollRef.current && ranks) {
      const cardWidth = scrollRef.current.children[0]?.clientWidth || 280;
      const scrollLeft = scrollRef.current.scrollLeft;
      const newIndex = Math.round(scrollLeft / (cardWidth + 12));
      setCurrentIndex(Math.min(Math.max(newIndex, 0), ranks.length - 1));
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        </div>
      </Card>
    );
  }

  if (!ranks || ranks.length === 0) {
    return null;
  }

  return (
    <Card className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm overflow-hidden relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-purple-900 flex items-center justify-center">
            <BarChart3 className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Consumed Rankings</p>
            <p className="text-[10px] text-gray-500">Vote on the order</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {currentIndex > 0 && (
            <button
              onClick={scrollToPrev}
              className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
          )}
          {currentIndex < ranks.length - 1 && (
            <button
              onClick={scrollToNext}
              className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          )}
          <span className="text-xs text-gray-500 ml-1">
            {currentIndex + 1}/{ranks.length}
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-1 px-1"
      >
        {ranks.map((rank) => (
          <div key={rank.id} className="flex-shrink-0 w-full snap-center">
            <h3 className="text-gray-900 font-semibold text-base mb-3">
              {rank.title}
            </h3>

            <div className="space-y-2 mb-3">
              {rank.items.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 py-2 px-3 rounded-xl bg-gray-50 border border-gray-100"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold ${
                    item.position === 1 ? 'bg-gradient-to-br from-purple-600 to-purple-800 text-white' :
                    item.position === 2 ? 'bg-gradient-to-br from-purple-500 to-purple-700 text-white' :
                    'bg-gradient-to-br from-purple-400 to-purple-600 text-white'
                  }`}>
                    {item.position}
                  </div>
                  <span className="text-gray-900 font-medium flex-1 truncate text-sm">
                    {item.title}
                  </span>
                  <div className="flex items-center gap-2">
                    <button className="flex items-center gap-0.5 text-green-600 hover:text-green-700 transition-colors">
                      <ChevronUp size={16} strokeWidth={2.5} />
                      <span className="text-xs font-medium">{item.up_vote_count}</span>
                    </button>
                    <button className="flex items-center gap-0.5 text-red-500 hover:text-red-600 transition-colors">
                      <ChevronDown size={16} strokeWidth={2.5} />
                      <span className="text-xs font-medium">{item.down_vote_count}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {rank.items.length > 3 && (
              <Link
                href={`/rank/${rank.id}`}
                className="text-purple-600 text-sm hover:underline block text-center"
              >
                Show all {rank.items.length} items
              </Link>
            )}
          </div>
        ))}
      </div>

      {ranks.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {ranks.map((_, idx) => (
            <div
              key={idx}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                idx === currentIndex ? 'bg-purple-600' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
