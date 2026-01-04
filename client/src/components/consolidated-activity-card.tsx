import { useState } from "react";
import { Link } from "wouter";
import { Heart, MessageCircle, ChevronRight, Star, Trash2, Dices } from "lucide-react";

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
  onBet?: (postId: string, mediaTitle: string, userName: string, targetUserId: string, externalId?: string, externalSource?: string, mediaType?: string) => void;
  isLiked: boolean;
  currentUserId?: string | null;
}

export default function ConsolidatedActivityCard({ 
  activity, 
  onLike, 
  onComment,
  onDelete,
  onBet,
  isLiked,
  currentUserId
}: ConsolidatedActivityCardProps) {
  const [showAll, setShowAll] = useState(false);
  
  const isOwner = currentUserId && activity.user.id === currentUserId;
  
  // Check if this is a bettable list (Currently or Want To)
  const listName = activity.listNames?.[0]?.toLowerCase() || '';
  const isBettableList = activity.type === 'list_adds' && (listName === 'currently' || listName === 'want to');
  const canBet = isBettableList && !isOwner && onBet && activity.items.length > 0;
  
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
            <Link href={`/profile/${activity.user.username}`} className="font-semibold text-white hover:text-purple-300">
              {displayName}
            </Link>
            <span className="text-purple-200/70"> rated</span>
          </span>
        );
      case 'finished':
        return (
          <span className="text-sm">
            <Link href={`/profile/${activity.user.username}`} className="font-semibold text-white hover:text-purple-300">
              {displayName}
            </Link>
            <span className="text-purple-200/70"> finished</span>
          </span>
        );
      case 'list_adds':
        const listName = activity.listNames?.[0] || 'a list';
        return (
          <span className="text-sm">
            <Link href={`/profile/${activity.user.username}`} className="font-semibold text-white hover:text-purple-300">
              {displayName}
            </Link>
            <span className="text-purple-200/70"> added to → </span>
            <span className="text-purple-300 font-medium">{listName}</span>
          </span>
        );
      default:
        return (
          <span className="text-sm">
            <Link href={`/profile/${activity.user.username}`} className="font-semibold text-white hover:text-purple-300">
              {displayName}
            </Link>
            <span className="text-purple-200/70"> shared activity</span>
          </span>
        );
    }
  };

  const allItems = activity.items;
  const displayedItems = showAll ? allItems : allItems.slice(0, 3);
  const remainingCount = allItems.length - 3;

  const formattedDate = (() => {
    try {
      const date = new Date(activity.timestamp);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) return 'Today';
      if (diffDays === 2) return 'Yesterday';
      if (diffDays <= 7) return `${diffDays - 1} days ago`;

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    } catch {
      return '';
    }
  })();

  return (
    <div 
      className="bg-gradient-to-br from-[#1a1a2e] via-[#2d1f4e] to-[#1a1a2e] rounded-2xl border border-purple-900/50 p-4 shadow-lg" 
      data-testid={`consolidated-activity-${activity.id}`}
    >
      {/* Header with Avatar */}
      <div className="flex items-center justify-between mb-4">
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
            className="text-purple-300 hover:text-red-400 transition-colors ml-2"
            data-testid={`button-delete-grouped-${activity.id}`}
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Media Items */}
      <div className="bg-white/10 rounded-lg p-4 mb-4">
        <div className="space-y-1.5">
          {displayedItems.map((item, idx) => (
            <div key={item.id || idx} className="flex items-center gap-2 py-1">
              <Link 
                href={`/media/${item.mediaType?.toLowerCase() || 'movie'}/${item.externalSource}/${item.externalId}`}
                className="flex items-center gap-2 flex-1 min-w-0 hover:text-purple-200 transition-colors cursor-pointer"
              >
                <span className="text-base">{getMediaTypeIcon(item.mediaType)}</span>
                <span className="text-sm text-white truncate flex-1">
                  {item.title}
                </span>
                {item.rating && activity.type === 'ratings' && (
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs font-medium text-white">
                      {item.rating}
                    </span>
                  </div>
                )}
              </Link>
              {canBet && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onBet!(
                      activity.originalPostIds[0],
                      item.title,
                      activity.user.displayName || activity.user.username,
                      activity.user.id,
                      item.externalId,
                      item.externalSource,
                      item.mediaType
                    );
                  }}
                  className="p-1.5 text-white/90 hover:text-white bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                  title={`Bet on ${item.title}`}
                  data-testid={`bet-item-${idx}`}
                >
                  <Dices size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* +X more link */}
      {!showAll && remainingCount > 0 && (
        <button 
          onClick={() => setShowAll(true)}
          className="text-sm text-purple-300 hover:text-white font-medium mb-3 flex items-center gap-1"
        >
          +{remainingCount} more <ChevronRight size={14} />
        </button>
      )}

      {/* See more of user's lists */}
      <Link 
        href={`/user/${activity.user.id}?tab=lists`}
        className="text-sm text-purple-300 hover:text-white font-medium flex items-center gap-1 mb-4"
      >
        See more of {activity.user.displayName || activity.user.username}'s lists <ChevronRight size={14} />
      </Link>

      {/* Footer - Likes, Comments & Date */}
      <div className="flex items-center justify-between pt-3 border-t border-purple-500/30">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onLike(activity.originalPostIds[0])}
            className="flex items-center gap-1.5 text-purple-300 hover:text-red-400 transition-colors"
            data-testid="like-button"
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
            <span className="text-sm">{activity.likes}</span>
          </button>
          <button
            onClick={() => onComment(activity.originalPostIds[0])}
            className="flex items-center gap-1.5 text-purple-300 hover:text-white transition-colors"
            data-testid="comment-button"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm">{activity.comments}</span>
          </button>
        </div>
        <span className="text-sm text-purple-200/60">{formattedDate}</span>
      </div>
    </div>
  );
}
