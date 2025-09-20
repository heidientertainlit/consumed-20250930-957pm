import { Button } from "@/components/ui/button";
import { Clock, Film, Tv, Book, Star, Trophy } from "lucide-react";
import { Pool } from "@shared/schema";

interface PoolCardProps {
  pool: Pool;
  onJoin: (pool: Pool) => void;
  onViewDetails: (pool: Pool) => void;
  compact?: boolean;
}

export default function PoolCard({ pool, onJoin, onViewDetails, compact = false }: PoolCardProps) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "movies": return <Film size={compact ? 20 : 24} />;
      case "tv": return <Tv size={compact ? 20 : 24} />;
      case "books": return <Book size={compact ? 20 : 24} />;
      case "sports": return <Trophy size={compact ? 20 : 24} />;
      case "pop-culture": return <Star size={compact ? 20 : 24} />;
      default: return <Star size={compact ? 20 : 24} />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "movies": return "bg-red-500";
      case "tv": return "bg-blue-500";
      case "books": return "bg-green-600";
      case "sports": return "bg-orange-500";
      case "pop-culture": return "bg-purple-600";
      default: return "bg-gray-500";
    }
  };

  const getTimeLeft = (endDate: Date) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return "Ended";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  };

  if (compact) {
    return (
      <div className="bg-dark-secondary rounded-xl border border-dark-accent p-4 hover:border-purple-primary transition-all duration-300">
        <div className="flex items-start justify-between mb-3">
          <span className={`${getCategoryColor(pool.category)} text-xs px-2 py-1 rounded-full font-medium uppercase`}>
            {pool.category}
          </span>
          <span className="text-xs text-gray-400 flex items-center">
            <Clock size={12} className="mr-1" />
            {getTimeLeft(pool.endDate)}
          </span>
        </div>
        <h3 className="font-semibold mb-2 text-sm line-clamp-2">{pool.title}</h3>
        <div className="flex justify-between items-center mb-3">
          <div className="text-center">
            <div className="text-lg font-bold text-gold-accent">{pool.totalPoints?.toLocaleString()} pts</div>
            <div className="text-xs text-gray-400">Prize Pool</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold">{pool.participantCount}</div>
            <div className="text-xs text-gray-400">Players</div>
          </div>
        </div>
        <Button 
          onClick={() => onJoin(pool)}
          className="w-full gradient-primary text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Join 100 pts
        </Button>
      </div>
    );
  }

  return (
    <div 
      className="bg-gradient-to-br from-dark-secondary to-dark-accent rounded-2xl border border-dark-accent overflow-hidden hover:border-purple-primary transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
      onClick={() => onViewDetails(pool)}
    >
      <div className="h-48 bg-gradient-to-br from-purple-primary/20 to-pink-primary/20 relative overflow-hidden">
        <div className="absolute top-4 left-4">
          <span className={`${getCategoryColor(pool.category)} text-xs px-2 py-1 rounded-full font-medium uppercase`}>
            {pool.category}
          </span>
        </div>
        <div className="absolute top-4 right-4">
          <span className="bg-dark-secondary/80 text-xs px-2 py-1 rounded-full flex items-center">
            <Clock size={12} className="mr-1" />
            {getTimeLeft(pool.endDate)}
          </span>
        </div>
        <div className="absolute inset-0 flex items-center justify-center text-white/30">
          {getCategoryIcon(pool.category)}
        </div>
      </div>
      <div className="p-6">
        <h3 className="text-lg font-bold mb-2">{pool.title}</h3>
        <p className="text-gray-400 text-sm mb-4 line-clamp-2">{pool.description}</p>
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gold-accent">{pool.totalPoints?.toLocaleString()} pts</div>
              <div className="text-xs text-gray-400">Prize Pool</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold">{pool.participantCount}</div>
              <div className="text-xs text-gray-400">Players</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Entry Cost</div>
            <div className="text-lg font-bold text-purple-primary">100 pts</div>
          </div>
        </div>
        
        <Button 
          onClick={(e) => {
            e.stopPropagation();
            onJoin(pool);
          }}
          className="w-full gradient-primary font-medium hover:opacity-90 transition-opacity"
        >
          Join Pool (100 pts)
        </Button>
      </div>
    </div>
  );
}
