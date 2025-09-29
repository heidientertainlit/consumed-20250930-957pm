
import { useState } from "react";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Trophy, Brain, Gamepad2, Vote, Star, Users, Clock, UserPlus } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// All game data now comes from the database via API


// Fetch prediction pools
function usePredictionPools() {
  return useQuery({
    queryKey: ['/api/predictions/pools'],
    queryFn: async () => {
      const response = await fetch('/api/predictions/pools?active=1');
      const data = await response.json();
      return data.pools || [];
    },
    enabled: true
  });
}

// Vote submission mutation
function useSubmitPrediction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ poolId, prediction }: { poolId: string; prediction: string }) => {
      const response = await fetch('/api/predictions/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pool_id: poolId,
          prediction: prediction
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit prediction');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/predictions/pools'] });
    }
  });
}

export default function PlayPage() {
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const { data: predictionPools = [], isLoading } = usePredictionPools();
  const submitPrediction = useSubmitPrediction();
  const { toast } = useToast();

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});

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
          toast({
            title: `${game.type === 'vote' ? 'Vote' : game.type === 'prediction' ? 'Prediction' : 'Answer'} Submitted!`,
            description: `You selected "${selectedOption}" and earned ${data.points_earned || game.points || 10} points!`,
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
    const shareData = {
      title: `Join me on consumed!`,
      text: `I'm playing "${item.title}" - think you can beat me? Join the game and let's see who wins! 🎯`,
      url: `${window.location.origin}/play#${item.id}`
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        toast({
          title: "Invite Link Copied!",
          description: "Share this with your friends to invite them",
        });
      }
    } catch (error) {
      console.error('Error inviting friends:', error);
      toast({
        title: "Invite Failed",
        description: "Unable to create invite link",
        variant: "destructive"
      });
    }
  };

  // Use only real games from the database API
  const allGames = (predictionPools || [])
    .filter((pool: any) => pool.status === 'open' && pool.options && pool.options.length === 2)
    .map((pool: any) => ({
      id: pool.id,
      type: pool.type,
      title: pool.title,
      description: pool.description,
      points: pool.points_reward || pool.pointsReward,
      participants: pool.participants,
      deadline: pool.deadline,
      icon: pool.icon,
      mediaType: pool.category,
      options: pool.options
    }))
    .sort(() => Math.random() - 0.5); // Randomize order

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
            Games Feed
          </h1>
          <p className="text-lg text-gray-600">
            Play games, vote on topics, make predictions, and earn points. Use the search bar above for personalized recommendations and group blends!
          </p>
        </div>

        {/* Games Feed */}
        <div className="space-y-6">
          {allGames.map((game: any) => (
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
                            TRIVIA
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
                    <div className="text-green-700 text-sm">You selected "{selectedOptions[game.id]}"</div>
                  </div>
                ) : (
                  <>
                    {/* Quick Vote/Predict/Trivia Label */}
                    <div className="text-gray-600 text-sm font-medium">
                      {game.type === 'vote' ? 'Quick Vote:' : game.type === 'prediction' ? 'Quick Predict:' : 'Quick Answer:'}
                    </div>

                    {/* Two Option Boxes */}
                    <div className="grid grid-cols-2 gap-3">
                      {(game.options || []).slice(0, 2).map((option: string, index: number) => (
                        <button
                          key={option}
                          onClick={() => handleOptionSelect(game.id, option)}
                          className={`p-4 text-left rounded-lg border-2 transition-all ${
                            selectedAnswers[game.id] === option
                              ? 'border-gray-400 bg-gray-50'
                              : 'border-gray-200 hover:border-gray-300'
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
          ))}
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
    </div>
  );
}
