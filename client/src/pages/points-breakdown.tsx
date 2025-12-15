import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { 
  Trophy, 
  BookOpen, 
  Film, 
  Tv, 
  Music, 
  Mic, 
  Gamepad2, 
  MessageSquare, 
  Target, 
  ChevronLeft,
  Award,
  Zap,
  BarChart3
} from "lucide-react";

interface PointsData {
  all_time: number;
  books: number;
  movies: number;
  tv: number;
  music: number;
  podcasts: number;
  games: number;
  reviews: number;
  predictions: number;
  trivia: number;
  polls: number;
}

interface CountsData {
  books: number;
  movies: number;
  tv: number;
  music: number;
  podcasts: number;
  games: number;
  reviews: number;
  predictions: number;
  trivia: number;
  polls: number;
  total: number;
}

const CATEGORY_CONFIG = [
  { key: 'books', label: 'Books', icon: BookOpen, color: 'text-amber-600', bgColor: 'bg-amber-50', pointsPer: 15 },
  { key: 'tv', label: 'TV Shows', icon: Tv, color: 'text-blue-600', bgColor: 'bg-blue-50', pointsPer: 10 },
  { key: 'movies', label: 'Movies', icon: Film, color: 'text-purple-600', bgColor: 'bg-purple-50', pointsPer: 8 },
  { key: 'games', label: 'Games', icon: Gamepad2, color: 'text-green-600', bgColor: 'bg-green-50', pointsPer: 5 },
  { key: 'podcasts', label: 'Podcasts', icon: Mic, color: 'text-pink-600', bgColor: 'bg-pink-50', pointsPer: 3 },
  { key: 'music', label: 'Music', icon: Music, color: 'text-indigo-600', bgColor: 'bg-indigo-50', pointsPer: 1 },
  { key: 'reviews', label: 'Reviews', icon: MessageSquare, color: 'text-orange-600', bgColor: 'bg-orange-50', pointsPer: 10 },
  { key: 'predictions', label: 'Predictions', icon: Target, color: 'text-red-600', bgColor: 'bg-red-50', pointsPer: null },
  { key: 'trivia', label: 'Trivia', icon: Zap, color: 'text-yellow-600', bgColor: 'bg-yellow-50', pointsPer: null },
  { key: 'polls', label: 'Polls', icon: BarChart3, color: 'text-cyan-600', bgColor: 'bg-cyan-50', pointsPer: null },
];

export default function PointsBreakdown() {
  const { session } = useAuth();
  const [, setLocation] = useLocation();
  const [points, setPoints] = useState<PointsData | null>(null);
  const [counts, setCounts] = useState<CountsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPoints = async () => {
      if (!session?.access_token) return;

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const response = await fetch(`${supabaseUrl}/functions/v1/calculate-user-points`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setPoints(data.points);
          setCounts(data.counts);
        }
      } catch (error) {
        console.error('Failed to fetch points:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPoints();
  }, [session?.access_token]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navigation onTrackConsumption={() => {}} />

      <div className="max-w-2xl mx-auto px-4 py-6">
        <Button 
          variant="ghost" 
          onClick={() => setLocation('/me')}
          className="mb-4 -ml-2 text-gray-600"
          data-testid="back-to-profile"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Profile
        </Button>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Trophy className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Points Breakdown</h1>
              <p className="text-gray-500 text-sm">See where your points come from</p>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading your points...</div>
          ) : points ? (
            <div className="mt-6">
              <div className="flex items-center justify-between py-4 border-b border-gray-100">
                <span className="text-lg font-semibold text-gray-700">Total Points</span>
                <span className="text-3xl font-bold text-purple-600">{points.all_time.toLocaleString()}</span>
              </div>
            </div>
          ) : null}
        </div>

        {!isLoading && points && counts && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-800 px-1">Points by Category</h2>
            
            {CATEGORY_CONFIG.map(({ key, label, icon: Icon, color, bgColor, pointsPer }) => {
              const categoryPoints = points[key as keyof PointsData] || 0;
              const categoryCount = counts[key as keyof CountsData] || 0;
              
              if (categoryPoints === 0 && categoryCount === 0) return null;

              return (
                <div 
                  key={key}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4"
                  data-testid={`points-category-${key}`}
                >
                  <div className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`h-6 w-6 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{label}</span>
                      <span className="font-bold text-gray-900">{categoryPoints.toLocaleString()} pts</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm text-gray-500">
                        {categoryCount} {categoryCount === 1 ? 'item' : 'items'}
                      </span>
                      {pointsPer && (
                        <span className="text-xs text-gray-400">
                          {pointsPer} pts each
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 mt-6 border border-purple-100">
              <div className="flex items-start gap-3">
                <Award className="h-5 w-5 text-purple-600 mt-0.5" />
                <div>
                  <p className="font-medium text-purple-900">How to earn more points</p>
                  <ul className="text-sm text-purple-700 mt-2 space-y-1">
                    <li>• Log books for the most points (15 pts each)</li>
                    <li>• Write reviews for bonus points (+10 pts)</li>
                    <li>• Make predictions and play trivia</li>
                    <li>• Track all your entertainment!</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
