import { useState, useRef } from "react";
import { ChevronRight, Star, ThumbsUp, ThumbsDown, Plus, User } from "lucide-react";
import { Link } from "wouter";

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
}

interface SwipeableRatingCardsProps {
  posts: RatingPost[];
  onReaction?: (postId: string, reaction: 'like' | 'dislike') => void;
  onAddToList?: (post: RatingPost) => void;
}

export default function SwipeableRatingCards({ posts, onReaction, onAddToList }: SwipeableRatingCardsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  if (!posts || posts.length === 0) return null;

  const currentPost = posts[currentIndex];
  const media = currentPost?.mediaItems?.[0];

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentIndex < posts.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else if (diff < 0 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }
    }
  };

  const goToNext = () => {
    if (currentIndex < posts.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const formatTimeAgo = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const renderStars = (rating?: number) => {
    if (!rating) return null;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={14}
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

  return (
    <div className="mb-4">
      <div 
        ref={containerRef}
        className="relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex">
          {/* Media poster */}
          <Link href={getMediaLink() || '#'} className="shrink-0">
            {media?.imageUrl ? (
              <img 
                src={media.imageUrl} 
                alt={media.title || ''} 
                className="w-24 h-36 object-cover"
              />
            ) : (
              <div className="w-24 h-36 bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center">
                <span className="text-gray-400 text-xs">No image</span>
              </div>
            )}
          </Link>

          {/* Content */}
          <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
            {/* User info */}
            <div className="flex items-center gap-2 mb-2">
              <Link href={`/profile/${currentPost.user?.id}`} className="flex items-center gap-2">
                {currentPost.user?.avatar ? (
                  <img 
                    src={currentPost.user.avatar} 
                    alt="" 
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                    <User size={12} className="text-purple-600" />
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

            {/* Media title and rating */}
            <div className="mb-2">
              <Link href={getMediaLink() || '#'}>
                <h3 className="font-semibold text-gray-900 text-sm line-clamp-1 hover:text-purple-600">
                  {media?.title || 'Unknown'}
                </h3>
              </Link>
              {currentPost.rating && (
                <div className="flex items-center gap-2 mt-1">
                  {renderStars(currentPost.rating)}
                  <span className="text-xs text-gray-500">
                    {formatTimeAgo(currentPost.timestamp)}
                  </span>
                </div>
              )}
            </div>

            {/* Review content */}
            {currentPost.content && !currentPost.content.startsWith('Added ') && (
              <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                "{currentPost.content}"
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => onReaction?.(currentPost.id, 'like')}
                  className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <ThumbsUp size={16} className="text-gray-400" />
                </button>
                <button 
                  onClick={() => onReaction?.(currentPost.id, 'dislike')}
                  className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <ThumbsDown size={16} className="text-gray-400" />
                </button>
                <button 
                  onClick={() => onAddToList?.(currentPost)}
                  className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <Plus size={16} className="text-gray-400" />
                </button>
              </div>

              {/* Navigation indicator */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">
                  {currentIndex + 1}/{posts.length}
                </span>
                {currentIndex < posts.length - 1 && (
                  <button 
                    onClick={goToNext}
                    className="p-1 rounded-full hover:bg-gray-100 transition-colors"
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
          <div className="flex justify-center gap-1 pb-2">
            {posts.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  idx === currentIndex ? 'bg-purple-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
