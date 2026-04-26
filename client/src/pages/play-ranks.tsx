import { useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/navigation";
import RankFeedCard from "@/components/rank-feed-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, ChevronLeft, Loader2, Globe, Lock, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { RanksCarousel } from "@/components/ranks-carousel";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export default function PlayRanks() {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isCreateRankOpen, setIsCreateRankOpen] = useState(false);
  const [newRankName, setNewRankName] = useState("");
  const [newRankVisibility, setNewRankVisibility] = useState("public");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Likes / comments state — keyed by rank.id for consistency (rank.id is always the stable key)
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Map of rankId → social_posts.id (populated by query)
  const rankToSocialPost = useRef<Record<string, string>>({});
  const likedInitialized = useRef(false);

  // Resolve the real social_posts.id from a rankId (passed in as postId by RankFeedCard)
  const resolveSocialPostId = (rankId: string): string | null =>
    rankToSocialPost.current[rankId] || null;

  // ── Like mutation ────────────────────────────────────────────────────────────
  const likeMutation = useMutation({
    mutationFn: async ({ socialPostId, wasLiked }: { socialPostId: string; wasLiked: boolean }) => {
      if (!session?.access_token) throw new Error('Not authenticated');
      const response = await fetch(`${SUPABASE_URL}/functions/v1/social-feed-like`, {
        method: wasLiked ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ post_id: socialPostId }),
      });
      if (!response.ok) throw new Error('Failed to like post');
      return response.json();
    },
    onMutate: ({ socialPostId, wasLiked }) => {
      // Optimistically toggle liked state (keyed by socialPostId)
      setLikedPosts(prev => {
        const next = new Set(prev);
        wasLiked ? next.delete(socialPostId) : next.add(socialPostId);
        return next;
      });
      // Optimistically update count
      queryClient.setQueryData(['public-ranks-play'], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((item: any) =>
          item.socialPostId === socialPostId
            ? { ...item, likesCount: Math.max(0, (item.likesCount || 0) + (wasLiked ? -1 : 1)) }
            : item
        );
      });
    },
    onError: (_err, { socialPostId, wasLiked }) => {
      setLikedPosts(prev => {
        const next = new Set(prev);
        wasLiked ? next.add(socialPostId) : next.delete(socialPostId);
        return next;
      });
    },
  });

  // RankFeedCard calls onLike(postId) where postId = rank.id (what we pass as postId prop)
  const handleLike = (rankId: string) => {
    if (!session?.access_token) { toast({ title: 'Sign in to like', variant: 'destructive' }); return; }
    const socialPostId = resolveSocialPostId(rankId);
    if (!socialPostId) {
      toast({ title: 'Likes not available yet', description: 'This rank is missing a feed post — run the backfill SQL in Supabase.', variant: 'destructive' });
      return;
    }
    const wasLiked = likedPosts.has(socialPostId);
    likeMutation.mutate({ socialPostId, wasLiked });
  };

  // ── Comment fetch ────────────────────────────────────────────────────────────
  const fetchComments = async (rankId: string): Promise<any[]> => {
    if (!session?.access_token) throw new Error('Not authenticated');
    const socialPostId = resolveSocialPostId(rankId);
    if (!socialPostId) return [];
    const response = await fetch(`${SUPABASE_URL}/functions/v1/social-feed-comments?post_id=${socialPostId}`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) throw new Error('Failed to fetch comments');
    const result = await response.json();
    const transformComment = (c: any): any => ({
      id: c.id,
      content: c.content,
      createdAt: c.created_at,
      user: { id: c.user_id, username: c.username, displayName: c.username, avatar: '' },
      likesCount: c.likesCount || 0,
      likedByCurrentUser: c.isLiked || false,
      upVoteCount: c.upVoteCount || 0,
      downVoteCount: c.downVoteCount || 0,
      voteScore: c.voteScore || 0,
      currentUserVote: c.currentUserVote || null,
      replies: c.replies?.map(transformComment) || [],
    });
    return (result.comments || []).map(transformComment);
  };

  // ── Comment submit ───────────────────────────────────────────────────────────
  const handleComment = async (rankId: string, parentCommentId?: string, content?: string) => {
    const text = content?.trim() || commentInputs[rankId]?.trim();
    if (!text || !session?.access_token) return;
    const socialPostId = resolveSocialPostId(rankId);
    if (!socialPostId) {
      toast({ title: 'Comments not available yet', description: 'This rank is missing a feed post — run the backfill SQL in Supabase.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const body: any = { post_id: socialPostId, content: text };
      if (parentCommentId) body.parent_comment_id = parentCommentId;
      const response = await fetch(`${SUPABASE_URL}/functions/v1/social-feed-comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        setCommentInputs(prev => ({ ...prev, [rankId]: '' }));
        queryClient.setQueryData(['public-ranks-play'], (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((item: any) =>
            item.rank?.id === rankId
              ? { ...item, commentsCount: (item.commentsCount || 0) + 1 }
              : item
          );
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Delete comment ───────────────────────────────────────────────────────────
  const handleDeleteComment = async (commentId: string, rankId: string) => {
    if (!confirm('Delete this comment?') || !session?.access_token) return;
    await supabase.from('social_post_comments').delete().eq('id', commentId);
    queryClient.setQueryData(['public-ranks-play'], (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.map((item: any) =>
        item.rank?.id === rankId
          ? { ...item, commentsCount: Math.max(0, (item.commentsCount || 0) - 1) }
          : item
      );
    });
  };

  // ── Like comment ─────────────────────────────────────────────────────────────
  const handleLikeComment = async (commentId: string) => {
    if (!session?.access_token) return;
    await supabase.from('comment_likes').upsert({ comment_id: commentId, user_id: user?.id }, { onConflict: 'comment_id,user_id' });
  };

  // ── Fetch community ranks with social_post data ──────────────────────────────
  const { data: publicRanksData, isLoading: isLoadingPublic } = useQuery({
    queryKey: ['public-ranks-play'],
    queryFn: async () => {
      const { data: ranksData, error } = await supabase
        .from('ranks')
        .select('id, title, description, user_id, visibility, created_at')
        .eq('visibility', 'public')
        .neq('origin_type', 'consumed')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error || !ranksData || ranksData.length === 0) return [];

      const rankIds = ranksData.map(r => r.id);
      const userIds = [...new Set(ranksData.map(r => r.user_id).filter(Boolean))];

      const [
        { data: allItems },
        { data: usersData },
        { data: socialPostsData },
      ] = await Promise.all([
        supabase
          .from('rank_items')
          .select('id, rank_id, position, title, media_type, creator, image_url, up_vote_count, down_vote_count')
          .in('rank_id', rankIds)
          .order('position', { ascending: true }),
        supabase
          .from('users')
          .select('id, user_name, display_name, profile_image_url')
          .in('id', userIds),
        supabase
          .from('social_posts')
          .select('id, rank_id, likes_count, comments_count')
          .in('rank_id', rankIds)
          .eq('post_type', 'rank_share'),
      ]);

      // Build rankId → socialPostId map (for use in handlers)
      const newMap: Record<string, string> = {};
      (socialPostsData || []).forEach((sp: any) => { newMap[sp.rank_id] = sp.id; });
      rankToSocialPost.current = newMap;

      // Fetch which posts current user has liked
      let likedSocialPostIds = new Set<string>();
      if (socialPostsData && socialPostsData.length > 0 && user?.id) {
        const spIds = socialPostsData.map((sp: any) => sp.id);
        const { data: likeData } = await supabase
          .from('post_likes')
          .select('post_id')
          .in('post_id', spIds)
          .eq('user_id', user.id);
        (likeData || []).forEach((l: any) => likedSocialPostIds.add(l.post_id));
      }
      if (!likedInitialized.current && likedSocialPostIds.size > 0) {
        setLikedPosts(likedSocialPostIds);
        likedInitialized.current = true;
      }

      const itemsByRank: Record<string, any[]> = {};
      (allItems || []).forEach((item: any) => {
        if (!itemsByRank[item.rank_id]) itemsByRank[item.rank_id] = [];
        itemsByRank[item.rank_id].push(item);
      });

      const usersMap = new Map((usersData || []).map((u: any) => [u.id, u]));
      const postByRank = new Map((socialPostsData || []).map((sp: any) => [sp.rank_id, sp]));

      return ranksData
        .filter(rank => (itemsByRank[rank.id] || []).length > 0)
        .map(rank => {
          const author = usersMap.get(rank.user_id) as any;
          const sp = postByRank.get(rank.id);
          return {
            // rank.id is always the stable key (used for expandedComments, commentInputs, onLike arg)
            rankId: rank.id,
            // social_posts.id — may be null for older ranks without a feed post
            socialPostId: sp?.id || null,
            rank: {
              id: rank.id,
              title: rank.title,
              description: rank.description,
              user_id: rank.user_id,
              visibility: rank.visibility,
              items: itemsByRank[rank.id] || [],
            },
            author: {
              id: rank.user_id,
              user_name: author?.user_name || 'Unknown',
              display_name: author?.display_name,
              profile_image_url: author?.profile_image_url,
            },
            createdAt: rank.created_at,
            likesCount: sp?.likes_count || 0,
            commentsCount: sp?.comments_count || 0,
          };
        });
    },
    staleTime: 30000,
  });

  const communityRanks = publicRanksData || [];

  const applyFilters = (items: any[]) => {
    let result = items;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item: any) => (item.rank?.title?.toLowerCase() || '').includes(q));
    }
    if (selectedCategory) {
      const cat = selectedCategory.toLowerCase();
      result = result.filter((item: any) => {
        if ((item.rank?.title?.toLowerCase() || '').includes(cat)) return true;
        return (item.rank?.items || []).some((i: any) =>
          i.media_type?.toLowerCase() === cat || i.media_type?.toLowerCase().includes(cat)
        );
      });
    }
    return result;
  };

  const filteredCommunityRanks = useMemo(() =>
    applyFilters(communityRanks.filter((item: any) => item.rank?.id && item.rank?.items?.length > 0)),
    [communityRanks, searchQuery, selectedCategory]
  );

  // ── Create rank mutation ─────────────────────────────────────────────────────
  const createRankMutation = useMutation({
    mutationFn: async () => {
      if (!session?.access_token || !newRankName.trim()) throw new Error('Missing title or session');
      const response = await fetch(`${SUPABASE_URL}/functions/v1/create-rank`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: newRankName.trim(), visibility: newRankVisibility }),
      });
      if (!response.ok) throw new Error('Failed to create rank');
      return response.json();
    },
    onSuccess: (data) => {
      const rankId = data?.data?.id;
      setNewRankName("");
      setNewRankVisibility("public");
      setIsCreateRankOpen(false);
      queryClient.invalidateQueries({ queryKey: ['public-ranks-play'] });
      if (rankId) setLocation(`/rank/${rankId}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create rank", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation />

      {/* Header */}
      <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] -mt-px">
        <div className="max-w-4xl mx-auto px-4 pt-10 pb-8 relative">
          <button
            onClick={() => window.history.back()}
            className="absolute left-4 top-6 flex items-center text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex flex-col items-center gap-4 pt-1">
            <h1 className="text-2xl font-semibold text-white tracking-tight">Debate The Rank</h1>
            <button
              onClick={() => setIsCreateRankOpen(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-blue-500 to-green-400 hover:from-blue-600 hover:to-green-500 text-white rounded-full px-5 py-2 text-sm font-semibold shadow-lg"
            >
              <Plus size={14} />
              Create Rank
            </button>
          </div>
        </div>
      </div>

      {/* Create Rank Dialog */}
      <Dialog open={isCreateRankOpen} onOpenChange={setIsCreateRankOpen}>
        <DialogContent className="rounded-2xl !bg-white w-[calc(100vw-2rem)] max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">Create Rank</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Title</label>
              <Input
                className="bg-white text-gray-900 border-gray-300 placeholder:text-gray-400"
                placeholder="e.g. Best Movies of 2024"
                value={newRankName}
                onChange={(e) => setNewRankName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newRankName.trim()) createRankMutation.mutate(); }}
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Visibility</label>
              <div className="flex gap-2">
                {(['public', 'private'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setNewRankVisibility(v)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      newRankVisibility === v
                        ? 'bg-purple-600 border-purple-600 text-white'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {v === 'public' ? <Globe size={15} /> : <Lock size={15} />}
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <Button
              className="w-full text-white rounded-xl"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}
              onClick={() => createRankMutation.mutate()}
              disabled={!newRankName.trim() || createRankMutation.isPending}
            >
              {createRankMutation.isPending ? (
                <><Loader2 size={16} className="mr-2 animate-spin" /> Creating...</>
              ) : (
                'Create & Add Items'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Consumed Ranks Carousel */}
        <div className="mb-6">
          <RanksCarousel expanded={true} offset={0} />
        </div>

        {/* Community Ranks */}
        {isLoadingPublic ? (
          <div className="space-y-4">
            {[1, 2].map((n) => (
              <div key={n} className="bg-white rounded-xl p-6 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div>
                    <div className="h-4 bg-gray-200 rounded w-24 mb-1" />
                    <div className="h-3 bg-gray-100 rounded w-16" />
                  </div>
                </div>
                <div className="h-5 bg-gray-200 rounded w-48 mb-3" />
                <div className="space-y-2">
                  <div className="h-10 bg-gray-100 rounded" />
                  <div className="h-10 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredCommunityRanks.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-purple-900 flex items-center justify-center flex-shrink-0">
                  <Users className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Community Ranks</p>
                  <p className="text-[10px] text-gray-500">Ranked by users</p>
                </div>
              </div>
              <span className="text-xs text-gray-500">{filteredCommunityRanks.length} lists</span>
            </div>

            <div className="space-y-4">
              {filteredCommunityRanks.map((item: any) => (
                <div key={item.rankId}>
                  <RankFeedCard
                    rank={item.rank}
                    author={item.author}
                    createdAt={item.createdAt}
                    postId={item.rank.id}
                    likesCount={item.likesCount}
                    commentsCount={item.commentsCount}
                    isLiked={likedPosts.has(item.socialPostId || '')}
                    onLike={handleLike}
                    expandedComments={expandedComments[item.rankId] || false}
                    onToggleComments={() =>
                      setExpandedComments(prev => ({ ...prev, [item.rankId]: !prev[item.rankId] }))
                    }
                    fetchComments={fetchComments}
                    commentInput={commentInputs[item.rankId] || ''}
                    onCommentInputChange={(val) =>
                      setCommentInputs(prev => ({ ...prev, [item.rankId]: val }))
                    }
                    onSubmitComment={(parentCommentId, content) =>
                      handleComment(item.rankId, parentCommentId, content)
                    }
                    isSubmitting={isSubmitting}
                    currentUserId={user?.id}
                    onDeleteComment={handleDeleteComment}
                    onLikeComment={handleLikeComment}
                  />
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
