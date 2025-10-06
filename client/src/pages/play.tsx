
import { useState, useMemo } from "react";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Play, Trophy, Brain, Gamepad2, Vote, Star, Users, Clock, UserPlus, Film, Tv, Music, Book, Dumbbell } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { copyLink } from "@/lib/share";
import { TriviaGameModal } from "@/components/trivia-game-modal";
import { PredictionGameModal } from "@/components/prediction-game-modal";

// All game data now comes from the database via API


// Fetch prediction pools directly from Supabase database (NO EXPRESS!)
function usePredictionPools() {
  return useQuery({
    queryKey: ['/api/predictions/pools'],
    queryFn: async () => {
      console.log('🎮 Fetching games directly from Supabase database...');
      
      // Import Supabase client
      const { createClient } = await import('@supabase/supabase-js');
      
      const supabaseUrl = 'https://mahpgcogwpawvviapqza.supabase.co';
      const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1haHBnY29nd3Bhd3Z2aWFwcXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxNTczOTMsImV4cCI6MjA2MTczMzM5M30.cv34J_2INF3_GExWw9zN1Vaa-AOFWI2Py02h0vAlW4c';
      
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      
      // Query prediction_pools table directly
      const { data: pools, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('❌ Supabase query error:', error);
        throw new Error('Failed to fetch prediction pools');
      }
      
      console.log('✅ Games loaded directly from Supabase:', pools);
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
      const { createClient } = await import('@supabase/supabase-js');
      
      const supabaseUrl = 'https://mahpgcogwpawvviapqza.supabase.co';
      const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1haHBnY29nd3Bhd3Z2aWFwcXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxNTczOTMsImV4cCI6MjA2MTczMzM5M30.cv34J_2INF3_GExWw9zN1Vaa-AOFWI2Py02h0vAlW4c';
      
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      
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
      
      // Import Supabase client
      const { createClient } = await import('@supabase/supabase-js');
      
      const supabaseUrl = 'https://mahpgcogwpawvviapqza.supabase.co';
      const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1haHBnY29nd3Bhd3Z2aWFwcXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxNTczOTMsImV4cCI6MjA2MTczMzM5M30.cv34J_2INF3_GExWw9zN1Vaa-AOFWI2Py02h0vAlW4c';
      
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      
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

export default function PlayPage() {
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [showHighStakesRules, setShowHighStakesRules] = useState(false);
  const [agreedToRules, setAgreedToRules] = useState(false);
  const { data: predictionPools = [], isLoading } = usePredictionPools();
  const { data: userPredictionsData = { predictions: {}, fullData: [] } } = useUserPredictions();
  const submitPrediction = useSubmitPrediction();
  const { toast } = useToast();
  
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
  const [gameTypeFilter, setGameTypeFilter] = useState<string>('all');
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
        const isMultiCategoryPrediction = pool.type === 'prediction' && 
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
        const isMultiCategoryPrediction = pool.type === 'prediction' && 
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
      
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-black mb-3">
            Play
          </h1>
          <p className="text-gray-600">
            Test your knowledge, make predictions, and compete with friends — free or high stakes.
          </p>
        </div>

        {/* LOW STAKES - Pastel Cards */}
        <div className="space-y-4 mb-8">
          {/* Trivia Challenges Card */}
          <div className="bg-gradient-to-br from-purple-100 to-purple-50 rounded-2xl p-6 border border-purple-200">
            <div className="flex items-center space-x-2 mb-3">
              <Brain className="text-purple-700" size={24} />
              <h3 className="text-xl font-semibold text-purple-900">Trivia Challenges</h3>
            </div>
            <p className="text-purple-700 text-sm mb-4">
              Test your knowledge against friends on different entertainment topics
            </p>
            <button
              onClick={() => setGameTypeFilter('trivia')}
              className="bg-white text-purple-700 font-medium px-6 py-3 rounded-full hover:bg-purple-50 transition-colors shadow-sm w-full"
              data-testid="explore-trivia"
            >
              Explore Trivia Challenges
            </button>
          </div>

          {/* Polls Card */}
          <div className="bg-gradient-to-br from-blue-100 to-blue-50 rounded-2xl p-6 border border-blue-200">
            <div className="flex items-center space-x-2 mb-3">
              <Vote className="text-blue-700" size={24} />
              <h3 className="text-xl font-semibold text-blue-900">Polls</h3>
            </div>
            <p className="text-blue-700 text-sm mb-4">
              Vote on trending topics and see how your opinions compare to others
            </p>
            <button
              onClick={() => setGameTypeFilter('vote')}
              className="bg-white text-blue-700 font-medium px-6 py-3 rounded-full hover:bg-blue-50 transition-colors shadow-sm w-full"
              data-testid="explore-polls"
            >
              Explore Polls
            </button>
          </div>

          {/* Predictions Card */}
          <div className="bg-gradient-to-br from-green-100 to-green-50 rounded-2xl p-6 border border-green-200">
            <div className="flex items-center space-x-2 mb-3">
              <Trophy className="text-green-700" size={24} />
              <h3 className="text-xl font-semibold text-green-900">Predictions</h3>
            </div>
            <p className="text-green-700 text-sm mb-4">
              Make predictions about upcoming releases and entertainment events
            </p>
            <button
              onClick={() => setGameTypeFilter('predict')}
              className="bg-white text-green-700 font-medium px-6 py-3 rounded-full hover:bg-green-50 transition-colors shadow-sm w-full"
              data-testid="explore-predictions"
            >
              Explore Predictions
            </button>
          </div>
        </div>

        {/* HIGH STAKES Section */}
        <div className="mb-8">
          <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 rounded-2xl p-6 border-2 border-amber-300">
            <div className="flex items-center space-x-2 mb-3">
              <Trophy className="text-amber-700" size={24} />
              <h3 className="text-xl font-semibold text-amber-900">Premium Challenges</h3>
              <Badge className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white text-xs font-bold border-0">
                ⭐ HIGH STAKES
              </Badge>
              <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs font-medium border border-red-300">
                18+
              </Badge>
            </div>
            <p className="text-amber-800 text-sm mb-4">
              Compete for real prizes from our sponsors. Double your points or win exclusive rewards!
            </p>
            <button
              onClick={() => setShowHighStakesRules(true)}
              className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-medium px-6 py-3 rounded-full transition-all shadow-sm w-full"
              data-testid="enter-high-stakes"
            >
              View High Stakes Games
            </button>
          </div>
        </div>

        {/* Original Games Feed Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-semibold text-black mb-3">
            All Games
          </h2>
          <p className="text-gray-600">
            Browse and filter all available games
          </p>
        </div>

        {/* Game Points Callout */}
        {totalGamePoints > 0 && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4 mb-6 text-center">
            <div className="text-sm text-gray-700">
              🎮 You've earned <span className="font-bold text-purple-700">{totalGamePoints} points</span> from games
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="flex items-center justify-between border-b border-gray-200">
            <div className="flex overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setGameTypeFilter('all')}
                className={`px-6 py-4 font-medium text-sm transition-colors relative whitespace-nowrap ${
                  gameTypeFilter === 'all'
                    ? 'text-gray-900 border-b-2 border-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                data-testid="tab-all"
              >
                All
              </button>
              <button
                onClick={() => setGameTypeFilter('vote')}
                className={`px-6 py-4 font-medium text-sm transition-colors relative flex items-center gap-2 whitespace-nowrap ${
                  gameTypeFilter === 'vote'
                    ? 'text-green-600 border-b-2 border-green-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                data-testid="tab-vote"
              >
                <Vote size={16} />
                Vote
              </button>
              <button
                onClick={() => setGameTypeFilter('trivia')}
                className={`px-6 py-4 font-medium text-sm transition-colors relative flex items-center gap-2 whitespace-nowrap ${
                  gameTypeFilter === 'trivia'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                data-testid="tab-trivia"
              >
                <Brain size={16} />
                Trivia
              </button>
              <button
                onClick={() => setGameTypeFilter('predict')}
                className={`px-6 py-4 font-medium text-sm transition-colors relative flex items-center gap-2 whitespace-nowrap ${
                  gameTypeFilter === 'predict'
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                data-testid="tab-predict"
              >
                <Trophy size={16} />
                Predict
              </button>
              <button
                onClick={() => setGameTypeFilter('challenges')}
                className={`px-6 py-4 font-medium text-sm transition-colors relative flex items-center gap-2 whitespace-nowrap ${
                  gameTypeFilter === 'challenges'
                    ? 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                data-testid="tab-challenges"
              >
                <Gamepad2 size={16} />
                Challenges
              </button>
            </div>

            {/* Media Type Dropdown */}
            <div className="px-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-300"
                    data-testid="dropdown-media-type"
                  >
                    {mediaTypeFilter === 'all' ? 'All Media' : mediaTypeFilter}
                    <span className="ml-2 text-xs">▾</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem 
                    onClick={() => setMediaTypeFilter('all')}
                    className={mediaTypeFilter === 'all' ? 'bg-gray-100 font-medium' : ''}
                  >
                    All Media
                  </DropdownMenuItem>
                  {allMediaTypes.map((type) => (
                    <DropdownMenuItem 
                      key={type}
                      onClick={() => setMediaTypeFilter(type)}
                      className={mediaTypeFilter === type ? 'bg-gray-100 font-medium' : ''}
                    >
                      {type}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Featured: 98th Academy Awards Prediction Pool - Only show on "All" and "Predict" tabs */}
        {(gameTypeFilter === 'all' || gameTypeFilter === 'predict') && (
        <div className="mb-6">
          <div className="bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 border-2 border-yellow-300 rounded-xl p-4 shadow-sm opacity-75">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🏆</div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-yellow-500 text-white hover:bg-yellow-500 text-xs font-bold border-0">
                    FEATURED
                  </Badge>
                  <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 text-xs font-medium">
                    <Trophy size={10} className="mr-1" />
                    PREDICT
                  </Badge>
                  <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 text-xs font-bold border border-yellow-400">
                    🎬 Coming Soon
                  </Badge>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  98th Academy Awards Prediction Pool
                </h2>
                <p className="text-sm text-gray-700">
                  Join the biggest Oscar prediction pool in history! Predict winners across all major categories.
                </p>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Games Feed */}
        <div className="space-y-6">
          {filteredGames.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <Gamepad2 className="mx-auto mb-4 text-gray-400" size={48} />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No games found</h3>
              <p className="text-gray-600">Try adjusting your filters to see more games</p>
            </div>
          ) : (
            filteredGames.map((game: any) => (
            <Card key={game.id} className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="text-2xl">{game.icon}</div>
                    {game.type === 'trivia' ? (
                      <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-xs font-medium uppercase">
                        {game.isLongForm ? 'Trivia' : 'Quick Trivia'}
                      </Badge>
                    ) : game.type === 'vote' ? (
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs font-medium uppercase">
                        Vote
                      </Badge>
                    ) : (
                      <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-xs font-medium uppercase">
                        Predict
                      </Badge>
                    )}
                  </div>
                  {/* Invite to Play button - upper right */}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleInviteFriends(game)}
                    className="px-3 py-1.5 text-xs bg-black text-white hover:bg-gray-800 border-0 rounded-lg"
                    data-testid={`invite-${game.id}`}
                  >
                    <UserPlus size={14} className="mr-1" />
                    Invite to Play
                  </Button>
                </div>

                <CardTitle className="text-xl font-bold text-gray-900 mb-2 mt-2">{game.title}</CardTitle>
                <p className="text-gray-600 text-sm mb-4">{game.description}</p>

                {/* Stats Row */}
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <Star size={14} className="text-purple-600" />
                    <span className="font-medium text-purple-600">{game.points || 10} pts</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Users size={14} />
                    <span>{game.participants || 0}</span>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Show if already submitted */}
                {allPredictions[game.id] ? (
                  (() => {
                    // For long-form trivia, check if all questions were answered
                    if (game.isLongForm) {
                      try {
                        const answers = JSON.parse(allPredictions[game.id]);
                        const isComplete = Array.isArray(answers) && answers.length === game.options.length;
                        
                        if (isComplete) {
                          return (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                              <div className="text-green-800 font-medium">✓ Submitted</div>
                              <div className="text-green-700 text-sm">Game completed!</div>
                            </div>
                          );
                        } else {
                          return (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                              <div className="text-yellow-800 font-medium">⏸ In Progress</div>
                              <div className="text-yellow-700 text-sm">
                                {answers.length}/{game.options.length} questions answered
                              </div>
                            </div>
                          );
                        }
                      } catch (e) {
                        // Fallback if parsing fails
                        return (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                            <div className="text-green-800 font-medium">✓ Submitted</div>
                            <div className="text-green-700 text-sm">Game completed!</div>
                          </div>
                        );
                      }
                    }
                    
                    // For multi-category predictions, check if all categories have predictions
                    if (game.isMultiCategory) {
                      try {
                        const predictions = JSON.parse(allPredictions[game.id]);
                        const isComplete = Array.isArray(predictions) && predictions.length === game.options.length;
                        
                        if (isComplete) {
                          return (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                              <div className="text-green-800 font-medium">✓ Predictions Submitted</div>
                              <div className="text-green-700 text-sm">{game.options.length} categories predicted!</div>
                            </div>
                          );
                        } else {
                          return (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                              <div className="text-yellow-800 font-medium">⏸ In Progress</div>
                              <div className="text-yellow-700 text-sm">
                                {predictions.length}/{game.options.length} categories predicted
                              </div>
                            </div>
                          );
                        }
                      } catch (e) {
                        // Fallback if parsing fails
                        return (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                            <div className="text-green-800 font-medium">✓ Predictions Submitted</div>
                            <div className="text-green-700 text-sm">Completed!</div>
                          </div>
                        );
                      }
                    }
                    
                    // For quick games
                    return (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                        <div className="text-green-800 font-medium">✓ Submitted</div>
                        <div className="text-green-700 text-sm">
                          You selected "{allPredictions[game.id]}"
                        </div>
                      </div>
                    );
                  })()
                ) : game.isLongForm ? (
                  // Long-form trivia game - show "Play Game" button
                  <Button 
                    onClick={() => setSelectedTriviaGame(game)}
                    className="w-full bg-gray-500 hover:bg-gray-600 text-white rounded-xl py-6"
                    data-testid={`play-${game.id}`}
                  >
                    <Brain size={16} className="mr-2" />
                    Play Trivia Game
                  </Button>
                ) : game.isMultiCategory ? (
                  // Multi-category prediction game - show "Make Predictions" button
                  <Button 
                    onClick={() => setSelectedPredictionGame(game)}
                    className="w-full bg-gray-500 hover:bg-gray-600 text-white rounded-xl py-6"
                    data-testid={`play-${game.id}`}
                  >
                    <Trophy size={16} className="mr-2" />
                    Make Predictions
                  </Button>
                ) : (
                  // Quick game - show inline options
                  <>
                    <div className="text-gray-600 text-sm font-medium">
                      {game.type === 'vote' ? 'Quick Vote:' : game.type === 'predict' ? 'Quick Predict:' : 'Quick Answer:'}
                    </div>

                    {/* Two Option Boxes */}
                    <div className="grid grid-cols-2 gap-3">
                      {(game.options || []).slice(0, 2).map((option: string, index: number) => (
                        <button
                          key={option}
                          onClick={() => handleOptionSelect(game.id, option)}
                          className={`p-4 text-left rounded-lg border-2 transition-all ${
                            selectedAnswers[game.id] === option
                              ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                          data-testid={`option-${game.id}-${index}`}
                        >
                          <div className="text-sm font-medium text-gray-900">{option}</div>
                        </button>
                      ))}
                    </div>

                    {/* Submit Button */}
                    <Button 
                      onClick={() => handleSubmitAnswer(game)}
                      disabled={!selectedAnswers[game.id] || submitPrediction.isPending}
                      className="w-full bg-gray-500 hover:bg-gray-600 text-white disabled:opacity-50 rounded-xl py-6"
                      data-testid={`submit-${game.id}`}
                    >
                      {submitPrediction.isPending ? 'Submitting...' : 'Submit'}
                    </Button>
                  </>
                )}

              </CardContent>
            </Card>
          ))
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

      {/* High Stakes Rules Modal */}
      <Dialog open={showHighStakesRules} onOpenChange={setShowHighStakesRules}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-amber-900 flex items-center space-x-2">
              <Trophy className="text-amber-600" size={28} />
              <span>High Stakes Rules of Play</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-900 font-medium mb-2">
                By entering a High Stakes game, you confirm that:
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5">
                  1
                </div>
                <p className="text-sm text-gray-700 flex-1">
                  You are <span className="font-semibold">18 years or older</span>.
                </p>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5">
                  2
                </div>
                <p className="text-sm text-gray-700 flex-1">
                  You understand that this game is <span className="font-semibold">skill-based, not chance-based</span>.
                </p>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5">
                  3
                </div>
                <p className="text-sm text-gray-700 flex-1">
                  Points have <span className="font-semibold">no cash value</span> and <span className="font-semibold">cannot be exchanged or refunded</span>.
                </p>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5">
                  4
                </div>
                <p className="text-sm text-gray-700 flex-1">
                  Any prizes are <span className="font-semibold">sponsor-provided and promotional only</span> — not cash payouts.
                </p>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5">
                  5
                </div>
                <p className="text-sm text-gray-700 flex-1">
                  <span className="font-semibold">No purchase is required</span> to participate; points can be earned in-app.
                </p>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5">
                  6
                </div>
                <p className="text-sm text-gray-700 flex-1">
                  You agree to Consumed's full <span className="font-semibold text-purple-600 cursor-pointer hover:underline">Terms of Service</span> and <span className="font-semibold text-purple-600 cursor-pointer hover:underline">Privacy Policy</span>.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-amber-50 border border-amber-200 rounded-lg mt-6">
              <Checkbox
                id="agree-rules"
                checked={agreedToRules}
                onCheckedChange={(checked) => setAgreedToRules(checked as boolean)}
                className="border-amber-500 data-[state=checked]:bg-amber-600"
              />
              <label
                htmlFor="agree-rules"
                className="text-sm font-medium text-gray-900 cursor-pointer flex-1"
              >
                I have read and agree to the High Stakes Rules of Play
              </label>
            </div>

            <div className="flex space-x-3 pt-4">
              <Button
                onClick={() => {
                  setShowHighStakesRules(false);
                  setAgreedToRules(false);
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (agreedToRules) {
                    setShowHighStakesRules(false);
                    toast({
                      title: "Welcome to High Stakes!",
                      description: "Browse available games and select one to enter.",
                    });
                  } else {
                    toast({
                      title: "Agreement Required",
                      description: "Please agree to the rules to continue.",
                      variant: "destructive"
                    });
                  }
                }}
                disabled={!agreedToRules}
                className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-bold disabled:opacity-50"
              >
                I Agree & Continue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
