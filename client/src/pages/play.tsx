
import { useState, useMemo } from "react";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import FeedbackFooter from "@/components/feedback-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Play, Trophy, Brain, Gamepad2, Vote, Star, Users, Clock, UserPlus, Film, Tv, Music, Book, Dumbbell } from "lucide-react";
import { Link, useLocation } from "wouter";
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
  const [, setLocation] = useLocation();
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
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

        {/* Game Points Callout */}
        {totalGamePoints > 0 && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4 mb-6 text-center">
            <div className="text-sm text-gray-700">
              🎮 You've earned <span className="font-bold text-purple-700">{totalGamePoints} points</span> from games
            </div>
          </div>
        )}

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
              onClick={() => setLocation('/play/trivia')}
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
              onClick={() => setLocation('/play/polls')}
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
              onClick={() => setLocation('/play/predictions')}
              className="bg-white text-green-700 font-medium px-6 py-3 rounded-full hover:bg-green-50 transition-colors shadow-sm w-full"
              data-testid="explore-predictions"
            >
              Explore Predictions
            </button>
          </div>
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

      <FeedbackFooter />

    </div>
  );
}
