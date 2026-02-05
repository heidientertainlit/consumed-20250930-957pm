import { useState, useRef } from "react";
import { ChevronRight, Star, Heart, MessageCircle, Plus, User } from "lucide-react";
import { Link } from "wouter";
import { QuickAddListSheet } from "./quick-add-list-sheet";

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

interface SwipeableRatingCardsProps {
  posts: RatingPost[];
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
  likedPosts?: Set<string>;
}

export default function SwipeableRatingCards({ posts, onLike, onComment, likedPosts }: SwipeableRatingCardsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef<number>(0);
  const currentX = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const [dragOffset, setDragOffset] = useState(0);

  if (!posts || posts.length === 0) return null;

  const currentPost = posts[currentIndex];
  const media = currentPost?.mediaItems?.[0];

  const handleStart = (clientX: number) => {
    startX.current = clientX;
    currentX.current = clientX;
    isDragging.current = true;
  };

  const handleMove = (clientX: number) => {
    if (!isDragging.current) return;
    currentX.current = clientX;
    const diff = currentX.current - startX.current;
    setDragOffset(diff);
  };

  const handleEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    
    const diff = currentX.current - startX.current;
    const threshold = 50;
    
    if (diff < -threshold && currentIndex < posts.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (diff > threshold && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
    
    setDragOffset(0);
  };

  const handleTouchStart = (e: React.TouchEvent) => handleStart(e.touches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => handleMove(e.touches[0].clientX);
  const handleTouchEnd = () => handleEnd();

  const handleMouseDown = (e: React.MouseEvent) => handleStart(e.clientX);
  const handleMouseMove = (e: React.MouseEvent) => handleMove(e.clientX);
  const handleMouseUp = () => handleEnd();
  const handleMouseLeave = () => {
    if (isDragging.current) handleEnd();
  };

  const goToNext = () => {
    if (currentIndex < posts.length - 1) {
      setCurrentIndex(currentIndex + 1);
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

  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onComment) {
      onComment(currentPost.id);
    }
  };

  return (
    <>
      <div className="mb-4">
        <div 
          ref={containerRef}
          className="relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden select-none touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          style={{
            transform: `translateX(${dragOffset * 0.3}px)`,
            transition: isDragging.current ? 'none' : 'transform 0.2s ease-out'
          }}
        >
          <div className="flex">
            {/* Media poster on left */}
            <Link href={getMediaLink() || '#'} className="shrink-0">
              {media?.imageUrl ? (
                <img 
                  src={media.imageUrl} 
                  alt={media.title || ''} 
                  className="w-28 h-40 object-cover"
                  draggable={false}
                  loading="eager"
                />
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
                      draggable={false}
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
                    <MessageCircle size={18} className="text-gray-400 group-hover:text-purple-500 transition-colors" />
                    <span className="text-xs text-gray-500">{currentPost.commentsCount || 0}</span>
                  </button>
                  
                  {/* Add to list button */}
                  <button 
                    onClick={handleAddClick}
                    className="group"
                  >
                    <Plus size={18} className="text-gray-400 group-hover:text-purple-500 transition-colors" />
                  </button>
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
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
                      <ChevronRight size={16} className="text-purple-600" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

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
