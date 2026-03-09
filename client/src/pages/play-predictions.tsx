import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Trophy, Star, Users, UserPlus, ChevronLeft, Lock, ChevronRight, Plus } from 'lucide-react';
import Navigation from '@/components/navigation';
import ConsumptionTracker from '@/components/consumption-tracker';
import { PredictionGameModal } from '@/components/prediction-game-modal';
import GameShareModal from "@/components/game-share-modal";
import InlineComposer from '@/components/inline-composer';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

export default function PlayPredictionsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [selectedPredictionGame, setSelectedPredictionGame] = useState<any>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [shareModalGame, setShareModalGame] = useState<any>(null);
  const [showComposer, setShowComposer] = useState(false);


  // Extract game ID from URL hash if present (format: /play/predictions#game-id)
  const gameIdFromUrl = window.location.hash.replace('#', '');

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  // Fetch games directly from Supabase - all predictions
  const { data: games = [], isLoading } = useQuery({
    queryKey: ['/api/predictions/pools'],
    queryFn: async () => {
      const { data: pools, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('status', 'open')
        .eq('type', 'predict')
        .order('created_at', { ascending: false });
      if (error) throw new Error('Failed to fetch games');
      // Return all predictions, mark which are consumed vs community
      return (pools || []).map((p: any) => ({
        ...p,
        isConsumed: p.origin_type === 'consumed' || p.id?.startsWith('consumed-'),
      }));
    },
  });

  // Fetch awards events
  const { data: awardsEvents = [] } = useQuery({
    queryKey: ['/api/awards/events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('awards_events')
        .select('id, name, year, status, ceremony_date, deadline');
      if (error) return [];
      // Open events first (latest ceremony date first), then locked (latest first)
      return (data || []).sort((a: any, b: any) => {
        if (a.status === 'open' && b.status !== 'open') return -1;
        if (a.status !== 'open' && b.status === 'open') return 1;
        return new Date(b.ceremony_date).getTime() - new Date(a.ceremony_date).getTime();
      });
    },
  });

  // Fetch all predictions
  const { data: userPredictionsData } = useQuery({
    queryKey: ['/api/predictions/user-predictions'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {};
      const { data, error } = await supabase
        .from('user_predictions')
        .select('pool_id, prediction')
        .eq('user_id', user.id);
      if (error) return {};
      const predictions: Record<string, string> = {};
      data?.forEach((pred) => { predictions[pred.pool_id] = pred.prediction; });
      return predictions;
    },
  });

  const allPredictions = userPredictionsData || {};

  // Submit prediction mutation - directly to Supabase
  const submitPrediction = useMutation({
    mutationFn: async ({ poolId, answer }: { poolId: string; answer: string }) => {
      console.log('🚀 Saving prediction to user_predictions table...');
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Must be logged in to submit predictions');
      }
      
      const { data: game, error: gameError } = await supabase
        .from('prediction_pools')
        .select('points_reward, type')
        .eq('id', poolId)
        .single();
        
      if (gameError || !game) {
        throw new Error('Game not found');
      }
      
      const gameType = game.type;
      let immediatePoints = 0;
      
      if (gameType === 'vote' || gameType === 'trivia') {
        immediatePoints = game.points_reward;
      } else if (gameType === 'predict') {
        immediatePoints = 0;
      }

      const { data, error } = await supabase
        .from('user_predictions')
        .insert({
          user_id: user.id,
          pool_id: poolId,
          prediction: answer,
          points_earned: immediatePoints,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) {
        console.error('❌ Error saving prediction:', error);
        if (error.code === '23505') {
          throw new Error('You have already submitted a prediction for this');
        }
        throw new Error('Failed to save prediction');
      }
      
      console.log('✅ Prediction saved successfully:', data);
      
      return { 
        success: true, 
        points_earned: immediatePoints,
        pool_id: poolId,
        prediction: answer,
        game_type: gameType
      };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/predictions/user-predictions'] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      
      toast({
        title: "Prediction Submitted!",
        description: data.game_type === 'predict' 
          ? `You predicted "${data.prediction}" - points will be awarded when the result is known!`
          : `You earned ${data.points_earned} points!`,
      });
    },
    onError: () => {
      toast({
        title: "Submission Failed",
        description: "Could not submit your prediction. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleOptionSelect = (gameId: string, option: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [gameId]: option
    }));
  };

  const handleSubmitAnswer = async (game: any) => {
    const answer = selectedAnswers[game.id];
    if (!answer) {
      toast({
        title: "Please select an option",
        description: "Choose one of the options before submitting.",
        variant: "destructive"
      });
      return;
    }

    await submitPrediction.mutateAsync({
      poolId: game.id,
      answer
    });
  };

  const handleInviteFriends = (item: any) => {
    setShareModalGame(item);
  };

  // Process and filter games
  const processedGames = games.map((pool: any) => {
    const isMultiCategoryPrediction = pool.type === 'predict' &&
      Array.isArray(pool.options) &&
      pool.options.length > 0 &&
      typeof pool.options[0] === 'object';

    return {
      ...pool,
      points: pool.points_reward,
      isMultiCategory: isMultiCategoryPrediction,
    };
  });

  const predictionGames = React.useMemo(() => {
    return processedGames.filter((game: any) => game.type === 'predict');
  }, [processedGames]);
  
  const lowStakesGames = predictionGames.filter((game: any) => !game.isHighStakes);
  const highStakesGames = predictionGames.filter((game: any) => game.isHighStakes);

  // Auto-open prediction if gameId is in URL hash
  React.useEffect(() => {
    if (gameIdFromUrl && !selectedPredictionGame && predictionGames.length > 0) {
      const gameToOpen = predictionGames.find((g: any) => g.id === gameIdFromUrl);
      if (gameToOpen) {
        setSelectedPredictionGame(gameToOpen);
      }
    }
  }, [gameIdFromUrl, predictionGames, selectedPredictionGame]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation onTrackConsumption={handleTrackConsumption} />
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center py-20">
            <div className="text-xl">Loading predictions...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={handleTrackConsumption} />

      {/* Header Section with Gradient */}
      <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] pb-6 -mt-px">
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => window.history.back()}
              className="flex items-center text-gray-400 hover:text-white transition-colors"
              data-testid="back-button"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-2xl font-semibold text-white" data-testid="predictions-title">Predictions</h1>
          </div>

          <Button
            onClick={() => setShowComposer(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-4 py-2 text-sm font-medium"
            data-testid="create-prediction-btn"
          >
            <Plus size={16} />
            Create Prediction
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4">

        {/* Awards Events Section */}
        {(() => {
          const visibleAwards = awardsEvents.filter((e: any) =>
            !['gg-2026', 'sag-awards-2026'].includes(e.id)
          );
          if (visibleAwards.length === 0) return null;
          return (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={16} className="text-amber-500" />
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Awards</h2>
              </div>
              <div className="space-y-3">
                {visibleAwards.map((event: any) => {
                  const isOpen = event.status === 'open';
                  const isCompleted = event.status === 'completed';
                  return (
                    <button
                      key={event.id}
                      onClick={() => setLocation(`/play/awards/${event.id}`)}
                      className="w-full text-left"
                    >
                      <Card className={`border shadow-sm rounded-2xl overflow-hidden transition-all hover:shadow-md ${
                        isOpen
                          ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200'
                          : isCompleted
                            ? 'bg-gray-50 border-gray-200'
                            : 'bg-white border-gray-200'
                      }`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                isOpen ? 'bg-amber-100' : 'bg-gray-100'
                              }`}>
                                <Trophy size={20} className={isOpen ? 'text-amber-600' : 'text-gray-400'} />
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900 text-sm">{event.name} {event.year}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {isOpen && (
                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs px-2 py-0">
                                      Open
                                    </Badge>
                                  )}
                                  {event.status === 'locked' && (
                                    <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 text-xs px-2 py-0 flex items-center gap-1">
                                      <Lock size={10} />
                                      Locked
                                    </Badge>
                                  )}
                                  {isCompleted && (
                                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs px-2 py-0">
                                      Results In
                                    </Badge>
                                  )}
                                  {event.deadline && isOpen && (
                                    <span className="text-xs text-gray-400">
                                      Closes {new Date(event.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Predictions */}
        {lowStakesGames.length > 0 && (
          <div className="mb-8">
            <div className="space-y-4">
              {lowStakesGames.map((game: any) => (
                <Card key={game.id} className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className="text-2xl">{game.icon}</div>
                        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-xs font-medium uppercase">
                          Predict
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleInviteFriends(game)}
                        className="px-3 py-1.5 text-xs bg-purple-600 text-white hover:bg-purple-700 border-0 rounded-lg"
                        data-testid={`invite-${game.id}`}
                      >
                        <UserPlus size={14} className="mr-1" />
                        Invite to Play
                      </Button>
                    </div>
                    <div className="mb-2">
                      {game.isConsumed ? (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs font-medium flex items-center gap-1 w-fit">
                          <Trophy size={11} />
                          Consumed
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs font-medium flex items-center gap-1 w-fit">
                          <Users size={11} />
                          Community
                        </Badge>
                      )}
                    </div>

                    {/* Show media title for context, then the question */}
                    {game.media_title ? (
                      <>
                        <div className="text-sm font-medium text-purple-600 mb-1">{game.media_title}</div>
                        <CardTitle className="text-xl font-bold text-gray-900 mb-2">{game.title}</CardTitle>
                      </>
                    ) : game.description && game.description !== game.title ? (
                      <>
                        <div className="text-sm font-medium text-purple-600 mb-1">{game.description}</div>
                        <CardTitle className="text-xl font-bold text-gray-900 mb-2">{game.title}</CardTitle>
                      </>
                    ) : game.category ? (
                      <>
                        <div className="text-sm font-medium text-purple-600 mb-1">{game.category}</div>
                        <CardTitle className="text-xl font-bold text-gray-900 mb-2">{game.title}</CardTitle>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-medium text-gray-400 mb-1 italic">General Prediction</div>
                        <CardTitle className="text-xl font-bold text-gray-900 mb-2">{game.title}</CardTitle>
                      </>
                    )}
                    {/* Only show description if different from title AND not already used as context label */}
                    {game.description && game.description !== game.title && game.media_title && (
                      <p className="text-gray-600 text-sm mb-4">{game.description}</p>
                    )}

                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <Star size={14} className="text-purple-600" />
                        <span className="font-medium text-purple-600">You Earn: {game.points || 10} pts</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Users size={14} />
                        <span>{game.participants || 0}</span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {allPredictions[game.id] ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                        <div className="text-green-800 font-medium">✓ Submitted</div>
                        <div className="text-green-700 text-sm">
                          You predicted "{allPredictions[game.id]}"
                        </div>
                      </div>
                    ) : game.isMultiCategory ? (
                      <Button
                        onClick={() => setSelectedPredictionGame(game)}
                        className="w-full bg-gray-500 hover:bg-gray-600 text-white rounded-xl py-6"
                        data-testid={`play-${game.id}`}
                      >
                        <Trophy size={16} className="mr-2" />
                        Make Predictions
                      </Button>
                    ) : (
                      <>
                        <div className="text-gray-600 text-sm font-medium">Quick Predict:</div>
                        <div className="grid grid-cols-2 gap-3">
                          {(game.options || []).slice(0, 2).map((option: string, index: number) => (
                            <button
                              key={option}
                              onClick={() => handleOptionSelect(game.id, option)}
                              className={`p-4 text-left rounded-lg border-2 transition-all ${
                                selectedAnswers[game.id] === option
                                  ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                              data-testid={`option-${game.id}-${index}`}
                            >
                              <div className="text-sm font-medium text-gray-900">{option}</div>
                            </button>
                          ))}
                        </div>
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
              ))}
            </div>
          </div>
        )}

        {/* High Stakes Predictions */}
        {highStakesGames.length > 0 && (
          <div className="mb-8">
            <div className="space-y-4">
              {highStakesGames.map((game: any) => (
                <Card key={game.id} className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300 shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Star className="text-amber-600" size={24} />
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs font-medium uppercase">
                          High Stakes
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleInviteFriends(game)}
                        className="px-3 py-1.5 text-xs bg-purple-600 text-white hover:bg-purple-700 border-0 rounded-lg"
                        data-testid={`invite-${game.id}`}
                      >
                        <UserPlus size={14} className="mr-1" />
                        Invite to Play
                      </Button>
                    </div>
                    <div className="mb-2">
                      {game.isConsumed ? (
                        <Badge className="bg-amber-200 text-amber-800 hover:bg-amber-200 text-xs font-medium flex items-center gap-1 w-fit">
                          <Trophy size={11} />
                          Consumed
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs font-medium flex items-center gap-1 w-fit">
                          <Users size={11} />
                          Community
                        </Badge>
                      )}
                    </div>

                    {/* Show media title for context, then the question */}
                    {game.media_title && game.media_title !== game.title ? (
                      <>
                        <div className="text-sm font-medium text-amber-600 mb-1">{game.media_title}</div>
                        <CardTitle className="text-xl font-bold text-amber-900 mb-2">{game.title}</CardTitle>
                      </>
                    ) : game.category ? (
                      <>
                        <div className="text-sm font-medium text-amber-600 mb-1">{game.category}</div>
                        <CardTitle className="text-xl font-bold text-amber-900 mb-2">{game.title}</CardTitle>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-medium text-amber-500 mb-1 italic">General Prediction</div>
                        <CardTitle className="text-xl font-bold text-amber-900 mb-2">{game.title}</CardTitle>
                      </>
                    )}
                    {/* Only show description if different from title */}
                    {game.description && game.description !== game.title && (
                      <p className="text-amber-800 text-sm mb-4">{game.description}</p>
                    )}

                    <div className="flex items-center space-x-4 text-sm text-amber-900">
                      <div className="flex items-center space-x-1">
                        <Star size={14} className="text-amber-600" />
                        <span className="font-medium">Entry: {game.entryCost || 50} pts</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Star size={14} className="text-amber-600" />
                        <span className="font-medium">Win: {game.payout || 100} pts</span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <Button
                      onClick={() => setSelectedPredictionGame(game)}
                      className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white rounded-xl py-6"
                      data-testid={`play-${game.id}`}
                    >
                      <Star size={16} className="mr-2" />
                      Make Prediction
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {predictionGames.length === 0 && awardsEvents.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Trophy className="mx-auto mb-4 text-gray-400" size={48} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No predictions available</h3>
            <p className="text-gray-600 mb-4">Be the first — create a prediction for others to weigh in on.</p>
            <Button
              onClick={() => setShowComposer(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
            >
              <Plus size={16} className="mr-2" />
              Create Prediction
            </Button>
          </div>
        )}
      </div>

      <ConsumptionTracker
        isOpen={isTrackModalOpen}
        onClose={() => setIsTrackModalOpen(false)}
      />

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

      {shareModalGame && (
        <GameShareModal
          isOpen={!!shareModalGame}
          onClose={() => setShareModalGame(null)}
          gameId={shareModalGame.id}
          gameTitle={shareModalGame.title}
          gameType={shareModalGame.type || "predict"}
        />
      )}

      <Dialog open={showComposer} onOpenChange={setShowComposer}>
        <DialogContent className="p-0 max-w-lg w-full overflow-hidden rounded-2xl" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Create Prediction</DialogTitle>
          <InlineComposer
            defaultType="prediction"
            onPostSuccess={() => {
              setShowComposer(false);
              queryClient.invalidateQueries({ queryKey: ['/api/predictions/pools'] });
            }}
          />
        </DialogContent>
      </Dialog>

    </div>
  );
}