
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

// Mock trivia questions (you can replace with real API later)
const mockTriviaQuestions = [
  {
    id: "trivia-1",
    type: "trivia",
    title: "Marvel vs DC Superhero Knowledge",
    description: "Test your comic book knowledge across both universes",
    points: 15,
    participants: 2847,
    difficulty: "Medium",
    icon: "🦸‍♂️"
  },
  {
    id: "trivia-2", 
    type: "trivia",
    title: "Friends TV Show Deep Cuts",
    description: "How well do you really know the gang from Central Perk?",
    points: 10,
    participants: 1923,
    difficulty: "Hard",
    icon: "☕"
  },
  {
    id: "trivia-3",
    type: "trivia", 
    title: "90s Movie Soundtrack Quiz",
    description: "Name the movies from these iconic 90s songs",
    points: 20,
    participants: 1456,
    difficulty: "Easy",
    icon: "🎵"
  }
];

// Mock simple predictions with options for inline actions
const mockSimplePredictions = [
  {
    id: "simple-pred-1",
    type: "prediction",
    title: "Weekend Box Office Champion",
    description: "Which movie will dominate this weekend's box office?",
    points: 15,
    participants: 892,
    deadline: "Friday 11:59 PM",
    icon: "🎬",
    options: ["Dune: Part Two", "Madame Web", "Ordinary Angels", "Lisa Frankenstein"]
  },
  {
    id: "simple-pred-2", 
    type: "prediction",
    title: "Grammy Best New Artist",
    description: "Who will take home the Grammy for Best New Artist?",
    points: 25,
    participants: 1543,
    deadline: "Sunday 8:00 PM",
    icon: "🏆",
    options: ["Ice Spice", "Jelly Roll", "Coco Jones", "Noah Kahan"]
  }
];

// Mock vote games for inline voting
const mockVoteGames = [
  {
    id: "vote-1",
    type: "vote",
    title: "Best Marvel Movie of All Time",
    description: "Cast your vote for the greatest MCU film ever made!",
    points: 10,
    participants: 2847,
    deadline: "Tomorrow 11:59 PM",
    icon: "🦸‍♂️",
    options: ["Avengers: Endgame", "Black Panther", "Iron Man", "Spider-Man: No Way Home"]
  },
  {
    id: "vote-2",
    type: "vote", 
    title: "Streaming Platform Champion",
    description: "Which platform has the best original content?",
    points: 5,
    participants: 1923,
    deadline: "Friday 11:59 PM",
    icon: "📺",
    options: ["Netflix", "HBO Max", "Disney+", "Amazon Prime"]
  }
];

// Mock complex prediction (many options - should link to detail page)
const mockComplexPredictions = [
  {
    id: "complex-pred-1",
    type: "prediction", 
    title: "2024 Oscar Predictions",
    description: "Predict winners across 24 Academy Award categories",
    points: 100,
    participants: 5429,
    deadline: "March 10th 6:00 PM",
    icon: "🏆",
    options: null // Many categories, needs detail page
  }
];

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
      const response = await apiRequest('/api/predictions/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pool_id: poolId,
          prediction: prediction
        })
      });
      
      return response;
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

  const handleQuickVote = (poolId: string, option: string) => {
    submitPrediction.mutate(
      { poolId, prediction: option },
      {
        onSuccess: (data) => {
          setSelectedOptions(prev => ({ ...prev, [poolId]: option }));
          toast({
            title: "Vote Submitted!",
            description: `You voted for "${option}" and earned ${data.points_earned} points!`,
          });
        },
        onError: () => {
          toast({
            title: "Submission Failed",
            description: "Could not submit your vote. Please try again.",
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

  // Combine all game types into one feed
  const allGames = [
    ...mockTriviaQuestions,
    ...mockSimplePredictions,
    ...mockVoteGames,
    ...mockComplexPredictions,
    ...predictionPools.filter((pool: any) => pool.status === 'open')
  ].sort(() => Math.random() - 0.5); // Randomize order

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
            <Card key={game.id} className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">{game.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        {game.type === 'trivia' ? (
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                            <Brain size={12} className="mr-1" />
                            TRIVIA
                          </Badge>
                        ) : game.type === 'vote' ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <Vote size={12} className="mr-1" />
                            VOTE
                          </Badge>
                        ) : (
                          <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
                            <Trophy size={12} className="mr-1" />
                            PREDICT
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg text-gray-900 leading-tight">{game.title}</CardTitle>
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 text-sm">{game.description}</p>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1">
                      <Star size={16} className="text-purple-600" />
                      <span className="font-medium text-purple-600">
                        {game.points || game.pointsReward} pts
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Users size={16} className="text-gray-500" />
                      <span className="text-gray-600">{game.participants || 0}</span>
                    </div>
                  </div>
                  {game.deadline && (
                    <div className="flex items-center space-x-1">
                      <Clock size={16} className="text-gray-500" />
                      <span className="text-gray-600 text-xs">{game.deadline}</span>
                    </div>
                  )}
                  {game.difficulty && (
                    <Badge variant="outline" className="text-xs">
                      {game.difficulty}
                    </Badge>
                  )}
                </div>

                {/* Inline voting for vote games - enhanced design */}
                {game.type === 'vote' && game.options && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3">
                      {game.options.slice(0, 4).map((option: string) => (
                        <button
                          key={option}
                          onClick={() => handleQuickVote(game.id, option)}
                          disabled={submitPrediction.isPending}
                          className={`p-4 text-left rounded-xl border-2 transition-all hover:shadow-sm ${
                            selectedOptions[game.id] === option
                              ? 'border-green-500 bg-green-50 text-green-900 font-medium shadow-sm'
                              : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                          } ${submitPrediction.isPending ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'}`}
                          data-testid={`vote-option-${game.id}-${option}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{option}</span>
                            {selectedOptions[game.id] === option && (
                              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full" />
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                    {selectedOptions[game.id] && (
                      <div className="text-center py-2">
                        <div className="text-sm text-green-700 font-medium">✓ Vote submitted for "{selectedOptions[game.id]}"</div>
                      </div>
                    )}
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleInviteFriends(game)}
                        className="flex-1"
                        data-testid={`invite-${game.id}`}
                      >
                        <UserPlus size={14} className="mr-1" />
                        Invite
                      </Button>
                    </div>
                  </div>
                )}

                {/* Trivia game actions - enhanced design */}
                {game.type === 'trivia' && (
                  <div className="space-y-3">
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-medium text-blue-900">Ready to test your knowledge?</div>
                        <Badge variant="outline" className="text-blue-700 border-blue-300">
                          {game.difficulty}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          size="sm" 
                          className="bg-blue-600 hover:bg-blue-700 text-white hover:scale-105 transition-all"
                          data-testid={`play-trivia-${game.id}`}
                        >
                          <Play size={14} className="mr-1" />
                          Play Now
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleInviteFriends(game)}
                          data-testid={`invite-${game.id}`}
                          className="hover:scale-105 transition-all"
                        >
                          <UserPlus size={14} className="mr-1" />
                          Invite
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Inline predictions for simple options */}
                {game.type === 'prediction' && game.options && game.options.length <= 4 && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3">
                      {game.options.slice(0, 4).map((option: string) => (
                        <button
                          key={option}
                          onClick={() => handleQuickVote(game.id, option)}
                          disabled={submitPrediction.isPending}
                          className={`p-4 text-left rounded-xl border-2 transition-all hover:shadow-sm ${
                            selectedOptions[game.id] === option
                              ? 'border-purple-500 bg-purple-50 text-purple-900 font-medium shadow-sm'
                              : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                          } ${submitPrediction.isPending ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'}`}
                          data-testid={`predict-option-${game.id}-${option}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{option}</span>
                            {selectedOptions[game.id] === option && (
                              <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full" />
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                    {selectedOptions[game.id] && (
                      <div className="text-center py-2">
                        <div className="text-sm text-purple-700 font-medium">✓ Prediction submitted for "{selectedOptions[game.id]}"</div>
                      </div>
                    )}
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleInviteFriends(game)}
                        className="flex-1"
                        data-testid={`invite-${game.id}`}
                      >
                        <UserPlus size={14} className="mr-1" />
                        Invite
                      </Button>
                    </div>
                  </div>
                )}


                {/* Complex predictions - link to detail page */}
                {game.type !== 'trivia' && game.type !== 'vote' && (!game.options || game.options.length > 4) && (
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-gray-700">Complex Prediction:</div>
                    <div className="grid grid-cols-2 gap-2">
                      <Link href="/predictions" className="flex-1">
                        <Button 
                          size="sm" 
                          className="w-full bg-purple-700 hover:bg-purple-800 text-white"
                          data-testid={`predict-${game.id}`}
                        >
                          <Trophy size={14} className="mr-1" />
                          Predict
                        </Button>
                      </Link>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleInviteFriends(game)}
                        data-testid={`invite-${game.id}`}
                      >
                        <UserPlus size={14} className="mr-1" />
                        Invite
                      </Button>
                    </div>
                  </div>
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
