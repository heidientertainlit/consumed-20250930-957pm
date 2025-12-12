import { Link } from "wouter";
import { Heart, MessageCircle, ChevronRight, Star, Plus, CheckCircle, Gamepad2, Layers } from "lucide-react";
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
  isLiked: boolean;
}

export default function ConsolidatedActivityCard({ 
  activity, 
  onLike, 
  onComment,
  isLiked 
}: ConsolidatedActivityCardProps) {

  const getActivityIcon = () => {
    switch (activity.type) {
      case 'ratings':
        return <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />;
      case 'finished':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'list_adds':
        return <Plus className="w-4 h-4 text-white" />;
      case 'games':
        return <Gamepad2 className="w-4 h-4 text-white" />;
      default:
        return <Layers className="w-4 h-4 text-white" />;
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

  return (
    <div 
      className={`rounded-2xl overflow-hidden shadow-sm ${
        isConsolidated 
          ? 'bg-gradient-to-br from-purple-600 via-purple-500 to-violet-500 text-white' 
          : 'bg-white border border-gray-200'
      }`} 
      data-testid={`consolidated-activity-${activity.id}`}
    >
      {/* Header */}
      <div className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <Link href={`/profile/${activity.user.username}`}>
            <div className="flex items-center gap-3 cursor-pointer">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                isConsolidated 
                  ? 'bg-white/20 text-white' 
                  : 'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
              }`}>
                {activity.user.avatar ? (
                  <img src={activity.user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  activity.user.displayName?.[0]?.toUpperCase() || activity.user.username?.[0]?.toUpperCase() || '?'
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${isConsolidated ? 'text-white' : 'text-gray-900'}`}>
                    {activity.user.displayName || activity.user.username}
                  </span>
                  <span className={isConsolidated ? 'text-white/80' : 'text-gray-500'}>
                    {getSummaryText()}
                  </span>
                </div>
                <div className={`flex items-center gap-2 text-xs ${isConsolidated ? 'text-white/60' : 'text-gray-400'}`}>
                  {isConsolidated && (
                    <>
                      <Layers className="w-3 h-3" />
                      <span>Consolidated</span>
                      <span>•</span>
                    </>
                  )}
                  <span>{formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}</span>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Content Preview */}
      <div className="px-4 pb-3">
        <div className={`rounded-xl p-3 ${isConsolidated ? 'bg-white/10' : 'bg-gray-50'}`}>
          {/* Activity Type Badge */}
          <div className="flex items-center gap-2 mb-2">
            {getActivityIcon()}
            <span className={`text-xs font-medium uppercase tracking-wide ${
              isConsolidated ? 'text-white/70' : 'text-gray-500'
            }`}>
              {activity.type === 'list_adds' ? 'Added to Lists' : 
               activity.type === 'ratings' ? 'Ratings' :
               activity.type === 'finished' ? 'Finished' : 'Games'}
            </span>
          </div>

          {/* Media Items Preview */}
          <div className="space-y-1.5">
            {activity.items.slice(0, 3).map((item, idx) => (
              <Link 
                key={item.id || idx} 
                href={`/media/${item.externalSource}/${item.externalId}`}
              >
                <div className={`flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer ${
                  isConsolidated ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                }`}>
                  <span className="text-lg">{getMediaTypeIcon(item.mediaType)}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium truncate text-sm ${isConsolidated ? 'text-white' : 'text-gray-900'}`}>
                      {item.title}
                    </div>
                    {item.creator && (
                      <div className={`text-xs truncate ${isConsolidated ? 'text-white/60' : 'text-gray-500'}`}>
                        {item.creator}
                      </div>
                    )}
                  </div>
                  {item.rating && activity.type === 'ratings' && (
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      <span className={`text-xs font-medium ${isConsolidated ? 'text-white' : 'text-gray-900'}`}>
                        {item.rating}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* See More */}
          {activity.items.length > 3 && (
            <div className={`flex items-center justify-end gap-1 mt-2 text-sm font-medium ${
              isConsolidated ? 'text-white/80' : 'text-purple-600'
            }`}>
              <span>+{activity.items.length - 3} more</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>

      {/* Footer - Likes & Comments */}
      <div className={`px-4 py-3 flex items-center justify-between ${
        isConsolidated ? 'border-t border-white/10' : 'border-t border-gray-100'
      }`}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => onLike(activity.originalPostIds[0])}
            className={`flex items-center gap-1.5 transition-colors ${
              isConsolidated 
                ? 'text-white/70 hover:text-white' 
                : 'text-gray-500 hover:text-red-500'
            }`}
            data-testid="like-button"
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-red-400 text-red-400' : ''}`} />
            <span className="text-sm">{activity.likes}</span>
          </button>
          <button
            onClick={() => onComment(activity.originalPostIds[0])}
            className={`flex items-center gap-1.5 transition-colors ${
              isConsolidated 
                ? 'text-white/70 hover:text-white' 
                : 'text-gray-500 hover:text-purple-500'
            }`}
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
