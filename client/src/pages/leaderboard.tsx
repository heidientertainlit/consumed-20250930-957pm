import { useAuth } from "@/lib/auth";
import Navigation from "@/components/navigation";
import { Trophy, Star, Flame, Target, Lightbulb, Heart, TrendingUp, Award } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface LeaderboardEntry {
  user_id: string;
  username: string;
  display_name?: string;
  score: number;
  rank: number;
  posts_count?: number;
  engagement_count?: number;
  accuracy?: number;
  helpful_count?: number;
}

export default function Leaderboard() {
  const { session, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'circle' | 'global'>('circle');

  // Fetch leaderboard data
  const { data: leaderboardData, isLoading } = useQuery({
    queryKey: ['leaderboard', activeTab],
    queryFn: async () => {
      if (!session?.access_token) return null;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-leaderboards?category=all&scope=${activeTab}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      return response.json();
    },
    enabled: !!session?.access_token,
  });

  const renderLeaderboardSection = (
    title: string,
    icon: any,
    entries: LeaderboardEntry[],
    subtitle: string,
    scoreLabel: string
  ) => {
    const Icon = icon;
    
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4">
          <div className="flex items-center gap-2">
            <Icon className="text-white" size={24} />
            <div>
              <h3 className="text-lg font-bold text-white">{title}</h3>
              <p className="text-xs text-purple-100">{subtitle}</p>
            </div>
          </div>
        </div>
        
        <div className="divide-y divide-gray-100">
          {entries && entries.length > 0 ? (
            entries.slice(0, 10).map((entry, index) => {
              const isCurrentUser = entry.user_id === user?.id;
              const rankColors = ['bg-yellow-400', 'bg-gray-300', 'bg-orange-400'];
              
              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-4 p-4 ${isCurrentUser ? 'bg-purple-50' : 'hover:bg-gray-50'} transition-colors`}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                    {index < 3 ? (
                      <div className={`w-8 h-8 rounded-full ${rankColors[index]} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                        {index + 1}
                      </div>
                    ) : (
                      <span className="text-gray-500 font-semibold text-sm">#{index + 1}</span>
                    )}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm truncate ${isCurrentUser ? 'text-purple-700' : 'text-gray-900'}`}>
                      {entry.display_name || entry.username}
                      {isCurrentUser && <span className="ml-2 text-xs text-purple-600">(You)</span>}
                    </p>
                    <p className="text-xs text-gray-500">@{entry.username}</p>
                  </div>

                  {/* Score */}
                  <div className="flex-shrink-0 text-right">
                    <p className="font-bold text-lg text-purple-600">{entry.score}</p>
                    <p className="text-xs text-gray-500">{scoreLabel}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-gray-500">
              <p className="text-sm">No data yet. Start engaging to see rankings!</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Mock data for now - will be replaced with actual API data
  const mockFanLeaders: LeaderboardEntry[] = [
    { user_id: '1', username: 'alexchen', display_name: 'Alex Chen', score: 1250, rank: 1 },
    { user_id: '2', username: 'miapatel', display_name: 'Mia Patel', score: 980, rank: 2 },
    { user_id: '3', username: 'jordantaylor', display_name: 'Jordan Taylor', score: 875, rank: 3 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-black mb-2 flex items-center justify-center gap-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            <Trophy className="text-purple-600" size={32} />
            Leaderboard
          </h1>
          <p className="text-lg text-gray-900 font-medium mb-1">
            Who's Leading the Entertainment Conversation This Week?
          </p>
          <p className="text-sm text-gray-600">
            See who's most active in your circle — sharing, predicting, and engaging.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white rounded-2xl border border-gray-200 p-1.5">
          <button
            onClick={() => setActiveTab('circle')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'circle'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Your Circle
          </button>
          <button
            onClick={() => setActiveTab('global')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'global'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Global Leaders
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-2xl border border-gray-200 p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-12 bg-gray-100 rounded"></div>
                  <div className="h-12 bg-gray-100 rounded"></div>
                  <div className="h-12 bg-gray-100 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Fan Leaders */}
            {renderLeaderboardSection(
              '🌟 Fan Leaders',
              Star,
              mockFanLeaders,
              'Most active overall',
              'points'
            )}

            {/* Conversation Starters */}
            {renderLeaderboardSection(
              '🔥 Conversation Starters',
              Flame,
              mockFanLeaders.map(e => ({ ...e, score: Math.floor(e.score * 0.6) })),
              'Posts people engaged with most',
              'engagements'
            )}

            {/* Top Predictors */}
            {renderLeaderboardSection(
              '🎯 Top Predictors',
              Target,
              mockFanLeaders.map(e => ({ ...e, score: Math.floor(Math.random() * 100) })),
              'Most accurate predictions',
              '% accuracy'
            )}

            {/* Trivia Champs */}
            {renderLeaderboardSection(
              '🧩 Trivia Champs',
              Lightbulb,
              mockFanLeaders.map(e => ({ ...e, score: Math.floor(e.score * 0.4) })),
              'Correct answers and streaks',
              'points'
            )}

            {/* Most Helpful */}
            {renderLeaderboardSection(
              '❤️ Most Helpful',
              Heart,
              mockFanLeaders.map(e => ({ ...e, score: Math.floor(e.score * 0.5) })),
              'Recommendations people saved',
              'saves'
            )}
          </div>
        )}

        {/* What's Tracked Section */}
        <div className="mt-8 bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl border border-purple-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="text-purple-600" size={20} />
            What We Track
          </h3>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <h4 className="font-semibold text-sm text-purple-900 mb-2">💬 Conversation Activity</h4>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• Posts & thoughts</li>
                <li>• Reactions & reviews</li>
                <li>• Polls & recommendations</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-sm text-purple-900 mb-2">👥 Social Interaction</h4>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• Replying to friends</li>
                <li>• Commenting</li>
                <li>• Mentioning @friends</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-sm text-purple-900 mb-2">🎮 Play Activity</h4>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• Predictions & accuracy</li>
                <li>• Trivia rounds</li>
                <li>• Wins & streaks</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-purple-200">
            <p className="text-xs text-gray-600 italic">
              ✨ We don't track hours watched, books read, or consumption quantity. 
              It's all about the conversation and engagement with your circle.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
