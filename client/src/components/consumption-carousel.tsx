import { useState, useRef, useMemo } from 'react';
import { Link } from 'wouter';
import { ChevronLeft, ChevronRight, Users, ThumbsUp, ThumbsDown, HelpCircle, BarChart3, Sparkles, Film, Tv, BookOpen, Music, Star, Plus, Trash2, MessageCircle, Send, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { QuickAddModal } from './quick-add-modal';

const getStablePercent = (id: string, min = 40, max = 80) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return min + Math.abs(hash % (max - min + 1));
};

interface FriendActivityItem {
  id: string;
  type: 'media_added' | 'poll_answer' | 'trivia_answer' | 'dna_moment';
  userId: string;
  username: string;
  displayName: string;
  avatar?: string;
  
  // For media_added
  mediaTitle?: string;
  mediaType?: string;
  mediaImage?: string;
  mediaExternalId?: string;
  mediaExternalSource?: string;
  activityText?: string; // e.g., "rated it ⭐⭐⭐⭐", "added it to their list", "finished it"
  rating?: number;
  review?: string;
  
  // For poll/trivia/dna
  questionTitle?: string;
  userAnswer?: string;
  communityPercent?: number;
  isCorrect?: boolean;
  poolId?: string;
  
  timestamp: string;
}

interface ConsumptionCarouselProps {
  items: FriendActivityItem[];
  title?: string;
  onItemDeleted?: () => void;
  currentUserId?: string | null;
}

const getMediaIcon = (mediaType?: string) => {
  switch (mediaType?.toLowerCase()) {
    case 'book':
      return <BookOpen className="w-4 h-4 text-purple-400" />;
    case 'tv':
      return <Tv className="w-4 h-4 text-purple-400" />;
    case 'movie':
      return <Film className="w-4 h-4 text-purple-400" />;
    case 'music':
    case 'podcast':
      return <Music className="w-4 h-4 text-purple-400" />;
    default:
      return <Film className="w-4 h-4 text-purple-400" />;
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'poll_answer':
      return <BarChart3 className="w-3.5 h-3.5" />;
    case 'trivia_answer':
      return <HelpCircle className="w-3.5 h-3.5" />;
    case 'dna_moment':
      return <Sparkles className="w-3.5 h-3.5" />;
    default:
      return <Film className="w-3.5 h-3.5" />;
  }
};

export default function ConsumptionCarousel({ items, title = "Community", onItemDeleted, currentUserId }: ConsumptionCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reactions, setReactions] = useState<Record<string, 'agree' | 'disagree'>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [showRating, setShowRating] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState<FriendActivityItem | null>(null);
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [loadingComments, setLoadingComments] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [userRatings, setUserRatings] = useState<Record<string, number>>({});
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleDelete = async (itemId: string) => {
    const deleteUserId = currentUserId || user?.id;
    if (!deleteUserId) return;
    
    setDeletingId(itemId);
    try {
      // Try deleting from social_posts first (these are feed items)
      const { error: socialError } = await supabase
        .from('social_posts')
        .delete()
        .eq('id', itemId)
        .eq('user_id', deleteUserId);
      
      if (socialError) {
        // Fallback to list_items if not a social post
        const { error: listError } = await supabase
          .from('list_items')
          .delete()
          .eq('id', itemId)
          .eq('user_id', deleteUserId);
        
        if (listError) throw listError;
      }
      
      onItemDeleted?.();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Couldn't delete",
        description: "Please try again.",
        variant: "destructive",
      });
    }
    setDeletingId(null);
  };

  // Group items into pages
  const ITEMS_PER_PAGE = 3;
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);

  const scrollToNext = () => {
    if (scrollRef.current && currentIndex < totalPages - 1) {
      const pageWidth = scrollRef.current.clientWidth;
      scrollRef.current.scrollBy({ left: pageWidth + 12, behavior: 'smooth' });
      setCurrentIndex(prev => Math.min(prev + 1, totalPages - 1));
    }
  };

  const scrollToPrev = () => {
    if (scrollRef.current && currentIndex > 0) {
      const pageWidth = scrollRef.current.clientWidth;
      scrollRef.current.scrollBy({ left: -(pageWidth + 12), behavior: 'smooth' });
      setCurrentIndex(prev => Math.max(prev - 1, 0));
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const pageWidth = scrollRef.current.clientWidth;
      const scrollLeft = scrollRef.current.scrollLeft;
      const newIndex = Math.round(scrollLeft / (pageWidth + 12));
      setCurrentIndex(Math.min(Math.max(newIndex, 0), totalPages - 1));
    }
  };

  const handleReaction = (itemId: string, reaction: 'agree' | 'disagree') => {
    setReactions(prev => ({ ...prev, [itemId]: reaction }));
  };

  const fetchComments = async (postId: string) => {
    setLoadingComments(postId);
    try {
      const { data, error } = await supabase
        .from('social_post_comments')
        .select(`id, content, created_at, user_id, users:user_id (id, user_name, display_name, avatar)`)
        .eq('social_post_id', postId)
        .order('created_at', { ascending: true })
        .limit(10);
      if (!error && data) {
        setComments(prev => ({ ...prev, [postId]: data }));
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
    setLoadingComments(null);
  };

  const toggleComments = (postId: string) => {
    if (expandedComments === postId) {
      setExpandedComments(null);
    } else {
      setExpandedComments(postId);
      if (!comments[postId]) {
        fetchComments(postId);
      }
    }
  };

  const submitComment = async (postId: string) => {
    if (!newComment.trim() || !user?.id) return;
    setSubmittingComment(true);
    try {
      console.log('Submitting comment to post:', postId, 'content:', newComment.trim());
      const { data, error } = await supabase.functions.invoke('social-feed-comments', {
        method: 'POST',
        body: { post_id: postId, content: newComment.trim() }
      });
      console.log('Comment response:', data, 'error:', error);
      if (error) throw error;
      setNewComment('');
      fetchComments(postId);
      toast({ title: 'Comment added!' });
    } catch (err) {
      console.error('Comment error:', err);
      toast({ title: 'Failed to add comment', variant: 'destructive' });
    }
    setSubmittingComment(false);
  };

  const submitRating = async (item: FriendActivityItem, rating: number) => {
    if (!user?.id || !item.mediaExternalId) return;
    setSubmittingRating(true);
    try {
      await supabase.functions.invoke('quick-add', {
        body: {
          userId: user.id,
          mediaId: item.mediaExternalId,
          mediaType: item.mediaType || 'movie',
          mediaTitle: item.mediaTitle,
          imageUrl: item.mediaImage,
          externalSource: item.mediaExternalSource || 'tmdb',
          listName: 'Finished',
          rating: rating
        }
      });
      setUserRatings(prev => ({ ...prev, [item.id]: rating }));
      setShowRating(null);
      toast({ title: `Rated ${rating} stars!` });
    } catch (err) {
      toast({ title: 'Failed to rate', variant: 'destructive' });
    }
    setSubmittingRating(false);
  };

  const deleteComment = async (commentId: number, postId: string) => {
    if (!user?.id) return;
    setDeletingCommentId(commentId);
    try {
      const { error } = await supabase
        .from('social_post_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user.id);
      if (error) throw error;
      setComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((c: any) => c.id !== commentId)
      }));
      toast({ title: 'Comment deleted' });
    } catch (err) {
      console.error('Delete comment error:', err);
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
    setDeletingCommentId(null);
  };

  if (!items || items.length === 0) return null;

  // Create pages array
  const pages: FriendActivityItem[][] = [];
  for (let i = 0; i < items.length; i += ITEMS_PER_PAGE) {
    pages.push(items.slice(i, i + ITEMS_PER_PAGE));
  }

  const [expandedReview, setExpandedReview] = useState<string | null>(null);

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3 h-3 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  const renderItem = (item: FriendActivityItem, index: number) => {
    const hasReacted = reactions[item.id];
    const isExpanded = expandedReview === item.id;
    
    if (item.type === 'media_added') {
      const mediaDetailLink = item.mediaExternalId 
        ? `/media/${item.mediaType || 'movie'}/${item.mediaExternalSource || 'tmdb'}/${item.mediaExternalId}`
        : `/add?q=${encodeURIComponent(item.mediaTitle || '')}`;
      return (
        <div key={item.id || index} className="py-3 border-b border-gray-100 last:border-b-0">
          <div className="flex gap-3">
            {/* Left: Media Image - Clickable to media page */}
            <Link href={mediaDetailLink}>
              {item.mediaImage ? (
                <div className="w-14 h-20 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0 shadow-sm cursor-pointer hover:opacity-80 transition-opacity">
                  <img src={item.mediaImage} alt={item.mediaTitle} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-14 h-20 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm cursor-pointer hover:opacity-80 transition-opacity">
                  {getMediaIcon(item.mediaType)}
                </div>
              )}
            </Link>
            
            {/* Right: Content */}
            <div className="flex-1 min-w-0">
              {/* Header row with user and delete */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-purple-600 font-medium">
                    {(item.username && item.username !== 'friend' && item.username !== 'Unknown' && item.username !== 'unknown') ? item.username : 'A fan'}
                  </span>
                  <span className="text-[10px] text-gray-400">{item.activityText || 'added'}</span>
                </div>
                {currentUserId && item.userId === currentUserId && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                    disabled={deletingId === item.id}
                    className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-red-100 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3 text-gray-500" />
                  </button>
                )}
              </div>
              
              {/* Title */}
              <p className="text-gray-900 text-sm font-semibold line-clamp-1 mb-1">
                {item.mediaTitle}
              </p>
              
              {/* Rating if exists */}
              {item.rating && item.rating > 0 && (
                <div className="mb-1">
                  {renderStars(item.rating)}
                </div>
              )}
              
              {/* Review snippet */}
              {item.review && (
                <div>
                  <p className={`text-xs text-gray-600 ${isExpanded ? '' : 'line-clamp-2'}`}>
                    "{item.review}"
                  </p>
                  {item.review.length > 80 && !isExpanded && (
                    <span className="text-[10px] text-purple-500 font-medium">Tap to see more</span>
                  )}
                </div>
              )}
              
              {/* Stats and actions row */}
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] text-gray-400">
                  {item.communityPercent || getStablePercent(item.id, 50, 80)}% of fans have this
                </p>
                <div className="flex gap-1">
                  {!hasReacted ? (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReaction(item.id, 'agree'); }}
                        className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-green-100 transition-colors"
                        title="Great pick"
                      >
                        <ThumbsUp className="w-3 h-3 text-gray-500" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReaction(item.id, 'disagree'); }}
                        className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-red-100 transition-colors"
                        title="Overrated"
                      >
                        <ThumbsDown className="w-3 h-3 text-gray-500" />
                      </button>
                    </>
                  ) : (
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${hasReacted === 'agree' ? 'bg-green-500' : 'bg-red-500'}`}>
                      {hasReacted === 'agree' ? <ThumbsUp className="w-3 h-3 text-white" /> : <ThumbsDown className="w-3 h-3 text-white" />}
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowAddModal(item); }}
                    className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-purple-100 transition-colors"
                    title="Add to list"
                  >
                    <Plus className="w-3 h-3 text-gray-500" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowRating(showRating === item.id ? null : item.id); }}
                    className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-yellow-100 transition-colors"
                    title="Rate"
                  >
                    <Star className={`w-3 h-3 ${userRatings[item.id] ? 'text-yellow-400 fill-yellow-400' : 'text-gray-500'}`} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleComments(item.id); }}
                    className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-blue-100 transition-colors"
                    title="Comments"
                  >
                    <MessageCircle className={`w-3 h-3 ${expandedComments === item.id ? 'text-purple-500' : 'text-gray-500'}`} />
                  </button>
                </div>
              </div>

              {/* Inline rating stars */}
              {showRating === item.id && !userRatings[item.id] && (
                <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-center gap-1">
                    {submittingRating ? (
                      <Loader2 className="animate-spin text-purple-500" size={16} />
                    ) : (
                      [1, 2, 3, 4, 5].map((star) => (
                        <div
                          key={star}
                          className="w-8 h-8 flex items-center justify-center cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const isLeftHalf = (e.clientX - rect.left) < rect.width / 2;
                            submitRating(item, isLeftHalf ? star - 0.5 : star);
                          }}
                          onMouseMove={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredStar((e.clientX - rect.left) < rect.width / 2 ? star - 0.5 : star);
                          }}
                          onMouseLeave={() => setHoveredStar(0)}
                        >
                          <div className="relative">
                            <Star size={20} className="text-gray-300" />
                            <div className="absolute inset-0 overflow-hidden" style={{ width: `${Math.min(100, Math.max(0, (hoveredStar - star + 1) * 100))}%` }}>
                              <Star size={20} className="text-yellow-400 fill-yellow-400" />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Inline comments section */}
              {expandedComments === item.id && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  {loadingComments === item.id ? (
                    <div className="flex justify-center py-2">
                      <Loader2 className="animate-spin text-purple-500" size={16} />
                    </div>
                  ) : (comments[item.id] || []).length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">No comments yet</p>
                  ) : (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {(comments[item.id] || []).map((comment: any) => (
                        <div key={comment.id} className="flex gap-2 group">
                          <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-[8px] text-purple-600">{comment.users?.user_name?.charAt(0)?.toUpperCase() || '?'}</span>
                          </div>
                          <div className="flex-1">
                            <span className="text-[10px] font-medium text-purple-600">{comment.users?.display_name || comment.users?.user_name}</span>
                            <p className="text-xs text-gray-600">{comment.content}</p>
                          </div>
                          {comment.user_id === user?.id && (
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteComment(comment.id, item.id); }}
                              disabled={deletingCommentId === comment.id}
                              className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center text-gray-400 hover:text-red-500 transition-all disabled:opacity-50"
                              title="Delete comment"
                            >
                              {deletingCommentId === comment.id ? (
                                <Loader2 className="animate-spin" size={10} />
                              ) : (
                                <Trash2 size={10} />
                              )}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {user && (
                    <div className="flex gap-1 mt-2">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && submitComment(item.id)}
                        placeholder="Add comment..."
                        className="flex-1 bg-gray-100 rounded-full px-3 py-1 text-xs outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); submitComment(item.id); }}
                        disabled={!newComment.trim() || submittingComment}
                        className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center disabled:opacity-50"
                      >
                        {submittingComment ? <Loader2 className="animate-spin text-white" size={12} /> : <Send size={12} className="text-white" />}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    
    if (item.type === 'poll_answer') {
      return (
        <div key={item.id || index} className="py-2 border-b border-gray-100 last:border-b-0">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              {getTypeIcon(item.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Link href={`/user/${item.userId}`}>
                  <span className="text-xs text-blue-600 font-medium hover:underline cursor-pointer">
                    {item.username}
                  </span>
                </Link>
                <span className="text-xs text-gray-400">voted</span>
              </div>
              <p className="text-gray-900 text-sm font-semibold line-clamp-1">
                "{item.userAnswer}"
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {item.communityPercent || getStablePercent(item.id, 40, 70)}% agree
              </p>
            </div>
            {!hasReacted ? (
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => handleReaction(item.id, 'agree')}
                  className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center hover:bg-blue-100 hover:border-blue-300 transition-colors"
                >
                  <ThumbsUp className="w-3.5 h-3.5 text-gray-600" />
                </button>
                <button
                  onClick={() => handleReaction(item.id, 'disagree')}
                  className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center hover:bg-red-100 hover:border-red-300 transition-colors"
                >
                  <ThumbsDown className="w-3.5 h-3.5 text-gray-600" />
                </button>
              </div>
            ) : (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${hasReacted === 'agree' ? 'bg-blue-500' : 'bg-red-500'}`}>
                {hasReacted === 'agree' ? <ThumbsUp className="w-3.5 h-3.5 text-white" /> : <ThumbsDown className="w-3.5 h-3.5 text-white" />}
              </div>
            )}
          </div>
        </div>
      );
    }
    
    if (item.type === 'trivia_answer') {
      return (
        <div key={item.id || index} className="py-2 border-b border-gray-100 last:border-b-0">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              {getTypeIcon(item.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Link href={`/user/${item.userId}`}>
                  <span className="text-xs text-purple-600 font-medium hover:underline cursor-pointer">
                    {item.username}
                  </span>
                </Link>
                <span className={`text-xs ${item.isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                  {item.isCorrect ? '✓' : '✗'}
                </span>
              </div>
              <p className="text-gray-900 text-sm font-semibold line-clamp-1">
                "{item.questionTitle}"
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {item.communityPercent || getStablePercent(item.id, 20, 60)}% got it right
              </p>
            </div>
            {!hasReacted ? (
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => handleReaction(item.id, 'agree')}
                  className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center hover:bg-purple-100 hover:border-purple-300 transition-colors"
                >
                  <ThumbsUp className="w-3.5 h-3.5 text-gray-600" />
                </button>
                <button
                  onClick={() => handleReaction(item.id, 'disagree')}
                  className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center hover:bg-red-100 hover:border-red-300 transition-colors"
                >
                  <ThumbsDown className="w-3.5 h-3.5 text-gray-600" />
                </button>
              </div>
            ) : (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${hasReacted === 'agree' ? 'bg-purple-500' : 'bg-red-500'}`}>
                {hasReacted === 'agree' ? <ThumbsUp className="w-3.5 h-3.5 text-white" /> : <ThumbsDown className="w-3.5 h-3.5 text-white" />}
              </div>
            )}
          </div>
        </div>
      );
    }
    
    if (item.type === 'dna_moment') {
      return (
        <div key={item.id || index} className="py-2 border-b border-gray-100 last:border-b-0">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0">
              {getTypeIcon(item.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Link href={`/user/${item.userId}`}>
                  <span className="text-xs text-pink-600 font-medium hover:underline cursor-pointer">
                    {item.username}
                  </span>
                </Link>
                <span className="text-xs text-gray-400">says</span>
              </div>
              <p className="text-gray-900 text-sm font-semibold line-clamp-1">
                "{item.userAnswer}"
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {item.communityPercent || getStablePercent(item.id, 50, 80)}% agree
              </p>
            </div>
            {!hasReacted ? (
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => handleReaction(item.id, 'agree')}
                  className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center hover:bg-pink-100 hover:border-pink-300 transition-colors"
                >
                  <ThumbsUp className="w-3.5 h-3.5 text-gray-600" />
                </button>
                <button
                  onClick={() => handleReaction(item.id, 'disagree')}
                  className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center hover:bg-red-100 hover:border-red-300 transition-colors"
                >
                  <ThumbsDown className="w-3.5 h-3.5 text-gray-600" />
                </button>
              </div>
            ) : (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${hasReacted === 'agree' ? 'bg-pink-500' : 'bg-red-500'}`}>
                {hasReacted === 'agree' ? <ThumbsUp className="w-3.5 h-3.5 text-white" /> : <ThumbsDown className="w-3.5 h-3.5 text-white" />}
              </div>
            )}
          </div>
        </div>
      );
    }
    
    return null;
  };

  const renderPage = (pageItems: FriendActivityItem[], pageIndex: number) => (
    <div
      key={pageIndex}
      className="flex-shrink-0 w-full snap-center"
    >
      {pageItems.map((item, i) => renderItem(item, pageIndex * ITEMS_PER_PAGE + i))}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            <p className="text-[10px] text-gray-500">See what fans are consuming</p>
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
          {currentIndex < pages.length - 1 && (
            <button
              onClick={scrollToNext}
              className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          )}
          <span className="text-xs text-gray-400 ml-1">{currentIndex + 1}/{pages.length}</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
      >
        {pages.map((pageItems, pageIndex) => renderPage(pageItems, pageIndex))}
      </div>

      {showAddModal && (
        <QuickAddModal
          isOpen={!!showAddModal}
          onClose={() => setShowAddModal(null)}
          preSelectedMedia={{
            title: showAddModal.mediaTitle || '',
            mediaType: showAddModal.mediaType || 'movie',
            imageUrl: showAddModal.mediaImage,
            externalId: showAddModal.mediaExternalId,
            externalSource: showAddModal.mediaExternalSource || 'tmdb'
          }}
        />
      )}
    </div>
  );
}
