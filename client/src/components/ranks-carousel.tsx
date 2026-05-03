import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { trackEvent } from '@/lib/posthog';
import { BarChart3, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Loader2, Plus, X, MessageCircle, Send, Heart, Flag, GripVertical, Check } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { ReportSheet } from '@/components/report-sheet';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

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
  socialPostId?: string | null;
  likesCount?: number;
}

function PctBar({ upCount, downCount }: { upCount: number; downCount: number }) {
  const total = upCount + downCount;
  if (total === 0) return null;
  const upPct = Math.round(upCount / total * 100);
  return (
    <div className="flex items-center gap-1 flex-shrink-0 min-w-[72px]">
      <span className="text-[10px] text-emerald-600 font-semibold w-7 text-right">↑{upPct}%</span>
      <div className="flex-1 h-1 bg-red-100 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${upPct}%` }} />
      </div>
      <span className="text-[10px] text-red-400 font-semibold w-7">{100 - upPct}%↓</span>
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
  const [addingToRank, setAddingToRank] = useState<string | null>(null);
  const [customAddInput, setCustomAddInput] = useState('');
  const [expandedVoting, setExpandedVoting] = useState<Record<string, boolean>>({});
  const [submittedRankIds, setSubmittedRankIds] = useState<Set<string>>(new Set());
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [rankComments, setRankComments] = useState<Record<string, RankComment[]>>({});
  // Like state — keyed by social_posts.id
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const rankToSocialPost = useRef<Record<string, string>>({});
  const likedInitialized = useRef(false);
  const [reportCommentTarget, setReportCommentTarget] = useState<{id: string; userId: string; userName: string} | null>(null);

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
      if (!ranksData || ranksData.length === 0) return [];

      const rankIds = ranksData.map(r => r.id);

      const [itemsResults, socialPostsResult] = await Promise.all([
        Promise.all(ranksData.map(rank =>
          supabase
            .from('rank_items')
            .select('*')
            .eq('rank_id', rank.id)
            .order('position', { ascending: true })
        )),
        supabase
          .from('social_posts')
          .select('id, rank_id, likes_count')
          .in('rank_id', rankIds)
          .eq('post_type', 'rank_share'),
      ]);

      // Build rankId → socialPostId map
      const newMap: Record<string, string> = {};
      const newLikeCounts: Record<string, number> = {};
      (socialPostsResult.data || []).forEach((sp: any) => {
        newMap[sp.rank_id] = sp.id;
        newLikeCounts[sp.rank_id] = sp.likes_count || 0;
      });
      rankToSocialPost.current = newMap;
      setLikeCounts(newLikeCounts);

      // Fetch current user's likes for these social posts
      if (socialPostsResult.data && socialPostsResult.data.length > 0 && user?.id) {
        const spIds = socialPostsResult.data.map((sp: any) => sp.id);
        const { data: likeData } = await supabase
          .from('post_likes')
          .select('post_id')
          .in('post_id', spIds)
          .eq('user_id', user.id);
        if (!likedInitialized.current && likeData && likeData.length > 0) {
          setLikedPosts(new Set(likeData.map((l: any) => l.post_id)));
          likedInitialized.current = true;
        }
      }

      const postByRank = new Map((socialPostsResult.data || []).map((sp: any) => [sp.rank_id, sp]));

      return ranksData.map((rank, i) => {
        const sp = postByRank.get(rank.id);
        return {
          id: rank.id,
          title: rank.title,
          description: rank.description,
          category: rank.category,
          items: itemsResults[i].data || [],
          socialPostId: sp?.id || null,
          likesCount: sp?.likes_count || 0,
        } as RankData;
      });
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
      if (!session?.access_token) throw new Error('Must be logged in');
      const item_positions = items.map((item, index) => ({
        rank_item_id: item.id,
        position: index + 1,
      }));
      const response = await fetch(`${SUPABASE_URL}/functions/v1/save-rank-ordering`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ rank_id: rankId, item_positions }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save ranking');
      }
      const data = await response.json();
      return { rankId, updatedItems: data.items || [] };
    },
    onSuccess: ({ rankId, updatedItems }) => {
      setSubmittedRankIds(prev => new Set([...prev, rankId]));
      // Update local item counts with fresh server data
      if (updatedItems.length > 0) {
        setLocalRankings(prev => ({
          ...prev,
          [rankId]: (prev[rankId] || []).map(item => {
            const updated = updatedItems.find((i: any) => i.id === item.id);
            return updated ? { ...item, up_vote_count: updated.up_vote_count, down_vote_count: updated.down_vote_count } : item;
          }),
        }));
      }
      queryClient.invalidateQueries({ queryKey: ['consumed-ranks-carousel'] });
      trackEvent('rank_submitted', { rank_id: rankId });
      toast({ title: 'Ranking saved!', description: 'Your personal ranking has been recorded.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save ranking', description: error.message, variant: 'destructive' });
    },
  });

  const handleDragEnd = (rankId: string, result: DropResult) => {
    if (!result.destination) return;
    setLocalRankings(prev => {
      const items = Array.from(prev[rankId] || []);
      const [moved] = items.splice(result.source.index, 1);
      items.splice(result.destination!.index, 0, moved);
      return { ...prev, [rankId]: items };
    });
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
      
      console.log('💬 Posting comment:', { rankId, userId: user.id, content: content.trim() });
      
      const { data, error } = await supabase
        .from('rank_comments')
        .insert({
          rank_id: rankId,
          user_id: user.id,
          content: content.trim()
        })
        .select()
        .single();
      
      if (error) {
        console.error('💬 Comment error:', error);
        throw error;
      }
      console.log('💬 Comment posted:', data);
      return { rankId, comment: data };
    },
    onSuccess: ({ rankId }) => {
      setCommentInputs(prev => ({ ...prev, [rankId]: '' }));
      fetchComments(rankId);
      trackEvent('rank_comment_posted', { rank_id: rankId });
      toast({ title: 'Comment posted!' });
    },
    onError: (error: any) => {
      console.error('💬 Comment mutation error:', error);
      toast({ title: 'Failed to post comment', description: error?.message || 'Please try again', variant: 'destructive' });
    }
  });

  const handlePostComment = (rankId: string) => {
    const content = commentInputs[rankId]?.trim();
    if (!content) return;
    commentMutation.mutate({ rankId, content });
  };

  // ── Like handler ─────────────────────────────────────────────────────────────
  const handleLike = async (rankId: string) => {
    if (!session?.access_token) {
      toast({ title: 'Sign in to like', variant: 'destructive' });
      return;
    }
    const socialPostId = rankToSocialPost.current[rankId];
    if (!socialPostId) {
      toast({ title: 'Likes not available yet', description: 'This rank has no feed post yet.', variant: 'destructive' });
      return;
    }
    const wasLiked = likedPosts.has(socialPostId);
    // Optimistic update
    setLikedPosts(prev => {
      const next = new Set(prev);
      wasLiked ? next.delete(socialPostId) : next.add(socialPostId);
      return next;
    });
    setLikeCounts(prev => ({
      ...prev,
      [rankId]: Math.max(0, (prev[rankId] || 0) + (wasLiked ? -1 : 1)),
    }));
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/social-feed-like`, {
        method: wasLiked ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ post_id: socialPostId }),
      });
    } catch {
      // Rollback on error
      setLikedPosts(prev => {
        const next = new Set(prev);
        wasLiked ? next.add(socialPostId) : next.delete(socialPostId);
        return next;
      });
      setLikeCounts(prev => ({
        ...prev,
        [rankId]: Math.max(0, (prev[rankId] || 0) + (wasLiked ? 1 : -1)),
      }));
    }
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
      <div className="bg-white border border-gray-100 shadow rounded-2xl p-5">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
        </div>
      </div>
    );
  }

  if (!ranks || ranks.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-100 shadow rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-none">Debate the Rank</p>
            <p className="text-[10px] text-gray-400 mt-0.5">ranked list</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {currentIndex > 0 && (
            <button onClick={scrollToPrev} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
            </button>
          )}
          {currentIndex < ranks.length - 1 && (
            <button onClick={scrollToNext} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
              <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
            </button>
          )}
          <span className="text-xs text-gray-400 ml-1">{currentIndex + 1}/{ranks.length}</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-1 px-1"
      >
        {ranks.map((rank) => {
          const isVotingExpanded = expandedVoting[rank.id];
          const isExpanded = expandedRanks[rank.id];
          const currentItems = localRankings[rank.id] || rank.items;
          const displayItems = isExpanded ? currentItems : currentItems.slice(0, 5);
          const previewItems = currentItems.slice(0, 2);
          const hiddenCount = currentItems.length - previewItems.length;

          return (
            <div key={rank.id} className="flex-shrink-0 w-full snap-center pb-3">
              {/* Rank title */}
              <div className="px-3 pb-2">
                <h3 className="text-gray-900 font-bold text-base leading-snug">{rank.title}</h3>
              </div>

              {/* ── COLLAPSED GLIMPSE ── */}
              {!isVotingExpanded && (
                <button className="w-full text-left" onClick={() => setExpandedVoting(prev => ({ ...prev, [rank.id]: true }))}>
                  <div className="px-3 space-y-1.5 mb-2">
                    {previewItems.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-2.5">
                        <span className={`w-5 h-5 flex items-center justify-center text-[11px] font-bold text-white rounded flex-shrink-0 ${
                          index === 0 ? 'bg-purple-600' : index === 1 ? 'bg-purple-400' : 'bg-purple-300'
                        }`}>{item.position}</span>
                        {item.image_url && <img src={item.image_url} alt={item.title} className="w-7 h-7 rounded object-cover flex-shrink-0" />}
                        <span className="text-sm text-gray-800 font-medium truncate">{item.title}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mx-3 flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                    <span className="text-xs text-gray-500">
                      {hiddenCount > 0 ? `+${hiddenCount} more · ` : ''}Tap to drag &amp; rank
                    </span>
                    <ChevronDown size={14} className="text-purple-500" />
                  </div>
                </button>
              )}

              {/* ── EXPANDED DRAG RANKING ── */}
              {isVotingExpanded && (
                <>
                  <div className="px-3 mb-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-purple-600 bg-purple-50 rounded-lg px-2.5 py-1.5 mb-2">
                      <GripVertical size={11} />
                      Drag items into your preferred order
                    </div>
                    <DragDropContext onDragEnd={(result) => handleDragEnd(rank.id, result)}>
                      <Droppable droppableId={`carousel-rank-${rank.id}`}>
                        {(provided) => (
                          <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1.5">
                            {currentItems.map((item, index) => (
                              <Draggable key={item.id} draggableId={`${rank.id}-${item.id}`} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`flex items-center gap-2 py-2 px-2.5 rounded-xl border transition-colors ${
                                      snapshot.isDragging
                                        ? 'bg-purple-50 border-purple-300 shadow-md'
                                        : 'bg-gray-50 border-transparent'
                                    }`}
                                  >
                                    <div {...provided.dragHandleProps} className="text-gray-300 hover:text-purple-400 cursor-grab active:cursor-grabbing flex-shrink-0">
                                      <GripVertical size={14} />
                                    </div>
                                    <div className={`w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 ${
                                      index === 0 ? 'bg-gradient-to-br from-teal-500 to-emerald-600' :
                                      index === 1 ? 'bg-gradient-to-br from-teal-400 to-emerald-500' :
                                      'bg-gradient-to-br from-teal-300 to-emerald-400'
                                    }`}>
                                      {index + 1}
                                    </div>
                                    {item.image_url && (
                                      <img src={item.image_url} alt={item.title} className="w-6 h-6 rounded object-cover flex-shrink-0" />
                                    )}
                                    <span className="text-gray-900 font-medium flex-1 truncate text-sm">{item.title}</span>
                                    <PctBar upCount={item.up_vote_count || 0} downCount={item.down_vote_count || 0} />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </DragDropContext>
                  </div>

                  <div className="px-3 flex items-center gap-2 mb-1">
                    <button
                      onClick={() => submitMutation.mutate({ rankId: rank.id, items: currentItems })}
                      disabled={submitMutation.isPending}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-purple-600 text-white hover:bg-purple-700 transition-colors font-medium disabled:opacity-60"
                    >
                      {submitMutation.isPending ? (
                        <><Loader2 size={11} className="animate-spin" /> Saving...</>
                      ) : submittedRankIds.has(rank.id) ? (
                        <><Check size={11} /> Re-submit Ranking</>
                      ) : (
                        <><Check size={11} /> Submit My Ranking</>
                      )}
                    </button>
                    <button
                      onClick={() => setExpandedVoting(prev => ({ ...prev, [rank.id]: false }))}
                      className="ml-auto flex items-center gap-0.5 text-xs text-gray-400 hover:text-purple-500 transition-colors"
                    >
                      <ChevronUp size={13} />
                      Collapse
                    </button>
                  </div>
                </>
              )}

              {/* Always-visible footer: like + debate */}
              <div className="px-3 py-2.5 border-t border-gray-100 flex items-center gap-4">
                {(() => {
                  const socialPostId = rankToSocialPost.current[rank.id];
                  const isLiked = socialPostId ? likedPosts.has(socialPostId) : false;
                  const count = likeCounts[rank.id] ?? (rank.likesCount || 0);
                  return (
                    <button
                      onClick={() => handleLike(rank.id)}
                      className="flex items-center gap-1.5 text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <Heart size={15} className={isLiked ? 'text-red-400 fill-red-400' : ''} />
                      <span className="text-xs font-medium text-gray-500">{count}</span>
                    </button>
                  );
                })()}
                <button
                  onClick={() => toggleComments(rank.id)}
                  className="flex items-center gap-1.5 text-gray-400 hover:text-purple-600 transition-colors"
                >
                  <MessageCircle size={15} />
                  <span className="text-xs font-medium text-gray-500">
                    {showComments[rank.id] ? 'Hide' : 'Debate'}
                    {(rankComments[rank.id]?.length || 0) > 0 ? ` · ${rankComments[rank.id].length}` : ''}
                  </span>
                </button>
              </div>

              {/* Comments */}
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
                      className="flex-1 h-8 text-sm rounded-full bg-gray-50 border-gray-200 text-gray-900"
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
                          {user?.id !== comment.user_id && (
                            <button
                              onClick={() => setReportCommentTarget({ id: comment.id, userId: comment.user_id, userName: comment.user?.display_name || comment.user?.user_name || 'User' })}
                              className="text-gray-400 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
                              title="Report comment"
                            >
                              <Flag size={11} />
                            </button>
                          )}
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
        <div className="flex justify-center gap-1.5 py-3">
          {ranks.map((_, idx) => (
            <div
              key={idx}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                idx === currentIndex ? 'bg-purple-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      )}

      <ReportSheet
        isOpen={!!reportCommentTarget}
        onClose={() => setReportCommentTarget(null)}
        contentType="comment"
        contentId={reportCommentTarget?.id || ''}
        reportedUserId={reportCommentTarget?.userId}
        reportedUserName={reportCommentTarget?.userName}
      />
    </div>
  );
}
