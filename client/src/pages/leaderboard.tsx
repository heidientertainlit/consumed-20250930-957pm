import { useAuth } from "@/lib/auth";
import Navigation from "@/components/navigation";
import { Trophy, Star, Flame, Target, Lightbulb, Heart, TrendingUp, Award, Tv, BookOpen, Film, Podcast, Share2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

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

type CategoryType = 'consumption' | 'conversation' | 'call-it';

export default function Leaderboard() {
  const { session, user } = useAuth();
  const [activeCategory, setActiveCategory] = useState<CategoryType>('consumption');
  const { toast } = useToast();

  // Fetch leaderboard data (global, weekly)
  const { data: leaderboardData, isLoading } = useQuery({
    queryKey: ['leaderboard', 'global'],
    queryFn: async () => {
      if (!session?.access_token) return null;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-leaderboards?category=all&scope=global&period=weekly`,
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

  // Share rank mutation
  const shareRankMutation = useMutation({
    mutationFn: async ({ rank, categoryName }: { rank: number; categoryName: string }) => {
      if (!session?.access_token) throw new Error('Not authenticated');

      const shareText = `🔥 I'm #${rank} in ${categoryName} this month on Consumed.`;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/share-update`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: shareText,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to share rank');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Rank shared!",
        description: "Your leaderboard rank has been posted to your feed.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to share",
        description: "Could not share your rank. Please try again.",
        variant: "destructive",
      });
    },
  });

  const renderLeaderboardSection = (
    title: string,
    icon: any,
    entries: LeaderboardEntry[],
    subtitle: string,
    scoreLabel: string,
    categoryName: string
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

                  {/* Score and Share Button */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="font-bold text-lg text-purple-600">{entry.score}</p>
                      <p className="text-xs text-gray-500">{scoreLabel}</p>
                    </div>
                    
                    {isCurrentUser && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => shareRankMutation.mutate({ rank: index + 1, categoryName })}
                        disabled={shareRankMutation.isPending}
                        className="flex items-center gap-1.5"
                        data-testid={`button-share-rank-${categoryName}`}
                      >
                        <Share2 size={14} />
                        <span className="hidden sm:inline">Share</span>
                      </Button>
                    )}
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
  const mockConsumptionLeaders: LeaderboardEntry[] = [
    { user_id: '1', username: 'alexchen', display_name: 'Alex Chen', score: 247, rank: 1 },
    { user_id: '2', username: 'miapatel', display_name: 'Mia Patel', score: 198, rank: 2 },
    { user_id: '3', username: 'jordantaylor', display_name: 'Jordan Taylor', score: 156, rank: 3 },
    { user_id: '4', username: 'sarahkim', display_name: 'Sarah Kim', score: 134, rank: 4 },
    { user_id: '5', username: 'marcusjones', display_name: 'Marcus Jones', score: 112, rank: 5 },
  ];

  const mockConversationLeaders: LeaderboardEntry[] = [
    { user_id: '2', username: 'miapatel', display_name: 'Mia Patel', score: 342, rank: 1 },
    { user_id: '1', username: 'alexchen', display_name: 'Alex Chen', score: 289, rank: 2 },
    { user_id: '4', username: 'sarahkim', display_name: 'Sarah Kim', score: 267, rank: 3 },
    { user_id: '3', username: 'jordantaylor', display_name: 'Jordan Taylor', score: 203, rank: 4 },
    { user_id: '6', username: 'emilyrodriguez', display_name: 'Emily Rodriguez', score: 178, rank: 5 },
  ];

  const mockCallItLeaders: LeaderboardEntry[] = [
    { user_id: '3', username: 'jordantaylor', display_name: 'Jordan Taylor', score: 89, rank: 1 },
    { user_id: '1', username: 'alexchen', display_name: 'Alex Chen', score: 76, rank: 2 },
    { user_id: '5', username: 'marcusjones', display_name: 'Marcus Jones', score: 64, rank: 3 },
    { user_id: '2', username: 'miapatel', display_name: 'Mia Patel', score: 58, rank: 4 },
    { user_id: '7', username: 'davidlee', display_name: 'David Lee', score: 45, rank: 5 },
  ];

  // Get current category data
  const getCurrentCategoryData = () => {
    switch (activeCategory) {
      case 'consumption':
        return mockConsumptionLeaders;
      case 'conversation':
        return mockConversationLeaders;
      case 'call-it':
        return mockCallItLeaders;
      default:
        return mockConsumptionLeaders;
    }
  };

  // Get category name for sharing
  const getCategoryName = () => {
    switch (activeCategory) {
      case 'consumption':
        return 'Consumption Leaders';
      case 'conversation':
        return 'Conversation Leaders';
      case 'call-it':
        return 'Call-It Leaders';
      default:
        return 'Leaders';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-semibold text-black mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Leaders
          </h1>
          <p className="text-base text-gray-600 max-w-xs mx-auto">
            Most active fans and trending voices.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 mb-6 justify-center flex-wrap">
          <button
            onClick={() => setActiveCategory('consumption')}
            className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all ${
              activeCategory === 'consumption'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Consumption
          </button>
          <button
            onClick={() => setActiveCategory('conversation')}
            className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all ${
              activeCategory === 'conversation'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Conversation
          </button>
          <button
            onClick={() => setActiveCategory('call-it')}
            className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all ${
              activeCategory === 'call-it'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Call-It
          </button>
        </div>

        {/* Category Description */}
        <div className="mb-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">
            {activeCategory === 'consumption' && 'Consumption Leaders'}
            {activeCategory === 'conversation' && 'Conversation Leaders'}
            {activeCategory === 'call-it' && 'Call-It Leaders'}
          </h2>
          <p className="text-sm text-gray-600 max-w-md mx-auto">
            {activeCategory === 'consumption' && "Who's adding the most shows, books, movies, podcasts, and more."}
            {activeCategory === 'conversation' && "Friends whose posts and comments are fueling the conversation."}
            {activeCategory === 'call-it' && "Friends making the boldest calls—and getting them right."}
          </p>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-lg p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="animate-pulse flex items-start gap-3">
                  <div className="w-6 h-4 bg-gray-200 rounded"></div>
                  <div className="flex-1">
                    <div className="h-5 bg-gray-200 rounded w-1/3 mb-1"></div>
                    <div className="h-4 bg-gray-100 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg p-6">
            <div className="space-y-4">
              {getCurrentCategoryData().map((entry, index) => {
                const isCurrentUser = entry.user_id === user?.id;
                
                return (
                  <div
                    key={entry.user_id}
                    className="flex items-start gap-3 py-2"
                  >
                    {/* Rank Number */}
                    <div className="text-gray-400 text-sm font-medium pt-0.5 w-6">
                      {index + 1}.
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-base ${isCurrentUser ? 'text-purple-700' : 'text-gray-900'}`}>
                        {entry.display_name || entry.username}
                      </p>
                      <p className="text-sm text-gray-500">
                        @{entry.username} • <span className="text-purple-400">{entry.score} pts</span>
                      </p>
                    </div>

                    {/* Share Button (only for current user) */}
                    {isCurrentUser && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => shareRankMutation.mutate({ rank: index + 1, categoryName: getCategoryName() })}
                        disabled={shareRankMutation.isPending}
                        className="text-gray-400 hover:text-purple-600"
                        data-testid="button-share-rank"
                      >
                        <Share2 size={16} />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
