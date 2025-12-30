import { useState } from "react";
import { Link } from "wouter";
import { Heart, MessageCircle, ChevronLeft, ChevronRight, Star, Plus, CheckCircle, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

interface MediaItem {
  id: string;
  title: string;
  creator?: string;
  mediaType: string;
  imageUrl?: string;
  rating?: number;
  externalId: string;
  externalSource: string;
}

interface ActivitySlide {
  type: 'rating' | 'finished' | 'list_add' | 'progress';
  items: MediaItem[];
  rating?: number;
  listName?: string;
  listId?: string;
}

interface GroupedUserActivity {
  id: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
  };
  timestamp: string;
  totalItems: number;
  totalLists: number;
  slides: ActivitySlide[];
  likes: number;
  comments: number;
  likedByCurrentUser?: boolean;
  originalPostIds: string[];
}

interface ActivityCarouselCardProps {
  activity: GroupedUserActivity;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  isLiked: boolean;
}

export default function ActivityCarouselCard({ 
  activity, 
  onLike, 
  onComment,
  isLiked 
}: ActivityCarouselCardProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % activity.slides.length);
  };
  
  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + activity.slides.length) % activity.slides.length);
  };

  const getSlideIcon = (type: string) => {
    switch (type) {
      case 'rating':
        return <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />;
      case 'finished':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'list_add':
        return <Plus className="w-4 h-4 text-purple-500" />;
      default:
        return <List className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSlideTitle = (slide: ActivitySlide) => {
    switch (slide.type) {
      case 'rating':
        return `Rated ${slide.rating} star${slide.rating !== 1 ? 's' : ''}`;
      case 'finished':
        return 'Finished';
      case 'list_add':
        return `Added to ${slide.listName || 'list'}`;
      default:
        return 'Activity';
    }
  };

  const getSummaryText = () => {
    if (activity.slides.length === 1 && activity.slides[0].type === 'rating') {
      const item = activity.slides[0].items[0];
      return `rated ${item?.title || 'media'}`;
    }
    
    if (activity.totalLists > 1) {
      return `added ${activity.totalItems} item${activity.totalItems !== 1 ? 's' : ''} across ${activity.totalLists} lists`;
    }
    
    if (activity.totalItems > 1) {
      return `added ${activity.totalItems} items`;
    }
    
    return 'shared activity';
  };

  const currentSlideData = activity.slides[currentSlide];

  const getMediaTypeIcon = (type: string) => {
    const iconMap: { [key: string]: string } = {
      movie: '🎬',
      tv: '📺',
      book: '📚',
      music: '🎵',
      podcast: '🎧',
      game: '🎮'
    };
    return iconMap[type?.toLowerCase()] || '📱';
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" data-testid={`activity-carousel-${activity.id}`}>
      {/* Header */}
      <div className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <Link href={`/profile/${activity.user.username}`}>
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                {activity.user.avatar ? (
                  <img src={activity.user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  activity.user.displayName?.[0]?.toUpperCase() || activity.user.username?.[0]?.toUpperCase() || '?'
                )}
              </div>
              <div>
                <span className="font-semibold text-gray-900">
                  {activity.user.displayName || activity.user.username}
                </span>
                <span className="text-gray-500 ml-1">{getSummaryText()}</span>
                <div className="text-xs text-gray-400">
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Carousel Content */}
      <div className="relative px-4 pb-2">
        {/* Slide Navigation Arrows */}
        {activity.slides.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center hover:bg-white transition-colors"
              data-testid="carousel-prev"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/90 shadow-md flex items-center justify-center hover:bg-white transition-colors"
              data-testid="carousel-next"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </>
        )}

        {/* Current Slide */}
        <div className="bg-gray-50 rounded-xl p-4">
          {/* Slide Header */}
          <div className="flex items-center gap-2 mb-3">
            {getSlideIcon(currentSlideData.type)}
            <span className="text-sm font-medium text-gray-700">
              {getSlideTitle(currentSlideData)}
            </span>
          </div>

          {/* Media Items */}
          <div className="space-y-2">
            {currentSlideData.items.slice(0, 3).map((item, idx) => (
              <Link 
                key={item.id || idx} 
                href={`/media/${item.mediaType?.toLowerCase() || 'movie'}/${item.externalSource}/${item.externalId}`}
              >
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                  <span className="text-lg">{getMediaTypeIcon(item.mediaType)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate text-sm">
                      {item.title}
                    </div>
                    {item.creator && (
                      <div className="text-xs text-gray-500 truncate">
                        {item.creator}
                      </div>
                    )}
                  </div>
                  {item.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs font-medium">{item.rating}</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
            
            {currentSlideData.items.length > 3 && (
              <div className="text-sm text-purple-600 font-medium pl-2">
                +{currentSlideData.items.length - 3} more →
              </div>
            )}
          </div>
        </div>

        {/* Carousel Dots */}
        {activity.slides.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-3">
            {activity.slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  idx === currentSlide ? 'bg-purple-500' : 'bg-gray-300'
                }`}
                data-testid={`carousel-dot-${idx}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer - Likes & Comments */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onLike(activity.originalPostIds[0])}
            className="flex items-center gap-1.5 text-gray-500 hover:text-red-500 transition-colors"
            data-testid="like-button"
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
            <span className="text-sm">{activity.likes}</span>
          </button>
          <button
            onClick={() => onComment(activity.originalPostIds[0])}
            className="flex items-center gap-1.5 text-gray-500 hover:text-purple-500 transition-colors"
            data-testid="comment-button"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm">{activity.comments}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export type { GroupedUserActivity, ActivitySlide, MediaItem };
