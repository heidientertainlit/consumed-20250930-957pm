import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { X, Clock } from "lucide-react";
import { Pool } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

interface PoolDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  pool: Pool | null;
  onJoinWithPrediction: (pool: Pool, prediction: string) => void;
}

export default function PoolDetailModal({ isOpen, onClose, pool, onJoinWithPrediction }: PoolDetailModalProps) {
  const [selectedPrediction, setSelectedPrediction] = useState("");

  const { data: predictions } = useQuery({
    queryKey: ["/api/pools", pool?.id, "predictions"],
    enabled: !!pool?.id,
  });

  if (!pool) return null;

  const getTimeLeft = (endDate: Date) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return "Ended";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "movies": return "bg-red-500";
      case "tv": return "bg-blue-500";
      case "books": return "bg-green-600";
      case "pop-culture": return "bg-purple-600";
      default: return "bg-gray-500";
    }
  };

  const getPredictionStats = () => {
    if (!predictions || predictions.length === 0) {
      return pool.options.map((option: string) => ({
        option,
        count: 0,
        percentage: 0
      }));
    }

    const stats = pool.options.map((option: string) => {
      const count = predictions.filter((p: any) => p.prediction === option).length;
      const percentage = predictions.length > 0 ? Math.round((count / predictions.length) * 100) : 0;
      return { option, count, percentage };
    });

    return stats;
  };

  const getOptionColor = (index: number) => {
    const colors = ["bg-green-500", "bg-red-500", "bg-blue-500", "bg-yellow-500"];
    return colors[index % colors.length];
  };

  const handleJoin = () => {
    if (selectedPrediction) {
      onJoinWithPrediction(pool, selectedPrediction);
    }
  };

  const predictionStats = getPredictionStats();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-dark-secondary border-dark-accent max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className={`${getCategoryColor(pool.category)} text-xs px-2 py-1 rounded-full font-medium mb-2 inline-block uppercase`}>
                {pool.category}
              </span>
              <h2 className="text-2xl font-bold">{pool.title}</h2>
              <p className="text-gray-400 mt-2">{pool.description}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pool Info */}
            <div className="lg:col-span-2">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-dark-primary rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gold-accent">{pool.totalPoints?.toLocaleString()} pts</div>
                  <div className="text-sm text-gray-400">Prize Pool</div>
                </div>
                <div className="bg-dark-primary rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold">{pool.participantCount}</div>
                  <div className="text-sm text-gray-400">Players</div>
                </div>
                <div className="bg-dark-primary rounded-lg p-4 text-center">
                  <div className="text-lg font-bold text-red-400">{getTimeLeft(pool.endDate)}</div>
                  <div className="text-sm text-gray-400">Time Left</div>
                </div>
              </div>

              {/* Current Predictions */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">Current Predictions</h3>
                <div className="space-y-3">
                  {predictionStats.map((stat, index) => (
                    <div key={stat.option} className="bg-dark-primary rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center space-x-3">
                          <div className={`w-4 h-4 ${getOptionColor(index)} rounded-full`}></div>
                          <span className="font-medium">{stat.option}</span>
                        </div>
                        <span className="text-lg font-bold">{stat.percentage}%</span>
                      </div>
                      <div className="w-full bg-dark-accent rounded-full h-2">
                        <div 
                          className={`${getOptionColor(index)} h-2 rounded-full transition-all duration-300`}
                          style={{ width: `${stat.percentage}%` }}
                        ></div>
                      </div>
                      <div className="text-sm text-gray-400 mt-1">{stat.count} players</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Make Prediction */}
            <div className="lg:col-span-1">
              <div className="bg-dark-primary rounded-lg p-6 sticky top-6">
                <h3 className="text-lg font-semibold mb-4">Make Your Prediction</h3>
                
                <RadioGroup value={selectedPrediction} onValueChange={setSelectedPrediction} className="space-y-3 mb-6">
                  {pool.options.map((option: string, index: number) => (
                    <div key={option}>
                      <RadioGroupItem value={option} id={option} className="sr-only" />
                      <Label 
                        htmlFor={option}
                        className={`block cursor-pointer border-2 border-dark-accent rounded-lg p-4 hover:border-purple-primary transition-colors ${
                          selectedPrediction === option ? 'border-purple-primary bg-purple-primary/10' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-4 h-4 ${getOptionColor(index)} rounded-full`}></div>
                            <span className="font-medium">{option}</span>
                          </div>
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>

                {/* Entry Cost Display */}
                <div className="bg-dark-secondary border border-dark-accent rounded-lg p-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Entry Cost:</span>
                    <span className="text-xl font-bold text-purple-primary">100 pts</span>
                  </div>
                </div>

                {/* Join Button */}
                <Button 
                  onClick={handleJoin}
                  disabled={!selectedPrediction}
                  className="w-full gradient-primary font-medium hover:opacity-90 transition-opacity mb-3"
                >
                  Join Pool (100 pts)
                </Button>
                
                <div className="text-xs text-gray-400 text-center">
                  By joining, you agree to our{" "}
                  <a href="#" className="text-purple-primary hover:underline">Terms of Service</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
