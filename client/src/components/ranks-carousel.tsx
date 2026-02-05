import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { trackEvent } from '@/lib/posthog';
import { BarChart3, ChevronLeft, ChevronRight, Loader2, ArrowUp, ArrowDown, Plus, X, MessageCircle, Send } from 'lucide-react';

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

interface VoteItemProps {
  item: RankItem;
  index: number;
  userVote: 'up' | 'down' | null;
  onVote: (itemId: string, direction: 'up' | 'down') => void;
  isVoting: boolean;
}

function VoteItem({ item, index, userVote, onVote, isVoting }: VoteItemProps) {
  return (
    <div className="flex items-center gap-2 py-2.5 px-3 rounded-xl bg-gray-50 border border-gray-100">
      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
        index === 0 ? 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white' :
        index === 1 ? 'bg-gradient-to-br from-teal-400 to-emerald-500 text-white' :
        'bg-gradient-to-br from-teal-300 to-emerald-400 text-white'
      }`}>
        {index + 1}
      </div>
      <span className="text-gray-900 font-medium flex-1 truncate text-sm">
        {item.title}
      </span>
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => onVote(item.id, 'up')}
          disabled={isVoting}
          className={`w-6 h-6 rounded-l flex items-center justify-center transition-colors ${
            userVote === 'up' 
              ? 'bg-teal-500 text-white' 
              : 'bg-gray-100 text-gray-500 hover:bg-teal-100 hover:text-teal-600'
          }`}
        >
          <ArrowUp size={14} strokeWidth={2.5} />
        </button>
        <div className="flex items-center bg-gray-100 px-1.5 py-1 text-[10px] font-medium">
          <span className="text-teal-600">+{item.up_vote_count || 0}</span>
          <span className="text-gray-400 mx-0.5">/</span>
          <span className="text-red-500">-{item.down_vote_count || 0}</span>
        </div>
        <button
          onClick={() => onVote(item.id, 'down')}
          disabled={isVoting}
          className={`w-6 h-6 rounded-r flex items-center justify-center transition-colors ${
            userVote === 'down' 
              ? 'bg-red-500 text-white' 
              : 'bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600'
          }`}
        >
          <ArrowDown size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

interface RankComment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: {
    display_name: string;
    user_name: string;
    avatar: string;
  };
}

interface RanksCarouselProps {
  expanded?: boolean;
  offset?: number;
}

export function RanksCarousel({ expanded = false, offset = 0 }: RanksCarouselProps) {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedRanks, setExpandedRanks] = useState<Record<string, boolean>>({});
  const [localRankings, setLocalRankings] = useState<Record<string, RankItem[]>>({});
  const [submittedRanks, setSubmittedRanks] = useState<Record<string, boolean>>({});
  const [addingToRank, setAddingToRank] = useState<string | null>(null);
  const [customAddInput, setCustomAddInput] = useState('');
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down' | null>>({});
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [rankComments, setRankComments] = useState<Record<string, RankComment[]>>({});

  const { data: ranks, isLoading } = useQuery({
    queryKey: ['consumed-ranks-carousel', offset],
    queryFn: async () => {
      const { data: ranksData, error: ranksError } = await supabase
        .from('ranks')
        .select('*')
        .eq('origin_type', 'consumed')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .range(offset * 3, (offset * 3) + 2);
      
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

  useEffect(() => {
    if (ranks && Object.keys(localRankings).length === 0) {
      const initial: Record<string, RankItem[]> = {};
      ranks.forEach(rank => {
        initial[rank.id] = [...rank.items];
      });
      setLocalRankings(initial);
    }
  }, [ranks]);

  const submitMutation = useMutation({
    mutationFn: async ({ rankId, items }: { rankId: string; items: RankItem[] }) => {
      if (!user?.id) throw new Error('Must be logged in');
      
      // Save user's complete order to user_rank_orders table
      const itemOrder = items.map(item => item.id);
      const { data: existingOrder } = await supabase
        .from('user_rank_orders')
        .select('id')
        .eq('user_id', user.id)
        .eq('rank_id', rankId)
        .single();
      
      if (existingOrder) {
        await supabase
          .from('user_rank_orders')
          .update({ item_order: itemOrder, updated_at: new Date().toISOString() })
          .eq('id', existingOrder.id);
      } else {
        await supabase.from('user_rank_orders').insert({
          user_id: user.id,
          rank_id: rankId,
          item_order: itemOrder
        });
      }
      
      // Also record individual up/down votes for aggregate scoring
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const originalPosition = ranks?.find(r => r.id === rankId)?.items.find(it => it.id === item.id)?.position || i + 1;
        
        if (i + 1 < originalPosition) {
          const existing = await supabase
            .from('rank_item_votes')
            .select('id')
            .eq('rank_item_id', item.id)
            .eq('voter_id', user.id)
            .single();
          
          if (existing.data) {
            await supabase.from('rank_item_votes')
              .update({ direction: 'up' })
              .eq('id', existing.data.id);
          } else {
            await supabase.from('rank_item_votes').insert({
              rank_item_id: item.id,
              voter_id: user.id,
              direction: 'up'
            });
            
            await supabase.from('rank_items')
              .update({ up_vote_count: (item.up_vote_count || 0) + 1 })
              .eq('id', item.id);
          }
        } else if (i + 1 > originalPosition) {
          const existing = await supabase
            .from('rank_item_votes')
            .select('id')
            .eq('rank_item_id', item.id)
            .eq('voter_id', user.id)
            .single();
          
          if (existing.data) {
            await supabase.from('rank_item_votes')
              .update({ direction: 'down' })
              .eq('id', existing.data.id);
          } else {
            await supabase.from('rank_item_votes').insert({
              rank_item_id: item.id,
              voter_id: user.id,
              direction: 'down'
            });
            
            await supabase.from('rank_items')
              .update({ down_vote_count: (item.down_vote_count || 0) + 1 })
              .eq('id', item.id);
          }
        }
      }
      
      return { rankId };
    },
    onSuccess: ({ rankId }) => {
      setSubmittedRanks(prev => ({ ...prev, [rankId]: true }));
      queryClient.invalidateQueries({ queryKey: ['consumed-ranks-carousel'] });
      trackEvent('rank_submitted', { rank_id: rankId });
    },
    onError: () => {
      console.error('Failed to submit rank');
    }
  });

  const voteMutation = useMutation({
    mutationFn: async ({ itemId, direction, rankId }: { itemId: string; direction: 'up' | 'down'; rankId: string }) => {
      if (!user?.id) throw new Error('Must be logged in');
      
      console.log('🗳️ Voting:', { itemId, direction, userId: user.id });
      
      const currentVote = userVotes[itemId];
      
      if (currentVote === direction) {
        console.log('🗳️ Removing existing vote');
        const { error: deleteError } = await supabase
          .from('rank_item_votes')
          .delete()
          .eq('rank_item_id', itemId)
          .eq('voter_id', user.id);
        
        if (deleteError) console.error('Delete vote error:', deleteError);
        
        const field = direction === 'up' ? 'up_vote_count' : 'down_vote_count';
        const { data: item, error: fetchError } = await supabase
          .from('rank_items')
          .select('up_vote_count, down_vote_count')
          .eq('id', itemId)
          .single();
        
        if (fetchError) console.error('Fetch item error:', fetchError);
        
        const newCount = Math.max(0, ((item as any)?.[field] || 1) - 1);
        const { error: updateError } = await supabase
          .from('rank_items')
          .update({ [field]: newCount })
          .eq('id', itemId);
        
        if (updateError) console.error('Update count error:', updateError);
        console.log('🗳️ Vote removed, new count:', newCount);
        
        return { itemId, direction: null as 'up' | 'down' | null, rankId };
      }
      
      const { data: existing, error: existingError } = await supabase
        .from('rank_item_votes')
        .select('id, direction')
        .eq('rank_item_id', itemId)
        .eq('voter_id', user.id)
        .maybeSingle();
      
      if (existingError) console.error('Fetch existing vote error:', existingError);
      console.log('🗳️ Existing vote:', existing);
      
      if (existing) {
        const oldDir = existing.direction as 'up' | 'down';
        const { error: updateVoteError } = await supabase
          .from('rank_item_votes')
          .update({ direction })
          .eq('id', existing.id);
        
        if (updateVoteError) console.error('Update vote error:', updateVoteError);
        
        const { data: item, error: fetchError } = await supabase
          .from('rank_items')
          .select('up_vote_count, down_vote_count')
          .eq('id', itemId)
          .single();
        
        if (fetchError) console.error('Fetch item error:', fetchError);
        
        const updates: Record<string, number> = {};
        if (oldDir === 'up') updates.up_vote_count = Math.max(0, (item?.up_vote_count || 1) - 1);
        if (oldDir === 'down') updates.down_vote_count = Math.max(0, (item?.down_vote_count || 1) - 1);
        if (direction === 'up') updates.up_vote_count = (updates.up_vote_count ?? item?.up_vote_count ?? 0) + 1;
        if (direction === 'down') updates.down_vote_count = (updates.down_vote_count ?? item?.down_vote_count ?? 0) + 1;
        
        const { error: updateError } = await supabase.from('rank_items').update(updates).eq('id', itemId);
        if (updateError) console.error('Update counts error:', updateError);
        console.log('🗳️ Changed vote from', oldDir, 'to', direction, 'new counts:', updates);
      } else {
        console.log('🗳️ Inserting new vote');
        const { error: insertError } = await supabase.from('rank_item_votes').insert({
          rank_item_id: itemId,
          voter_id: user.id,
          direction
        });
        
        if (insertError) console.error('Insert vote error:', insertError);
        
        const field = direction === 'up' ? 'up_vote_count' : 'down_vote_count';
        const { data: item, error: fetchError } = await supabase
          .from('rank_items')
          .select('up_vote_count, down_vote_count')
          .eq('id', itemId)
          .single();
        
        if (fetchError) console.error('Fetch item error:', fetchError);
        
        const newCount = ((item as any)?.[field] || 0) + 1;
        const { error: updateError } = await supabase
          .from('rank_items')
          .update({ [field]: newCount })
          .eq('id', itemId);
        
        if (updateError) console.error('Update count error:', updateError);
        console.log('🗳️ New vote inserted, new count:', newCount);
      }
      
      return { itemId, direction, rankId };
    },
    onMutate: async ({ itemId, direction, rankId }) => {
      await queryClient.cancelQueries({ queryKey: ['consumed-ranks-carousel'] });
      
      const previousRanks = queryClient.getQueryData(['consumed-ranks-carousel', offset]);
      
      setLocalRankings(prev => {
        const items = prev[rankId] || [];
        return {
          ...prev,
          [rankId]: items.map(item => {
            if (item.id !== itemId) return item;
            const currentVote = userVotes[itemId];
            let upDelta = 0;
            let downDelta = 0;
            
            if (currentVote === direction) {
              if (direction === 'up') upDelta = -1;
              else downDelta = -1;
            } else if (currentVote) {
              if (currentVote === 'up') upDelta = -1;
              else downDelta = -1;
              if (direction === 'up') upDelta += 1;
              else downDelta += 1;
            } else {
              if (direction === 'up') upDelta = 1;
              else downDelta = 1;
            }
            
            return {
              ...item,
              up_vote_count: Math.max(0, item.up_vote_count + upDelta),
              down_vote_count: Math.max(0, item.down_vote_count + downDelta)
            };
          })
        };
      });
      
      const newVote = userVotes[itemId] === direction ? null : direction;
      setUserVotes(prev => ({ ...prev, [itemId]: newVote }));
      
      return { previousRanks };
    },
    onSuccess: ({ itemId, direction }) => {
      queryClient.invalidateQueries({ queryKey: ['consumed-ranks-carousel'] });
      trackEvent('rank_item_voted', { item_id: itemId, direction });
      console.log('🗳️ Vote success:', { itemId, direction });
    },
    onError: (err, variables, context) => {
      console.error('Failed to vote:', err);
      if (context?.previousRanks) {
        queryClient.setQueryData(['consumed-ranks-carousel', offset], context.previousRanks);
      }
    }
  });

  const handleVote = (itemId: string, direction: 'up' | 'down', rankId: string) => {
    voteMutation.mutate({ itemId, direction, rankId });
  };

  const fetchComments = async (rankId: string) => {
    const { data, error } = await supabase
      .from('rank_comments')
      .select(`
        id,
        user_id,
        content,
        created_at,
        users:user_id (display_name, user_name, avatar)
      `)
      .eq('rank_id', rankId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (!error && data) {
      const formattedComments = data.map((c: any) => ({
        id: c.id,
        user_id: c.user_id,
        content: c.content,
        created_at: c.created_at,
        user: c.users
      }));
      setRankComments(prev => ({ ...prev, [rankId]: formattedComments }));
    }
  };

  const toggleComments = (rankId: string) => {
    const newState = !showComments[rankId];
    setShowComments(prev => ({ ...prev, [rankId]: newState }));
    if (newState && !rankComments[rankId]) {
      fetchComments(rankId);
    }
  };

  const commentMutation = useMutation({
    mutationFn: async ({ rankId, content }: { rankId: string; content: string }) => {
      if (!user?.id) throw new Error('Must be logged in');
      
      const { data, error } = await supabase
        .from('rank_comments')
        .insert({
          rank_id: rankId,
          user_id: user.id,
          content: content.trim()
        })
        .select()
        .single();
      
      if (error) throw error;
      return { rankId, comment: data };
    },
    onSuccess: ({ rankId }) => {
      setCommentInputs(prev => ({ ...prev, [rankId]: '' }));
      fetchComments(rankId);
      trackEvent('rank_comment_posted', { rank_id: rankId });
    },
    onError: () => {
      toast({ title: 'Failed to post comment', variant: 'destructive' });
    }
  });

  const handlePostComment = (rankId: string) => {
    const content = commentInputs[rankId]?.trim();
    if (!content) return;
    commentMutation.mutate({ rankId, content });
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
  };

  const addCustomItemMutation = useMutation({
    mutationFn: async ({ rankId, title }: { rankId: string; title: string }) => {
      if (!user?.id) throw new Error('Must be logged in');
      
      const { data: maxPos } = await supabase
        .from('rank_items')
        .select('position')
        .eq('rank_id', rankId)
        .order('position', { ascending: false })
        .limit(1)
        .single();
      
      const newPosition = (maxPos?.position || 0) + 1;
      
      const { error } = await supabase.from('rank_items').insert({
        rank_id: rankId,
        user_id: user.id,
        title: title.trim(),
        position: newPosition,
        custom_add_user_id: user.id,
        up_vote_count: 0,
        down_vote_count: 0
      });
      
      if (error) throw error;
      return { rankId };
    },
    onSuccess: () => {
      setAddingToRank(null);
      setCustomAddInput('');
      queryClient.invalidateQueries({ queryKey: ['consumed-ranks-carousel'] });
      trackEvent('rank_custom_add', { rank_id: addingToRank });
      toast({ title: 'Added!', description: 'Your pick has been added to the list.' });
    },
    onError: () => {
      toast({ title: 'Failed to add', variant: 'destructive' });
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

  if (isLoading) {
    return (
      <Card className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
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
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
            <BarChart3 className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Debate the Rank</p>
            <p className="text-[10px] text-gray-500">Vote to rank</p>
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
          const currentItems = localRankings[rank.id] || rank.items;
          const displayItems = isExpanded ? currentItems : currentItems.slice(0, 5);
          const isSubmitted = submittedRanks[rank.id];
          
          return (
            <div key={rank.id} className="flex-shrink-0 w-full snap-center">
              <h3 className="text-gray-900 font-semibold text-base mb-3">
                {rank.title}
              </h3>

              <div className="space-y-2 mb-3">
                {displayItems.map((item, index) => (
                  <VoteItem 
                    key={item.id} 
                    item={item} 
                    index={index}
                    userVote={userVotes[item.id] || null}
                    onVote={(itemId, direction) => handleVote(itemId, direction, rank.id)}
                    isVoting={voteMutation.isPending}
                  />
                ))}
              </div>

              <div className="flex items-center gap-3 mt-3">
                {rank.items.length > 5 && (
                  <button
                    onClick={() => toggleExpanded(rank.id)}
                    className="text-teal-600 text-sm hover:underline"
                  >
                    {isExpanded ? 'Show less' : `Show all ${rank.items.length}`}
                  </button>
                )}
                <button
                  onClick={() => toggleComments(rank.id)}
                  className="flex items-center gap-1 text-gray-500 hover:text-teal-600 text-sm transition-colors"
                >
                  <MessageCircle size={14} />
                  <span>Debate</span>
                </button>
              </div>

              {showComments[rank.id] && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Input
                      placeholder="Share your take..."
                      value={commentInputs[rank.id] || ''}
                      onChange={(e) => setCommentInputs(prev => ({ ...prev, [rank.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handlePostComment(rank.id);
                        }
                      }}
                      className="flex-1 h-8 text-sm rounded-full bg-gray-50 border-gray-200"
                    />
                    <Button
                      size="sm"
                      onClick={() => handlePostComment(rank.id)}
                      disabled={!commentInputs[rank.id]?.trim() || commentMutation.isPending}
                      className="h-8 w-8 p-0 rounded-full bg-teal-500 hover:bg-teal-600"
                    >
                      <Send size={14} />
                    </Button>
                  </div>
                  
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {(rankComments[rank.id] || []).length === 0 ? (
                      <p className="text-gray-400 text-xs text-center py-2">No comments yet. Be the first to debate!</p>
                    ) : (
                      (rankComments[rank.id] || []).map((comment) => (
                        <div key={comment.id} className="flex gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center flex-shrink-0">
                            {comment.user?.avatar ? (
                              <img src={comment.user.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <span className="text-white text-[10px] font-medium">
                                {(comment.user?.display_name || comment.user?.user_name || 'U')[0].toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-xs font-medium text-gray-900 truncate">
                                {comment.user?.display_name || comment.user?.user_name || 'User'}
                              </span>
                              <span className="text-[10px] text-gray-400">{formatTimeAgo(comment.created_at)}</span>
                            </div>
                            <p className="text-xs text-gray-700 break-words">{comment.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
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
                idx === currentIndex ? 'bg-teal-500' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
