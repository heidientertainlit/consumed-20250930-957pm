
import { useQuery } from "@tanstack/react-query";
import { Star, Calendar, Coins } from "lucide-react";
import { ConsumptionLog } from "@shared/schema";

interface ConsumptionHistoryProps {
  userId: string;
}

export default function ConsumptionHistory({ userId }: ConsumptionHistoryProps) {
  const { data: logs, isLoading } = useQuery({
    queryKey: [`/api/users/${userId}/consumption`],
  });

  const { data: stats } = useQuery({
    queryKey: [`/api/users/${userId}/consumption/stats`],
  });

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "movies": return "bg-red-500/20 text-red-300";
      case "tv": return "bg-blue-500/20 text-blue-300";
      case "books": return "bg-green-500/20 text-green-300";
      case "music": return "bg-purple-500/20 text-purple-300";
      case "games": return "bg-orange-500/20 text-orange-300";
      default: return "bg-gray-500/20 text-gray-300";
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((n) => (
          <div key={n} className="bg-dark-secondary rounded-lg p-4 animate-pulse">
            <div className="h-4 bg-dark-accent rounded mb-2"></div>
            <div className="h-3 bg-dark-accent rounded mb-1"></div>
            <div className="h-3 bg-dark-accent rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-r from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-300">{stats.totalLogged}</div>
            <div className="text-sm text-gray-400">Items Tracked</div>
          </div>
          <div className="bg-gradient-to-r from-gold-accent/20 to-yellow-500/20 border border-gold-accent/30 rounded-lg p-4">
            <div className="text-2xl font-bold text-gold-accent">{stats.pointsEarned}</div>
            <div className="text-sm text-gray-400">Points Earned</div>
          </div>
          <div className="bg-gradient-to-r from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-300">{Object.keys(stats.categoriesCount).length}</div>
            <div className="text-sm text-gray-400">Categories</div>
          </div>
        </div>
      )}

      {/* Consumption Logs */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Recent Activity</h3>
        {logs && logs.length > 0 ? (
          logs.map((log: ConsumptionLog) => (
            <div key={log.id} className="bg-dark-secondary rounded-lg p-4 border border-dark-accent">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className="font-semibold">{log.title}</h4>
                    <span className={`text-xs px-2 py-1 rounded-full ${getCategoryColor(log.category)}`}>
                      {log.category}
                    </span>
                    <span className="text-xs bg-dark-accent px-2 py-1 rounded-full">
                      {log.type}
                    </span>
                  </div>
                  
                  {log.rating && (
                    <div className="flex items-center space-x-1 mb-2">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          size={14}
                          className={i < log.rating! ? "text-yellow-400 fill-current" : "text-gray-400"}
                        />
                      ))}
                    </div>
                  )}
                  
                  {log.review && (
                    <p className="text-sm text-gray-300 mb-2 line-clamp-2">{log.review}</p>
                  )}
                  
                  <div className="flex items-center space-x-4 text-xs text-gray-400">
                    <div className="flex items-center space-x-1">
                      <Calendar size={12} />
                      <span>{formatDate(log.consumedAt)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Coins size={12} className="text-gold-accent" />
                      <span className="text-gold-accent">+{log.pointsEarned} pts</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p>No consumption logged yet. Start tracking what you watch, read, or play!</p>
          </div>
        )}
      </div>
    </div>
  );
}
