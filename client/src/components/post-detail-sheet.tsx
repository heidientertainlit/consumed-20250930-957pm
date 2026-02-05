import { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { X, Heart, MessageCircle, Plus, Star, Send, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { QuickAddModal } from './quick-add-modal';

interface PostDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  post: {
    id: string;
    userId: string;
    username: string;
    displayName?: string;
    avatar?: string;
    mediaTitle: string;
    mediaType?: string;
    mediaImage?: string;
    mediaExternalId?: string;
    mediaExternalSource?: string;
    rating?: number;
    review?: string;
    timestamp?: string;
  };
  onLike?: (postId: string) => void;
  isLiked?: boolean;
}

export default function PostDetailSheet({ isOpen, onClose, post, onLike, isLiked: initialIsLiked }: PostDetailSheetProps) {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isLiked, setIsLiked] = useState(initialIsLiked || false);
  const [likesCount, setLikesCount] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [submittingRating, setSubmittingRating] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && post.id) {
      fetchComments();
      fetchLikeStatus();
    }
  }, [isOpen, post.id]);

  useEffect(() => {
    setIsLiked(initialIsLiked || false);
  }, [initialIsLiked]);

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          content,
          created_at,
          user_id,
          users:user_id (id, user_name, display_name, avatar)
        `)
        .eq('post_id', post.id)
        .order('created_at', { ascending: true })
        .limit(20);

      if (!error && data) {
        setComments(data);
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
    setLoadingComments(false);
  };

  const fetchLikeStatus = async () => {
    if (!user?.id) return;
    try {
      const { count } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id);
      setLikesCount(count || 0);

      const { data } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', user.id)
        .maybeSingle();
      setIsLiked(!!data);
    } catch (err) {
      console.error('Error fetching like status:', err);
    }
  };

  const handleLike = async () => {
    if (!user?.id || !session) {
      toast({ title: 'Sign in to like', variant: 'destructive' });
      return;
    }

    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikesCount(prev => wasLiked ? prev - 1 : prev + 1);

    try {
      if (wasLiked) {
        await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', user.id);
      } else {
        await supabase.from('likes').insert({ post_id: post.id, user_id: user.id });
      }
      onLike?.(post.id);
    } catch (err) {
      setIsLiked(wasLiked);
      setLikesCount(prev => wasLiked ? prev + 1 : prev - 1);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user?.id || !session) return;

    setSubmittingComment(true);
    try {
      const { data, error } = await supabase.functions.invoke('social-feed-comments', {
        body: {
          action: 'add',
          postId: post.id,
          content: newComment.trim(),
          userId: user.id
        }
      });

      if (error) throw error;

      setNewComment('');
      fetchComments();
      toast({ title: 'Comment added!' });
    } catch (err) {
      console.error('Error adding comment:', err);
      toast({ title: 'Failed to add comment', variant: 'destructive' });
    }
    setSubmittingComment(false);
  };

  const submitRating = async (rating: number) => {
    if (!user?.id || !session || !post.mediaExternalId) {
      toast({ title: 'Sign in to rate', variant: 'destructive' });
      return;
    }

    setSubmittingRating(true);
    try {
      const { error } = await supabase.functions.invoke('quick-add', {
        body: {
          userId: user.id,
          mediaId: post.mediaExternalId,
          mediaType: post.mediaType || 'movie',
          mediaTitle: post.mediaTitle,
          imageUrl: post.mediaImage,
          externalSource: post.mediaExternalSource || 'tmdb',
          listName: 'Finished',
          rating: rating
        }
      });

      if (error) throw error;

      setUserRating(rating);
      setShowRating(false);
    } catch (err) {
      console.error('Error rating:', err);
      toast({ title: 'Failed to rate', variant: 'destructive' });
    }
    setSubmittingRating(false);
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.floor(rating);
        const halfFilled = !filled && star - 0.5 <= rating;
        return (
          <div key={star} className="relative">
            <Star size={16} className="text-gray-300" />
            <div 
              className="absolute inset-0 overflow-hidden"
              style={{ width: filled ? '100%' : halfFilled ? '50%' : '0%' }}
            >
              <Star size={16} className="text-yellow-400 fill-yellow-400" />
            </div>
          </div>
        );
      })}
    </div>
  );

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (!isOpen) return null;

  const mediaDetailLink = post.mediaExternalId 
    ? `/media/${post.mediaType || 'movie'}/${post.mediaExternalSource || 'tmdb'}/${post.mediaExternalId}`
    : `/add?q=${encodeURIComponent(post.mediaTitle || '')}`;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50" />
      
      <div 
        ref={sheetRef}
        className="relative bg-white rounded-t-3xl w-full max-w-lg max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <X size={18} className="text-gray-600" />
        </button>

        <div className="px-4 pb-4 overflow-y-auto max-h-[calc(85vh-60px)]">
          <div className="flex gap-4 mb-4">
            <Link href={mediaDetailLink} onClick={onClose}>
              {post.mediaImage ? (
                <img 
                  src={post.mediaImage} 
                  alt={post.mediaTitle} 
                  className="w-20 h-28 rounded-lg object-cover shadow-md"
                />
              ) : (
                <div className="w-20 h-28 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-md">
                  <Star size={24} className="text-white" />
                </div>
              )}
            </Link>
            
            <div className="flex-1">
              <Link href={`/user/${post.userId}`} onClick={onClose}>
                <div className="flex items-center gap-2 mb-1">
                  {post.avatar ? (
                    <img src={post.avatar} alt="" className="w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                      <span className="text-xs text-purple-600">{post.username?.charAt(0)?.toUpperCase()}</span>
                    </div>
                  )}
                  <span className="text-sm font-medium text-purple-600">{post.displayName || post.username}</span>
                </div>
              </Link>
              
              <Link href={mediaDetailLink} onClick={onClose}>
                <h3 className="font-semibold text-gray-900 mb-1 hover:text-purple-600">{post.mediaTitle}</h3>
              </Link>
              
              {post.rating && post.rating > 0 && (
                <div className="mb-2">{renderStars(post.rating)}</div>
              )}
              
              {post.review && (
                <p className="text-sm text-gray-600">"{post.review}"</p>
              )}
              
              {post.timestamp && (
                <p className="text-xs text-gray-400 mt-2">{formatTime(post.timestamp)}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-t border-b border-gray-100 mb-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={handleLike}
                className="flex items-center gap-1.5"
              >
                <Heart 
                  size={22} 
                  className={isLiked ? 'text-red-500 fill-red-500' : 'text-gray-500'} 
                />
                <span className="text-sm text-gray-600">{likesCount}</span>
              </button>
              
              <button 
                onClick={() => inputRef.current?.focus()}
                className="flex items-center gap-1.5"
              >
                <MessageCircle size={22} className="text-gray-500" />
                <span className="text-sm text-gray-600">{comments.length}</span>
              </button>
              
              <button 
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5"
              >
                <Plus size={22} className="text-gray-500" />
              </button>
              
              <button 
                onClick={() => setShowRating(!showRating)}
                className="flex items-center gap-1.5"
              >
                <Star 
                  size={22} 
                  className={userRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-500'} 
                />
              </button>
            </div>
          </div>

          {showRating && !userRating && session && (
            <div className="mb-4 p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 mb-2 text-center">Tap to rate (tap left/right half for half stars)</p>
              <div className="flex items-center justify-center">
                {submittingRating ? (
                  <Loader2 className="animate-spin text-purple-500" size={20} />
                ) : (
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <div
                        key={star}
                        className="relative w-10 h-10 flex items-center justify-center cursor-pointer"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const isLeftHalf = (e.clientX - rect.left) < rect.width / 2;
                          const rating = isLeftHalf ? star - 0.5 : star;
                          submitRating(rating);
                        }}
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const isLeftHalf = (e.clientX - rect.left) < rect.width / 2;
                          setHoveredStar(isLeftHalf ? star - 0.5 : star);
                        }}
                        onMouseLeave={() => setHoveredStar(0)}
                      >
                        <div className="relative">
                          <Star size={28} className="text-gray-300" />
                          <div 
                            className="absolute inset-0 overflow-hidden"
                            style={{ width: `${Math.min(100, Math.max(0, (hoveredStar - star + 1) * 100))}%` }}
                          >
                            <Star size={28} className="text-yellow-400 fill-yellow-400" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mb-4">
            <h4 className="font-medium text-gray-900 mb-3">Comments</h4>
            
            {loadingComments ? (
              <div className="flex justify-center py-4">
                <Loader2 className="animate-spin text-purple-500" size={20} />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No comments yet. Be the first!</p>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                      {comment.users?.avatar ? (
                        <img src={comment.users.avatar} alt="" className="w-7 h-7 rounded-full" />
                      ) : (
                        <span className="text-xs text-purple-600">
                          {comment.users?.user_name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                      <Link href={`/user/${comment.user_id}`} onClick={onClose}>
                        <span className="text-xs font-medium text-purple-600">
                          {comment.users?.display_name || comment.users?.user_name || 'User'}
                        </span>
                      </Link>
                      <p className="text-sm text-gray-700">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {session && (
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <input
                ref={inputRef}
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
                placeholder="Add a comment..."
                className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-300"
              />
              <button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || submittingComment}
                className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center disabled:opacity-50"
              >
                {submittingComment ? (
                  <Loader2 className="animate-spin text-white" size={18} />
                ) : (
                  <Send size={18} className="text-white" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {showAddModal && post.mediaExternalId && (
        <QuickAddModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          preSelectedMedia={{
            title: post.mediaTitle,
            mediaType: post.mediaType || 'movie',
            imageUrl: post.mediaImage,
            externalId: post.mediaExternalId,
            externalSource: post.mediaExternalSource || 'tmdb'
          }}
        />
      )}
    </div>
  );
}
