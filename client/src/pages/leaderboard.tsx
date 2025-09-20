import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Medal, Award, Gamepad2, Book, Headphones, Music, Film, Tv, Target } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface LeaderboardEntry {
  user_id: string;
  user_points: number;
  score: number;
  created_at: string;
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

export default function Leaderboard() {
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const { session } = useAuth();

  const { data: leaderboardData, isLoading } = useQuery({
    queryKey: ["leaderboard", "all_time"],
    queryFn: () => fetchLeaderboard(session, "all_time", 10),
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

        {/* Full Leaderboard */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-gray-100 bg-gray-50">
            <h2 className="text-2xl font-bold text-gray-900">All-Time Rankings</h2>
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
                          {entry.user_id}
                        </div>
                        <div className="text-sm text-gray-600">Score: {entry.score}</div>
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
