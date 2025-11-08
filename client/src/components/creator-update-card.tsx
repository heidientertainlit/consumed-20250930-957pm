import { Users, Music, Film, Book, ChevronRight, Sparkles, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";

interface CreatorUpdate {
  creator_name: string;
  creator_role: string;
  title: string;
  type: string;
  image?: string;
  release_date: string;
  overview?: string;
  external_id: string;
  external_source: string;
  is_classic?: boolean;
}

interface CreatorUpdateCardProps {
  update: CreatorUpdate;
  onClick: () => void;
}

export default function CreatorUpdateCard({ update, onClick }: CreatorUpdateCardProps) {
  const getMediaIcon = () => {
    switch (update.type) {
      case 'album':
      case 'single':
        return <Music size={20} className="text-white" />;
      case 'movie':
        return <Film size={20} className="text-white" />;
      case 'book':
        return <Book size={20} className="text-white" />;
      default:
        return <Users size={20} className="text-white" />;
    }
  };

  const getTypeLabel = () => {
    if (update.is_classic) {
      switch (update.type) {
        case 'album':
        case 'single':
          return 'Popular Album';
        case 'movie':
          return 'Classic Film';
        case 'tv':
          return 'Popular Show';
        case 'book':
          return 'Classic Book';
        default:
          return 'Popular Work';
      }
    }
    
    switch (update.type) {
      case 'album':
        return 'New Album';
      case 'single':
        return 'New Single';
      case 'movie':
        return 'New Movie';
      case 'tv':
        return 'New Show';
      case 'book':
        return 'New Book';
      default:
        return 'New Release';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'today';
    if (diffInDays === 1) return 'yesterday';
    if (diffInDays < 7) return `${diffInDays}d ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short',
      day: 'numeric'
    });
  };

  const getNewsHeadline = () => {
    const typeEmoji = update.type === 'album' || update.type === 'single' ? '🎵' : 
                      update.type === 'movie' ? '🎬' : 
                      update.type === 'book' ? '📚' : '🆕';
    
    if (update.is_classic) {
      return `${typeEmoji} ${update.creator_name}'s "${update.title}" is trending`;
    }
    
    const action = update.type === 'album' ? 'dropped a new album' :
                   update.type === 'single' ? 'released a new single' :
                   update.type === 'movie' ? 'has a new film out' :
                   update.type === 'book' ? 'published a new book' :
                   'released new content';
    
    return `${typeEmoji} ${update.creator_name} just ${action}`;
  };

  return (
    <Card 
      className="bg-white border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors shadow-sm"
      onClick={onClick}
      data-testid="card-creator-update"
    >
      <div className="p-4">
        {/* Tweet-style header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
            <TrendingUp size={16} className="text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-gray-900 text-sm">Pop Culture Updates</span>
              <span className="text-gray-400 text-xs">· {formatDate(update.release_date)}</span>
            </div>
            {/* Tweet-style headline */}
            <p className="text-gray-900 text-sm font-medium mb-3">
              {getNewsHeadline()}
            </p>
          </div>
        </div>

        {/* Media card - Twitter style */}
        <div className="border border-gray-200 rounded-2xl overflow-hidden">
          <div className="flex items-start gap-3 p-3">
            {/* Compact artwork */}
            {update.image ? (
              <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                <img 
                  src={update.image} 
                  alt={update.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                {update.type === 'album' || update.type === 'single' ? (
                  <Music size={24} className="text-gray-400" />
                ) : update.type === 'movie' ? (
                  <Film size={24} className="text-gray-400" />
                ) : (
                  <Book size={24} className="text-gray-400" />
                )}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2">
                {update.title}
              </h3>
              <p className="text-xs text-gray-500 mb-1">by {update.creator_name}</p>
              {update.overview && (
                <p className="text-xs text-gray-600 line-clamp-2">
                  {update.overview}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
