import { useState, useRef, useEffect } from "react";
import { ChevronRight, ChevronLeft, Star, Heart, MessageCircle, Plus, User, Send, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { QuickAddListSheet } from "./quick-add-list-sheet";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface RatingPost {
  id: string;
  user?: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
  };
  mediaItems?: Array<{
    id: string;
    title: string;
    imageUrl?: string;
    mediaType?: string;
    externalId?: string;
    externalSource?: string;
  }>;
  rating?: number;
  content?: string;
  timestamp?: string;
  type?: string;
  likesCount?: number;
  commentsCount?: number;
  isLiked?: boolean;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
  };
}

interface SwipeableRatingCardsProps {
  posts: RatingPost[];
  onLike?: (postId: string) => void;
  likedPosts?: Set<string>;
}

export default function SwipeableRatingCards({ posts, onLike, likedPosts }: SwipeableRatingCardsProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  useEffect(() => {
    setImageLoaded(false);
    setShowComments(false);
    setComments([]);
  }, [currentIndex]);

  if (!posts || posts.length === 0) return null;

  const currentPost = posts[currentIndex];
  const media = currentPost?.mediaItems?.[0];

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    handleSwipe();
  };

  const handleSwipe = () => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;

    if (diff > threshold && currentIndex < posts.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (diff < -threshold && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const goToNext = () => {
    if (currentIndex < posts.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const renderStars = (rating?: number) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            className={star <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}
          />
        ))}
      </div>
    );
  };

  const getMediaLink = () => {
    if (!media?.externalId || !media?.externalSource) return null;
    return `/media/${media.externalSource}/${media.externalId}`;
  };

  const isPostLiked = likedPosts?.has(currentPost.id) || currentPost.isLiked;
  
  const getDisplayContent = () => {
    const content = currentPost.content?.trim() || '';
    if (!content) return null;
    if (content.startsWith('Added ') || content.startsWith('"Added ')) return null;
    if (content.match(/^"?Added .+ to .+"?$/i)) return null;
    return content;
  };

  const displayContent = getDisplayContent();

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (media) {
      setSelectedMedia({
        title: media.title || 'Unknown',
        mediaType: media.mediaType || 'movie',
        imageUrl: media.imageUrl,
        externalId: media.externalId,
        externalSource: media.externalSource,
      });
      setAddSheetOpen(true);
    }
  };

  const fetchComments = async () => {
    if (!session?.access_token) return;
    setLoadingComments(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/social-feed-comments?post_id=${currentPost.id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleCommentClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!showComments) {
      setShowComments(true);
      await fetchComments();
    } else {
      setShowComments(false);
    }
  };

  const submitComment = async () => {
    if (!session?.access_token || !commentInput.trim()) return;
    setSubmittingComment(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/social-feed-comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          post_id: currentPost.id,
          content: commentInput.trim()
        })
      });
      if (response.ok) {
        setCommentInput("");
        await fetchComments();
        toast({ title: "Comment added!" });
      }
    } catch (err) {
      console.error('Failed to submit comment:', err);
      toast({ title: "Failed to add comment", variant: "destructive" });
    } finally {
      setSubmittingComment(false);
    }
  };

  const hasValidImage = media?.imageUrl && media.imageUrl.startsWith('http');

  return (
    <>
      <div className="mb-4">
        <div 
          className="relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex">
            {/* Media poster on left */}
            <Link href={getMediaLink() || '#'} className="shrink-0">
              {hasValidImage ? (
                <div className="relative w-28 h-40">
                  {!imageLoaded && (
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-200 to-purple-100 animate-pulse" />
                  )}
                  <img 
                    src={media.imageUrl} 
                    alt={media.title || ''} 
                    className={`w-28 h-40 object-cover transition-opacity duration-200 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={() => setImageLoaded(true)}
                    loading="eager"
                  />
                </div>
              ) : (
                <div className="w-28 h-40 bg-gradient-to-br from-purple-200 to-purple-100 flex items-center justify-center">
                  <span className="text-gray-500 text-xs text-center px-2">No image</span>
                </div>
              )}
            </Link>

            {/* Content on right */}
            <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
              {/* User info */}
              <div className="flex items-center gap-2 mb-2">
                <Link href={`/profile/${currentPost.user?.id}`} className="flex items-center gap-2">
                  {currentPost.user?.avatar ? (
                    <img 
                      src={currentPost.user.avatar} 
                      alt="" 
                      className="w-7 h-7 rounded-full object-cover border border-purple-100"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
                      <User size={14} className="text-purple-600" />
                    </div>
                  )}
                  <span className="text-sm font-medium text-purple-600">
                    {currentPost.user?.displayName || currentPost.user?.username || 'User'}
                  </span>
                </Link>
                <span className="text-xs text-gray-400">
                  {currentPost.rating ? 'rated' : 'reviewed'}
                </span>
              </div>

              {/* Media title */}
              <Link href={getMediaLink() || '#'}>
                <h3 className="font-medium text-gray-900 text-sm line-clamp-1 hover:text-purple-600 mb-1">
                  {media?.title || 'Unknown'}
                </h3>
              </Link>
              
              {/* Rating stars */}
              {currentPost.rating && (
                <div className="mb-1">
                  {renderStars(currentPost.rating)}
                </div>
              )}

              {/* Review/thought content */}
              {displayContent && (
                <p className="text-sm text-gray-600 line-clamp-3 mb-2">
                  "{displayContent}"
                </p>
              )}

              {/* Actions row */}
              <div className="flex items-center justify-between mt-auto">
                <div className="flex items-center gap-4">
                  {/* Like button with count */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onLike?.(currentPost.id);
                    }}
                    className="flex items-center gap-1 group"
                  >
                    <Heart 
                      size={18} 
                      className={`transition-colors ${isPostLiked ? 'text-red-500 fill-red-500' : 'text-gray-400 group-hover:text-red-400'}`}
                    />
                    <span className="text-xs text-gray-500">{currentPost.likesCount || 0}</span>
                  </button>
                  
                  {/* Comment button with count */}
                  <button 
                    onClick={handleCommentClick}
                    className="flex items-center gap-1 group"
                  >
                    <MessageCircle 
                      size={18} 
                      className={`transition-colors ${showComments ? 'text-purple-600 fill-purple-100' : 'text-gray-400 group-hover:text-purple-500'}`}
                    />
                    <span className={`text-xs ${showComments ? 'text-purple-600' : 'text-gray-500'}`}>
                      {currentPost.commentsCount || comments.length || 0}
                    </span>
                  </button>
                  
                  {/* Add to list button */}
                  <button 
                    onClick={handleAddClick}
                    className="group"
                  >
                    <Plus size={18} className="text-gray-400 group-hover:text-purple-500 transition-colors" />
                  </button>
                </div>

                {/* Navigation arrows */}
                <div className="flex items-center gap-1">
                  {currentIndex > 0 && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        goToPrev();
                      }}
                      className="p-1.5 rounded-full bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <ChevronLeft size={14} className="text-gray-500" />
                    </button>
                  )}
                  <span className="text-xs text-gray-400 px-1">
                    {currentIndex + 1}/{posts.length}
                  </span>
                  {currentIndex < posts.length - 1 && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        goToNext();
                      }}
                      className="p-1.5 rounded-full bg-purple-50 hover:bg-purple-100 transition-colors"
                    >
                      <ChevronRight size={14} className="text-purple-600" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Inline Comments Section */}
          {showComments && (
            <div className="border-t border-gray-100 p-3 bg-gray-50/50">
              {loadingComments ? (
                <div className="flex justify-center py-3">
                  <Loader2 className="animate-spin text-purple-500" size={20} />
                </div>
              ) : (
                <>
                  {/* Existing comments */}
                  {comments.length > 0 ? (
                    <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
                      {comments.slice(0, 3).map((comment) => (
                        <div key={comment.id} className="flex gap-2">
                          {comment.user?.avatar ? (
                            <img src={comment.user.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                              <User size={12} className="text-purple-600" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium text-purple-600">
                              {comment.user?.displayName || comment.user?.username}
                            </span>
                            <p className="text-xs text-gray-700 line-clamp-2">{comment.content}</p>
                          </div>
                        </div>
                      ))}
                      {comments.length > 3 && (
                        <p className="text-xs text-gray-400 text-center">+ {comments.length - 3} more comments</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 text-center mb-3">No comments yet</p>
                  )}

                  {/* Comment input */}
                  {session ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        placeholder="Add a comment..."
                        className="flex-1 text-sm px-3 py-2 rounded-full border border-gray-200 focus:outline-none focus:border-purple-400"
                        onKeyPress={(e) => e.key === 'Enter' && submitComment()}
                      />
                      <button
                        onClick={submitComment}
                        disabled={!commentInput.trim() || submittingComment}
                        className="p-2 rounded-full bg-purple-600 text-white disabled:opacity-50"
                      >
                        {submittingComment ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <Send size={16} />
                        )}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 text-center">Sign in to comment</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Dots indicator */}
          {posts.length > 1 && (
            <div className="flex justify-center gap-1.5 py-2 bg-gray-50/50">
              {posts.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                  }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentIndex ? 'bg-purple-600 w-4' : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add to list sheet */}
      <QuickAddListSheet 
        isOpen={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        media={selectedMedia}
      />
    </>
  );
}
