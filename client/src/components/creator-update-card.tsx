import { Users, Music, Film, Book, ChevronRight, Sparkles } from "lucide-react";
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
    
    if (diffInDays === 0) return 'Released today';
    if (diffInDays === 1) return 'Released yesterday';
    if (diffInDays < 7) return `Released ${diffInDays} days ago`;
    if (diffInDays < 30) return `Released ${Math.floor(diffInDays / 7)} weeks ago`;
    
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Card 
      className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-pink-50 border-2 border-purple-100 cursor-pointer shadow-md active:scale-[0.98] transition-transform"
      onClick={onClick}
      data-testid="card-creator-update"
    >
      {/* Decorative gradient blob */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl" />
      
      <div className="relative p-6">
        {/* Header with Creator Info */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {/* Icon */}
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center shadow-lg">
              {getMediaIcon()}
            </div>
            
            {/* Creator Details */}
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                  {update.creator_name}
                </span>
                <Sparkles size={14} className="text-purple-500" />
              </div>
              <div className="text-xs text-gray-500 font-medium">
                {update.creator_role}
              </div>
            </div>
          </div>

          {/* "New" Badge */}
          <div className="px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold rounded-full shadow-md">
            {getTypeLabel()}
          </div>
        </div>

        {/* Media Content */}
        <div className="flex items-start space-x-4 bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm">
          {/* Album/Movie/Book Cover */}
          <div className="relative flex-shrink-0">
            {update.image ? (
              <div className="w-24 h-32 rounded-xl overflow-hidden shadow-lg ring-2 ring-purple-200">
                <img 
                  src={update.image} 
                  alt={update.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-24 h-32 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center shadow-lg">
                {update.type === 'album' || update.type === 'single' ? (
                  <Music size={36} className="text-purple-600" />
                ) : update.type === 'movie' ? (
                  <Film size={36} className="text-purple-600" />
                ) : (
                  <Book size={36} className="text-purple-600" />
                )}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-lg mb-2 line-clamp-2">
              {update.title}
            </h3>
            
            <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
              <span className="font-medium">{formatDate(update.release_date)}</span>
            </div>

            {update.overview && (
              <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                {update.overview}
              </p>
            )}
          </div>

          {/* View Arrow */}
          <div className="flex-shrink-0 self-center">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
              <ChevronRight className="text-purple-600" size={18} />
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <div className="mt-3 text-xs text-center text-gray-400 font-medium">
          Tap to view details
        </div>
      </div>
    </Card>
  );
}
