
import { useState, useMemo } from "react";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Trophy, Brain, Gamepad2, Vote, Star, Users, Clock, UserPlus, Film, Tv, Music, Book, Dumbbell } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { copyLink } from "@/lib/share";
import { TriviaGameModal } from "@/components/trivia-game-modal";

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
      console.log('🔄 Leaderboard cache invalidated - points will update immediately');
    }
  });
}

export default function PlayPage() {
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const { data: predictionPools = [], isLoading } = usePredictionPools();
  const submitPrediction = useSubmitPrediction();
  const { toast } = useToast();
  
  // Filter states
  const [gameTypeFilter, setGameTypeFilter] = useState<string>('all');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>('all');

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [selectedTriviaGame, setSelectedTriviaGame] = useState<any>(null);

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
        
        // Quick games have exactly 2 string options
        const isQuickGame = Array.isArray(pool.options) && 
          pool.options.length === 2 && 
          typeof pool.options[0] === 'string';
        
        return isMultiQuestionTrivia || isQuickGame;
      })
      .map((pool: any) => {
        // Determine if this is a long-form trivia game
        const isLongFormTrivia = pool.type === 'trivia' && 
          Array.isArray(pool.options) && 
          pool.options.length > 0 && 
          typeof pool.options[0] === 'object';
        
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
          isLongForm: isLongFormTrivia
        };
      })
      .sort(() => Math.random() - 0.5); // Randomize order ONLY once
  }, [predictionPools]);

  // All available media types (including those without content yet)
  const allMediaTypes = ['Movies', 'TV', 'Music', 'Books', 'Sports', 'Gaming', 'Podcasts'];

  // Filter games based on selected filters
  const filteredGames = useMemo(() => {
    return allGames.filter((game: any) => {
      // Game type filter
      if (gameTypeFilter !== 'all' && game.type !== gameTypeFilter) {
        return false;
      }
      
      // Media type filter
      if (mediaTypeFilter !== 'all' && game.mediaType !== mediaTypeFilter) {
        return false;
      }
      
      return true;
    });
  }, [allGames, gameTypeFilter, mediaTypeFilter]);

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
        <div className="text-center mb-6">
          <h1 className="text-3xl font-semibold text-black mb-3">
            Games Feed
          </h1>
          <p className="text-lg text-gray-600">
            Play games, vote on topics, make predictions, and earn points. Use the search bar above for personalized recommendations and group blends!
          </p>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            {/* Game Type Dropdown */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Game Type</label>
              <Select value={gameTypeFilter} onValueChange={setGameTypeFilter}>
                <SelectTrigger className="w-full" data-testid="select-game-type">
                  <SelectValue placeholder="All Games" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Games</SelectItem>
                  <SelectItem value="vote">Vote</SelectItem>
                  <SelectItem value="trivia">Trivia</SelectItem>
                  <SelectItem value="predict">Predict</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Media Type Dropdown */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Media Type</label>
              <Select value={mediaTypeFilter} onValueChange={setMediaTypeFilter}>
                <SelectTrigger className="w-full" data-testid="select-media-type">
                  <SelectValue placeholder="All Media" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Media</SelectItem>
                  {allMediaTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results count */}
          <div className="text-sm text-gray-500 mt-3 pt-3 border-t border-gray-200">
            Showing {filteredGames.length} of {allGames.length} games
          </div>
        </div>

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
            <Card key={game.id} className="bg-white border border-gray-200 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="text-xl">{game.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {game.type === 'trivia' ? (
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs font-medium">
                            <Brain size={10} className="mr-1" />
                            {game.isLongForm ? 'TRIVIA GAME' : 'QUICK TRIVIA'}
                          </Badge>
                        ) : game.type === 'vote' ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs font-medium">
                            <Vote size={10} className="mr-1" />
                            VOTE
                          </Badge>
                        ) : (
                          <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 text-xs font-medium">
                            <Trophy size={10} className="mr-1" />
                            PREDICT
                          </Badge>
                        )}
                        {game.isLongForm && (
                          <Badge variant="outline" className="text-xs">
                            {game.options.length} Questions
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg text-gray-900 leading-tight mb-2">{game.title}</CardTitle>
                      <p className="text-gray-600 text-sm">{game.description}</p>
                    </div>
                  </div>
                  {/* Invite to Play button - upper right */}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleInviteFriends(game)}
                    className="ml-3 px-3 py-1 text-xs border-gray-300 hover:border-gray-400"
                    data-testid={`invite-${game.id}`}
                  >
                    <UserPlus size={12} className="mr-1" />
                    Invite to Play
                  </Button>
                </div>

                {/* Stats Row */}
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <div className="flex items-center space-x-1">
                    <Star size={14} className="text-purple-600" />
                    <span className="font-medium text-purple-600">{game.points || 10} pts</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Users size={14} />
                    <span>{game.participants || 0}</span>
                  </div>
                  {game.deadline && (
                    <div className="flex items-center space-x-1">
                      <Clock size={14} />
                      <span>{game.deadline}</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Show if already submitted */}
                {selectedOptions[game.id] ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <div className="text-green-800 font-medium">✓ Submitted</div>
                    <div className="text-green-700 text-sm">
                      {game.isLongForm ? 'Game completed!' : `You selected "${selectedOptions[game.id]}"`}
                    </div>
                  </div>
                ) : game.isLongForm ? (
                  // Long-form trivia game - show "Play Game" button
                  <Button 
                    onClick={() => setSelectedTriviaGame(game)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    data-testid={`play-${game.id}`}
                  >
                    <Brain size={16} className="mr-2" />
                    Play Trivia Game
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
                      className="w-full bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-50"
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

        {/* Stats Section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mt-8">
          <div className="flex items-center space-x-3 mb-6">
            <Gamepad2 className="text-purple-800" size={24} />
            <h2 className="text-xl font-bold text-gray-800">Your Game Stats</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">0</div>
              <div className="text-sm text-gray-500">Trivia Played</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">0%</div>
              <div className="text-sm text-gray-500">Trivia Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">0</div>
              <div className="text-sm text-gray-500">Votes Cast</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 mb-1">0</div>
              <div className="text-sm text-gray-500">Predictions Made</div>
            </div>
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
            // Mark as submitted
            setSelectedOptions(prev => ({ ...prev, [selectedTriviaGame.id]: 'completed' }));
          }}
        />
      )}
    </div>
  );
}
