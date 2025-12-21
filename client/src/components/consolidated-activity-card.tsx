import { useState } from "react";
import { Link } from "wouter";
import { Heart, MessageCircle, ChevronRight, Star, Trash2 } from "lucide-react";
import { format } from "date-fns";

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
  const [showAll, setShowAll] = useState(false);
  
  const isOwner = currentUserId && activity.user.id === currentUserId;
  
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

  const getHeaderText = () => {
    const displayName = activity.user.displayName || activity.user.username;
    
    switch (activity.type) {
      case 'ratings':
        return (
          <span className="text-sm">
            <Link href={`/profile/${activity.user.username}`} className="font-semibold text-gray-900 hover:text-purple-600">
              {displayName}
            </Link>
            <span className="text-gray-500"> rated</span>
          </span>
        );
      case 'finished':
        return (
          <span className="text-sm">
            <Link href={`/profile/${activity.user.username}`} className="font-semibold text-gray-900 hover:text-purple-600">
              {displayName}
            </Link>
            <span className="text-gray-500"> finished</span>
          </span>
        );
      case 'list_adds':
        const listName = activity.listNames?.[0] || 'a list';
        return (
          <span className="text-sm">
            <Link href={`/profile/${activity.user.username}`} className="font-semibold text-gray-900 hover:text-purple-600">
              {displayName}
            </Link>
            <span className="text-gray-500"> added to → </span>
            <span className="text-purple-600 font-medium">{listName}</span>
          </span>
        );
      default:
        return (
          <span className="text-sm">
            <Link href={`/profile/${activity.user.username}`} className="font-semibold text-gray-900 hover:text-purple-600">
              {displayName}
            </Link>
            <span className="text-gray-500"> shared activity</span>
          </span>
        );
    }
  };

  const allItems = activity.items;
  const displayedItems = showAll ? allItems : allItems.slice(0, 3);
  const remainingCount = allItems.length - 3;

  const formattedDate = (() => {
    try {
      return format(new Date(activity.timestamp), 'MMM d');
    } catch {
      return '';
    }
  })();

  return (
    <div 
      className="bg-gray-50 rounded-2xl p-4" 
      data-testid={`consolidated-activity-${activity.id}`}
    >
      {/* Header with Avatar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 flex-1">
          {/* Avatar */}
          <Link href={`/profile/${activity.user.username}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold flex-shrink-0 cursor-pointer">
              {activity.user.avatar ? (
                <img src={activity.user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                (activity.user.displayName?.[0] || activity.user.username?.[0] || '?').toUpperCase()
              )}
            </div>
          </Link>
          <div className="flex-1">
            {getHeaderText()}
          </div>
        </div>
        
        {/* Delete Button - Only show for owner */}
        {isOwner && onDelete && (
          <button 
            onClick={() => {
              if (confirm('Are you sure you want to delete this? This will delete all posts in this group.')) {
                onDelete(activity.originalPostIds);
              }
            }}
            className="text-gray-400 hover:text-red-500 transition-colors ml-2"
            data-testid={`button-delete-grouped-${activity.id}`}
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Media Items - Simple list */}
      <div className="space-y-1 mb-3">
        {displayedItems.map((item, idx) => (
          <Link 
            key={item.id || idx} 
            href={`/media/${item.externalSource}/${item.externalId}`}
          >
            <div className="flex items-center gap-2 py-1 hover:text-purple-600 transition-colors cursor-pointer">
              <span className="text-base">{getMediaTypeIcon(item.mediaType)}</span>
              <span className="text-sm text-gray-900 truncate flex-1">
                {item.title}
              </span>
              {item.rating && activity.type === 'ratings' && (
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  <span className="text-xs font-medium text-gray-700">
                    {item.rating}
                  </span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* +X more link */}
      {!showAll && remainingCount > 0 && (
        <button 
          onClick={() => setShowAll(true)}
          className="text-sm text-purple-600 hover:text-purple-700 font-medium mb-3 flex items-center gap-1"
        >
          +{remainingCount} more <ChevronRight size={14} />
        </button>
      )}

      {/* See more of user's lists */}
      <Link 
        href={`/user/${activity.user.id}?tab=lists`}
        className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1 mb-3"
      >
        See more of {activity.user.displayName || activity.user.username}'s lists <ChevronRight size={14} />
      </Link>

      {/* Footer - Likes, Comments & Date */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
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
        <span className="text-sm text-gray-400">{formattedDate}</span>
      </div>
    </div>
  );
}
