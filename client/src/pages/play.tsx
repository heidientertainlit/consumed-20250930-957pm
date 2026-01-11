
import { useState, useMemo } from "react";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Trophy, Brain, Gamepad2, Vote, Star, Users, Clock, UserPlus, Film, Tv, Music, Book, Dumbbell, Target, CheckSquare, HelpCircle, Medal, Award, Globe, TrendingUp, BookOpen, Headphones, Share2, ChevronDown, ChevronUp, Flame, Edit3 } from "lucide-react";
import { QuickActionSheet } from "@/components/quick-action-sheet";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { copyLink } from "@/lib/share";
import { TriviaGameModal } from "@/components/trivia-game-modal";
import { PredictionGameModal } from "@/components/prediction-game-modal";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { DailyChallengeCard } from "@/components/daily-challenge-card";

// All game data now comes from the database via API


// Fetch prediction pools directly from Supabase database (NO EXPRESS!)
function usePredictionPools() {
  return useQuery({
    queryKey: ['/api/predictions/pools'],
    queryFn: async () => {
      console.log('🎮 Fetching games directly from Supabase database...');
      
      // Get session for authenticated query
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔑 Session for pools query:', session ? 'active' : 'none');
      
      // Query prediction_pools table directly
      const { data: pools, error, count } = await supabase
        .from('prediction_pools')
        .select('*', { count: 'exact' })
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Supabase query error:', error);
        throw new Error('Failed to fetch prediction pools');
      }
      
      console.log('✅ Games loaded directly from Supabase:', pools?.length, 'games, count:', count);
      
      // Log trivia games specifically
      const triviaGames = pools?.filter((p: any) => p.type === 'trivia') || [];
      console.log('🎯 Trivia games found:', triviaGames.length, triviaGames.map((g: any) => g.title));
      
      return pools || [];
    },
    enabled: true
  });
}

// Fetch user's existing predictions with full details
function useUserPredictions() {
  return useQuery({
    queryKey: ['/api/predictions/user-predictions'],
    queryFn: async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { predictions: {}, fullData: [] };
      
      // Get user's predictions with pool details
      const { data, error } = await supabase
        .from('user_predictions')
        .select(`
          pool_id, 
          prediction, 
          points_earned,
          created_at,
          prediction_pools (
            id,
            title,
            type,
            category
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error fetching user predictions:', error);
        return { predictions: {}, fullData: [] };
      }
      
      // Convert to map of pool_id -> prediction for form state
      const predictions: Record<string, string> = {};
      data?.forEach((pred) => {
        predictions[pred.pool_id] = pred.prediction;
      });
      
      return { predictions, fullData: data || [] };
    }
  });
}

// Vote submission mutation - directly to Supabase database (NO EDGE FUNCTIONS!)
function useSubmitPrediction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ poolId, prediction }: { poolId: string; prediction: string }) => {
      console.log('🚀 Saving submission to user_predictions table...');
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Must be logged in to submit predictions');
      }
      
      // Get the game details to know how many points to award
      const { data: game, error: gameError } = await supabase
        .from('prediction_pools')
        .select('points_reward, type')
        .eq('id', poolId)
        .single();
        
      if (gameError || !game) {
        throw new Error('Game not found');
      }
      
      // Determine points to award immediately (only Vote and Trivia get points now)
      const gameType = game.type;
      let immediatePoints = 0;
      
      if (gameType === 'vote' || gameType === 'trivia') {
        // Award points immediately for Vote (10) and Trivia (15)
        immediatePoints = game.points_reward;
      } else if (gameType === 'predict') {
        // Predict games get 0 points until resolution
        immediatePoints = 0;
      }

      // Save the prediction to user_predictions table
      const { data, error } = await supabase
        .from('user_predictions')
        .insert({
          user_id: user.id,
          pool_id: poolId,
          prediction: prediction,
          points_earned: immediatePoints,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) {
        console.error('❌ Error saving prediction:', error);
        throw new Error('Failed to save prediction');
      }
      
      console.log('✅ Prediction saved successfully:', data);
      
      return { 
        success: true, 
        points_earned: immediatePoints,
        pool_id: poolId,
        prediction: prediction,
        game_type: gameType
      };
    },
    onSuccess: () => {
      // Invalidate leaderboard cache to show updated points immediately
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ['/api/predictions/user-predictions'] });
      console.log('🔄 Leaderboard cache invalidated - points will update immediately');
    }
  });
}

// Fetch leaderboard data
function useLeaderboardData() {
  return useQuery({
    queryKey: ['leaderboard', 'all_time'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return null;

      const params = new URLSearchParams({ category: 'all_time' });
      const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-leaderboards?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }

      return await response.json();
    },
    enabled: true
  });
}

interface LeaderboardEntry {
  user_id: string;
  username: string;
  display_name: string;
  score: number;
  rank: number;
  detail?: string;
}

export default function PlayPage() {
  const [, setLocation] = useLocation();
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const { data: predictionPools = [], isLoading } = usePredictionPools();
  const { data: userPredictionsData = { predictions: {}, fullData: [] } } = useUserPredictions();
  const { data: leaderboardData = [] } = useLeaderboardData();
  const submitPrediction = useSubmitPrediction();
  const { toast } = useToast();
  const { session, user } = useAuth();
  
  // Leaderboard state
  const [leaderboardScope, setLeaderboardScope] = useState<'global' | 'friends'>('global');
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'weekly' | 'monthly' | 'all_time'>('weekly');
  const [leaderboardActiveTab, setLeaderboardActiveTab] = useState<string>('engagement');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleExpanded = (categoryName: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  // Leaderboard data query
  const { data: leaderboardFullData, isLoading: isLeaderboardLoading } = useQuery<any>({
    queryKey: ['leaderboard', leaderboardScope, leaderboardPeriod],
    queryFn: async () => {
      if (!session?.access_token) return null;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-leaderboards?category=all&scope=${leaderboardScope}&period=${leaderboardPeriod}`,
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

  const shareRankMutation = useMutation({
    mutationFn: async ({ rank, categoryName }: { rank: number; categoryName: string }) => {
      if (!session?.access_token) throw new Error('Not authenticated');

      const periodLabel = leaderboardPeriod === 'weekly' ? 'this week' : leaderboardPeriod === 'monthly' ? 'this month' : 'all time';
      const shareText = `🏆 I'm #${rank} in ${categoryName} ${periodLabel} on Consumed!`;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inline-post`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: shareText,
            post_type: 'update',
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

  const currentUserId = leaderboardFullData?.currentUserId;
  
  // Get current user
  const [currentUser, setCurrentUser] = useState<any>(null);
  useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      return user;
    }
  });
  
  // Extract predictions map and full data
  const userPredictions = userPredictionsData?.predictions || {};
  const userPredictionsList = userPredictionsData?.fullData || [];
  
  // Merge local selections with database predictions
  const allPredictions = { ...userPredictions, ...selectedOptions };
  
  // Calculate total points from games
  const totalGamePoints = (userPredictionsList || []).reduce((sum: number, pred: any) => {
    return sum + (pred.points_earned || 0);
  }, 0);
  
  // Filter states
  const [gameTypeFilter, setGameTypeFilter] = useState<string>('predict');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>('all');

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [selectedTriviaGame, setSelectedTriviaGame] = useState<any>(null);
  const [selectedPredictionGame, setSelectedPredictionGame] = useState<any>(null);

  const handleOptionSelect = (gameId: string, option: string) => {
    setSelectedAnswers(prev => ({ ...prev, [gameId]: option }));
  };

  const handleSubmitAnswer = (game: any) => {
    const selectedOption = selectedAnswers[game.id];
    if (!selectedOption) {
      toast({
        title: "Please select an answer",
        description: "Choose one of the options before submitting.",
        variant: "destructive"
      });
      return;
    }

    submitPrediction.mutate(
      { poolId: game.id, prediction: selectedOption },
      {
        onSuccess: (data: any) => {
          setSelectedOptions(prev => ({ ...prev, [game.id]: selectedOption }));
          
          let title = '';
          let description = '';
          
          if (game.type === 'vote') {
            title = 'Vote Submitted!';
            description = `You selected "${selectedOption}" and earned ${data.points_earned} points!`;
          } else if (game.type === 'trivia') {
            title = 'Answer Submitted!';
            description = `You selected "${selectedOption}" and earned ${data.points_earned} points!`;
          } else if (game.type === 'predict') {
            title = 'Prediction Submitted!';
            description = `You predicted "${selectedOption}" - points will be awarded when the result is known!`;
          }
          
          toast({
            title,
            description,
          });
        },
        onError: () => {
          toast({
            title: "Submission Failed",
            description: "Could not submit your answer. Please try again.",
            variant: "destructive"
          });
        }
      }
    );
  };

  const handleInviteFriends = async (item: any) => {
    try {
      const { copyLink } = await import('@/lib/share');
      await copyLink({ kind: 'prediction', id: item.id });
      
      toast({
        title: "Invite Link Copied!",
        description: "Share this with your friends to invite them to play",
      });
    } catch (error) {
      console.error('Error inviting friends:', error);
      toast({
        title: "Invite Failed",
        description: "Unable to create invite link",
        variant: "destructive"
      });
    }
  };

  // Use only real games from the database API - shuffle ONLY once when data loads
  const allGames = useMemo(() => {
    return (predictionPools || [])
      .filter((pool: any) => {
        if (pool.status !== 'open' || !pool.options) return false;
        
        // Multi-question trivia games have array of question objects
        const isMultiQuestionTrivia = pool.type === 'trivia' && 
          Array.isArray(pool.options) && 
          pool.options.length > 0 && 
          typeof pool.options[0] === 'object' &&
          pool.options[0].question;
        
        // Multi-category prediction games have array of category objects
        const isMultiCategoryPrediction = pool.type === 'predict' && 
          Array.isArray(pool.options) && 
          pool.options.length > 0 && 
          typeof pool.options[0] === 'object' &&
          pool.options[0].category;
        
        // Quick games have exactly 2 string options
        const isQuickGame = Array.isArray(pool.options) && 
          pool.options.length === 2 && 
          typeof pool.options[0] === 'string';
        
        return isMultiQuestionTrivia || isMultiCategoryPrediction || isQuickGame;
      })
      .map((pool: any) => {
        // Determine if this is a long-form trivia game
        const isLongFormTrivia = pool.type === 'trivia' && 
          Array.isArray(pool.options) && 
          pool.options.length > 0 && 
          typeof pool.options[0] === 'object';
        
        // Determine if this is a multi-category prediction game
        const isMultiCategoryPrediction = pool.type === 'predict' && 
          Array.isArray(pool.options) && 
          pool.options.length > 0 && 
          typeof pool.options[0] === 'object' &&
          pool.options[0].category && 
          pool.options[0].nominees;
        
        return {
          id: pool.id,
          type: pool.type,
          title: pool.title,
          description: pool.description,
          points: pool.points_reward || pool.pointsReward,
          participants: pool.participants,
          deadline: pool.deadline,
          icon: pool.icon,
          mediaType: pool.category,
          options: pool.options,
          isLongForm: isLongFormTrivia,
          isMultiCategory: isMultiCategoryPrediction
        };
      })
      .sort(() => Math.random() - 0.5); // Randomize order ONLY once
  }, [predictionPools]);

  // All available media types (including those without content yet)
  const allMediaTypes = ['Movies', 'TV', 'Music', 'Books', 'Sports', 'Gaming', 'Podcasts'];

  // Filter games based on selected filters and sort by completion status
  const filteredGames = useMemo(() => {
    const filtered = allGames.filter((game: any) => {
      // Challenges tab - show only long-form trivia games
      if (gameTypeFilter === 'challenges') {
        if (!game.isLongForm) return false;
      }
      // Game type filter (for non-challenge tabs)
      else if (gameTypeFilter !== 'all' && game.type !== gameTypeFilter) {
        return false;
      }
      
      // Media type filter
      if (mediaTypeFilter !== 'all' && game.mediaType !== mediaTypeFilter) {
        return false;
      }
      
      return true;
    });
    
    // Sort: uncompleted games first, completed games at bottom
    return filtered.sort((a: any, b: any) => {
      const aCompleted = !!allPredictions[a.id];
      const bCompleted = !!allPredictions[b.id];
      
      // If a is completed and b is not, b comes first
      if (aCompleted && !bCompleted) return 1;
      // If b is completed and a is not, a comes first
      if (!aCompleted && bCompleted) return -1;
      // If both same status, maintain original order
      return 0;
    });
  }, [allGames, gameTypeFilter, mediaTypeFilter, allPredictions]);

  // Get user's active predictions for "Predictions in Progress"
  const activePredictions = useMemo(() => {
    return userPredictionsList
      .filter((pred: any) => pred.prediction_pools?.type === 'predict')
      .slice(0, 3);
  }, [userPredictionsList]);

  // Get trivia games for "Trivia Challenges"
  const triviaGames = useMemo(() => {
    return allGames.filter((game: any) => game.type === 'trivia').slice(0, 3);
  }, [allGames]);

  // Extract total consumption leaders array from leaderboard data (API returns object with categories)
  const totalConsumptionLeaders = leaderboardData?.categories?.total_consumption || [];
  const userRank = Array.isArray(totalConsumptionLeaders) 
    ? totalConsumptionLeaders.findIndex((entry: any) => entry.user_id === currentUser?.id) + 1 
    : 0;
  const userEntry = Array.isArray(totalConsumptionLeaders)
    ? totalConsumptionLeaders.find((entry: any) => entry.user_id === currentUser?.id)
    : null;
  const totalPoints = userEntry?.total_points || leaderboardData?.currentUser?.total_points || 0;

  // Leaderboard render functions
  const renderLeaderboardList = (
    entries: LeaderboardEntry[] | undefined,
    categoryName: string,
    emptyMessage: string,
    isExpanded: boolean,
    hideDetails: boolean = false
  ) => {
    if (!entries || entries.length === 0) {
      return (
        <div className="p-8 text-center text-gray-500">
          <p className="text-sm">{emptyMessage}</p>
        </div>
      );
    }

    const displayEntries = isExpanded ? entries.slice(0, 10) : entries.slice(0, 3);
    const hasMore = entries.length > 3;

    return (
      <div>
        <div className="divide-y divide-gray-100">
          {displayEntries.map((entry, index) => {
            const isCurrentUser = entry.user_id === currentUserId;
            const rankColors = ['bg-yellow-400', 'bg-gray-300', 'bg-amber-600'];
            
            return (
              <div
                key={entry.user_id}
                className={`flex items-center gap-4 p-4 ${isCurrentUser ? 'bg-purple-50' : 'hover:bg-gray-50'} transition-colors`}
                data-testid={`leaderboard-entry-${entry.user_id}`}
              >
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                  {index < 3 ? (
                    <div className={`w-8 h-8 rounded-full ${rankColors[index]} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                      {index + 1}
                    </div>
                  ) : (
                    <span className="text-gray-500 font-semibold text-sm">#{index + 1}</span>
                  )}
                </div>

                <Link 
                  href={`/user/${entry.user_id}`}
                  className="flex-1 min-w-0"
                >
                  <p className={`font-semibold text-sm truncate ${isCurrentUser ? 'text-purple-700' : 'text-gray-900'}`}>
                    {entry.display_name || entry.username}
                    {isCurrentUser && <span className="ml-2 text-xs text-purple-600">(You)</span>}
                  </p>
                  <p className="text-xs text-gray-500">@{entry.username}</p>
                </Link>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="font-bold text-lg text-purple-600">{entry.score}</p>
                    {!hideDetails && entry.detail && (
                      <p className="text-xs text-gray-500">{entry.detail}</p>
                    )}
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
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {hasMore && (
          <button
            onClick={() => toggleExpanded(categoryName)}
            className="w-full py-3 flex items-center justify-center gap-1 text-sm text-purple-600 hover:bg-purple-50 transition-colors border-t border-gray-100"
            data-testid={`button-show-more-${categoryName}`}
          >
            {isExpanded ? (
              <>
                Show Less <ChevronUp size={16} />
              </>
            ) : (
              <>
                Show More <ChevronDown size={16} />
              </>
            )}
          </button>
        )}
      </div>
    );
  };

  const renderCategoryCard = (
    title: string,
    Icon: any,
    entries: LeaderboardEntry[] | undefined,
    categoryName: string,
    emptyMessage: string,
    gradient: string = 'from-purple-600 to-blue-600',
    actionLink?: { label: string; href: string },
    hideDetails: boolean = false
  ) => {
    const isExpanded = expandedCategories.has(categoryName);
    
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
        <div className={`bg-gradient-to-r ${gradient} p-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="text-white" size={20} />
              <h3 className="text-base font-bold text-white">{title}</h3>
            </div>
            {actionLink && (
              <Link 
                href={actionLink.href}
                className="text-white/90 hover:text-white text-sm font-medium flex items-center gap-1"
                data-testid={`link-${categoryName.toLowerCase().replace(/\s/g, '-')}-action`}
              >
                {actionLink.label} →
              </Link>
            )}
          </div>
        </div>
        {renderLeaderboardList(entries, categoryName, emptyMessage, isExpanded, hideDetails)}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation onTrackConsumption={handleTrackConsumption} />
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center py-20">
            <div className="text-xl">Loading games...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={handleTrackConsumption} />
      
      {/* Dark Gradient Hero with Pills - matches nav gradient */}
      <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] pb-8 -mt-px px-4 pt-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Play
          </h1>
          <p className="text-gray-400 text-sm mb-6">
            Compete, predict, and earn rewards
          </p>
          
          {/* Pills inside gradient */}
          <div className="flex flex-wrap gap-2">
            <Link href="/play/awards">
              <button
                className="inline-flex items-center px-4 py-2 rounded-full border border-purple-400/50 bg-transparent text-white text-sm font-medium hover:bg-purple-800/30 hover:border-purple-300 transition-all"
                data-testid="browse-predictions"
              >
                Predictions
              </button>
            </Link>
            <Link href="/play/polls">
              <button
                className="inline-flex items-center px-4 py-2 rounded-full border border-purple-400/50 bg-transparent text-white text-sm font-medium hover:bg-purple-800/30 hover:border-purple-300 transition-all"
                data-testid="browse-polls"
              >
                Polls
              </button>
            </Link>
            <Link href="/play/trivia">
              <button
                className="inline-flex items-center px-4 py-2 rounded-full border border-purple-400/50 bg-transparent text-white text-sm font-medium hover:bg-purple-800/30 hover:border-purple-300 transition-all"
                data-testid="browse-trivia"
              >
                Trivia
              </button>
            </Link>
            <Link href="/play/ranks">
              <button
                className="inline-flex items-center px-4 py-2 rounded-full border border-purple-400/50 bg-transparent text-white text-sm font-medium hover:bg-purple-800/30 hover:border-purple-300 transition-all"
                data-testid="browse-ranks"
              >
                Ranks
              </button>
            </Link>
            <Link href="/play/hot-takes">
              <button
                className="inline-flex items-center px-4 py-2 rounded-full border border-purple-400/50 bg-transparent text-white text-sm font-medium hover:bg-purple-800/30 hover:border-purple-300 transition-all"
                data-testid="browse-hot-takes"
              >
                Hot Takes
              </button>
            </Link>
            <Link href="/play/ask-recs">
              <button
                className="inline-flex items-center px-4 py-2 rounded-full border border-purple-400/50 bg-transparent text-white text-sm font-medium hover:bg-purple-800/30 hover:border-purple-300 transition-all"
                data-testid="browse-ask-recs"
              >
                Ask for Recs
              </button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-6">
        {/* Daily Challenge */}
        <div className="mb-6">
          <DailyChallengeCard />
        </div>

        {/* Leaders Section */}
        <div className="mb-6">
          <div className="mb-4 text-center">
            <h2 className="text-xl font-semibold text-black mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Leaders
            </h2>
            <p className="text-sm text-gray-600">
              Most active fans and top contributors
            </p>
          </div>

          <div className="flex justify-center gap-2 mb-4">
            <Button
              size="sm"
              variant={leaderboardScope === 'global' ? 'default' : 'outline'}
              onClick={() => setLeaderboardScope('global')}
              className={leaderboardScope === 'global' ? 'bg-purple-600 hover:bg-purple-700' : ''}
              data-testid="button-scope-global"
            >
              <Globe size={14} className="mr-1" />
              Global
            </Button>
            <Button
              size="sm"
              variant={leaderboardScope === 'friends' ? 'default' : 'outline'}
              onClick={() => setLeaderboardScope('friends')}
              className={leaderboardScope === 'friends' ? 'bg-purple-600 hover:bg-purple-700' : ''}
              data-testid="button-scope-friends"
            >
              <Users size={14} className="mr-1" />
              Friends
            </Button>
          </div>

          <div className="flex justify-center gap-2 mb-6">
            {(['weekly', 'monthly', 'all_time'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setLeaderboardPeriod(p)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  leaderboardPeriod === p 
                    ? 'bg-purple-100 text-purple-700 font-medium' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                data-testid={`button-period-${p}`}
              >
                {p === 'weekly' ? 'This Week' : p === 'monthly' ? 'This Month' : 'All Time'}
              </button>
            ))}
          </div>

          {isLeaderboardLoading ? (
            <div className="space-y-4">
              {[1, 2].map((n) => (
                <div key={n} className="bg-white rounded-2xl p-6 animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                        <div className="flex-1">
                          <div className="h-4 bg-gray-200 rounded w-1/4 mb-1"></div>
                          <div className="h-3 bg-gray-100 rounded w-1/6"></div>
                        </div>
                        <div className="h-6 bg-gray-200 rounded w-12"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Tabs value={leaderboardActiveTab} onValueChange={setLeaderboardActiveTab} className="w-full">
              <TabsList className="w-full mb-4 bg-white border border-gray-200 p-1 h-auto flex flex-wrap justify-center gap-1">
                <TabsTrigger 
                  value="engagement" 
                  className="data-[state=active]:bg-purple-600 data-[state=active]:text-white px-3 py-1.5 text-sm"
                  data-testid="tab-engagement"
                >
                  <TrendingUp size={14} className="mr-1" />
                  Engagers
                </TabsTrigger>
                <TabsTrigger 
                  value="games" 
                  className="data-[state=active]:bg-purple-600 data-[state=active]:text-white px-3 py-1.5 text-sm"
                  data-testid="tab-games"
                >
                  <Target size={14} className="mr-1" />
                  Games
                </TabsTrigger>
                <TabsTrigger 
                  value="consumption" 
                  className="data-[state=active]:bg-purple-600 data-[state=active]:text-white px-3 py-1.5 text-sm"
                  data-testid="tab-consumption"
                >
                  <Star size={14} className="mr-1" />
                  Media
                </TabsTrigger>
              </TabsList>

              <TabsContent value="engagement">
                {renderCategoryCard(
                  'Top Engagers',
                  TrendingUp,
                  leaderboardFullData?.categories?.overall,
                  'Top Engagers',
                  'Start posting and engaging to appear here!',
                  'from-purple-600 to-pink-600'
                )}
              </TabsContent>

              <TabsContent value="games">
                {renderCategoryCard(
                  'Trivia Champions',
                  Brain,
                  leaderboardFullData?.categories?.trivia,
                  'Trivia',
                  'No trivia results yet. Play some trivia!',
                  'from-yellow-500 to-orange-500',
                  { label: 'Play Trivia', href: '/play/trivia' },
                  true
                )}
                
                {renderCategoryCard(
                  'Poll Masters',
                  Target,
                  leaderboardFullData?.categories?.polls,
                  'Polls',
                  'No poll activity yet. Vote on some polls!',
                  'from-blue-500 to-cyan-500',
                  { label: 'Do Polls', href: '/play/polls' },
                  true
                )}
                
                {renderCategoryCard(
                  'Prediction Pros',
                  Trophy,
                  leaderboardFullData?.categories?.predictions,
                  'Predictions',
                  'No predictions resolved yet. Make some predictions!',
                  'from-green-500 to-emerald-500',
                  { label: 'Do Predictions', href: '/play/awards' },
                  true
                )}
              </TabsContent>

              <TabsContent value="consumption">
                <div className="mb-4">
                  {renderCategoryCard(
                    'Total Consumption Leaders',
                    Star,
                    leaderboardFullData?.categories?.total_consumption,
                    'Total Consumption',
                    'Track some media to appear here!',
                    'from-purple-600 to-blue-600'
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>

      </div>

      <ConsumptionTracker 
        isOpen={isTrackModalOpen} 
        onClose={() => setIsTrackModalOpen(false)} 
      />

      {/* Trivia Game Modal */}
      {selectedTriviaGame && (
        <TriviaGameModal
          poolId={selectedTriviaGame.id}
          title={selectedTriviaGame.title}
          questions={selectedTriviaGame.options}
          pointsReward={selectedTriviaGame.points}
          isOpen={!!selectedTriviaGame}
          onClose={() => {
            setSelectedTriviaGame(null);
          }}
        />
      )}

      {/* Prediction Game Modal */}
      {selectedPredictionGame && (
        <PredictionGameModal
          poolId={selectedPredictionGame.id}
          title={selectedPredictionGame.title}
          categories={selectedPredictionGame.options}
          pointsReward={selectedPredictionGame.points}
          isOpen={!!selectedPredictionGame}
          onClose={() => {
            setSelectedPredictionGame(null);
          }}
        />
      )}

      {/* Floating Action Button for Creating */}
      <button
        onClick={() => setIsQuickActionOpen(true)}
        className="fixed bottom-24 right-4 z-50 w-14 h-14 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105"
        data-testid="fab-create"
      >
        <Edit3 size={24} />
      </button>

      {/* Quick Action Sheet */}
      <QuickActionSheet
        isOpen={isQuickActionOpen}
        onClose={() => setIsQuickActionOpen(false)}
      />

    </div>
  );
}
