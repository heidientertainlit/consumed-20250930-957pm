import { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { X, Star, Send, Loader2, ArrowUp, ArrowDown, Flame, Plus } from 'lucide-react';
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
  const [hoverRating, setHoverRating] = useState(0);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [fetchedMediaMeta, setFetchedMediaMeta] = useState<{ image: string; externalId?: string; externalSource?: string; mediaType?: string } | null>(null);
  const [fullPost, setFullPost] = useState<{ mediaTitle?: string; mediaImage?: string; externalId?: string; externalSource?: string; mediaType?: string } | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const starsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && post.id) {
      fetchComments();
      fetchLikeStatus();
      // Fetch the full post row to pick up media fields the feed summary may have omitted
      if (!post.mediaTitle || !post.mediaImage) {
        supabase
          .from('social_posts')
          .select('media_title, media_image, external_id, external_source, media_type')
          .eq('id', post.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              setFullPost({
                mediaTitle: data.media_title || undefined,
                mediaImage: data.media_image || undefined,
                externalId: data.external_id || undefined,
                externalSource: data.external_source || undefined,
                mediaType: data.media_type || undefined,
              });
            }
          });
      }
    }
  }, [isOpen, post.id]);

  // Fetch poster + external ID when we don't have one but have a real media title
  // Runs after fullPost is populated so we can use its title as fallback
  useEffect(() => {
    const resolvedTitle = post.mediaTitle || fullPost?.mediaTitle;
    const resolvedImage = post.mediaImage || fullPost?.mediaImage;
    const hasImage = resolvedImage && (resolvedImage.startsWith('http') || resolvedImage.startsWith('/'));
    if (!isOpen || hasImage) { setFetchedMediaMeta(null); return; }
    if (!resolvedTitle) { setFetchedMediaMeta(null); return; }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const resolvedType = post.mediaType || fullPost?.mediaType;
    const typeParam = resolvedType ? `&type=${encodeURIComponent(resolvedType)}` : '';
    fetch(`${supabaseUrl}/functions/v1/media-search?q=${encodeURIComponent(resolvedTitle)}&limit=1${typeParam}`, {
      headers: { 'Authorization': `Bearer ${anonKey}` },
    })
      .then(r => r.json())
      .then(data => {
        const result = data?.results?.[0];
        const img = result?.poster_url || result?.image;
        if (img) setFetchedMediaMeta({
          image: img,
          externalId: result?.external_id,
          externalSource: result?.external_source,
          mediaType: result?.type,
        });
      })
      .catch(() => {});
  }, [isOpen, post.mediaTitle, post.mediaImage, post.mediaType, fullPost]);

  useEffect(() => {
    setIsLiked(initialIsLiked || false);
  }, [initialIsLiked]);

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`id, content, created_at, user_id, users:user_id (id, user_name, display_name, avatar)`)
        .eq('post_id', post.id)
        .order('created_at', { ascending: true })
        .limit(20);
      if (!error && data) setComments(data);
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
    setLoadingComments(false);
  };

  const fetchLikeStatus = async () => {
    if (!user?.id) return;
    try {
      const { count } = await supabase
        .from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id);
      setLikesCount(count || 0);
      const { data } = await supabase
        .from('likes').select('id').eq('post_id', post.id).eq('user_id', user.id).maybeSingle();
      setIsLiked(!!data);
    } catch (err) {
      console.error('Error fetching like status:', err);
    }
  };

  const handleLike = async () => {
    if (!user?.id || !session) { toast({ title: 'Sign in to like', variant: 'destructive' }); return; }
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
    } catch {
      setIsLiked(wasLiked);
      setLikesCount(prev => wasLiked ? prev + 1 : prev - 1);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user?.id || !session) return;
    setSubmittingComment(true);
    try {
      const { error } = await supabase.functions.invoke('social-feed-comments', {
        body: { action: 'add', postId: post.id, content: newComment.trim(), userId: user.id }
      });
      if (error) throw error;
      setNewComment('');
      fetchComments();
    } catch {
      toast({ title: 'Failed to add comment', variant: 'destructive' });
    }
    setSubmittingComment(false);
  };

  const submitRating = async (rating: number) => {
    if (!user?.id || !session) { toast({ title: 'Sign in to rate', variant: 'destructive' }); return; }
    setSubmittingRating(true);
    try {
      await supabase.functions.invoke('rate-media', {
        body: {
          userId: user.id,
          mediaExternalId: post.mediaExternalId || '',
          mediaExternalSource: post.mediaExternalSource || 'tmdb',
          mediaType: post.mediaType || 'movie',
          mediaTitle: post.mediaTitle,
          imageUrl: getMediaImage() || '',
          rating,
        }
      });
      setUserRating(rating);
      setShowRating(false);
    } catch {
      toast({ title: 'Failed to rate', variant: 'destructive' });
    }
    setSubmittingRating(false);
  };

  const getMediaImage = () => {
    if (!post.mediaImage) return null;
    if (post.mediaImage.startsWith('http')) return post.mediaImage;
    if (post.mediaImage.startsWith('/')) return `https://image.tmdb.org/t/p/w300${post.mediaImage}`;
    return null;
  };

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '';
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const m = Math.floor(diffMs / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.floor(rating);
        const halfFilled = !filled && star - 0.5 <= rating;
        return (
          <div key={star} className="relative">
            <Star size={15} className="text-gray-200" />
            <div className="absolute inset-0 overflow-hidden" style={{ width: filled ? '100%' : halfFilled ? '50%' : '0%' }}>
              <Star size={15} className="text-yellow-400 fill-yellow-400" />
            </div>
          </div>
        );
      })}
    </div>
  );

  if (!isOpen) return null;

  // Merge post props with fullPost DB row (fullPost fills gaps the feed summary omits)
  const effectiveTitle = post.mediaTitle || fullPost?.mediaTitle || '';
  const effectiveImage = post.mediaImage || fullPost?.mediaImage || '';
  const effectiveExternalId = post.mediaExternalId || fullPost?.externalId;
  const effectiveExternalSource = post.mediaExternalSource || fullPost?.externalSource || 'tmdb';
  const effectiveMediaType = post.mediaType || fullPost?.mediaType || 'movie';

  // Resolve poster — prefer stored image, then fetched search result
  const rawImage = effectiveImage && (effectiveImage.startsWith('http') ? effectiveImage : effectiveImage.startsWith('/') ? `https://image.tmdb.org/t/p/w300${effectiveImage}` : null);
  const mediaImage = rawImage || fetchedMediaMeta?.image || null;

  // Resolve the media detail link — prefer real externalId (post or fetched), never fall back to /add
  const resolvedExternalId = effectiveExternalId || fetchedMediaMeta?.externalId;
  const resolvedExternalSource = effectiveExternalSource || fetchedMediaMeta?.externalSource || 'tmdb';
  const resolvedMediaType = effectiveMediaType || fetchedMediaMeta?.mediaType || 'movie';
  const mediaDetailLink = resolvedExternalId
    ? `/media/${resolvedMediaType}/${resolvedExternalSource}/${resolvedExternalId}`
    : null;

  // Only show the poster column if we have a real media title or image
  const hasMedia = !!(effectiveTitle || mediaImage);

  const currentUserInitial = (
    session?.user?.user_metadata?.display_name ||
    session?.user?.email || 'Y'
  )[0]?.toUpperCase();

  const engagementButtons = [
    { icon: <ArrowUp size={20} />, label: 'Agree', action: handleLike, active: isLiked, activeClass: 'bg-violet-600 text-white' },
    { icon: <Flame size={20} />, label: 'Hot Take', action: () => {}, active: false, activeClass: '' },
    { icon: <ArrowDown size={20} />, label: 'Disagree', action: () => {}, active: false, activeClass: '' },
    {
      icon: <Star size={20} />,
      label: userRating ? `${userRating}★` : 'Rate it',
      action: () => setShowRating(v => !v),
      active: showRating || !!userRating,
      activeClass: 'bg-violet-600 text-white',
    },
    { icon: <Plus size={20} />, label: 'Add to list', action: () => setShowAddModal(true), active: false, activeClass: '' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />

      <div
        ref={sheetRef}
        className="relative bg-white rounded-t-3xl w-full max-w-lg max-h-[88vh] overflow-hidden animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <X size={18} className="text-gray-600" />
        </button>

        <div className="px-4 pb-24 overflow-y-auto max-h-[calc(88vh-52px)]">

          {/* Post header */}
          <div className={`flex gap-4 mb-5 ${!hasMedia ? 'flex-col' : ''}`}>
            {/* Poster — only when we have actual media */}
            {hasMedia && (
              mediaDetailLink ? (
                <Link href={mediaDetailLink} onClick={onClose} className="flex-shrink-0">
                  {mediaImage ? (
                    <img src={mediaImage} alt={post.mediaTitle} className="w-20 h-28 rounded-xl object-cover shadow-md" />
                  ) : (
                    <div className="w-20 h-28 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-md">
                      <Star size={28} className="text-white/70" />
                    </div>
                  )}
                </Link>
              ) : (
                <div className="flex-shrink-0">
                  {mediaImage ? (
                    <img src={mediaImage} alt={post.mediaTitle} className="w-20 h-28 rounded-xl object-cover shadow-md" />
                  ) : (
                    <div className="w-20 h-28 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-md">
                      <Star size={28} className="text-white/70" />
                    </div>
                  )}
                </div>
              )
            )}

            <div className="flex-1 min-w-0 pt-1">
              <Link href={`/user/${post.userId}`} onClick={onClose}>
                <div className="flex items-center gap-2 mb-2">
                  {post.avatar ? (
                    <img src={post.avatar} alt="" className="w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-violet-600">{post.username?.charAt(0)?.toUpperCase()}</span>
                    </div>
                  )}
                  <span className="text-sm font-semibold text-violet-600">{post.displayName || post.username}</span>
                </div>
              </Link>

              {effectiveTitle && (
                mediaDetailLink ? (
                  <Link href={mediaDetailLink} onClick={onClose}>
                    <h3 className="font-bold text-gray-900 text-base leading-snug mb-1.5 hover:text-violet-600">{effectiveTitle}</h3>
                  </Link>
                ) : (
                  <h3 className="font-bold text-gray-900 text-base leading-snug mb-1.5">{effectiveTitle}</h3>
                )
              )}

              {post.rating && post.rating > 0 && (
                <div className="mb-2">{renderStars(post.rating)}</div>
              )}

              {post.review && (
                <p className="text-sm text-gray-600 leading-snug">"{post.review}"</p>
              )}

              {post.timestamp && (
                <p className="text-xs text-gray-400 mt-2">{formatTime(post.timestamp)}</p>
              )}
            </div>
          </div>

          {/* Engagement row */}
          <div className="flex justify-around items-center py-4 border-t border-b border-gray-100 mb-4">
            {engagementButtons.map(({ icon, label, action, active, activeClass }) => (
              <button
                key={label}
                onClick={action}
                className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm ${active ? activeClass : 'bg-white border border-gray-200'}`}>
                  <span className={active && activeClass ? 'text-white' : 'text-gray-500'}>{icon}</span>
                </div>
                <span className={`text-[10px] font-medium ${active && activeClass ? 'text-violet-600' : 'text-gray-500'}`}>{label}</span>
              </button>
            ))}
          </div>

          {/* YOUR TURN star picker */}
          {showRating && !userRating && session && (
            <div
              ref={starsRef}
              className="flex items-center gap-1.5 mb-4 py-2.5 px-3 bg-violet-50 rounded-xl touch-none select-none"
              onMouseLeave={() => setHoverRating(0)}
              onTouchStart={() => {}}
              onTouchMove={(e) => {
                e.stopPropagation();
                if (!starsRef.current) return;
                const touch = e.touches[0];
                const rect = starsRef.current.getBoundingClientRect();
                const x = touch.clientX - rect.left - 90;
                const starWidth = (rect.width - 90) / 5;
                const starIndex = Math.floor(x / starWidth);
                const withinStar = (x % starWidth) / starWidth;
                const val = Math.max(0.5, Math.min(5, starIndex + (withinStar < 0.5 ? 0.5 : 1)));
                setHoverRating(Math.round(val * 2) / 2);
              }}
              onTouchEnd={() => {
                if (hoverRating > 0) { submitRating(hoverRating); setHoverRating(0); }
              }}
            >
              <span className="text-[10px] font-bold text-violet-600 tracking-widest uppercase mr-1 flex-shrink-0">Your Turn</span>
              {submittingRating ? (
                <Loader2 className="animate-spin text-violet-500 mx-auto" size={18} />
              ) : (
                [1,2,3,4,5].map(star => {
                  const displayVal = hoverRating;
                  return (
                    <div key={star} className="relative" style={{ width: 28, height: 28 }}>
                      <Star size={28} className="absolute inset-0 text-violet-200" />
                      <div className="absolute inset-0 overflow-hidden pointer-events-none"
                        style={{ width: displayVal >= star ? '100%' : displayVal >= star - 0.5 ? '50%' : '0%' }}>
                        <Star size={28} className="fill-yellow-400 text-yellow-400" />
                      </div>
                      <button className="absolute top-0 left-0 h-full z-10" style={{ width: '50%' }}
                        onMouseEnter={() => setHoverRating(star - 0.5)}
                        onClick={() => submitRating(star - 0.5)}
                        aria-label={`Rate ${star - 0.5}`} />
                      <button className="absolute top-0 right-0 h-full z-10" style={{ width: '50%' }}
                        onMouseEnter={() => setHoverRating(star)}
                        onClick={() => submitRating(star)}
                        aria-label={`Rate ${star}`} />
                    </div>
                  );
                })
              )}
              {hoverRating > 0 && <span className="ml-1 text-xs text-gray-400">{hoverRating}/5</span>}
            </div>
          )}

          {/* Comments */}
          <div className="mb-3">
            <h4 className="font-semibold text-gray-900 mb-3 text-sm">Comments</h4>
            {loadingComments ? (
              <div className="flex justify-center py-4">
                <Loader2 className="animate-spin text-violet-500" size={20} />
              </div>
            ) : comments.length === 0 ? null : (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                      {comment.users?.avatar ? (
                        <img src={comment.users.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-bold text-violet-600">
                          {comment.users?.display_name?.charAt(0)?.toUpperCase() || comment.users?.user_name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                      <span className="text-xs font-semibold text-violet-600 block">
                        {comment.users?.display_name || comment.users?.user_name || 'User'}
                      </span>
                      <p className="text-sm text-gray-700 leading-snug">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add your take input */}
          {session && (
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100 mx-3">
              <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                <span className="text-violet-600 text-xs font-bold">{currentUserInitial}</span>
              </div>
              <div className="flex-1 flex items-center bg-gray-50 rounded-full px-4 py-2 gap-2 border border-gray-100">
                <input
                  ref={inputRef}
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
                  placeholder="Add your take..."
                  className="flex-1 text-sm bg-transparent focus:outline-none text-gray-700 placeholder:text-gray-400"
                  onClick={(e) => e.stopPropagation()}
                />
                {newComment.trim() && (
                  <button
                    onClick={handleSubmitComment}
                    disabled={submittingComment}
                    className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                  >
                    {submittingComment
                      ? <Loader2 className="animate-spin text-white" size={11} />
                      : <Send size={11} className="text-white ml-0.5" />
                    }
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <QuickAddModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          preSelectedMedia={post.mediaExternalId ? {
            title: post.mediaTitle,
            mediaType: post.mediaType || 'movie',
            imageUrl: mediaImage || undefined,
            externalId: post.mediaExternalId,
            externalSource: post.mediaExternalSource || 'tmdb'
          } : undefined}
        />
      )}
    </div>
  );
}
