
import { useState, useMemo } from "react";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Trophy, Brain, Gamepad2, Vote, Star, Users, Clock, UserPlus, Film, Tv, Music, Book, Dumbbell, Target, CheckSquare, HelpCircle, Medal, Award, Globe, TrendingUp, BookOpen, Headphones, Share2, ChevronDown, ChevronUp, Flame, Edit3, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

export default function PlayPage({ initialTab }: { initialTab?: 'all' | 'polls' | 'predictions' | 'trivia' | 'hot_takes' }) {
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
  const [topTab, setTopTab] = useState<'play' | 'leaderboard'>('play');
  const [activeFilter, setActiveFilter] = useState<'all' | 'polls' | 'predictions' | 'trivia' | 'hot_takes'>(initialTab || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});

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
    return allGames.filter((game: any) => game.type === 'trivia').slice(0, 5);
  }, [allGames]);

  // Get polls for carousel
  const pollGames = useMemo(() => {
    return allGames.filter((game: any) => game.type === 'vote').slice(0, 5);
  }, [allGames]);

  // Get predictions for carousel
  const predictionGames = useMemo(() => {
    return allGames.filter((game: any) => game.type === 'predict').slice(0, 5);
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
    <div className="min-h-screen bg-white pb-20">
      <Navigation onTrackConsumption={handleTrackConsumption} />
      
      {/* Hero Section with Purple Gradient */}
      <div className="bg-gradient-to-br from-[#0a0a0f] via-[#1a1a2e] to-[#2d1f4e] px-4 pt-4 pb-6 -mt-px">
        <div className="max-w-4xl mx-auto">
          {/* Page Title */}
          <h1 className="text-3xl font-bold text-white mb-2">Play</h1>
          <p className="text-gray-400 text-sm mb-6">Compete, predict, and prove your expertise</p>
          
          {/* Daily Challenge inside hero */}
          <DailyChallengeCard />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-6">
        {/* Create Play Button - Dark gradient pill */}
        <button
          onClick={() => setIsQuickActionOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-[#0a0a0f] via-[#1a1a2e] to-[#7c3aed] hover:opacity-90 rounded-full text-white font-medium transition-all mb-4"
          data-testid="create-play-button"
        >
          <Edit3 size={18} />
          Create Play
        </button>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <Input
            type="text"
            placeholder="Search games..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white border-gray-200 rounded-xl"
            data-testid="games-search-input"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
          {[
            { key: 'all', label: 'All' },
            { key: 'polls', label: 'Polls' },
            { key: 'predictions', label: 'Predictions' },
            { key: 'trivia', label: 'Trivia' },
            { key: 'hot_takes', label: 'Hot Takes' },
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key as any)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                activeFilter === filter.key
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              data-testid={`filter-${filter.key}`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Games Content */}
        <div className="space-y-4 pb-6">
          {/* Polls Section */}
          {(activeFilter === 'all' || activeFilter === 'polls') && pollGames.filter((g: any) => 
            !searchQuery || g.title?.toLowerCase().includes(searchQuery.toLowerCase())
          ).length > 0 && (
            <div>
              {activeFilter === 'all' && (
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-900">Polls</h2>
                  <button 
                    onClick={() => setActiveFilter('polls')}
                    className="text-sm text-purple-600 font-medium"
                  >
                    See all →
                  </button>
                </div>
              )}
              <div className="space-y-3">
                {pollGames
                  .filter((g: any) => !searchQuery || g.title?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .slice(0, activeFilter === 'all' ? 3 : undefined)
                  .map((game: any) => (
                  <Card key={game.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-purple-600 text-white text-[10px] py-0 px-1.5">
                            {game.points || 10} pts
                          </Badge>
                        </div>
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/play?game=${game.id}`;
                            navigator.clipboard.writeText(url);
                            toast({ title: "Link copied!", description: "Share with friends" });
                          }}
                          className="p-1.5 rounded-lg hover:bg-gray-100"
                        >
                          <UserPlus size={14} className="text-gray-500" />
                        </button>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-3">{game.title}</h3>
                      
                      {userPredictionsData.predictions[game.id] ? (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                          <div className="text-green-800 font-medium text-sm">✓ Voted</div>
                          <div className="text-green-700 text-xs">"{userPredictionsData.predictions[game.id]}"</div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-col gap-2 mb-3">
                            {(game.options || []).slice(0, 4).map((option: any, idx: number) => {
                              const optionText = typeof option === 'string' ? option : (option.label || option.text || String(option));
                              return (
                                <button
                                  key={idx}
                                  onClick={() => setSelectedAnswers(prev => ({ ...prev, [game.id]: optionText }))}
                                  className={`w-full px-3 py-2 text-center rounded-full border-2 text-sm font-medium transition-all ${
                                    selectedAnswers[game.id] === optionText
                                      ? 'border-purple-500 bg-purple-600 text-white'
                                      : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300'
                                  }`}
                                >
                                  {optionText}
                                </button>
                              );
                            })}
                          </div>
                          <Button
                            onClick={() => handleSubmitAnswer(game)}
                            disabled={!selectedAnswers[game.id] || submitPrediction.isPending}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-full"
                          >
                            Vote
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Predictions Section */}
          {(activeFilter === 'all' || activeFilter === 'predictions') && predictionGames.filter((g: any) => 
            !searchQuery || g.title?.toLowerCase().includes(searchQuery.toLowerCase())
          ).length > 0 && (
            <div>
              {activeFilter === 'all' && (
                <div className="flex items-center justify-between mb-3 mt-6">
                  <h2 className="text-lg font-semibold text-gray-900">Predictions</h2>
                  <button 
                    onClick={() => setActiveFilter('predictions')}
                    className="text-sm text-purple-600 font-medium"
                  >
                    See all →
                  </button>
                </div>
              )}
              <div className="space-y-3">
                {predictionGames
                  .filter((g: any) => !searchQuery || g.title?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .slice(0, activeFilter === 'all' ? 3 : undefined)
                  .map((game: any) => (
                  <Card key={game.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <Badge className="bg-green-600 text-white text-[10px] py-0 px-1.5">
                          {game.points || 50} pts
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-3">{game.title}</h3>
                      
                      {userPredictionsData.predictions[game.id] ? (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                          <div className="text-green-800 font-medium text-sm">✓ Predicted</div>
                          <div className="text-green-700 text-xs">"{userPredictionsData.predictions[game.id]}"</div>
                        </div>
                      ) : (
                        <Button
                          onClick={() => setSelectedPredictionGame(game)}
                          className="w-full bg-green-600 hover:bg-green-700 text-white rounded-full"
                        >
                          Make Prediction
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Trivia Section */}
          {(activeFilter === 'all' || activeFilter === 'trivia') && triviaGames.filter((g: any) => 
            !searchQuery || g.title?.toLowerCase().includes(searchQuery.toLowerCase())
          ).length > 0 && (
            <div>
              {activeFilter === 'all' && (
                <div className="flex items-center justify-between mb-3 mt-6">
                  <h2 className="text-lg font-semibold text-gray-900">Trivia</h2>
                  <button 
                    onClick={() => setActiveFilter('trivia')}
                    className="text-sm text-purple-600 font-medium"
                  >
                    See all →
                  </button>
                </div>
              )}
              <div className="space-y-3">
                {triviaGames
                  .filter((g: any) => !searchQuery || g.title?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .slice(0, activeFilter === 'all' ? 3 : undefined)
                  .map((game: any) => (
                  <Card key={game.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <Badge className="bg-yellow-500 text-white text-[10px] py-0 px-1.5">
                          {game.points || 15} pts
                        </Badge>
                        <Brain size={18} className="text-yellow-500" />
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-3">{game.title}</h3>
                      
                      <Button
                        onClick={() => setSelectedTriviaGame(game)}
                        className="w-full bg-yellow-500 hover:bg-yellow-600 text-white rounded-full"
                      >
                        Play Trivia
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {activeFilter !== 'all' && activeFilter !== 'hot_takes' && (
            (activeFilter === 'polls' && pollGames.filter((g: any) => !searchQuery || g.title?.toLowerCase().includes(searchQuery.toLowerCase())).length === 0) ||
            (activeFilter === 'predictions' && predictionGames.filter((g: any) => !searchQuery || g.title?.toLowerCase().includes(searchQuery.toLowerCase())).length === 0) ||
            (activeFilter === 'trivia' && triviaGames.filter((g: any) => !searchQuery || g.title?.toLowerCase().includes(searchQuery.toLowerCase())).length === 0)
          ) && (
            <div className="text-center py-12">
              <p className="text-gray-500">No {activeFilter} found{searchQuery ? ` for "${searchQuery}"` : ''}</p>
            </div>
          )}

          {/* Hot Takes Placeholder */}
          {activeFilter === 'hot_takes' && (
            <div className="text-center py-12">
              <Flame size={48} className="mx-auto mb-3 text-orange-400" />
              <p className="text-gray-600 font-medium">Hot Takes coming soon!</p>
              <p className="text-sm text-gray-500">Share your spiciest opinions</p>
            </div>
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

      {/* Quick Action Sheet */}
      <QuickActionSheet
        isOpen={isQuickActionOpen}
        onClose={() => setIsQuickActionOpen(false)}
      />

    </div>
  );
}
