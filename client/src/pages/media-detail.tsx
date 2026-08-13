
import { useState, useEffect, useRef } from "react";
import { StarRater } from "@/components/star-rater";
import { ArrowLeft, ArrowUp, ArrowDown, Share, Star, Bookmark, Calendar, Clock, ExternalLink, Plus, Trash2, ChevronDown, List, Target, MessageCircle, Heart, Send, Sparkles, Film, Tv, BookOpen, Music, Mic, Loader2, TrendingUp, ListPlus, Flame, Lightbulb, Users, Dna } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Navigation from "@/components/navigation";
import RoomComposer, { DISCUSSION_TAGS, dbTagToDisplay } from "@/components/room-composer";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import MentionInput from "@/components/mention-input";
import { copyLink } from "@/lib/share";
import { useToast } from "@/hooks/use-toast";
import { useDnaArchetype } from "@/hooks/use-dna-archetype";
import CreateListDialog from "@/components/create-list-dialog";
import { QuickAddModal } from "@/components/quick-add-modal";
import { QuickAddListSheet } from "@/components/quick-add-list-sheet";
import { ReportButton } from "@/components/report-button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import { supabase } from "@/lib/supabase";
import { apiRequest } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Media-detail composer tags: "Rate" (default here) + shared conversation tags
// (Discussion, Take, Theory, Question). Rooms keep "Discussion" as their default.
const MEDIA_TAGS = [
  { label: "Rate", db: "rate", icon: Star, bg: "#fef9c3", fg: "#ca8a04" },
  ...DISCUSSION_TAGS,
];

export default function MediaDetail() {
  const [matchStandard, paramsStandard] = useRoute("/media/:type/:source/:id");
  const [matchPrefixed, paramsPrefixed] = useRoute("/media/:type/:source/:prefix/:id");
  const [, setLocation] = useLocation();
  
  // Combine params - for Open Library, the ID includes the prefix (e.g., "works/OL123")
  const params = matchPrefixed && paramsPrefixed ? {
    type: paramsPrefixed.type,
    source: paramsPrefixed.source,
    id: `${paramsPrefixed.prefix}/${paramsPrefixed.id}`
  } : paramsStandard;
  const { session, user } = useAuth();
  const { archetypeKey } = useDnaArchetype();
  const [showAbout, setShowAbout] = useState(false);
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);
  // Dormant: the full reviews list (Activity Section) is gated on showReviews, whose only
  // trigger was the hero "Hot Takes" stat. That stat row is hidden for now, so this stays
  // false. Kept in place (not removed) so it can be re-enabled with the stat row later.
  const [showReviews, setShowReviews] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [showCreateListDialog, setShowCreateListDialog] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replyingToComment, setReplyingToComment] = useState<number | null>(null);
  const [commentReplyContent, setCommentReplyContent] = useState("");
  const [expandedTake, setExpandedTake] = useState<string | null>(null);
  const [disagreedTakes, setDisagreedTakes] = useState<Set<string>>(new Set());
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddMedia, setQuickAddMedia] = useState<any>(null);
  const [quickAddPostType, setQuickAddPostType] = useState<"predict" | "review">("review");
  const [expandedComments, setExpandedComments] = useState<Record<string, any[]>>({});
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());
  const [composeRating, setComposeRating] = useState(0);
  const [composeHoverRating, setComposeHoverRating] = useState(0);
  const [composeSelectedList, setComposeSelectedList] = useState<{ name: string; isCustom: boolean; id?: string } | null>(null);
  const [isComposePosting, setIsComposePosting] = useState(false);
  const [composePredictionOptions, setComposePredictionOptions] = useState<string[]>(["", ""]);
  const [composerOpen, setComposerOpen] = useState(false);
  // Rotating conversation-starter prompts for the composer trigger
  const TAKE_PROMPTS = [
    'I wish that this…',
    "I couldn't believe…",
    'The characters were…',
    "Season 1 didn't…",
  ];
  const [promptIdx, setPromptIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPromptIdx((i) => (i + 1) % TAKE_PROMPTS.length), 4000);
    return () => clearInterval(t);
  }, []);
  const composeSectionRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Progress sheet state
  const [isProgressSheetOpen, setIsProgressSheetOpen] = useState(false);
  const [isListSheetOpen, setIsListSheetOpen] = useState(false);
  const [editProgress, setEditProgress] = useState(0);
  const [editTotal, setEditTotal] = useState(0);
  const [editMode, setEditMode] = useState<'percent' | 'page' | 'episode' | 'minutes'>('percent');

  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [params?.id, params?.type, params?.source]);

  // Fetch comments for a post
  const fetchComments = async (postId: string, force = false) => {
    if (!force && expandedComments[postId]) {
      // Already loaded, just toggle visibility
      return;
    }
    setLoadingComments(prev => new Set(prev).add(postId));
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/social-feed-comments?post_id=${postId}&include=meta`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (response.ok) {
        const data = await response.json();
        setExpandedComments(prev => ({ ...prev, [postId]: data.comments || data || [] }));
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoadingComments(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
  };

  const toggleComments = (postId: string) => {
    if (expandedComments[postId]) {
      // Hide comments
      setExpandedComments(prev => {
        const newState = { ...prev };
        delete newState[postId];
        return newState;
      });
      setReplyingTo(null);
    } else {
      // Show comments and fetch them
      fetchComments(postId);
      setReplyingTo(postId);
    }
  };

  // Like mutation - uses social-feed-like edge function
  const likeMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/social-feed-like`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ post_id: postId })
        }
      );
      const data = await response.json();
      if (!response.ok) {
        // If already liked, try to unlike
        if (data.error === 'Already liked') {
          const unlikeResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/social-feed-like`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${session?.access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ post_id: postId })
            }
          );
          if (!unlikeResponse.ok) throw new Error('Failed to unlike');
          return { liked: false };
        }
        throw new Error(data.error || 'Failed to like');
      }
      return { liked: true };
    },
    onSuccess: (data, postId) => {
      setLikedPosts(prev => {
        const newSet = new Set(prev);
        if (data.liked) {
          newSet.add(postId);
        } else {
          newSet.delete(postId);
        }
        return newSet;
      });
      queryClient.invalidateQueries({ queryKey: ['media-detail'] });
    }
  });

  // Reply mutation - uses social-feed-comments edge function
  const replyMutation = useMutation({
    mutationFn: async ({ postId, content, parentCommentId }: { postId: string; content: string; parentCommentId?: number }) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/social-feed-comments`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ post_id: postId, content, parent_comment_id: parentCommentId })
        }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add reply');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      setReplyContent("");
      setCommentReplyContent("");
      setReplyingToComment(null);
      // Force a fresh fetch so the new comment/reply shows without a page refresh.
      fetchComments(variables.postId, true);
      queryClient.invalidateQueries({ queryKey: ['media-detail'] });
    }
  });

  const handleLike = (postId: string) => {
    if (!session?.access_token) {
      toast({ title: "Please sign in to like posts", variant: "destructive" });
      return;
    }
    likeMutation.mutate(postId);
  };

  const handleReply = (postId: string) => {
    if (!replyContent.trim()) return;
    replyMutation.mutate({ postId, content: replyContent });
  };

  const handleCommentReply = (postId: string, parentCommentId: number) => {
    if (!commentReplyContent.trim()) return;
    replyMutation.mutate({ postId, content: commentReplyContent, parentCommentId });
  };

  // Recursive renderer for a comment and its nested reply thread.
  const renderComment = (comment: any, postId: string, depth = 0): JSX.Element => {
    const cRaw = comment.users?.display_name || comment.users?.user_name || comment.username || '';
    const cName = cRaw.includes('+') ? (cRaw.split('+').pop() || cRaw) : (cRaw || 'Someone');
    const isReplying = replyingToComment === comment.id;
    return (
      <div key={comment.id}>
        <div className="flex items-start gap-2">
          <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-purple-600 text-[10px] font-semibold">{(cName[0] || '?').toUpperCase()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-medium text-gray-900">{cName}</span>
            <p className="text-sm text-gray-700 leading-snug">{comment.content}</p>
            <div className="flex items-center justify-between mt-0.5">
              <button
                onClick={() => { setReplyingToComment(isReplying ? null : comment.id); setCommentReplyContent(''); }}
                className={`text-xs font-medium transition-colors ${isReplying ? 'text-purple-600' : 'text-gray-400 hover:text-purple-600'}`}
                data-testid={`comment-reply-${comment.id}`}
              >
                Reply
              </button>
              <ReportButton contentType="comment" contentId={String(comment.id)} className="text-gray-200 hover:text-red-500 [&_svg]:w-3 [&_svg]:h-3" />
            </div>
            {isReplying && (
              <div className="flex items-center gap-2 mt-1.5">
                <MentionInput
                  autoFocus
                  value={commentReplyContent}
                  onChange={setCommentReplyContent}
                  session={session}
                  onSubmit={() => handleCommentReply(postId, comment.id)}
                  placeholder={`Reply to ${cName}...`}
                  className="flex-1 h-auto bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-0"
                  testId={`comment-reply-input-${comment.id}`}
                />
                <button
                  onClick={() => handleCommentReply(postId, comment.id)}
                  disabled={!commentReplyContent.trim() || replyMutation.isPending}
                  className="text-sm font-semibold text-purple-600 disabled:text-gray-300"
                  data-testid={`comment-reply-send-${comment.id}`}
                >
                  Post
                </button>
              </div>
            )}
          </div>
        </div>
        {comment.replies?.length > 0 && (
          <div className="mt-2 space-y-2 border-l-2 border-purple-200 pl-3 ml-2.5">
            {comment.replies.map((reply: any) => renderComment(reply, postId, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async ({ commentId, postId }: { commentId: string; postId: string }) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/delete-comment`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ comment_id: commentId })
        }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete comment');
      }
      return { postId };
    },
    onSuccess: (data) => {
      // Force a fresh fetch so the deletion is reflected without a page refresh.
      fetchComments(data.postId, true);
      toast({ title: "Comment deleted" });
    }
  });

  const handleDeleteComment = (commentId: string, postId: string) => {
    deleteCommentMutation.mutate({ commentId, postId });
  };

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  const handleShare = async () => {
    try {
      await copyLink({
        kind: 'media',
        obj: {
          type: params?.type,
          source: params?.source,
          id: params?.id
        }
      });
      toast({
        title: "Link copied!",
        description: "Share this media with your friends",
      });
    } catch (err) {
      console.error('Failed to copy link:', err);
      toast({
        title: "Failed to copy link",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  // Fetch media details from edge function with fallback to cached data
  const { data: mediaItem, isLoading } = useQuery({
    queryKey: ['media-detail', params?.type, params?.source, params?.id],
    gcTime: 0,
    queryFn: async () => {
      // First try the main API
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-media-details?source=${params?.source}&external_id=${params?.id}&media_type=${params?.type}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (response.ok) {
        return response.json();
      }
      
      // Fallback: Try to get cached info from list_items table
      console.log('API failed, trying fallback from cached media data...');
      const { data: cachedMedia } = await supabase
        .from('list_items')
        .select('title, media_type, creator, image_url, external_id, external_source')
        .eq('external_id', params?.id)
        .eq('external_source', params?.source)
        .limit(1)
        .single();
      
      if (cachedMedia) {
        return {
          title: cachedMedia.title,
          media_type: cachedMedia.media_type || params?.type,
          creator: cachedMedia.creator,
          image_url: cachedMedia.image_url,
          external_id: cachedMedia.external_id,
          external_source: cachedMedia.external_source,
          fromCache: true
        };
      }
      
      // Second fallback: Try to get info from social_posts
      const { data: postMedia } = await supabase
        .from('social_posts')
        .select('media_title, media_type, media_creator, image_url, media_external_id, media_external_source')
        .eq('media_external_id', params?.id)
        .eq('media_external_source', params?.source)
        .not('media_title', 'is', null)
        .limit(1)
        .single();
      
      if (postMedia) {
        return {
          title: postMedia.media_title,
          media_type: postMedia.media_type || params?.type,
          creator: postMedia.media_creator,
          image_url: postMedia.image_url,
          external_id: postMedia.media_external_id,
          external_source: postMedia.media_external_source,
          fromCache: true
        };
      }
      
      console.error('Failed to fetch media details and no cached data found');
      throw new Error('Media not found');
    },
    enabled: !!params?.source && !!params?.id && !!session?.access_token,
    retry: false
  });

  // Fetch user's own rating from media_ratings table (includes private ratings)
  const { data: userRating, isFetched: userRatingFetched } = useQuery({
    queryKey: ['user-media-rating', params?.source, params?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('media_ratings')
        .select('rating, created_at')
        .eq('media_external_id', params?.id)
        .eq('media_external_source', params?.source)
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch user rating:', error);
        return null;
      }
      return data;
    },
    enabled: !!params?.source && !!params?.id && !!user?.id
  });

  // Fetch ALL social activity for this specific media
  const { data: socialActivity = [] } = useQuery({
    queryKey: ['media-social-activity', params?.source, params?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_posts')
        .select(`
          id,
          user_id,
          post_type,
          rating,
          content,
          created_at,
          likes_count,
          comments_count,
          prediction_pool_id,
          users!social_posts_user_id_fkey (
            display_name,
            user_name
          )
        `)
        .eq('media_external_source', params?.source)
        .eq('media_external_id', params?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch social activity:', error);
        return [];
      }

      // Fetch prediction pool details separately for posts that have them
      const postsWithPools = data?.filter(p => p.prediction_pool_id) || [];
      if (postsWithPools.length > 0) {
        const poolIds = postsWithPools.map(p => p.prediction_pool_id);
        const { data: pools } = await supabase
          .from('prediction_pools')
          .select('id, type, title, options, total_participants')
          .in('id', poolIds);

        // Attach pool data to posts
        if (pools) {
          const poolMap = new Map(pools.map(p => [p.id, p]));
          data?.forEach((post: any) => {
            if (post.prediction_pool_id) {
              post.prediction_pools = poolMap.get(post.prediction_pool_id);
            }
          });
        }
      }

      return data || [];
    },
    enabled: !!params?.source && !!params?.id
  });

  // Fetch ALL ratings for this media so every rater shows up in the conversation,
  // even users whose rating never produced a social post.
  const { data: allRatings = [] } = useQuery({
    queryKey: ['media-all-ratings', params?.source, params?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('media_ratings')
        .select('id, user_id, rating, created_at')
        .eq('media_external_source', params?.source)
        .eq('media_external_id', params?.id)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Failed to fetch media ratings:', error);
        return [];
      }
      const rows = data || [];
      const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
      if (userIds.length === 0) return rows.map((r: any) => ({ ...r, users: null }));
      const { data: userRows } = await supabase
        .from('users')
        .select('id, display_name, user_name')
        .in('id', userIds);
      const userMap = new Map((userRows || []).map((u: any) => [u.id, u]));
      return rows.map((r: any) => ({ ...r, users: userMap.get(r.user_id) || null }));
    },
    enabled: !!params?.source && !!params?.id
  });

  // Look up any public room linked to this media by series_tag or name match
  const { data: linkedRoom } = useQuery({
    queryKey: ['media-room', mediaItem?.title],
    queryFn: async () => {
      if (!mediaItem?.title) return null;
      const title = mediaItem.title.toLowerCase().trim();
      const { data } = await supabase
        .from('pools')
        .select('id, name, series_tag, media_image, partner_logo_url, is_public')
        .eq('pool_type', 'room')
        .eq('is_public', true)
        .ilike('series_tag', `%${title}%`)
        .limit(1)
        .maybeSingle();
      if (data) return data;
      // Fallback: match on room name itself
      const { data: byName } = await supabase
        .from('pools')
        .select('id, name, series_tag, media_image, partner_logo_url, is_public')
        .eq('pool_type', 'room')
        .eq('is_public', true)
        .ilike('name', `%${title}%`)
        .limit(1)
        .maybeSingle();
      return byName || null;
    },
    enabled: !!mediaItem?.title,
    staleTime: 5 * 60 * 1000,
  });

  // Separate reviews from other activity
  const reviews = socialActivity.filter((post: any) => post.rating);
  // Posts shown in the expanded list — rated reviews AND text takes (so text takes are respondable)
  const discussionPosts = socialActivity.filter((post: any) => post.rating || (post.content && post.content.trim()));
  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum: number, r: any) => sum + Number(r.rating), 0) / reviews.length).toFixed(1)
    : null;
  const predictions = socialActivity.filter((post: any) => post.prediction_pool_id && post.prediction_pools?.type === 'predict');
  const polls = socialActivity.filter((post: any) => post.prediction_pool_id && post.prediction_pools?.type === 'vote');
  const conversations = socialActivity.filter((post: any) => !post.rating && !post.prediction_pool_id && post.content && post.content.trim());

  // --- Hero stats (REAL data only; no fabricated numbers) ---
  const takes = socialActivity.filter((post: any) => post.rating || (post.content && post.content.trim() && !post.prediction_pool_id));
  // Collapse ALL of a user's activity for this title into ONE card. The app
  // inserts a new "rate-review" post every time someone rates, so a single user
  // can have several rating posts plus an "added to <list>" post. We pick one
  // representative card per user (a written take first, then the "added to"
  // post, then a bare rating) and fold in that user's most recent rating, so
  // the rating is never shown as its own separate row.
  const mergedTakes = (() => {
    const groups = new Map<string, any[]>();
    const order: string[] = [];
    for (const post of takes as any[]) {
      const uid = post.user_id || post.id;
      if (!groups.has(uid)) { groups.set(uid, []); order.push(uid); }
      groups.get(uid)!.push(post);
    }
    const result: any[] = [];
    for (const uid of order) {
      // posts are newest-first (socialActivity is ordered created_at desc)
      const posts = groups.get(uid)!;
      const freeform = posts.filter((p) => p.content && p.content.trim() && p.post_type !== 'added_to_list');
      const listAdds = posts.filter((p) => p.content && p.content.trim() && p.post_type === 'added_to_list');
      const ratingOnly = posts.filter((p) => !(p.content && p.content.trim()));
      const base = freeform[0] || listAdds[0] || ratingOnly[0];
      if (!base) continue;
      // posts are newest-first, so the first rated post is the user's latest rating.
      const latestRating = posts.find((p) => p.rating != null)?.rating ?? null;
      result.push({ ...base, rating: latestRating ?? base.rating });
    }
    // Fold in users from media_ratings who have NO social post for this title —
    // their rating still deserves a card in the conversation.
    const seenUsers = new Set(result.map((p) => p.user_id).filter(Boolean));
    for (const r of allRatings as any[]) {
      if (!r.user_id || seenUsers.has(r.user_id)) continue;
      seenUsers.add(r.user_id);
      result.push({
        id: `rating-${r.id}`,
        user_id: r.user_id,
        users: r.users,
        rating: r.rating,
        content: '',
        created_at: r.created_at,
        likes_count: 0,
        comments_count: 0,
        post_type: 'rate-review',
        _ratingOnly: true,
      });
    }
    return result;
  })();
  // Preload comments for each take so a couple show at a glance without tapping "Comment".
  const takeIdsKey = (mergedTakes as any[]).map((t) => t.id).join(',');
  useEffect(() => {
    if (!session?.access_token) return;
    (mergedTakes as any[]).forEach((t) => { if (t?.id && !t._ratingOnly) fetchComments(String(t.id)); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takeIdsKey, session?.access_token]);
  const distinctFanIds = Array.from(new Set((socialActivity as any[]).map((p: any) => p.user_id).filter(Boolean)));
  const fansCount = distinctFanIds.length;
  // Theories feature has no backend yet — real count is 0 until built.
  const theoriesCount = 0;
  const formatCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`);

  // Fetch similar media across different types using AI
  const { data: similarMedia = [], isLoading: isSimilarLoading } = useQuery({
    queryKey: ['similar-media', mediaItem?.title, mediaItem?.type],
    queryFn: async () => {
      if (!session?.access_token || !mediaItem?.title) return [];
      
      const mediaType = mediaItem.type || mediaItem.media_type || params?.type;
      const prompt = `Find me media similar to "${mediaItem.title}" (${mediaType}). Include: other ${mediaType === 'tv' ? 'TV shows' : mediaType === 'movie' ? 'movies' : mediaType?.toLowerCase() + 's'} like it, soundtrack music, books it's based on or similar books, related podcasts, and any connected media. Mix of types please.`;
      
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/conversational-search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: prompt })
      });
      
      if (!response.ok) return [];
      const result = await response.json();
      
      // Extract recommendations from AI response (may be in recommendations or results)
      const recs = result.recommendations || result.results || [];
      const limitedRecs = recs.slice(0, 6);
      
      // Enrich each recommendation with poster images by searching media-search
      const enrichedRecs = await Promise.all(
        limitedRecs.map(async (item: any) => {
          const itemType = (item.type || item.media_type || '').toLowerCase();
          const searchTypes = itemType.includes('book') ? ['book'] : itemType.includes('music') || itemType.includes('album') ? ['music'] : itemType.includes('podcast') ? ['podcast'] : ['movie', 'tv'];
          const searchQuery = item.title + (item.year ? ` ${item.year}` : '');
          try {
            const searchResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/media-search`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ query: searchQuery, types: searchTypes, limit: 1 })
            });
            
            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              const match = searchData.results?.[0];
              if (match) {
                let posterUrl = match.poster_url || match.image || match.image_url || '';
                const matchSource = match.external_source || match.source || '';
                const matchId = match.external_id || match.id || '';
                if (!posterUrl && matchSource === 'googlebooks' && matchId) {
                  posterUrl = `https://books.google.com/books/content?id=${matchId}&printsec=frontcover&img=1&zoom=1`;
                }
                if (!posterUrl && (matchSource === 'openlibrary' || matchSource === 'open_library') && matchId) {
                  posterUrl = `https://covers.openlibrary.org/b/olid/${matchId.replace(/^works\//, '')}-L.jpg`;
                }
                return {
                  title: match.title || item.title,
                  type: match.type || item.type || item.media_type,
                  poster_url: posterUrl,
                  year: match.year || item.year,
                  external_id: matchId,
                  external_source: matchSource,
                };
              }
            }
          } catch (e) {
            console.error('Failed to enrich recommendation:', e);
          }
          
          return {
            title: item.title,
            type: item.type || item.media_type,
            poster_url: item.poster_url || item.poster || item.image_url || '',
            year: item.year,
            external_id: item.external_id || item.id,
            external_source: item.external_source || item.source,
          };
        })
      );
      
      return enrichedRecs;
    },
    enabled: !!session?.access_token && !!mediaItem?.title,
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
  });

  // Fetch user's lists (including custom lists)
  const { data: userListsData } = useQuery({
    queryKey: ['user-lists-with-media'],
    queryFn: async () => {
      if (!session?.access_token) return null;

      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-lists-with-media", {
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch lists');
      return response.json();
    },
    enabled: !!session?.access_token,
  });

  const customLists = userListsData?.lists?.filter((list: any) => list.isCustom) || [];

  // Query to find which lists contain this media item
  const { data: listsContainingMedia = [] } = useQuery({
    queryKey: ['lists-containing-media', params?.source, params?.id],
    queryFn: async () => {
      if (!user?.id || !params?.id || !params?.source) return [];
      
      const { data, error } = await supabase
        .from('list_items')
        .select(`
          id,
          list_id,
          title,
          lists!inner (
            id,
            title,
            is_default
          )
        `)
        .eq('external_id', params.id)
        .eq('external_source', params.source)
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Error fetching lists containing media:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!user?.id && !!params?.id && !!params?.source,
  });

  // On-demand DNA match: scores THIS title against your taste profile (server-cached)
  const { data: dnaRecMatch } = useQuery({
    queryKey: ['dna-match-score', user?.id, params?.source, params?.id],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const res = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/score-media-match`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            external_source: params?.source,
            external_id: params?.id,
            media_type: params?.type,
            title: (mediaItem as any)?.title,
            creator: (mediaItem as any)?.creator,
            genres: (mediaItem as any)?.genres || [],
            description: (mediaItem as any)?.description,
          }),
        }
      );
      if (!res.ok) return null;
      const json = await res.json();
      return typeof json.score === 'number' ? json : null;
    },
    enabled: !!user?.id && !!params?.id && !!params?.source && !!(mediaItem as any)?.title && userRatingFetched && !userRating?.rating,
    staleTime: 30 * 60 * 1000,
    retry: false,
  });

  // Small hero pill: which of the user's system lists holds this item
  const LIST_STATUS_PRIORITY = ["Currently", "Want To", "Finished", "Did Not Finish", "Favorites"];
  const systemListTitles = (listsContainingMedia as any[])
    .map((item: any) => item.lists)
    .filter((l: any) => l?.is_default)
    .map((l: any) => l.title);
  const onListStatus = LIST_STATUS_PRIORITY.find(t => systemListTitles.includes(t)) || null;

  // Query: is this media in the user's "Currently" list?
  // Uses the same edge function as my-library (handles user ID resolution server-side)
  const { data: currentlyItem, refetch: refetchCurrentlyItem } = useQuery({
    queryKey: ['currently-item', params?.source, params?.id, user?.id],
    queryFn: async () => {
      if (!user?.id || !session?.access_token || !params?.id || !params?.source) return null;
      const res = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-lists-with-media?user_id=${user.id}`,
        { headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const currentlyList = (data.lists || []).find((l: any) => l.title === 'Currently');
      if (!currentlyList?.items) return null;
      const match = currentlyList.items.find(
        (item: any) => item.external_id === params.id && item.external_source === params.source
      );
      return match || null;
    },
    enabled: !!user?.id && !!session?.access_token && !!params?.id && !!params?.source,
    staleTime: 0,
  });

  // Sync sheet state when currently item loads
  useEffect(() => {
    if (currentlyItem) {
      const t = currentlyItem.progress_total ?? currentlyItem.total ?? 0;
      const p = currentlyItem.progress ?? 0;
      const m = currentlyItem.progress_mode || (params?.type === 'book' ? 'page' : 'percent');
      setEditProgress(p);
      setEditTotal(t);
      setEditMode(m as any);
    }
  }, [currentlyItem?.id, currentlyItem?.progress, currentlyItem?.total]);

  // Update progress mutation (for media detail page)
  const updateProgressMutation = useMutation({
    mutationFn: async ({ progress, total, mode }: { progress: number; total: number; mode: string }) => {
      if (!currentlyItem?.id || !session?.access_token) throw new Error('Not available');
      const res = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/update-item-progress', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: currentlyItem.id, progress, total, progress_mode: mode }),
      });
      if (!res.ok) throw new Error('Failed to update progress');
      return res.json();
    },
    onSuccess: () => {
      setIsProgressSheetOpen(false);
      refetchCurrentlyItem();
      toast({ title: 'Progress updated' });
    },
  });

  // Delete list item mutation
  const deleteListItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/delete-list-item", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ itemId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to remove item: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      queryClient.invalidateQueries({ queryKey: ['lists-containing-media', params?.source, params?.id] });
      queryClient.invalidateQueries({ queryKey: ['user-lists'] });
      toast({
        title: "Removed from list",
        description: "Item has been removed from your list",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to remove",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRemoveFromList = (itemId: string, listTitle: string) => {
    if (confirm(`Remove from "${listTitle}"?`)) {
      deleteListItemMutation.mutate(itemId);
    }
  };

  // Delete review mutation
  const deleteReviewMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      // Delete using Supabase client directly
      const { error } = await supabase
        .from('social_posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user.id); // Ensure user can only delete their own posts

      if (error) {
        console.error('Delete error:', error);
        throw new Error('Failed to delete review');
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-feed'] });
      queryClient.invalidateQueries({ queryKey: ['media-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['media-social-activity', params?.source, params?.id] });
      queryClient.invalidateQueries({ queryKey: ['user-media-rating', params?.source, params?.id] });
      toast({
        title: "Review deleted",
        description: "Your review has been removed",
      });
    },
  });

  const handleDeleteReview = async (postId: string) => {
    if (confirm('Are you sure you want to delete this review?')) {
      await deleteReviewMutation.mutateAsync(postId);
    }
  };


  // Mutation for adding current media to lists
  const addMediaToListMutation = useMutation({
    mutationFn: async ({ listType, isCustom, skipSocialPost }: { listType: string; isCustom?: boolean; skipSocialPost?: boolean }) => {
      if (!session?.access_token || !mediaItem) {
        throw new Error("Authentication required");
      }

      const endpoint = isCustom 
        ? "https://mahpgcogwpawvviapqza.supabase.co/functions/v1/add-to-custom-list"
        : "https://mahpgcogwpawvviapqza.supabase.co/functions/v1/track-media";

      const body = isCustom
        ? {
            listId: listType,
            title: mediaItem.title,
            type: mediaItem.type || params?.type,
            creator: mediaItem.creator,
            image_url: resolvedImageUrl,
            media_type: mediaItem.type || params?.type,
          }
        : {
            media: {
              title: mediaItem.title,
              mediaType: mediaItem.type || params?.type,
              creator: mediaItem.creator,
              imageUrl: resolvedImageUrl,
              externalId: params?.id,
              externalSource: params?.source,
              description: mediaItem.description || null
            },
            rating: null,
            review: null,
            listType: listType,
            skip_social_post: skipSocialPost ?? false
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('Failed to add media to list');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'], exact: true });
      queryClient.invalidateQueries({ queryKey: ['lists-containing-media'] });
      setTimeout(() => queryClient.refetchQueries({ queryKey: ['social-feed'] }), 800);
    },
    onError: (error) => {
      toast({
        title: "Failed to add to list",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleComposePost = async ({ title, body, tag }: { title: string; body: string; tag: string }): Promise<boolean> => {
    if (!session?.access_token || !mediaItem) return false;
    const text = [title, body].map((s) => s.trim()).filter(Boolean).join("\n\n");
    setIsComposePosting(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Not authenticated');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';

      if (tag === 'predict') {
        const filledOptions = composePredictionOptions.filter(opt => opt.trim());
        const question = title.trim() || body.trim();
        if (!question || filledOptions.length < 2) {
          toast({ title: "Add a question and at least 2 options", variant: "destructive" });
          setIsComposePosting(false);
          return false;
        }
        const predResponse = await fetch(`${supabaseUrl}/functions/v1/create-prediction`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question,
            options: filledOptions,
            type: "predict",
            media_external_id: params?.id || null,
            media_external_source: params?.source || null,
            media_title: mediaItem?.title || null,
            media_type: (mediaItem?.type || params?.type || null),
          }),
        });
        if (!predResponse.ok) throw new Error("Failed to create prediction");
      } else {
        const rating = tag === 'rate' && composeRating > 0 ? composeRating : null;
        if (!text && !rating) {
          setIsComposePosting(false);
          return false;
        }
        await supabase.from('social_posts').insert({
          user_id: authUser.id,
          content: text || null,
          post_type: rating ? 'rate-review' : (tag && tag !== 'rate' ? tag : 'thought'),
          rating,
          visibility: 'public',
          media_title: mediaItem.title,
          media_type: (mediaItem.type || params?.type || 'movie').toLowerCase(),
          media_external_id: params?.id,
          media_external_source: params?.source || 'tmdb',
          image_url: resolvedImageUrl || '',
          fire_votes: 0,
          ice_votes: 0,
        });
        if (rating) {
          const { error: ratingErr } = await supabase.from('media_ratings').upsert({
            user_id: authUser.id,
            media_external_id: params?.id,
            media_external_source: params?.source || 'tmdb',
            media_title: mediaItem.title,
            media_type: (mediaItem.type || params?.type || 'movie').toLowerCase(),
            rating,
          }, { onConflict: 'user_id,media_external_id,media_external_source' });
          if (ratingErr) console.error('Failed to save rating:', ratingErr);
        }
      }

      if (composeSelectedList) {
        addMediaToListMutation.mutate({ 
          listType: composeSelectedList.isCustom ? composeSelectedList.id! : composeSelectedList.name, 
          isCustom: composeSelectedList.isCustom,
          skipSocialPost: true  // compose handler already created its own social post above
        });
      }

      setComposeRating(0);
      setComposeHoverRating(0);
      setComposeSelectedList(null);
      setComposePredictionOptions(["", ""]);
      queryClient.invalidateQueries({ queryKey: ['social-feed'] });
      queryClient.invalidateQueries({ queryKey: ['media-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['media-social-activity', params?.source, params?.id] });
      queryClient.invalidateQueries({ queryKey: ['user-media-rating', params?.source, params?.id] });
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      toast({ title: "Posted!", description: "Your post has been shared." });
      setIsComposePosting(false);
      setComposerOpen(false);
      return true;
    } catch (error) {
      console.error('Compose post error:', error);
      toast({ title: "Couldn't post", description: "Please try again.", variant: "destructive" });
      setIsComposePosting(false);
      return false;
    }
  };

  const handleAddMediaToList = (listType: string, isCustom: boolean = false) => {
    addMediaToListMutation.mutate({ listType, isCustom });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation onTrackConsumption={handleTrackConsumption} />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (!mediaItem) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation onTrackConsumption={handleTrackConsumption} />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Use wouter navigation for reliable routing - fallback to activity feed
              setLocation('/');
            }}
            className="mb-4 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            data-testid="button-back"
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </Button>

          <div className="max-w-md mx-auto mt-16">
            <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ExternalLink className="text-purple-600" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Media Not Available
              </h2>
              <p className="text-gray-600 mb-6">
                We couldn't find detailed information for this item. It might be unavailable or not yet in our database.
              </p>
              <div className="space-y-3">
                <Button
                  onClick={() => setLocation('/track')}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  data-testid="button-browse-media"
                >
                  Browse Your Media
                </Button>
                <Button
                  onClick={() => setLocation('/')}
                  variant="outline"
                  className="w-full border-gray-300 text-gray-700 hover:bg-gray-100"
                  data-testid="button-go-back"
                >
                  Go to Feed
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Use fetched data or fallback to mock data structure
  const getBooksCoverUrl = (id: string) => `https://books.google.com/books/content?id=${id}&printsec=frontcover&img=1&zoom=1`;
  const getOpenLibraryCoverUrl = (id: string) => {
    const cleanId = id.replace(/^works\//, '');
    // ISBNs are all digits (possibly with hyphens) — use isbn endpoint
    if (/^[\d-]+$/.test(cleanId)) {
      return `https://covers.openlibrary.org/b/isbn/${cleanId}-L.jpg`;
    }
    return `https://covers.openlibrary.org/b/olid/${cleanId}-L.jpg`;
  };
  const resolvedImageUrl = (() => {
    const src = params?.source || mediaItem?.external_source;
    const eid = params?.id || mediaItem?.external_id;
    // Prefer the artwork returned directly by the API (already validated/HTTPS-corrected)
    const apiArtwork = mediaItem?.artwork || mediaItem?.image_url || mediaItem?.poster_url || '';
    console.log('[media-detail] resolvedImageUrl debug:', { src, eid, artwork: mediaItem?.artwork, image_url: mediaItem?.image_url, poster_url: mediaItem?.poster_url });
    if (apiArtwork) return apiArtwork;
    // Fallback: construct cover URL from external ID for book sources
    if (src === 'googlebooks' && eid) {
      return getBooksCoverUrl(eid);
    }
    if ((src === 'openlibrary' || src === 'open_library') && eid) {
      return getOpenLibraryCoverUrl(eid);
    }
    return '';
  })();

  const mediaData = mediaItem || {
    id: "spotify_0Yzd0g8NYmn27k2HFNplv7",
    title: "SmartLess",
    creator: "Jason Bateman, Sean Hayes, Will Arnett",
    type: "Podcast",
    provider: "Spotify",
    artwork: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400&h=400&fit=crop",
    description: "Jason Bateman, Sean Hayes, and Will Arnett invite their favorite people for uninformed conversations.",
    rating: 4.8,
    totalEpisodes: 245,
    subscribers: "2.1M",
    category: "Comedy",
    language: "English",
    releaseDate: "2020-07-20",
    lastEpisode: "2024-01-15",
    averageLength: "45 min"
  };

  // Find user's own rating
  const userReview = reviews.find((review: any) => review.user_id === user?.id);

  // Reusable take card (used by both Trending Takes and Join the Conversation).
  // Room-style helpers for the threaded conversation look
  const TAKE_AVATAR_COLORS = ['#7c3aed', '#db2777', '#0891b2', '#ca8a04', '#16a34a', '#dc2626', '#2563eb', '#9333ea'];
  const takeTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // sectionKey scopes which card is expanded so the same post shown in two
  // sections doesn't expand in both at once.
  const renderTakeCard = (post: any, sectionKey: string) => {
    const cardId = `${sectionKey}:${post.id}`;
    const rawName = post.users?.display_name || post.users?.user_name || '';
    const fullName = rawName.includes('+') ? (rawName.split('+').pop() || rawName) : (rawName || 'Someone');
    // Display as "First L." so it reads as the commenter, not the media's creator
    const name = (() => {
      const parts = fullName.trim().split(/\s+/);
      return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : (parts[0] || 'Someone');
    })();
    const initial = (name[0] || '?').toUpperCase();
    const isExpanded = expandedTake === cardId;
    const isLiked = likedPosts.has(post.id);
    const isDisagreed = disagreedTakes.has(post.id);
    const hasText = !!(post.content && post.content.trim());
    const ratingVal = Number(post.rating) || 0;
    const avatarBg = TAKE_AVATAR_COLORS[(name.charCodeAt(0) || 0) % TAKE_AVATAR_COLORS.length];
    const commentCount = expandedComments[post.id]?.length ?? Number(post.comments_count) ?? 0;
    // "Just a rating" rows: synthetic media_ratings rows, or posts whose only
    // content is the auto "Added X to <list>" text. Render them as one compact
    // line (name + star left, agree/disagree right) instead of a full card.
    const isAutoListText = hasText && /^added .+ to .+/i.test(post.content.trim());
    const isCompactRating = ratingVal > 0 && (post._ratingOnly || !hasText || isAutoListText);
    const toggleExpand = () => {
      if (post._ratingOnly) return;
      const next = isExpanded ? null : cardId;
      setExpandedTake(next);
      setReplyContent('');
      if (next) { setReplyingTo(post.id); fetchComments(post.id); }
      else { setReplyingTo(null); }
    };
    if (isCompactRating) {
      return (
        <div key={cardId} className="py-3" data-testid={`take-card-${post.id}`}>
          <div className="flex items-center gap-0.5 mb-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`w-7 h-7 ${n <= Math.round(ratingVal) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] font-semibold text-gray-600 truncate">— {name}</span>
            {post.created_at && <span className="text-gray-400 text-[12px] shrink-0">{takeTimeAgo(post.created_at)}</span>}
            {!post._ratingOnly && (
              <div className="ml-auto flex items-center gap-1.5 text-gray-400 shrink-0">
                <button
                  onClick={() => handleLike(post.id)}
                  className={`active:scale-90 transition-transform ${isLiked ? 'text-orange-500' : ''}`}
                  aria-label="Hot take"
                  data-testid={`take-agree-${post.id}`}
                >
                  <Flame size={16} strokeWidth={2.5} className={isLiked ? 'fill-orange-500' : ''} />
                </button>
                <span className="text-[12px] font-medium text-gray-500">{Number(post.likes_count) || 0}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    // Content-first card: rating stars up top, the take itself as the headline,
    // then a quiet byline (name · time) with actions — Reddit-style.
    return (
      <div key={cardId} className="py-4" data-testid={`take-card-${post.id}`}>
        {ratingVal > 0 && (
          <div className="flex items-center gap-0.5 mb-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`w-7 h-7 ${n <= Math.round(ratingVal) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}`}
              />
            ))}
          </div>
        )}
        <button onClick={toggleExpand} className="block w-full text-left" data-testid={`take-toggle-${post.id}`}>
          <p className={`text-[15px] leading-relaxed ${hasText ? 'text-gray-900' : 'text-gray-400 italic'} ${isExpanded ? '' : 'line-clamp-4'}`}>
            {hasText ? post.content : 'Rated it — no take yet'}
          </p>
        </button>

        {/* Byline + actions */}
        <div className="flex items-center gap-2 mt-2 min-w-0">
          <span className="text-[13px] font-semibold text-gray-600 truncate">— {name}</span>
          {post.created_at && <span className="text-gray-400 text-[12px] shrink-0">{takeTimeAgo(post.created_at)}</span>}
          {(() => {
            const tag = dbTagToDisplay(post.post_type);
            if (!tag) return null;
            return (
              <span
                className="px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase rounded-sm shrink-0"
                style={{ backgroundColor: tag.bg, color: tag.fg }}
                data-testid={`take-tag-${post.id}`}
              >
                {tag.label}
              </span>
            );
          })()}
          {!post._ratingOnly && (
            <div className="ml-auto flex items-center gap-4 text-gray-400 shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleLike(post.id)}
                  className={`active:scale-90 transition-transform ${isLiked ? 'text-orange-500' : ''}`}
                  aria-label="Hot take"
                  data-testid={`take-agree-${post.id}`}
                >
                  <Flame size={16} strokeWidth={2.5} className={isLiked ? 'fill-orange-500' : ''} />
                </button>
                <span className="text-[12px] font-medium text-gray-500">{Number(post.likes_count) || 0}</span>
              </div>
              <button
                onClick={toggleExpand}
                className="text-[12px] font-medium active:text-purple-600"
                data-testid={`take-reply-${post.id}`}
              >
                Reply{commentCount > 0 ? ` · ${commentCount}` : ''}
              </button>
              <ReportButton contentType="post" contentId={String(post.id)} className="text-gray-300 hover:text-red-500 [&_svg]:w-3.5 [&_svg]:h-3.5" />
            </div>
          )}
        </div>

        <div className="min-w-0">
          {/* Expanded thread — comments + reply input */}
          {!post._ratingOnly && isExpanded && (
            <div className="mt-3">
              {expandedComments[post.id]?.length > 0 && (
                <div className="space-y-3 border-l-2 border-gray-100 pl-3 mb-3">
                  {expandedComments[post.id].map((comment: any) => renderComment(comment, post.id))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 min-w-0"
                  onFocus={() => { setReplyingTo(post.id); fetchComments(post.id); }}
                >
                  <MentionInput
                    value={replyingTo === post.id ? replyContent : ''}
                    onChange={(v) => { setReplyingTo(post.id); setReplyContent(v); }}
                    session={session}
                    onSubmit={() => handleReply(post.id)}
                    placeholder="Write a reply…"
                    className="flex-1 h-auto bg-gray-50 border border-gray-200 rounded-full px-4 py-1.5 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-0"
                    testId={`take-input-${post.id}`}
                  />
                </div>
                {replyingTo === post.id && !!replyContent.trim() && (
                  <button
                    onClick={() => handleReply(post.id)}
                    disabled={replyMutation.isPending}
                    className="text-sm font-semibold text-purple-600 disabled:text-gray-300"
                    data-testid={`take-send-${post.id}`}
                  >
                    Post
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={handleTrackConsumption} />

      {/* Full-bleed purple hero */}
      <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] text-white">
        <div className="max-w-6xl mx-auto px-4 pt-3 pb-10">
          {/* Back button inline with content */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/', { replace: true })}
            className="mb-3 -ml-2 text-gray-300 hover:text-white hover:bg-white/10 h-8"
            data-testid="button-back"
          >
            <ArrowLeft size={18} className="text-gray-300" />
            <span className="ml-1 text-sm">Back</span>
          </Button>

          {/* Side-by-side layout on all screen sizes */}
          <div className="flex gap-4">
            {/* Poster - smaller and fixed width */}
            <div className="relative flex-shrink-0">
              <div className="w-32 h-48 md:w-40 md:h-60 rounded-xl overflow-hidden shadow-lg ring-1 ring-white/10">
                <img 
                  src={resolvedImageUrl} 
                  alt={mediaItem.title}
                  className="w-full h-full object-cover"
                />
              </div>
              {session && (
                <button
                  onClick={() => setIsListSheetOpen(true)}
                  className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md hover:bg-black/70 text-white shadow-lg flex items-center justify-center ring-1 ring-white/40 transition-colors"
                  data-testid="button-quick-add"
                >
                  <Plus size={16} />
                </button>
              )}
              {session && !(Number(userRating?.rating || userReview?.rating) > 0) && typeof dnaRecMatch?.score === 'number' && (
                <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 whitespace-nowrap rounded-full bg-[#2a1b4a] ring-1 ring-purple-400/30 shadow-lg px-2.5 py-1" data-testid="card-dna-match">
                  <Dna className="w-3 h-3 text-purple-300" />
                  <span className="text-[11px] font-medium text-purple-200">{dnaRecMatch.score}% match</span>
                </span>
              )}
            </div>
            
            {/* Info column */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h1 className="text-lg md:text-2xl font-semibold text-white leading-tight mb-1">{mediaData.title}</h1>
                <button
                  onClick={handleShare}
                  className="flex-shrink-0 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                  data-testid="button-share"
                >
                  <Share size={18} />
                </button>
              </div>
              <p className="text-sm text-gray-400 mb-2 truncate">
                by {mediaData.creator}
                {mediaItem.releaseDate && <span> · {new Date(mediaItem.releaseDate).getFullYear()}</span>}
              </p>
              <div className="border-t border-white/[0.05] my-2.5 mr-4" />
          {/* Runtime / seasons — small line under the byline */}
              {(() => {
                const bits: JSX.Element[] = [];
                const runtimeLabel = (() => {
                  const raw = String(mediaItem.averageLength || '').trim();
                  if (!raw) return null;
                  // Already in "1h 30m" style — keep as-is
                  const hm = raw.match(/(\d+)\s*h(?:\s*(\d+)\s*m)?/i);
                  if (hm) return `${hm[1]}h${hm[2] ? ` ${hm[2]}m` : ''}`;
                  // Minute-only forms like "173 min" / "~173 min"
                  const minMatch = raw.match(/(\d+)/);
                  const m = minMatch ? parseInt(minMatch[1], 10) : NaN;
                  if (!m || isNaN(m)) return null;
                  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m} min`;
                })();
                if (mediaItem.type === 'tv' && mediaItem.totalSeasons > 0) {
                  bits.push(<span key="s" className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-gray-400" />{mediaItem.totalSeasons} {mediaItem.totalSeasons === 1 ? 'season' : 'seasons'}</span>);
                } else if ((mediaItem.type === 'tv' || mediaItem.type === 'Podcast') && mediaItem.totalEpisodes > 1) {
                  bits.push(<span key="e" className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-gray-400" />{mediaItem.totalEpisodes} eps</span>);
                }
                if (runtimeLabel && mediaItem.type !== 'tv') bits.push(<span key="r" className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-gray-400" />{runtimeLabel}</span>);
                if (avgRating) bits.push(
                  <span key="c" className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-yellow-400 fill-current" />
                    <span className="font-semibold text-white">{avgRating}</span>
                    <span className="text-gray-400">Consumed</span>
                  </span>
                );
                if (mediaItem.tmdb_score) bits.push(
                  <span key="i" className="flex items-center gap-1.5">
                    <span className="font-semibold text-white">{Number(mediaItem.tmdb_score).toFixed(1)}</span>
                    <span className="text-gray-400">IMDb</span>
                  </span>
                );
                if (mediaItem.google_books_rating) bits.push(
                  <span key="b" className="flex items-center gap-1.5">
                    <span className="font-semibold text-white">{Number(mediaItem.google_books_rating).toFixed(1)}</span>
                    <span className="text-gray-400">Books</span>
                  </span>
                );
                return bits.length > 0 ? (
                  <div className="mb-0 flex flex-wrap items-center text-sm text-gray-300">
                    {bits.map((b, i) => (
                      <span key={i} className="flex items-center">
                        {i > 0 && <span className="mx-2 text-gray-500">·</span>}
                        {b}
                      </span>
                    ))}
                  </div>
                ) : null;
              })()}

            {/* Available on — minimal, deduped provider chips */}
              {mediaItem.platforms && mediaItem.platforms.length > 0 && (
                <><div className="border-t border-white/[0.05] my-2.5 mr-4" /><div className="-ml-1.5 flex flex-wrap items-center gap-1.5">
                  {(() => {
                    const baseName = (n: string) => {
                      let v = (n || '').replace(/\s+(standard\s+)?with ads.*$/i, '').replace(/\s+(premium|basic|standard)$/i, '').trim();
                      if (/amazon\s+channel$/i.test(v)) return 'Amazon';
                      if (/apple\s*tv\s+channel$/i.test(v)) return 'Apple TV';
                      if (/roku(\s+premium)?\s+channel$/i.test(v)) return 'Roku';
                      return v;
                    };
                    const seen = new Set<string>();
                    const sorted = [...(mediaItem.platforms as any[])].sort((a: any, b: any) => (a.name || '').length - (b.name || '').length);
                    const unique = sorted.filter((pf: any) => {
                      const b = baseName(pf.name).toLowerCase();
                      if (!b || seen.has(b)) return false;
                      seen.add(b);
                      return true;
                    });
                    const MAX_VISIBLE = 1;
                    const visible = showAllPlatforms ? unique : unique.slice(0, MAX_VISIBLE);
                    const hiddenCount = unique.length - MAX_VISIBLE;
                    const chips = visible.map((platform: any, index: number) => {
                      const label = baseName(platform.name);
                      const inner = (
                        <>
                          {platform.logo && <img src={platform.logo} alt={label} className="w-4 h-4 rounded-[3px] object-contain" />}
                          <span className="text-sm text-white">{label}</span>
                        </>
                      );
                      return platform.url ? (
                        <a key={index} href={platform.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-white/10 transition-colors">
                          {inner}
                        </a>
                      ) : (
                        <div key={index} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md">
                          {inner}
                        </div>
                      );
                    });
                    return (
                      <>
                        {chips}
                        {hiddenCount > 0 && (
                          <button
                            onClick={() => setShowAllPlatforms(v => !v)}
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-sm text-purple-300 hover:bg-white/10 transition-colors"
                          >
                            {showAllPlatforms ? 'less' : `+${hiddenCount} more`}
                            <ChevronDown size={13} className={`transition-transform ${showAllPlatforms ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div></>
              )}


            </div>
          </div>

          {/* Match card + tap-to-rate + add to list — only for titles you haven't rated */}
          {session && (() => {
            const ownRating = Number(userRating?.rating || userReview?.rating) || 0;
            const isRated = ownRating > 0;
            // Big tappable star with half-star support (left half = .5, right half = full)
            const heroStar = (n: number, current: number, interactive: boolean) => {
              const isFull = current >= n;
              const isHalf = !isFull && current >= n - 0.5;
              return (
                <div key={n} className="relative w-11 h-11">
                  <Star className="absolute inset-0 w-11 h-11 text-purple-400/60" strokeWidth={1.5} fill="none" />
                  {(isFull || isHalf) && (
                    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ width: isFull ? '100%' : '50%' }}>
                      <Star className="w-11 h-11 text-purple-400 fill-purple-400" strokeWidth={1.5} />
                    </div>
                  )}
                  {interactive && (
                    <>
                      <button
                        type="button"
                        aria-label={`Rate ${n - 0.5} stars`}
                        className="absolute inset-y-0 left-0 w-1/2 z-10"
                        onClick={() => quickRate(n - 0.5)}
                        data-testid={`button-quick-rate-${n - 0.5}`}
                      />
                      <button
                        type="button"
                        aria-label={`Rate ${n} stars`}
                        className="absolute inset-y-0 right-0 w-1/2 z-10"
                        onClick={() => quickRate(n)}
                        data-testid={`button-quick-rate-${n}`}
                      />
                    </>
                  )}
                </div>
              );
            };
            const quickRate = (val: number) => {
              setComposeRating(val);
              setComposerOpen(true);
              setTimeout(() => composeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
            };
            return (
            <div className="mt-6">
              <div className="rounded-2xl border border-purple-300/15 bg-black/20 px-4 py-4" data-testid="card-rate-title">
                <p className="text-center text-[11px] font-semibold tracking-widest uppercase text-gray-400">{isRated ? 'Your rating' : 'Rate this title'}</p>
                <div className="mt-3 flex items-center justify-center gap-3">
                  {[1, 2, 3, 4, 5].map((n) => heroStar(n, isRated ? ownRating : composeRating, !isRated))}
                </div>
                {!isRated ? (
                  <p className="mt-2 text-center text-xs text-gray-400">Tap to rate · tap left side for ½</p>
                ) : (
                  <p className="mt-2 text-center text-xs text-gray-400">You rated this {ownRating % 1 === 0 ? ownRating : ownRating.toFixed(1)} out of 5</p>
                )}
                <button
                  type="button"
                  onClick={() => setIsListSheetOpen(true)}
                  className={`mt-4 w-full flex items-center justify-center gap-1.5 rounded-full text-sm font-semibold py-3 transition-colors ${onListStatus
                    ? 'border border-purple-300/25 text-purple-200 hover:bg-purple-500/10'
                    : 'bg-gradient-to-r from-purple-700 to-purple-500 hover:from-purple-600 hover:to-purple-400 text-white shadow-sm'}`}
                  data-testid="button-hero-add-to-list"
                >
                  {onListStatus ? (
                    <>On your {onListStatus === 'Want To' ? 'Want To' : onListStatus} list <ChevronDown className="w-4 h-4" /></>
                  ) : (
                    <><Plus className="w-4 h-4" /> Add to my list</>
                  )}
                </button>
              </div>
            </div>
            );
          })()}

          {/* Description — starts open, clamped, with Read more */}
          {mediaItem.description && (
            <div className="mt-6">
              <p className={`text-sm text-gray-300 leading-relaxed ${showAbout ? '' : 'line-clamp-1'}`}>
                {mediaItem.genres?.length > 0 && (
                  <span className="italic text-gray-400" data-testid="text-genres">{mediaItem.genres.slice(0, 2).join(', ')} — </span>
                )}
                {mediaItem.description}
              </p>
              <button
                onClick={() => setShowAbout(!showAbout)}
                className="mt-1.5 text-sm text-purple-300 hover:text-purple-200 transition-colors"
                data-testid="button-toggle-description"
              >
                {showAbout ? 'Show less' : 'Read more'}
              </button>
            </div>
          )}

          {/* Stat row — hidden for now until there's more engagement (flip false → true to restore) */}
          {false && (
          <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-white/10">
            <button onClick={() => setShowReviews(true)} className="flex flex-col items-center gap-1 py-1" data-testid="stat-hot-takes">
              <Flame className="w-5 h-5 text-orange-400" />
              <span className="text-base font-bold text-white">{formatCount(takes.length)}</span>
              <span className="text-[11px] text-gray-400">Hot Takes</span>
            </button>
            <div className="flex flex-col items-center gap-1 py-1" data-testid="stat-theories">
              <Lightbulb className="w-5 h-5 text-purple-300" />
              <span className="text-base font-bold text-white">{formatCount(theoriesCount)}</span>
              <span className="text-[11px] text-gray-400">Theories</span>
            </div>
            <div className="flex flex-col items-center gap-1 py-1" data-testid="stat-predictions">
              <Target className="w-5 h-5 text-pink-400" />
              <span className="text-base font-bold text-white">{formatCount(predictions.length)}</span>
              <span className="text-[11px] text-gray-400">Predictions</span>
            </div>
            <div className="flex flex-col items-center gap-1 py-1" data-testid="stat-fans">
              <Users className="w-5 h-5 text-blue-300" />
              <span className="text-base font-bold text-white">{formatCount(fansCount)}</span>
              <span className="text-[11px] text-gray-400">Fans Here</span>
            </div>
          </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-6 pb-8">
          {/* Your Reaction — dark purple pill button that expands the composer inline */}
          {session && (
          <div ref={composeSectionRef} className="mb-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Share Your Take</h3>
            {!composerOpen && (
              <button
                type="button"
                onClick={() => setComposerOpen(true)}
                className="w-full flex items-center gap-3 rounded-full bg-white border border-gray-200 px-4 py-3 text-left shadow-sm hover:border-purple-300 transition-colors active:scale-[0.99]"
                data-testid="button-open-composer"
              >
                <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                  <Sparkles size={14} className="text-purple-600" />
                </div>
                <span className="text-[14px] text-gray-500">{TAKE_PROMPTS[promptIdx]}</span>
              </button>
            )}
            {composerOpen && (
            <RoomComposer
              tags={MEDIA_TAGS}
              defaultTag="rate"
              compactTags
              hideTitle
              hideTags
              bodyRows={6}
              posting={isComposePosting}
              bodyPlaceholder="What do you think?"
              onSubmit={handleComposePost}
              canSubmit={({ title, body }) => {
                const hasText = !!(title.trim() || body.trim());
                return hasText || composeRating > 0;
              }}
              footerExtra={<StarRater value={composeRating} onChange={setComposeRating} />}
            />
            )}
          </div>
          )}

          {/* What People Are Saying — all takes by likes, click a card to respond */}
          {!showReviews && (() => {
            const communityTakes = (mergedTakes as any[])
              .slice()
              .sort((a, b) => {
                // Likes first, written takes above rating-only cards, then newest
                const likeDiff = (Number(b.likes_count) || 0) - (Number(a.likes_count) || 0);
                if (likeDiff !== 0) return likeDiff;
                const aText = a.content && a.content.trim() ? 1 : 0;
                const bText = b.content && b.content.trim() ? 1 : 0;
                if (bText !== aText) return bText - aText;
                return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
              });
            if (communityTakes.length === 0) {
              return (
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-gray-900 mb-0.5">What people are saying...</h3>
                  <div className="py-8 text-center">
                    <p className="text-sm text-gray-500 mb-2">Quiet in here so far. Someone has to go first —</p>
                    <button
                      onClick={() => { setComposerOpen(true); setTimeout(() => composeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }}
                      className="text-sm font-semibold text-purple-600"
                      data-testid="button-first-take"
                    >
                      Share the first take
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div className="mb-4">
                <h3 className="text-base font-semibold text-gray-900 mb-1">What people are saying...</h3>
                <div className="divide-y divide-gray-200/80">
                  {communityTakes.map((post: any) => renderTakeCard(post, 'trending'))}
                </div>
              </div>
            );
          })()}

          {/* Activity Section — full reviews list (opened via the Hot Takes stat) */}
          {showReviews && (
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">

            {showReviews && (
              <>
                {/* Your Rating - always show at top if user has rated */}
                {(userReview || userRating) && (
                  <div className="bg-purple-50 rounded-xl p-4 mt-3 border border-purple-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-purple-700">Your Rating</span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          <span className="font-bold text-gray-900">{userReview?.rating || userRating?.rating}</span>
                        </div>
                        <button
                          onClick={async () => {
                            if (!confirm('Delete your rating and review for this media?')) return;
                            try {
                              if (userReview) {
                                await supabase.from('social_posts').delete().eq('id', userReview.id).eq('user_id', user?.id);
                              }
                              await supabase.from('media_ratings').delete().eq('media_external_id', params?.id).eq('media_external_source', params?.source).eq('user_id', user?.id);
                              queryClient.invalidateQueries({ queryKey: ['media-social-activity', params?.source, params?.id] });
                              queryClient.invalidateQueries({ queryKey: ['user-media-rating', params?.source, params?.id] });
                              queryClient.invalidateQueries({ queryKey: ['social-feed'] });
                              toast({ title: "Rating deleted", description: "Your rating has been removed" });
                            } catch (err) {
                              toast({ title: "Error", description: "Failed to delete rating", variant: "destructive" });
                            }
                          }}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete your rating"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {userReview?.content && (
                      <p className="text-gray-700 text-sm leading-relaxed mt-2">{userReview.content}</p>
                    )}
                    <p className="text-xs text-purple-500 mt-2">
                      Rated on {new Date(userReview?.created_at || userRating?.created_at).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </p>
                  </div>
                )}

                {/* Other Reviews */}
                {discussionPosts.filter((r: any) => r.user_id !== user?.id).length > 0 ? (
              <div className="space-y-4 mt-3">
                  {discussionPosts.filter((r: any) => r.user_id !== user?.id).map((review: any) => (
                    <div key={review.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-purple-600 text-sm font-medium">
                              {review.users?.display_name?.[0]?.toUpperCase() || review.users?.user_name?.[0]?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {review.users?.user_name || review.users?.display_name || 'Anonymous'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(review.created_at).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric' 
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {review.rating && (
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 text-yellow-500 fill-current" />
                              <span className="font-medium text-gray-900">{review.rating}</span>
                            </div>
                          )}
                          {user?.id === review.user_id && (
                            <button
                              onClick={() => handleDeleteReview(review.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                              data-testid={`button-delete-review-${review.id}`}
                              title="Delete review"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                      {review.content && (
                        <p className="text-gray-700 text-sm leading-relaxed">{review.content}</p>
                      )}
                      {/* Like and Reply Actions */}
                      <div className="flex items-center gap-4 mt-3 pt-2 border-t border-gray-50">
                        <button
                          onClick={() => handleLike(review.id)}
                          className={`flex items-center gap-1 text-xs transition-colors ${
                            likedPosts.has(review.id) ? 'text-red-500' : 'text-gray-400 hover:text-red-500'
                          }`}
                          data-testid={`button-like-review-${review.id}`}
                        >
                          <Heart size={14} className={likedPosts.has(review.id) ? 'fill-current' : ''} />
                          <span>{review.likes_count || 0}</span>
                        </button>
                        <button
                          onClick={() => toggleComments(review.id)}
                          className={`flex items-center gap-1 text-xs transition-colors ${
                            expandedComments[review.id] ? 'text-purple-600' : 'text-gray-400 hover:text-purple-600'
                          }`}
                          data-testid={`button-reply-review-${review.id}`}
                        >
                          <MessageCircle size={14} />
                          <span>{review.comments_count || 0}</span>
                        </button>
                      </div>
                      
                      {/* Comments Section */}
                      {(expandedComments[review.id] || replyingTo === review.id) && (
                        <div className="mt-3 space-y-3">
                          {/* Loading state */}
                          {loadingComments.has(review.id) && (
                            <p className="text-xs text-gray-400">Loading replies...</p>
                          )}
                          
                          {/* Existing comments */}
                          {expandedComments[review.id]?.length > 0 && (
                            <div className="space-y-2 pl-4 border-l-2 border-gray-100">
                              {expandedComments[review.id].map((comment: any) => (
                                <div key={comment.id} className="text-sm group">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <span className="font-medium text-gray-900">{comment.username || 'User'}</span>
                                      <p className="text-gray-700">{comment.content}</p>
                                      <span className="text-xs text-gray-400">
                                        {new Date(comment.created_at).toLocaleDateString()}
                                      </span>
                                    </div>
                                    {user?.id === comment.user_id && (
                                      <button
                                        onClick={() => handleDeleteComment(comment.id, review.id)}
                                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1"
                                        data-testid={`button-delete-comment-${comment.id}`}
                                        title="Delete your comment"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Reply Input */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              placeholder="Write a reply..."
                              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                              onKeyDown={(e) => e.key === 'Enter' && handleReply(review.id)}
                            />
                            <Button
                              size="sm"
                              onClick={() => handleReply(review.id)}
                              disabled={!replyContent.trim() || replyMutation.isPending}
                              className="bg-purple-600 hover:bg-purple-700"
                            >
                              <Send size={14} />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : !userRating && (
                <div className="text-center py-6 mt-4 border border-dashed border-gray-200 rounded-xl">
                  <Star className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm mb-1">No reviews yet</p>
                  <p className="text-gray-400 text-xs">Add your rating using the reaction composer above</p>
                </div>
              )}
              </>
            )}
          </div>
          )}

        {/* Fan Room Banner */}
        {linkedRoom && (
          <button
            onClick={() => setLocation(`/pools/${linkedRoom.id}`)}
            className="w-full flex items-center gap-3 bg-gradient-to-r from-purple-700 to-purple-500 rounded-2xl p-4 shadow-sm text-left mb-4 active:opacity-90"
          >
            {(linkedRoom.media_image || linkedRoom.partner_logo_url) && (
              <img
                src={linkedRoom.media_image || linkedRoom.partner_logo_url}
                alt={linkedRoom.name}
                className="w-12 h-12 rounded-xl object-cover flex-shrink-0 shadow"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm leading-tight mb-0.5">
                Fan of {mediaItem.title}?
              </p>
              <p className="text-purple-200 text-xs leading-snug line-clamp-1">
                Join the room and dive even deeper →
              </p>
            </div>
            <div className="flex-shrink-0 bg-white/20 rounded-xl px-3 py-1.5">
              <span className="text-white text-xs font-bold">Join</span>
            </div>
          </button>
        )}

        {/* Content sections */}
        <div className="space-y-4">
            {/* Predictions */}
            {predictions.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-500" />
                  Predictions ({predictions.length})
                </h2>
                <div className="space-y-4">
                  {predictions.map((pred: any) => (
                    <div key={pred.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-purple-600 text-sm font-medium">
                            {pred.users?.display_name?.[0]?.toUpperCase() || pred.users?.user_name?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 mb-1">
                            {pred.prediction_pools?.title || pred.content}
                          </p>
                          <p className="text-sm text-gray-600">
                            {pred.prediction_pools?.total_participants || 0} participants
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Similar Media Section */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                You Might Also Like
              </h2>
              
              {isSimilarLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                  <span className="ml-2 text-gray-500">Finding similar content...</span>
                </div>
              ) : similarMedia.length > 0 ? (
                <div className="overflow-x-auto -mx-2">
                  <div className="flex gap-3 px-2 pb-2" style={{ minWidth: 'max-content' }}>
                    {similarMedia.map((item: any, index: number) => {
                      const getTypeIcon = (type: string) => {
                        const t = type?.toLowerCase();
                        if (t?.includes('movie')) return <Film className="w-3 h-3" />;
                        if (t?.includes('tv') || t?.includes('series')) return <Tv className="w-3 h-3" />;
                        if (t?.includes('book')) return <BookOpen className="w-3 h-3" />;
                        if (t?.includes('music') || t?.includes('album') || t?.includes('song')) return <Music className="w-3 h-3" />;
                        if (t?.includes('podcast')) return <Mic className="w-3 h-3" />;
                        return <Film className="w-3 h-3" />;
                      };
                      
                      const getTypeColor = (type: string) => {
                        const t = type?.toLowerCase();
                        if (t?.includes('movie')) return 'bg-blue-100 text-blue-700';
                        if (t?.includes('tv') || t?.includes('series')) return 'bg-purple-100 text-purple-700';
                        if (t?.includes('book')) return 'bg-amber-100 text-amber-700';
                        if (t?.includes('music') || t?.includes('album') || t?.includes('song')) return 'bg-green-100 text-green-700';
                        if (t?.includes('podcast')) return 'bg-pink-100 text-pink-700';
                        return 'bg-gray-100 text-gray-700';
                      };

                      const handleClick = () => {
                        // Navigate to media detail if we have IDs, otherwise search
                        if (item.external_id && item.external_source) {
                          setLocation(`/media/${item.type || 'movie'}/${item.external_source}/${item.external_id}`);
                        } else {
                          const searchTerm = item.title + (item.year ? ` ${item.year}` : '');
                          setLocation(`/add?q=${encodeURIComponent(searchTerm)}`);
                        }
                      };

                      const handleAddClick = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        setQuickAddMedia({
                          title: item.title,
                          mediaType: item.type || 'movie',
                          imageUrl: item.poster_url,
                          externalId: item.external_id,
                          externalSource: item.external_source,
                        });
                        setIsQuickAddOpen(true);
                      };

                      return (
                        <div
                          key={`${item.title}-${index}`}
                          onClick={handleClick}
                          className="flex-shrink-0 w-28 cursor-pointer group"
                          data-testid={`similar-media-${index}`}
                        >
                          <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gradient-to-br from-purple-100 to-blue-100 mb-2 shadow-sm group-hover:shadow-md transition-shadow">
                            {item.poster_url ? (
                              <img
                                src={item.poster_url}
                                alt={item.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  target.parentElement?.classList.add('show-fallback');
                                }}
                              />
                            ) : null}
                            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-200 to-blue-200 ${item.poster_url ? 'absolute inset-0 -z-10' : ''}`}>
                              <div className="text-purple-600 opacity-60 scale-150">
                                {getTypeIcon(item.type)}
                              </div>
                            </div>
                            <div className={`absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 ${getTypeColor(item.type)}`}>
                              {getTypeIcon(item.type)}
                              <span className="truncate max-w-[50px]">{item.type || 'Media'}</span>
                            </div>
                            <button
                              onClick={handleAddClick}
                              className="absolute bottom-1 right-1 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center shadow-sm"
                              data-testid={`add-similar-${index}`}
                            >
                              <Plus size={14} className="text-purple-600" />
                            </button>
                          </div>
                          <p className="text-xs font-medium text-gray-900 line-clamp-2 group-hover:text-purple-600 transition-colors">
                            {item.title}
                          </p>
                          {item.year && (
                            <p className="text-[10px] text-gray-500">{item.year}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No recommendations available yet</p>
                </div>
              )}
            </div>

            {/* Polls */}
            {polls.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-blue-500" />
                  Polls ({polls.length})
                </h2>
                <div className="space-y-4">
                  {polls.map((poll: any) => (
                    <div key={poll.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-600 text-sm font-medium">
                            {poll.users?.display_name?.[0]?.toUpperCase() || poll.users?.user_name?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 mb-1">
                            {poll.prediction_pools?.title || poll.content}
                          </p>
                          <p className="text-sm text-gray-600">
                            {poll.prediction_pools?.total_participants || 0} votes
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

        </div>
      </div>
      
      <CreateListDialog 
        open={showCreateListDialog} 
        onOpenChange={(open) => {
          setShowCreateListDialog(open);
          if (!open) {
            queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
          }
        }}
      />
      
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => {
          setIsQuickAddOpen(false);
          setQuickAddMedia(null);
          setQuickAddPostType("review");
        }}
        preSelectedMedia={quickAddMedia}
        initialPostType={quickAddPostType}
      />

      {/* Update Progress Sheet */}
      <Sheet open={isProgressSheetOpen} onOpenChange={setIsProgressSheetOpen}>
        <SheetContent side="bottom" className="bg-white rounded-t-2xl p-0">
          <div className="flex items-center justify-center px-4 py-4 border-b border-gray-100">
            <SheetTitle className="text-lg font-semibold text-gray-900">Update Progress</SheetTitle>
          </div>
          <div className="px-4 py-4 space-y-4 pb-8">
            {/* Mode tabs */}
            {editMode !== 'percent' && (
              <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                {(['page', 'percent'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setEditMode(m)}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all capitalize ${
                      editMode === m ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {m === 'page' ? 'Page' : 'Percent'}
                  </button>
                ))}
              </div>
            )}

            {editMode === 'page' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Current Page</label>
                    <Input
                      type="number"
                      min={0}
                      value={editProgress}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setEditProgress(Math.max(0, parseInt(e.target.value.replace(/^0+/, '')) || 0))}
                      className="text-center text-lg font-semibold bg-white text-gray-900 border-gray-200 focus:border-purple-400 focus:ring-purple-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Total Pages</label>
                    <Input
                      type="number"
                      min={0}
                      value={editTotal}
                      onChange={(e) => setEditTotal(Math.max(0, parseInt(e.target.value) || 0))}
                      className="text-center text-lg font-semibold bg-white text-gray-900 border-gray-200 focus:border-purple-400 focus:ring-purple-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {[10, 25, 50].map((pages) => (
                    <button
                      key={pages}
                      onClick={() => setEditProgress(Math.min(editProgress + pages, editTotal || 9999))}
                      className="flex-1 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                      +{pages} pages
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">Percentage Complete</label>
                <div className="relative flex-1">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={editProgress}
                    onChange={(e) => setEditProgress(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="text-center text-lg font-semibold pr-8 bg-white text-gray-900 border-gray-200 focus:border-purple-400 focus:ring-purple-400"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">%</span>
                </div>
                <div className="flex gap-2">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setEditProgress(pct)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        editProgress === pct ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-3 font-semibold"
              disabled={updateProgressMutation.isPending}
              onClick={() => updateProgressMutation.mutate({ progress: editProgress, total: editTotal, mode: editMode })}
            >
              {updateProgressMutation.isPending ? 'Saving...' : 'Update Progress'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <QuickAddListSheet
        isOpen={isListSheetOpen}
        onClose={() => setIsListSheetOpen(false)}
        media={mediaItem || mediaData ? {
          title: mediaItem?.title || mediaData.title,
          mediaType: (() => {
            const raw = (mediaItem?.type || mediaData.type || params?.type || '').toLowerCase();
            if (raw === 'tv' || raw.includes('show') || raw === 'tv_show') return 'tv';
            if (raw.includes('podcast')) return 'podcast';
            if (raw === 'movie') return 'movie';
            return raw;
          })(),
          imageUrl: resolvedImageUrl || mediaData.artwork,
          externalId: params?.id,
          externalSource: params?.source,
        } : null}
      />

    </div>
  );
}
