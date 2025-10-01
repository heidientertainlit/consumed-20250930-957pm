import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Medal, Award, Gamepad2, Book, Headphones, Music, Film, Tv, Target, Star, MessageSquare, Calendar, Flame, Users, Vote, Brain, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface LeaderboardEntry {
  user_id: string;
  user_name: string;
  user_points: number;
  score: number;
  created_at: string;
  total_items?: number;
  total_reviews?: number;
  creator_name?: string;
  creator_role?: string;
}

const fetchLeaderboard = async (session: any, category: string = 'all_time', limit: number = 10): Promise<LeaderboardEntry[]> => {
  if (!session?.access_token) {
    throw new Error('No authentication token available');
  }

  // All leaderboard categories now use the unified edge function
  const params = new URLSearchParams({
    category,
    limit: limit.toString(),
  });

  const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-leaderboards?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
  }

  return response.json();
};

// Define leaderboard categories
const leaderboardCategories = [
  {
    id: "all_time",
    title: "All-Time Leader",
    icon: <Trophy className="w-5 h-5" />,
    isSelected: true
  },
  {
    id: "book_leader",
    title: "Book Leader",
    icon: <Book className="w-5 h-5 text-blue-600" />,
    isSelected: false
  },
  {
    id: "movie_leader",
    title: "Movie Leader",
    icon: <Film className="w-5 h-5 text-red-600" />,
    isSelected: false
  },
  {
    id: "tv_leader",
    title: "TV Leader",
    icon: <Tv className="w-5 h-5 text-purple-600" />,
    isSelected: false
  },
  {
    id: "music_leader",
    title: "Music Leader",
    icon: <Music className="w-5 h-5 text-green-600" />,
    isSelected: false
  },
  {
    id: "podcast_leader",
    title: "Podcast Leader",
    icon: <Headphones className="w-5 h-5 text-orange-600" />,
    isSelected: false
  },
  {
    id: "sports_leader",
    title: "Sports Leader",
    icon: <Target className="w-5 h-5 text-blue-600" />,
    isSelected: false
  },
  {
    id: "critic_leader",
    title: "Critic Leader",
    icon: <Star className="w-5 h-5 text-yellow-600" />,
    isSelected: false
  },
  {
    id: "streaker",
    title: "Streaker",
    icon: <Flame className="w-5 h-5 text-blue-600" />,
    isSelected: false
  },
  {
    id: "friend_inviter",
    title: "Friend Inviter",
    icon: <Users className="w-5 h-5 text-green-600" />,
    isSelected: false
  },
  {
    id: "vote_leader",
    title: "Vote Leader",
    icon: <Vote className="w-5 h-5 text-green-600" />,
    isSelected: false
  },
  {
    id: "predict_leader",
    title: "Predict Leader", 
    icon: <TrendingUp className="w-5 h-5 text-purple-600" />,
    isSelected: false
  },
  {
    id: "trivia_leader",
    title: "Trivia Leader",
    icon: <Brain className="w-5 h-5 text-blue-600" />,
    isSelected: false
  },
  {
    id: "fan_points",
    title: "Fan Points",
    icon: <Star className="w-5 h-5 text-pink-600" />,
    isSelected: false
  }
];

export default function Leaderboard() {
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all_time");
  const { session } = useAuth();

  const { data: leaderboardData, isLoading, error } = useQuery({
    queryKey: ["leaderboard", selectedCategory],
    queryFn: () => fetchLeaderboard(session, selectedCategory, 10),
    enabled: !!session?.access_token,
  });

  // Log leaderboard data for debugging
  if (leaderboardData) {
    console.log(`📊 Leaderboard data for ${selectedCategory}:`, leaderboardData);
  }
  if (error) {
    console.error(`❌ Leaderboard error for ${selectedCategory}:`, error);
  }

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="text-purple-800" />;
      case 2: return <Medal className="text-gray-400" />;
      case 3: return <Award className="text-purple-700" />;
      default: return <span className="text-gray-500 font-bold">{rank}</span>;
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={handleTrackConsumption} />
      
      {/* Launch Challenge Banner - Compact Bar */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-2 px-4" data-testid="launch-challenge-banner">
        <div className="max-w-4xl mx-auto text-center text-xs sm:text-sm">
          <span className="font-semibold">🏆 Launch Challenge:</span> Race to 15,000 points! First 3 users win 🥇$50 🥈$30 🥉$20 gift cards. Plus: First to reach a 7-day streak wins $20! 
          <a href="https://consumedapp.com/launch-challenge-rules" target="_blank" rel="noopener noreferrer" className="underline ml-2 hover:text-purple-100" data-testid="link-challenge-rules">Rules</a>
          <span className="mx-1">•</span>
          <a href="mailto:heidi@consumedapp.com" className="underline hover:text-purple-100" data-testid="link-contact-email">Contact</a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-black mb-3">Leaderboard</h1>
          <p className="text-gray-600">See the top fans and trackers in the community — ranked by points from logging, sharing, and engaging with entertainment.</p>
        </div>

        {/* Categories Section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Categories</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {leaderboardCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center space-x-3 p-3 rounded-lg border transition-all ${
                  selectedCategory === category.id
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
                data-testid={`category-${category.id}`}
              >
                <div className={`${selectedCategory === category.id ? 'text-white' : ''}`}>
                  {category.icon}
                </div>
                <span className="font-medium text-sm">{category.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Full Leaderboard */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-gray-100 bg-gray-50">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              {leaderboardCategories.find(cat => cat.id === selectedCategory)?.title || 'All-Time'} Rankings
            </h2>
            <div className="flex items-center space-x-3 mb-2">
              <div className="text-purple-600">
                {leaderboardCategories.find(cat => cat.id === selectedCategory)?.icon}
              </div>
              <p className="text-gray-700 text-sm">
                {selectedCategory === 'all_time' && 'Total points from all media types'}
                {selectedCategory === 'book_leader' && 'Points from books only (15 pts each)'}
                {selectedCategory === 'movie_leader' && 'Points from movies only (8 pts each)'}
                {selectedCategory === 'tv_leader' && 'Points from TV shows only (10 pts each)'}
                {selectedCategory === 'music_leader' && 'Points from music only (1 pt each)'}
                {selectedCategory === 'podcast_leader' && 'Points from podcasts only (3 pts each)'}
                {selectedCategory === 'sports_leader' && 'Points from sports events only (5 pts each)'}
                {selectedCategory === 'critic_leader' && 'Points from reviews only (10 pts each)'}
                {selectedCategory === 'streaker' && 'Consecutive days streak (20 pts per day)'}
                {selectedCategory === 'friend_inviter' && '25 points for every successful friend that joins and uses the app'}
                {selectedCategory === 'vote_leader' && 'Points from voting games only (10 pts each)'}
                {selectedCategory === 'predict_leader' && 'Pending points for correct predictions (20 pts each when resolved)'}
                {selectedCategory === 'trivia_leader' && 'Points from trivia games only (15 pts each)'}
                {selectedCategory === 'fan_points' && 'Your top creators ranked by fan points (1 pt per media item consumed)'}
              </p>
            </div>
          </div>
          
          {!session ? (
            <div className="p-8 text-center">
              <p className="text-gray-600">Please sign in to view the leaderboard.</p>
            </div>
          ) : isLoading ? (
            <div className="divide-y divide-gray-100">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="p-4 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gray-200 rounded"></div>
                      <div>
                        <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-16"></div>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="h-5 bg-gray-200 rounded w-16 mb-1"></div>
                      <div className="h-3 bg-gray-200 rounded w-12"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : leaderboardData && leaderboardData.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {leaderboardData.map((entry, index) => (
                <div key={entry.user_id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 flex items-center justify-center">
                        {getRankIcon(index + 1)}
                      </div>
                      <div>
                        <div className="font-medium text-lg text-gray-900" data-testid={`user-${entry.user_id}`}>
                          {entry.user_name || 'Anonymous User'}
                        </div>
                        <div className="text-sm text-gray-600">
                          {selectedCategory === 'all_time' 
                            ? `${entry.total_items || 0} items tracked`
                            : selectedCategory === 'fan_points' && entry.creator_name
                            ? `${entry.creator_name} (${entry.creator_role})`
                            : `Score: ${entry.user_points.toLocaleString()}`
                          }
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-lg font-medium text-green-600">{entry.user_points.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">Total Points</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-gray-600">No leaderboard data available for this category.</p>
            </div>
          )}
        </div>

      </div>


      <ConsumptionTracker 
        isOpen={isTrackModalOpen} 
        onClose={() => setIsTrackModalOpen(false)} 
      />
    </div>
  );
}
