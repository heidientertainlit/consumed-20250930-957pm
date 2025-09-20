import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import { Pool } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  pool: Pool | null;
  prediction: string;
  onSuccess: () => void;
}

export default function PaymentModal({ isOpen, onClose, pool, prediction, onSuccess }: PaymentModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const joinPoolMutation = useMutation({
    mutationFn: async () => {
      // Create the prediction with points
      return apiRequest("POST", "/api/predictions", {
        poolId: pool?.id,
        prediction,
        pointsSpent: 100
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pools/featured"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pools", pool?.id, "predictions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/user-1"] });
      
      toast({
        title: "Success!",
        description: "Your prediction has been recorded! Good luck!",
      });
      
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Join Pool",
        description: error.message || "There was an error joining the pool.",
        variant: "destructive",
      });
    },
  });

  const handleConfirm = () => {
    joinPoolMutation.mutate();
  };

  if (!pool) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-dark-secondary border-dark-accent max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy className="text-2xl text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Join Pool</h2>
          <p className="text-gray-400">Confirm your prediction entry</p>
        </div>

        {/* Pool Summary */}
        <div className="bg-dark-primary rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">Pool:</span>
            <span className="font-medium">{pool.title.substring(0, 20)}...</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">Your Prediction:</span>
            <span className="font-medium text-green-400">{prediction}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Entry Cost:</span>
            <span className="text-xl font-bold text-purple-primary">100 pts</span>
          </div>
        </div>

        {/* Points Info */}
        <div className="bg-gradient-to-r from-purple-primary/10 to-pink-primary/10 border border-purple-primary/20 rounded-lg p-4 mb-6">
          <div className="text-sm text-gray-300 text-center">
            <div className="font-medium mb-1">🎯 How it works</div>
            <div className="text-xs">
              Use points to join pools and make predictions. Win more points by making correct predictions!
            </div>
          </div>
        </div>

        <div className="flex space-x-4">
          <Button 
            variant="outline"
            onClick={onClose}
            className="flex-1 bg-dark-accent border-dark-accent hover:border-gray-600"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={joinPoolMutation.isPending}
            className="flex-1 gradient-primary hover:opacity-90"
          >
            {joinPoolMutation.isPending ? "Joining..." : "Confirm (100 pts)"}
          </Button>
        </div>

        {/* Points Purchase Link */}
        <div className="text-center mt-4">
          <p className="text-xs text-gray-400">
            Need more points?{" "}
            <button className="text-purple-primary hover:underline">
              Purchase points
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
