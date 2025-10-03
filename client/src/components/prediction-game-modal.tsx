
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface PredictionCategory {
  category: string;
  nominees: string[];
}

interface PredictionGameModalProps {
  poolId: string;
  title: string;
  categories: PredictionCategory[];
  pointsReward: number;
  isOpen: boolean;
  onClose: () => void;
}

export function PredictionGameModal({ poolId, title, categories, pointsReward, isOpen, onClose }: PredictionGameModalProps) {
  const [currentCategory, setCurrentCategory] = useState(0);
  const [selectedNominee, setSelectedNominee] = useState<string>("");
  const [userPredictions, setUserPredictions] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const submitPrediction = useMutation({
    mutationFn: async (data: { poolId: string; prediction: string }) => {
      return await apiRequest('POST', '/api/predictions/predict', {
        pool_id: data.poolId,
        prediction: data.prediction,
        score: 0 // Points awarded later when resolved
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/predictions/user-predictions'] });
    }
  });

  const handleNext = () => {
    if (!selectedNominee) return;

    const newPredictions = [...userPredictions, selectedNominee];
    setUserPredictions(newPredictions);

    if (currentCategory < categories.length - 1) {
      setCurrentCategory(currentCategory + 1);
      setSelectedNominee("");
    } else {
      // All predictions complete
      setIsComplete(true);
      
      submitPrediction.mutate({
        poolId,
        prediction: JSON.stringify(newPredictions)
      });

      toast({
        title: "Predictions Submitted!",
        description: `You've made ${categories.length} predictions. Points will be awarded when results are announced!`,
      });
    }
  };

  const handleBack = () => {
    if (currentCategory > 0) {
      setCurrentCategory(currentCategory - 1);
      setSelectedNominee(userPredictions[currentCategory - 1] || "");
      // Remove the last prediction
      setUserPredictions(userPredictions.slice(0, -1));
    }
  };

  const progress = ((currentCategory + 1) / categories.length) * 100;
  const currentCat = categories[currentCategory];

  if (isComplete) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-lg bg-white border-gray-200 text-gray-800">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 text-center">
              <Trophy className="inline-block mr-2 text-yellow-500" size={24} />
              Predictions Submitted!
            </DialogTitle>
          </DialogHeader>

          <div className="text-center py-6">
            <CheckCircle className="mx-auto text-green-500 mb-4" size={64} />
            <div className="text-2xl font-bold text-gray-900 mb-3">
              {categories.length} Predictions Made
            </div>
            <div className="text-base text-gray-600 mb-4">
              You'll earn up to {pointsReward} points when the results are announced!
            </div>
            <div className="text-sm text-gray-500">
              Check back after the event to see your score.
            </div>
          </div>

          <div className="flex justify-center">
            <Button className="bg-purple-700 hover:bg-purple-800 text-white" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-white border-gray-200 text-gray-800">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-gray-900">{title}</DialogTitle>
          <div className="flex items-center justify-between mt-3">
            <Badge variant="outline" className="text-xs">
              Category {currentCategory + 1} of {categories.length}
            </Badge>
            <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 text-xs">
              {pointsReward} pts possible
            </Badge>
          </div>
          <Progress value={progress} className="mt-2" />
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="text-lg font-semibold text-gray-800">
            {currentCat.category}
          </div>

          <div className="space-y-2">
            {currentCat.nominees.map((nominee) => (
              <button
                key={nominee}
                onClick={() => setSelectedNominee(nominee)}
                className={`w-full p-3 text-left rounded-lg border transition-all ${
                  selectedNominee === nominee
                    ? 'border-purple-500 bg-purple-50 text-purple-900'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-800'
                }`}
                data-testid={`nominee-${nominee}`}
              >
                <div className="font-medium">{nominee}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between space-x-3 mt-4 pt-4 border-t">
          <div className="flex space-x-2">
            {currentCategory > 0 && (
              <Button variant="outline" className="text-gray-900 bg-white" onClick={handleBack}>
                Back
              </Button>
            )}
            <Button variant="outline" className="text-gray-900 bg-white" onClick={onClose}>
              Cancel
            </Button>
          </div>
          <Button 
            className="bg-purple-700 hover:bg-purple-800 text-white"
            disabled={!selectedNominee}
            onClick={handleNext}
            data-testid="next-category"
          >
            {currentCategory < categories.length - 1 ? 'Next Category' : 'Submit Predictions'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
