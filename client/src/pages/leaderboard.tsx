import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Medal, Award, Gamepad2, Book, Headphones, Music, Film, Tv, Target, Star, MessageSquare, Calendar, Flame, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface LeaderboardEntry {
  user_id: string;
  user_name: string;
  user_points: number;
  score: number;
  created_at: string;
  total_items?: number;
  total_reviews?: number;
}

const fetchLeaderboard = async (session: any, category: string = 'all_time', limit: number = 10): Promise<LeaderboardEntry[]> => {
  if (!session?.access_token) {
    throw new Error('No authentication token available');
  }

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
    id: "bookworm",
    title: "Bookworm",
    icon: <Book className="w-5 h-5 text-blue-600" />,
    isSelected: false
  },
  {
    id: "cinephile",
    title: "Cinephile",
    icon: <Film className="w-5 h-5 text-red-600" />,
    isSelected: false
  },
  {
    id: "series_slayer",
    title: "Series Slayer",
    icon: <Tv className="w-5 h-5 text-purple-600" />,
    isSelected: false
  },
  {
    id: "track_star",
    title: "Track Star",
    icon: <Music className="w-5 h-5 text-green-600" />,
    isSelected: false
  },
  {
    id: "podster",
    title: "Podster",
    icon: <Headphones className="w-5 h-5 text-orange-600" />,
    isSelected: false
  },
  {
    id: "top_critic",
    title: "Top Critic",
    icon: <Star className="w-5 h-5 text-yellow-600" />,
    isSelected: false
  },
  {
    id: "superstar",
    title: "Superstar(er)",
    icon: <Award className="w-5 h-5 text-pink-600" />,
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
  }
];

export default function Leaderboard() {
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all_time");
  const { session } = useAuth();

  const { data: leaderboardData, isLoading } = useQuery({
    queryKey: ["leaderboard", selectedCategory],
    queryFn: () => fetchLeaderboard(session, selectedCategory, 10),
    enabled: !!session?.access_token,
  });

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
            <h2 className="text-2xl font-bold text-gray-900">
              {leaderboardCategories.find(cat => cat.id === selectedCategory)?.title || 'All-Time'} Rankings
            </h2>
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
                          {entry.total_items ? `${entry.total_items} items tracked` : `Score: ${entry.score}`}
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
