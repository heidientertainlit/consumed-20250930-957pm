import { Newspaper, ExternalLink, Sparkles, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";

interface CreatorNewsArticle {
  creator_name: string;
  title: string;
  description?: string;
  url: string;
  urlToImage?: string;
  publishedAt: string;
  source: {
    name: string;
  };
}

interface CreatorNewsCardProps {
  article: CreatorNewsArticle;
}

export default function CreatorNewsCard({ article }: CreatorNewsCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours === 1) return '1 hour ago';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    if (diffInHours < 48) return 'Yesterday';
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} days ago`;
    
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short',
      day: 'numeric'
    });
  };

  const handleClick = () => {
    window.open(article.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card 
      className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50 border-2 border-blue-100 cursor-pointer shadow-md active:scale-[0.98] transition-transform"
      onClick={handleClick}
      data-testid="card-creator-news"
    >
      {/* Decorative gradient blob */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-3xl" />
      
      <div className="relative p-6">
        {/* Header with Creator Info */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {/* Icon */}
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
              <Newspaper size={20} className="text-white" />
            </div>
            
            {/* Creator Details */}
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  {article.creator_name}
                </span>
                <Sparkles size={14} className="text-blue-500" />
              </div>
              <div className="text-xs text-gray-500 font-medium">
                In the News
              </div>
            </div>
          </div>

          {/* "News" Badge */}
          <div className="px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-full shadow-md">
            News
          </div>
        </div>

        {/* Article Content */}
        <div className="flex items-start space-x-4 bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm">
          {/* Article Image */}
          {article.urlToImage && (
            <div className="relative flex-shrink-0">
              <div className="w-24 h-24 rounded-xl overflow-hidden shadow-lg ring-2 ring-blue-200">
                <img 
                  src={article.urlToImage} 
                  alt={article.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            </div>
          )}

          {/* Details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-base mb-2 line-clamp-2 leading-tight">
              {article.title}
            </h3>
            
            <div className="flex items-center space-x-2 text-xs text-gray-500 mb-2">
              <Clock size={12} />
              <span className="font-medium">{formatDate(article.publishedAt)}</span>
              <span>•</span>
              <span>{article.source.name}</span>
            </div>

            {article.description && (
              <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                {article.description}
              </p>
            )}
          </div>

          {/* External Link Arrow */}
          <div className="flex-shrink-0 self-center">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <ExternalLink className="text-blue-600" size={16} />
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <div className="mt-3 text-xs text-center text-gray-400 font-medium">
          Tap to read article
        </div>
      </div>
    </Card>
  );
}
