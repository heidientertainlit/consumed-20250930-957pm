
import { useState, useMemo } from "react";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import FeedbackFooter from "@/components/feedback-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Play, Trophy, Brain, Gamepad2, Vote, Star, Users, Clock, UserPlus, Film, Tv, Music, Book, Dumbbell, Target, CheckSquare, HelpCircle, Medal, Award } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { copyLink } from "@/lib/share";
import { TriviaGameModal } from "@/components/trivia-game-modal";
import { PredictionGameModal } from "@/components/prediction-game-modal";
import { supabase } from "@/lib/supabase";

// All game data now comes from the database via API


// Fetch prediction pools directly from Supabase database (NO EXPRESS!)
function usePredictionPools() {
  return useQuery({
    queryKey: ['/api/predictions/pools'],
    queryFn: async () => {
      console.log('🎮 Fetching games directly from Supabase database...');
      
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

export default function PlayPage() {
  const [, setLocation] = useLocation();
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const { data: predictionPools = [], isLoading } = usePredictionPools();
  const { data: userPredictionsData = { predictions: {}, fullData: [] } } = useUserPredictions();
  const { data: leaderboardData = [] } = useLeaderboardData();
  const submitPrediction = useSubmitPrediction();
  const { toast } = useToast();
  
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
  const [gameTypeFilter, setGameTypeFilter] = useState<string>('prediction');
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
        <div className="text-center mb-4">
          <h1 className="text-3xl font-semibold text-black mb-3">
            Play
          </h1>
          <p className="text-gray-600">
            Test your knowledge, make predictions, and compete with friends
          </p>
        </div>

        {/* Points Card with Rank - Compact */}
        {(() => {
          const userRank = leaderboardData.findIndex((entry: any) => entry.user_id === currentUser?.id) + 1;
          const userEntry = leaderboardData.find((entry: any) => entry.user_id === currentUser?.id);
          const totalPoints = userEntry?.total_points || 0;
          
          return (
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5 text-center">
              <Award className="w-6 h-6 text-purple-600 mx-auto mb-1" />
              <div className="text-2xl font-bold text-purple-700 mb-0.5">{totalPoints}</div>
              <div className="text-xs text-gray-500 mb-1">Points Earned</div>
              {userRank > 0 && (
                <div className="text-xs text-gray-400">
                  You're ranked <span className="font-semibold text-purple-600">#{userRank}</span> out of {leaderboardData.length} players
                  {userRank > 1 && leaderboardData[0] && (
                    <span className="ml-1">
                      • {leaderboardData[0].total_points - totalPoints} pts behind #1
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Filter Icons */}
        <div className="flex justify-center gap-8 mb-6">
          <button
            onClick={() => setGameTypeFilter('prediction')}
            className={`flex flex-col items-center gap-2 transition-all ${
              gameTypeFilter === 'prediction' ? 'opacity-100' : 'opacity-40'
            }`}
            data-testid="filter-predictions"
          >
            <div className={`p-3 rounded-full ${gameTypeFilter === 'prediction' ? 'bg-red-100' : 'bg-gray-100'}`}>
              <Target className={gameTypeFilter === 'prediction' ? 'text-red-600' : 'text-gray-600'} size={24} />
            </div>
            <span className={`text-sm font-medium ${gameTypeFilter === 'prediction' ? 'text-red-600' : 'text-gray-600'}`}>
              Predictions
            </span>
          </button>

          <button
            onClick={() => setGameTypeFilter('vote')}
            className={`flex flex-col items-center gap-2 transition-all ${
              gameTypeFilter === 'vote' ? 'opacity-100' : 'opacity-40'
            }`}
            data-testid="filter-polls"
          >
            <div className={`p-3 rounded-full ${gameTypeFilter === 'vote' ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <CheckSquare className={gameTypeFilter === 'vote' ? 'text-blue-600' : 'text-gray-600'} size={24} />
            </div>
            <span className={`text-sm font-medium ${gameTypeFilter === 'vote' ? 'text-blue-600' : 'text-gray-600'}`}>
              Polls
            </span>
          </button>

          <button
            onClick={() => setGameTypeFilter('trivia')}
            className={`flex flex-col items-center gap-2 transition-all ${
              gameTypeFilter === 'trivia' ? 'opacity-100' : 'opacity-40'
            }`}
            data-testid="filter-trivia"
          >
            <div className={`p-3 rounded-full ${gameTypeFilter === 'trivia' ? 'bg-green-100' : 'bg-gray-100'}`}>
              <HelpCircle className={gameTypeFilter === 'trivia' ? 'text-green-600' : 'text-gray-600'} size={24} />
            </div>
            <span className={`text-sm font-medium ${gameTypeFilter === 'trivia' ? 'text-green-600' : 'text-gray-600'}`}>
              Trivia
            </span>
          </button>
        </div>

        {/* Mini Leaderboard */}
        {leaderboardData.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <h3 className="text-lg font-semibold text-gray-900">Top Players</h3>
              </div>
              <Link href="/leaderboard">
                <button className="text-sm text-purple-600 hover:text-purple-700 font-medium">
                  See Full Leaderboard →
                </button>
              </Link>
            </div>
            
            <div className="space-y-3">
              {leaderboardData.slice(0, 5).map((entry: any, index: number) => (
                <div
                  key={entry.user_id}
                  className={`flex items-center justify-between p-3 rounded-xl ${
                    entry.user_id === currentUser?.id ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-gray-100 text-gray-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {entry.user_name || 'Anonymous'}
                        {entry.user_id === currentUser?.id && <span className="ml-2 text-xs text-purple-600">(You)</span>}
                      </div>
                    </div>
                  </div>
                  <div className="font-semibold text-purple-600">{entry.total_points} pts</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Games List */}
        <div className="space-y-4 mb-8">
          {filteredGames.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No {gameTypeFilter === 'prediction' ? 'predictions' : gameTypeFilter === 'vote' ? 'polls' : 'trivia'} available right now. Check back soon!
            </div>
          ) : (
            filteredGames.map((game: any) => {
              const userAnswer = allPredictions[game.id];
              const hasAnswered = !!userAnswer;

              return (
                <div
                  key={game.id}
                  className={`bg-white rounded-2xl p-6 border-2 transition-all ${
                    hasAnswered ? 'border-gray-200 opacity-60' : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{game.title}</h3>
                      {game.description && (
                        <p className="text-sm text-gray-600">{game.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-purple-600">{game.points} pts</div>
                    </div>
                  </div>

                  {hasAnswered ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                      <div className="text-sm font-medium text-green-700">
                        ✓ You answered: {userAnswer}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {game.options.map((option: string) => (
                        <button
                          key={option}
                          onClick={() => handleOptionSelect(game.id, option)}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                            selectedAnswers[game.id] === option
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-200 hover:border-purple-300'
                          }`}
                          data-testid={`option-${game.id}-${option}`}
                        >
                          <span className="text-sm font-medium">{option}</span>
                        </button>
                      ))}
                      <Button
                        onClick={() => handleSubmitAnswer(game)}
                        disabled={!selectedAnswers[game.id]}
                        className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white"
                        data-testid={`submit-${game.id}`}
                      >
                        Submit Answer
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
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

      <FeedbackFooter />

    </div>
  );
}
