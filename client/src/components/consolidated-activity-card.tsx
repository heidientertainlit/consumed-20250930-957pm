import { useState } from "react";
import { Link } from "wouter";
import { Heart, MessageCircle, ChevronRight, Star, Plus, CheckCircle, Layers, MoreHorizontal, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

interface ListGroup {
  listId: string;
  listName: string;
  items: MediaItem[];
}

export interface ConsolidatedActivity {
  id: string;
  type: 'list_adds' | 'ratings' | 'finished' | 'games';
  user: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
  };
  timestamp: string;
  items: MediaItem[];
  totalItems: number;
  totalLists?: number;
  listNames?: string[];
  lists?: ListGroup[];
  likes: number;
  comments: number;
  likedByCurrentUser?: boolean;
  originalPostIds: string[];
  gameTitle?: string;
}

interface ConsolidatedActivityCardProps {
  activity: ConsolidatedActivity;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  onDelete?: (postIds: string[]) => void;
  isLiked: boolean;
  currentUserId?: string | null;
}

export default function ConsolidatedActivityCard({ 
  activity, 
  onLike, 
  onComment,
  onDelete,
  isLiked,
  currentUserId
}: ConsolidatedActivityCardProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const isOwner = currentUserId && activity.user.id === currentUserId;
  
  // Check if we have multiple lists for carousel
  const hasCarousel = activity.lists && activity.lists.length > 1;
  const slides = activity.lists || [{ listId: 'default', listName: activity.listNames?.[0] || 'List', items: activity.items }];

  const nextSlide = () => {
    if (hasCarousel) {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }
  };

  const getActivityIcon = () => {
    switch (activity.type) {
      case 'ratings':
        return <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />;
      case 'finished':
        return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
      case 'list_adds':
        return <Plus className="w-3.5 h-3.5 text-purple-500" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-purple-500" />;
    }
  };

  const getSummaryText = () => {
    switch (activity.type) {
      case 'ratings':
        if (activity.totalItems === 1 && activity.items[0]) {
          return `rated ${activity.items[0].title}`;
        }
        return `rated ${activity.totalItems} items`;
      case 'finished':
        if (activity.totalItems === 1 && activity.items[0]) {
          return `finished ${activity.items[0].title}`;
        }
        return `finished ${activity.totalItems} items`;
      case 'list_adds':
        if (activity.totalLists && activity.totalLists > 1) {
          return `added ${activity.totalItems} item${activity.totalItems !== 1 ? 's' : ''} across ${activity.totalLists} lists`;
        }
        if (activity.listNames?.[0]) {
          return `added ${activity.totalItems} item${activity.totalItems !== 1 ? 's' : ''} to ${activity.listNames[0]}`;
        }
        return `added ${activity.totalItems} item${activity.totalItems !== 1 ? 's' : ''}`;
      case 'games':
        return activity.gameTitle ? `played ${activity.gameTitle}` : 'played a game';
      default:
        return 'shared activity';
    }
  };

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

  const isConsolidated = activity.totalItems > 1 || (activity.totalLists && activity.totalLists > 1);
  const currentListData = slides[currentSlide];

  return (
    <div 
      className={`rounded-2xl overflow-hidden shadow-sm bg-white border ${
        isConsolidated 
          ? 'border-purple-200 ring-1 ring-purple-100' 
          : 'border-gray-200'
      }`} 
      data-testid={`consolidated-activity-${activity.id}`}
    >
      {/* Header */}
      <div className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/profile/${activity.user.username}`}>
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                {activity.user.avatar ? (
                  <img src={activity.user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  activity.user.displayName?.[0]?.toUpperCase() || activity.user.username?.[0]?.toUpperCase() || '?'
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="font-semibold text-gray-900">
                    {activity.user.displayName || activity.user.username}
                  </span>
                  <span className="text-gray-500 text-sm">
                    {getSummaryText()}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </div>
              </div>
            </div>
          </Link>
          
          {/* Grouped Badge & Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {isConsolidated && (
              <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 rounded-full">
                <Layers className="w-3 h-3 text-purple-500" />
                <span className="text-xs font-medium text-purple-600">Grouped</span>
              </div>
            )}
            
            {/* Delete Menu - Only show for owner */}
            {isOwner && onDelete && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button 
                    className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100"
                    data-testid={`button-more-options-${activity.id}`}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuItem
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this grouped activity? This will delete all posts in this group.')) {
                        onDelete(activity.originalPostIds);
                      }
                    }}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                    data-testid={`button-delete-grouped-${activity.id}`}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Content - Carousel for multiple lists */}
      <div className="px-4 pb-3 relative">
        <div className="bg-gray-50 rounded-xl p-3">
          {/* List Header with swipe indicator */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {getActivityIcon()}
              <span className="text-sm font-medium text-gray-700">
                {activity.type === 'list_adds' 
                  ? `Added to ${currentListData.listName}`
                  : activity.type === 'ratings' ? 'Rated'
                  : activity.type === 'finished' ? 'Finished' 
                  : 'Activity'}
              </span>
            </div>
            
            {/* Carousel indicator & next button */}
            {hasCarousel && (
              <button 
                onClick={nextSlide}
                className="flex items-center gap-1 text-purple-600 hover:text-purple-700 transition-colors"
              >
                <span className="text-xs font-medium">{currentSlide + 1}/{slides.length}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Media Items for current list */}
          <div className="space-y-1.5">
            {currentListData.items.slice(0, 3).map((item, idx) => (
              <Link 
                key={item.id || idx} 
                href={`/media/${item.externalSource}/${item.externalId}`}
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
                  {item.rating && activity.type === 'ratings' && (
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs font-medium text-gray-900">
                        {item.rating}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* See More for current list */}
          {currentListData.items.length > 3 && (
            <div className="flex items-center justify-end gap-1 mt-2 text-sm font-medium text-purple-600">
              <span>+{currentListData.items.length - 3} more in this list</span>
            </div>
          )}
        </div>

        {/* Carousel Dots */}
        {hasCarousel && (
          <div className="flex justify-center gap-1.5 mt-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  idx === currentSlide ? 'bg-purple-500' : 'bg-gray-300'
                }`}
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
