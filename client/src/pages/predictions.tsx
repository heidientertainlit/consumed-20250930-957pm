import { useState } from "react";
import Navigation from "@/components/navigation";
import ConsumptionTracker from "@/components/consumption-tracker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Calendar, Vote, ArrowLeft, Clock, Users, Star, UserPlus, Brain } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { PredictionPool } from "@shared/schema";
import { TriviaGameModal } from "@/components/trivia-game-modal";

// Data fetching hooks
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
      queryClient.invalidateQueries({ queryKey: ['/api/predictions/user-predictions'] });
    }
  });
}

// Vote Modal Component
const VoteModal = ({ pool, isOpen, onClose }: { pool: PredictionPool; isOpen: boolean; onClose: () => void }) => {
  const [selectedVote, setSelectedVote] = useState<string>("");
  const submitPrediction = useSubmitPrediction();
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!selectedVote) return;
    
    submitPrediction.mutate(
      { poolId: pool.id, prediction: selectedVote },
      {
        onSuccess: (data) => {
          toast({
            title: "Vote Submitted!",
            description: `You voted for "${selectedVote}" and earned ${data.points_earned} points!`,
          });
          onClose();
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

  const options: string[] = Array.isArray(pool.options) ? pool.options : [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white border-gray-200 text-gray-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">{pool.title}</DialogTitle>
          <p className="text-gray-600">{pool.description}</p>
        </DialogHeader>

        <div className="space-y-3 mt-6">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => setSelectedVote(option)}
              className={`w-full p-4 text-left rounded-lg border transition-all ${
                selectedVote === option
                  ? 'border-purple-500 bg-purple-50 text-purple-900'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-gray-800">{option}</div>
            </button>
          ))}
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            className="bg-purple-700 hover:bg-purple-800"
            disabled={!selectedVote || submitPrediction.isPending}
            onClick={handleSubmit}
          >
            {submitPrediction.isPending ? 'Submitting...' : `Cast Vote (${pool.pointsReward} pts)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Weekly Prediction Modal Component
const WeeklyModal = ({ pool, isOpen, onClose }: { pool: PredictionPool; isOpen: boolean; onClose: () => void }) => {
  const [selectedPick, setSelectedPick] = useState<string>("");
  const submitPrediction = useSubmitPrediction();
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!selectedPick) return;
    
    submitPrediction.mutate(
      { poolId: pool.id, prediction: selectedPick },
      {
        onSuccess: (data) => {
          toast({
            title: "Prediction Submitted!",
            description: `You predicted "${selectedPick}" and earned ${data.points_earned} points!`,
          });
          onClose();
        },
        onError: () => {
          toast({
            title: "Submission Failed",
            description: "Could not submit your prediction. Please try again.",
            variant: "destructive"
          });
        }
      }
    );
  };

  const options: string[] = Array.isArray(pool.options) ? pool.options : [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white border-gray-200 text-gray-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">{pool.title}</DialogTitle>
          <p className="text-gray-600">{pool.description}</p>
        </DialogHeader>

        <div className="space-y-3 mt-6">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => setSelectedPick(option)}
              className={`w-full p-4 text-left rounded-lg border transition-all ${
                selectedPick === option
                  ? 'border-purple-500 bg-purple-50 text-purple-900'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-gray-800">{option}</div>
            </button>
          ))}
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            className="bg-purple-700 hover:bg-purple-800"
            disabled={!selectedPick || submitPrediction.isPending}
            onClick={handleSubmit}
          >
            {submitPrediction.isPending ? 'Submitting...' : `Submit Prediction (${pool.pointsReward} pts)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Bracket Modal Component
const BracketModal = ({ pool, isOpen, onClose }: { pool: PredictionPool; isOpen: boolean; onClose: () => void }) => {
  const [selectedWinner, setSelectedWinner] = useState<string>("");
  const submitPrediction = useSubmitPrediction();
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!selectedWinner) return;
    
    submitPrediction.mutate(
      { poolId: pool.id, prediction: selectedWinner },
      {
        onSuccess: (data) => {
          toast({
            title: "Bracket Submitted!",
            description: `You picked "${selectedWinner}" and earned ${data.points_earned} points!`,
          });
          onClose();
        },
        onError: () => {
          toast({
            title: "Submission Failed",
            description: "Could not submit your bracket. Please try again.",
            variant: "destructive"
          });
        }
      }
    );
  };

  const options: string[] = Array.isArray(pool.options) ? pool.options : [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-white border-gray-200 text-gray-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">{pool.title}</DialogTitle>
          <p className="text-gray-600">{pool.description}</p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mt-6">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => setSelectedWinner(option)}
              className={`p-4 text-left rounded-lg border transition-all ${
                selectedWinner === option
                  ? 'border-purple-500 bg-purple-50 text-purple-900'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-gray-800">{option}</div>
            </button>
          ))}
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            className="bg-purple-700 hover:bg-purple-800"
            disabled={!selectedWinner || submitPrediction.isPending}
            onClick={handleSubmit}
          >
            {submitPrediction.isPending ? 'Submitting...' : `Submit Pick (${pool.pointsReward} pts)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Awards Show Modal Component
const AwardShowModal = ({ pool, isOpen, onClose }: { pool: PredictionPool; isOpen: boolean; onClose: () => void }) => {
  const [selectedPicks, setSelectedPicks] = useState<Record<string, string>>({});
  const submitPrediction = useSubmitPrediction();
  const { toast } = useToast();

  const categories = [
    { id: "best-picture", name: "Best Picture", options: ["Oppenheimer", "Killers of the Flower Moon", "Barbie", "Past Lives"] },
    { id: "best-actor", name: "Best Actor", options: ["Cillian Murphy", "Paul Giamatti", "Jeffrey Wright", "Bradley Cooper"] },
    { id: "best-actress", name: "Best Actress", options: ["Emma Stone", "Lily Gladstone", "Sandra Hüller", "Annette Bening"] },
  ];

  const handleSubmit = () => {
    const picks = Object.values(selectedPicks);
    if (picks.length !== categories.length) return;
    
    submitPrediction.mutate(
      { poolId: pool.id, prediction: JSON.stringify(selectedPicks) },
      {
        onSuccess: (data) => {
          toast({
            title: "Awards Predictions Submitted!",
            description: `You submitted predictions for all categories and earned ${data.points_earned} points!`,
          });
          onClose();
        },
        onError: () => {
          toast({
            title: "Submission Failed",
            description: "Could not submit your predictions. Please try again.",
            variant: "destructive"
          });
        }
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-white border-gray-200 text-gray-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">{pool.title}</DialogTitle>
          <p className="text-gray-600">{pool.description}</p>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {categories.map((category) => (
            <div key={category.id}>
              <h3 className="text-lg font-semibold mb-3">{category.name}</h3>
              <div className="grid grid-cols-2 gap-2">
                {category.options.map((option) => (
                  <button
                    key={option}
                    onClick={() => setSelectedPicks(prev => ({ ...prev, [category.id]: option }))}
                    className={`p-3 text-left rounded-lg border transition-all ${
                      selectedPicks[category.id] === option
                        ? 'border-purple-500 bg-purple-50 text-purple-900'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-gray-800">{option}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            className="bg-purple-700 hover:bg-purple-800"
            disabled={Object.keys(selectedPicks).length !== categories.length || submitPrediction.isPending}
            onClick={handleSubmit}
          >
            {submitPrediction.isPending ? 'Submitting...' : `Submit All Picks (${pool.pointsReward} pts)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function VoteAndPredictPage() {
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [selectedPool, setSelectedPool] = useState<PredictionPool | null>(null);
  const [filterStatus, setFilterStatus] = useState<"open" | "my_predictions" | "completed">("open");
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const { toast } = useToast();
  
  // Fetch real prediction pools
  const { data: pools = [], isLoading, error } = usePredictionPools();
  const submitPrediction = useSubmitPrediction();

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "awards": return <Trophy size={24} className="text-yellow-600" />;
      case "weekly": return <Calendar size={24} className="text-blue-600" />;
      case "vote": return <Vote size={24} className="text-green-600" />;
      default: return <Star size={24} className="text-purple-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open": return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Open</Badge>;
      case "locked": return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Locked</Badge>;
      case "completed": return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Completed</Badge>;
      default: return null;
    }
  };

  // Filter pools based on status and sort with Harry Potter trivia first
  const filteredPools = pools
    .filter((pool: PredictionPool) => pool.status === filterStatus)
    .sort((a: PredictionPool, b: PredictionPool) => {
      // Put Harry Potter trivia at the top
      if (a.id === 'trivia-harry-potter-full') return -1;
      if (b.id === 'trivia-harry-potter-full') return 1;
      return 0;
    });

  const handlePoolClick = (pool: PredictionPool) => {
    if (pool.status === "open" && !pool.inline) {
      setSelectedPool(pool);
    }
  };

  const handleQuickPick = (poolId: string, option: string) => {
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

  const handleInviteFriends = async (pool: PredictionPool) => {
    try {
      const { copyLink } = await import('@/lib/share');
      await copyLink({ kind: 'prediction', id: pool.id });
      
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

  const renderModal = () => {
    if (!selectedPool) return null;

    // Check if this is a multi-question trivia game
    if (selectedPool.type === "trivia" && Array.isArray(selectedPool.options) && 
        selectedPool.options.length > 0 && typeof selectedPool.options[0] === 'object') {
      return (
        <TriviaGameModal
          poolId={selectedPool.id}
          title={selectedPool.title}
          questions={selectedPool.options as any}
          pointsReward={selectedPool.pointsReward}
          isOpen={!!selectedPool}
          onClose={() => setSelectedPool(null)}
        />
      );
    }

    switch (selectedPool.type) {
      case "awards":
        return <AwardShowModal pool={selectedPool} isOpen={!!selectedPool} onClose={() => setSelectedPool(null)} />;
      case "weekly":
        return <WeeklyModal pool={selectedPool} isOpen={!!selectedPool} onClose={() => setSelectedPool(null)} />;
      case "bracket":
        return <BracketModal pool={selectedPool} isOpen={!!selectedPool} onClose={() => setSelectedPool(null)} />;
      case "vote":
        return <VoteModal pool={selectedPool} isOpen={!!selectedPool} onClose={() => setSelectedPool(null)} />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation onTrackConsumption={handleTrackConsumption} />
        <div className="max-w-6xl mx-auto px-4 pt-2 pb-6">
          <div className="text-center py-20">
            <div className="text-xl">Loading prediction pools...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation onTrackConsumption={handleTrackConsumption} />
        <div className="max-w-6xl mx-auto px-4 pt-2 pb-6">
          <div className="text-center py-20">
            <div className="text-xl text-red-600">Failed to load prediction pools</div>
            <div className="text-gray-600 mt-2">Please try again later</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={handleTrackConsumption} />
      
      <div className="max-w-6xl mx-auto px-4 pt-2 pb-6">
        {/* Back Button */}
        <div className="mb-4">
          <Link href="/play">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="back-to-play">
              <ArrowLeft size={20} className="mr-2" />
              Back to Play
            </Button>
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Vote & Predict</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Cast your votes on fun topics and make predictions about awards, releases, and entertainment trends. Earn points for participation and accuracy!
          </p>
        </div>

        <div className="space-y-8">
          {/* Prediction Pools Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPools.map((pool: PredictionPool) => (
              <Card key={pool.id} className="bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => handlePoolClick(pool)}>
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-3xl">{pool.icon}</div>
                      <div className="flex-1">
                        <CardTitle className="text-lg text-gray-900 leading-tight">{pool.title}</CardTitle>
                      </div>
                    </div>
                    {getStatusBadge(pool.status)}
                  </div>
                  <p className="text-gray-600 text-sm">{pool.description}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <Star size={16} className="text-purple-600" />
                        <span className="font-medium text-purple-600">{pool.pointsReward} pts</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Users size={16} className="text-gray-500" />
                        <span className="text-gray-600">{pool.participants || 0}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock size={16} className="text-gray-500" />
                      <span className="text-gray-600 text-xs">{pool.deadline}</span>
                    </div>
                  </div>

                  {/* Quick Pick Options (for inline polls) */}
                  {pool.inline && pool.options && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-700">Quick Pick:</div>
                      <div className="grid grid-cols-1 gap-2">
                        {pool.options.map((option) => (
                          <button
                            key={option}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickPick(pool.id, option);
                            }}
                            disabled={submitPrediction.isPending}
                            className={`p-2 text-sm rounded-md border transition-all text-left ${
                              selectedOptions[pool.id] === option
                                ? 'border-purple-500 bg-purple-50 text-purple-900'
                                : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                            } ${submitPrediction.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    {!pool.inline && pool.status === "open" && (
                      <Button 
                        size="sm" 
                        className="flex-1 bg-purple-700 hover:bg-purple-800 text-white"
                        data-testid={`predict-${pool.id}`}
                      >
                        {getTypeIcon(pool.type)}
                        <span className="ml-2">
                          {pool.type === "vote" ? "Vote" : 
                           pool.type === "weekly" ? "Predict" :
                           pool.type === "awards" ? "Pick Winners" :
                           pool.type === "trivia" ? "Play Trivia" :
                           "Fill Bracket"}
                        </span>
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInviteFriends(pool);
                      }}
                      data-testid={`invite-${pool.id}`}
                    >
                      <UserPlus size={16} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filter Tabs for Status */}
          <div className="flex justify-center mt-8">
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              {[
                { key: "open", label: "Open" },
                { key: "my_predictions", label: "My Votes & Predictions" },
                { key: "completed", label: "Results" }
              ].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setFilterStatus(filter.key as any)}
                  className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                    filterStatus === filter.key
                      ? 'bg-white text-gray-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-700'
                  }`}
                  data-testid={`filter-${filter.key}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {renderModal()}

      <ConsumptionTracker 
        isOpen={isTrackModalOpen} 
        onClose={() => setIsTrackModalOpen(false)} 
      />
    </div>
  );
}