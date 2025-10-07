import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Star, Users, UserPlus, ChevronLeft } from 'lucide-react';
import Navigation from '@/components/navigation';
import ConsumptionTracker from '@/components/consumption-tracker';
import { TriviaGameModal } from '@/components/trivia-game-modal';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { copyLink } from "@/lib/share";
import GameShareModal from "@/components/game-share-modal";

export default function PlayTriviaPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [selectedTriviaGame, setSelectedTriviaGame] = useState<any>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [shareModalGame, setShareModalGame] = useState<any>(null);

  // Extract game ID from URL if present (format: /prediction/trivia-harry-potter-easy)
  const gameIdFromUrl = location.match(/\/prediction\/(.+)/)?.[1];

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  // Fetch games directly from Supabase
  const { data: games = [], isLoading } = useQuery({
    queryKey: ['/api/predictions/pools'],
    queryFn: async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = 'https://mahpgcogwpawvviapqza.supabase.co';
      const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1haHBnY29nd3Bhd3Z2aWFwcXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxNTczOTMsImV4cCI6MjA2MTczMzM5M30.cv34J_2INF3_GExWw9zN1Vaa-AOFWI2Py02h0vAlW4c';
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: pools, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      if (error) throw new Error('Failed to fetch games');
      return pools || [];
    },
  });

  // Fetch all predictions
  const { data: userPredictionsData } = useQuery({
    queryKey: ['/api/predictions/user-predictions'],
    queryFn: async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = 'https://mahpgcogwpawvviapqza.supabase.co';
      const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1haHBnY29nd3Bhd3Z2aWFwcXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxNTczOTMsImV4cCI6MjA2MTczMzM5M30.cv34J_2INF3_GExWw9zN1Vaa-AOFWI2Py02h0vAlW4c';
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
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

  // Submit prediction mutation
  const submitPrediction = useMutation({
    mutationFn: async ({ poolId, answer }: { poolId: string; answer: string }) => {
      return apiRequest('/api/predictions', {
        method: 'POST',
        body: JSON.stringify({ poolId, prediction: answer }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/predictions/all'] });
      toast({
        title: "Success!",
        description: "Your answer has been submitted",
      });
    },
  });

  const handleOptionSelect = (gameId: string, option: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [gameId]: option
    }));
  };

  const handleSubmitAnswer = async (game: any) => {
    const answer = selectedAnswers[game.id];
    if (!answer) return;

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
    const isLongFormTrivia = pool.type === 'trivia' && 
      Array.isArray(pool.options) && 
      pool.options.length > 0 && 
      typeof pool.options[0] === 'object';

    return {
      ...pool,
      points: pool.points_reward,
      isLongForm: isLongFormTrivia,
    };
  });

  // Filter for trivia games only
  const triviaGames = processedGames.filter((game: any) => game.type === 'trivia');
  const lowStakesGames = triviaGames.filter((game: any) => !game.isHighStakes);
  const highStakesGames = triviaGames.filter((game: any) => game.isHighStakes);

  // Auto-open game if gameId is in URL
  React.useEffect(() => {
    if (gameIdFromUrl && !selectedTriviaGame && triviaGames.length > 0) {
      const gameToOpen = triviaGames.find((g: any) => g.id === gameIdFromUrl);
      if (gameToOpen) {
        setSelectedTriviaGame(gameToOpen);
      }
    }
  }, [gameIdFromUrl, triviaGames, selectedTriviaGame]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation onTrackConsumption={handleTrackConsumption} />
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center py-20">
            <div className="text-xl">Loading trivia...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={handleTrackConsumption} />

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Back Button and Header */}
        <button
          onClick={() => setLocation('/play')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          data-testid="back-to-play"
        >
          <ChevronLeft size={20} />
          <span className="ml-1">Back to Play</span>
        </button>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-3">
            <Brain className="text-purple-600" size={32} />
            <h1 className="text-3xl font-semibold text-black">Trivia Challenges</h1>
          </div>
          <p className="text-gray-600">
            Test your knowledge against friends on different entertainment topics
          </p>
        </div>

        {/* LOW STAKES Section */}
        {lowStakesGames.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Low Stakes</h2>
            <div className="space-y-4">
              {lowStakesGames.map((game: any) => (
                <Card key={game.id} className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="text-2xl">{game.icon}</div>
                        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-xs font-medium uppercase">
                          {game.isLongForm ? 'Trivia' : 'Quick Trivia'}
                        </Badge>
                      </div>
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
                    {allPredictions[game.id] ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                        <div className="text-green-800 font-medium">✓ Submitted</div>
                        <div className="text-green-700 text-sm">Game completed!</div>
                      </div>
                    ) : game.isLongForm ? (
                      <Button 
                        onClick={() => setSelectedTriviaGame(game)}
                        className="w-full bg-gray-500 hover:bg-gray-600 text-white rounded-xl py-6"
                        data-testid={`play-${game.id}`}
                      >
                        <Brain size={16} className="mr-2" />
                        Play Trivia Game
                      </Button>
                    ) : (
                      <>
                        <div className="text-gray-600 text-sm font-medium">Quick Answer:</div>
                        <div className="grid grid-cols-2 gap-3">
                          {(game.options || []).slice(0, 2).map((option: string, index: number) => (
                            <button
                              key={`${game.id}-${index}`}
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

        {/* HIGH STAKES Section */}
        {highStakesGames.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <span>High Stakes</span>
              <Badge className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white text-xs font-bold border-0">
                ⭐ PREMIUM
              </Badge>
            </h2>
            <div className="space-y-4">
              {highStakesGames.map((game: any) => (
                <Card key={game.id} className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300 shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="text-2xl">{game.icon}</div>
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs font-medium uppercase">
                          High Stakes Trivia
                        </Badge>
                      </div>
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

                    <CardTitle className="text-xl font-bold text-amber-900 mb-2 mt-2">{game.title}</CardTitle>
                    <p className="text-amber-800 text-sm mb-4">{game.description}</p>

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
                      onClick={() => setSelectedTriviaGame(game)}
                      className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white rounded-xl py-6"
                      data-testid={`play-${game.id}`}
                    >
                      <Brain size={16} className="mr-2" />
                      Play High Stakes Game
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {triviaGames.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Brain className="mx-auto mb-4 text-gray-400" size={48} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No trivia games available</h3>
            <p className="text-gray-600">Check back soon for new challenges!</p>
          </div>
        )}
      </div>

      <ConsumptionTracker 
        isOpen={isTrackModalOpen} 
        onClose={() => setIsTrackModalOpen(false)} 
      />

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

      {/* Game Share Modal */}
      {shareModalGame && (
        <GameShareModal
          isOpen={!!shareModalGame}
          onClose={() => setShareModalGame(null)}
          gameId={shareModalGame.id}
          gameTitle={shareModalGame.title}
          gameType={shareModalGame.type || "trivia"}
        />
      )}

    </div>
  );
}