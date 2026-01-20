import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { BarChart3, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface RankItem {
  id: string;
  position: number;
  title: string;
  media_type: string;
  image_url?: string;
  up_vote_count: number;
  down_vote_count: number;
}

interface UserVote {
  rank_item_id: string;
  direction: 'up' | 'down';
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
  const { session, user } = useAuth();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedRanks, setExpandedRanks] = useState<Record<string, boolean>>({});

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
          .order('position', { ascending: true });
        
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

  const { data: userVotes } = useQuery({
    queryKey: ['rank-item-votes', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('rank_item_votes')
        .select('rank_item_id, direction')
        .eq('voter_id', user.id);
      return (data || []) as UserVote[];
    },
    enabled: !!user?.id
  });

  const voteMutation = useMutation({
    mutationFn: async ({ itemId, direction }: { itemId: string; direction: 'up' | 'down' }) => {
      if (!user?.id) throw new Error('Must be logged in');
      
      const existingVote = userVotes?.find(v => v.rank_item_id === itemId);
      
      if (existingVote) {
        if (existingVote.direction === direction) {
          await supabase.from('rank_item_votes').delete()
            .eq('rank_item_id', itemId)
            .eq('voter_id', user.id);
          
          const field = direction === 'up' ? 'up_vote_count' : 'down_vote_count';
          const { data: item } = await supabase.from('rank_items').select(field).eq('id', itemId).single();
          const currentCount = (item as any)?.[field] || 0;
          await supabase.from('rank_items').update({ [field]: Math.max(0, currentCount - 1) }).eq('id', itemId);
          
          return { action: 'removed', direction };
        } else {
          await supabase.from('rank_item_votes').update({ direction })
            .eq('rank_item_id', itemId)
            .eq('voter_id', user.id);
          
          const oldField = existingVote.direction === 'up' ? 'up_vote_count' : 'down_vote_count';
          const newField = direction === 'up' ? 'up_vote_count' : 'down_vote_count';
          
          const { data: item } = await supabase.from('rank_items').select('up_vote_count, down_vote_count').eq('id', itemId).single();
          const oldCount = (item as any)?.[oldField] || 0;
          const newCount = (item as any)?.[newField] || 0;
          
          await supabase.from('rank_items').update({ 
            [oldField]: Math.max(0, oldCount - 1),
            [newField]: newCount + 1 
          }).eq('id', itemId);
          
          return { action: 'changed', direction };
        }
      } else {
        await supabase.from('rank_item_votes').insert({
          rank_item_id: itemId,
          voter_id: user.id,
          direction
        });
        
        const field = direction === 'up' ? 'up_vote_count' : 'down_vote_count';
        const { data: item } = await supabase.from('rank_items').select(field).eq('id', itemId).single();
        const currentCount = (item as any)?.[field] || 0;
        await supabase.from('rank_items').update({ [field]: currentCount + 1 }).eq('id', itemId);
        
        return { action: 'added', direction };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['consumed-ranks-carousel'] });
      queryClient.invalidateQueries({ queryKey: ['rank-item-votes'] });
      
      const message = result.action === 'removed' 
        ? 'Vote removed' 
        : result.direction === 'up' 
          ? 'Voted to move up!' 
          : 'Voted to move down!';
      toast({ title: message });
    },
    onError: () => {
      toast({ title: 'Failed to vote', variant: 'destructive' });
    }
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

  const toggleExpanded = (rankId: string) => {
    setExpandedRanks(prev => ({
      ...prev,
      [rankId]: !prev[rankId]
    }));
  };

  const getUserVote = (itemId: string): 'up' | 'down' | null => {
    const vote = userVotes?.find(v => v.rank_item_id === itemId);
    return vote?.direction || null;
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
            <p className="text-sm font-semibold text-gray-900">Debate the Rank</p>
            <p className="text-[10px] text-gray-500">Vote to move items up or down</p>
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
        {ranks.map((rank) => {
          const isExpanded = expandedRanks[rank.id];
          const displayItems = isExpanded ? rank.items : rank.items.slice(0, 3);
          
          return (
            <div key={rank.id} className="flex-shrink-0 w-full snap-center">
              <h3 className="text-gray-900 font-semibold text-base mb-3">
                {rank.title}
              </h3>

              <div className="space-y-2 mb-3">
                {displayItems.map((item) => {
                  const userVote = getUserVote(item.id);
                  
                  return (
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
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => voteMutation.mutate({ itemId: item.id, direction: 'up' })}
                          disabled={voteMutation.isPending}
                          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                        >
                          <svg 
                            width="16" 
                            height="16" 
                            viewBox="0 0 24 24" 
                            className={userVote === 'up' ? 'text-green-600' : 'text-gray-400'}
                            fill={userVote === 'up' ? 'currentColor' : 'none'}
                            stroke="currentColor" 
                            strokeWidth="2"
                          >
                            <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M5 19h14" strokeLinecap="round" />
                          </svg>
                          <span className={`text-xs font-medium ${
                            item.up_vote_count > 0 ? 'text-green-600' : 'text-gray-400'
                          }`}>
                            {item.up_vote_count > 0 ? `+${item.up_vote_count}` : '+0'}
                          </span>
                        </button>
                        <button 
                          onClick={() => voteMutation.mutate({ itemId: item.id, direction: 'down' })}
                          disabled={voteMutation.isPending}
                          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                        >
                          <svg 
                            width="16" 
                            height="16" 
                            viewBox="0 0 24 24" 
                            className={userVote === 'down' ? 'text-red-500' : 'text-gray-400'}
                            fill={userVote === 'down' ? 'currentColor' : 'none'}
                            stroke="currentColor" 
                            strokeWidth="2"
                          >
                            <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M5 5h14" strokeLinecap="round" />
                          </svg>
                          <span className={`text-xs font-medium ${
                            item.down_vote_count > 0 ? 'text-red-500' : 'text-gray-400'
                          }`}>
                            {item.down_vote_count > 0 ? `-${item.down_vote_count}` : '-0'}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {rank.items.length > 3 && (
                <button
                  onClick={() => toggleExpanded(rank.id)}
                  className="text-purple-600 text-sm hover:underline block text-center w-full"
                >
                  {isExpanded ? 'Show less' : `Show all ${rank.items.length} items`}
                </button>
              )}
            </div>
          );
        })}
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
