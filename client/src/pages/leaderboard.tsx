import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import FeedbackFooter from "@/components/feedback-footer";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Medal, Award, Gamepad2, Book, Headphones, Music, Film, Tv, Target, Star, MessageSquare, Calendar, Flame, Users, Vote, Brain, TrendingUp, Share2, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { copyLink } from "@/lib/share";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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

// Fetch challenge-specific leaderboards
const fetchChallengeLeaderboards = async (session: any) => {
  if (!session?.access_token) {
    throw new Error('No authentication token available');
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = 'https://mahpgcogwpawvviapqza.supabase.co';
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1haHBnY29nd3Bhd3Z2aWFwcXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxNTczOTMsImV4cCI6MjA2MTczMzM5M30.cv34J_2INF3_GExWw9zN1Vaa-AOFWI2Py02h0vAlW4c';
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Fetch all long-form trivia challenges (20+ questions)
  const { data: challenges, error: challengesError } = await supabase
    .from('prediction_pools')
    .select('id, title, description, points_reward, icon, options')
    .eq('type', 'trivia')
    .eq('status', 'open');

  if (challengesError) throw challengesError;

  // Filter to only long-form challenges (multi-question format)
  const longFormChallenges = challenges?.filter(c => 
    Array.isArray(c.options) && c.options.length > 2 && c.options[0]?.question
  ) || [];

  // For each challenge, fetch top scorers
  const challengeLeaderboards = await Promise.all(
    longFormChallenges.map(async (challenge) => {
      const { data: predictions, error } = await supabase
        .from('user_predictions')
        .select(`
          user_id,
          points_earned,
          created_at,
          users (
            user_name
          )
        `)
        .eq('pool_id', challenge.id)
        .order('points_earned', { ascending: false })
        .limit(10);

      if (error) {
        console.error(`Error fetching leaderboard for ${challenge.id}:`, error);
        return {
          challenge,
          topScorers: []
        };
      }

      return {
        challenge,
        topScorers: predictions || []
      };
    })
  );

  return challengeLeaderboards;
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
  const [expandedChallenge, setExpandedChallenge] = useState<string | null>(null);
  const { session } = useAuth();
  const { toast } = useToast();


  const { data: leaderboardData, isLoading, error } = useQuery({
    queryKey: ["leaderboard", selectedCategory],
    queryFn: () => fetchLeaderboard(session, selectedCategory, 10),
    enabled: !!session?.access_token && selectedCategory !== 'challenges',
    staleTime: 30000, // Cache data for 30 seconds - instant category switches!
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  // Fetch trivia challenges when trivia_leader is selected
  const { data: challengeLeaderboards, isLoading: challengesLoading } = useQuery({
    queryKey: ["challenge-leaderboards"],
    queryFn: () => fetchChallengeLeaderboards(session),
    enabled: !!session?.access_token && (selectedCategory === 'challenges' || selectedCategory === 'trivia_leader'),
    staleTime: 30000, // Cache for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
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

  const handleShare = async () => {
    try {
      await copyLink({ kind: 'leaderboard' });
      toast({
        title: "Link Copied!",
        description: "Leaderboard link copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Failed to copy link",
        description: "Please try again",
        variant: "destructive",
      });
    }
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
          <div className="flex items-center justify-center gap-3 mb-3">
            <h1 className="text-3xl font-semibold text-black">Leaderboard</h1>
            <button
              onClick={handleShare}
              className="p-2 rounded-full hover:bg-gray-200 transition-colors"
              data-testid="button-share-leaderboard"
              aria-label="Share leaderboard"
            >
              <Share2 className="w-5 h-5 text-gray-600" />
            </button>
          </div>
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
                    ? 'bg-purple-600 text-white border-purple-600'
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
                {selectedCategory === 'trivia_leader' && 'Overall trivia points from all games • View individual challenge leaderboards below'}
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
          ) : selectedCategory === 'challenges' ? (
            <div className="p-6">
              {challengesLoading ? (
                <div className="text-center py-8 text-gray-500">Loading challenges...</div>
              ) : challengeLeaderboards && challengeLeaderboards.length > 0 ? (
                <>
                  <p className="text-gray-500 text-sm mb-4">Click a challenge to see its leaderboard:</p>
                  <div className="space-y-3">
                    {challengeLeaderboards.map((item: any) => (
                      <div key={item.challenge.id}>
                        <button
                          onClick={() => setExpandedChallenge(expandedChallenge === item.challenge.id ? null : item.challenge.id)}
                          className="w-full bg-purple-50 border border-purple-200 rounded-lg p-4 hover:bg-purple-100 transition-colors"
                          data-testid={`challenge-${item.challenge.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="text-2xl">{item.challenge.icon || '🏆'}</div>
                              <div className="text-left">
                                <div className="font-semibold text-gray-900">{item.challenge.title}</div>
                                <div className="text-sm text-gray-600">
                                  {item.challenge.options?.length || 0} questions • {item.challenge.points_reward} points
                                </div>
                              </div>
                            </div>
                            <div className="text-sm text-purple-600 font-medium">
                              {item.topScorers.length > 0 ? `${item.topScorers.length} player${item.topScorers.length !== 1 ? 's' : ''}` : 'No scores yet'}
                            </div>
                          </div>
                        </button>
                        
                        {expandedChallenge === item.challenge.id && item.topScorers.length > 0 && (
                          <div className="mt-2 bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                            {item.topScorers.map((scorer: any, index: number) => (
                              <div key={scorer.user_id} className="p-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 flex items-center justify-center">
                                    {index === 0 ? <Trophy className="text-yellow-500" size={20} /> :
                                     index === 1 ? <Medal className="text-gray-400" size={20} /> :
                                     index === 2 ? <Award className="text-orange-600" size={20} /> :
                                     <span className="text-gray-500 font-semibold text-sm">{index + 1}</span>}
                                  </div>
                                  <div className="font-medium text-gray-900">{scorer.users?.user_name || 'Anonymous'}</div>
                                </div>
                                <div className="font-semibold text-purple-600">{scorer.points_earned} pts</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center text-sm text-gray-500 py-8">
                  No challenges available yet. Check back soon!
                </div>
              )}
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

          {/* Trivia Challenges Section - only show within trivia_leader */}
          {selectedCategory === 'trivia_leader' && challengeLeaderboards && challengeLeaderboards.length > 0 && (
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Individual Trivia Challenges</h3>
              <p className="text-gray-600 text-sm mb-4">Click a challenge to see its leaderboard:</p>
              <div className="space-y-3">
                {challengeLeaderboards.map((item: any) => (
                  <div key={item.challenge.id}>
                    <button
                      onClick={() => setExpandedChallenge(expandedChallenge === item.challenge.id ? null : item.challenge.id)}
                      className="w-full bg-white border border-gray-200 rounded-lg p-4 hover:bg-purple-50 hover:border-purple-300 transition-colors"
                      data-testid={`challenge-${item.challenge.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">{item.challenge.icon || '🧠'}</div>
                          <div className="text-left">
                            <div className="font-semibold text-gray-900">{item.challenge.title}</div>
                            <div className="text-sm text-gray-600">
                              {item.challenge.options?.length || 0} questions • {item.challenge.points_reward} points
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-sm text-purple-600 font-medium">
                            {item.topScorers.length > 0 ? `${item.topScorers.length} player${item.topScorers.length !== 1 ? 's' : ''}` : 'No scores yet'}
                          </div>
                          {item.topScorers.length > 0 && (
                            <ChevronDown 
                              className={`w-5 h-5 text-gray-400 transition-transform ${expandedChallenge === item.challenge.id ? 'rotate-180' : ''}`}
                            />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Expanded Challenge Leaderboard */}
                    {expandedChallenge === item.challenge.id && item.topScorers.length > 0 && (
                      <div className="mt-2 bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-3">Top Scores</h4>
                        <div className="space-y-2">
                          {item.topScorers.map((scorer: any, idx: number) => (
                            <div key={scorer.user_id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 flex items-center justify-center">
                                  {getRankIcon(idx + 1)}
                                </div>
                                <span className="font-medium text-gray-900">{scorer.user_name}</span>
                              </div>
                              <span className="text-green-600 font-semibold">{scorer.user_points} pts</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>


      <ConsumptionTracker 
        isOpen={isTrackModalOpen} 
        onClose={() => setIsTrackModalOpen(false)} 
      />

      <FeedbackFooter />

    </div>
  );
}
