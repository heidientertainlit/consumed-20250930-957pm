
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import CelebrationModal from './celebration-modal';

interface TriviaQuestion {
  question: string;
  options: string[];
  correct: string;
}

interface TriviaGameModalProps {
  poolId: string;
  title: string;
  questions: TriviaQuestion[];
  pointsReward: number;
  isOpen: boolean;
  onClose: () => void;
}

export function TriviaGameModal({ poolId, title, questions, pointsReward, isOpen, onClose }: TriviaGameModalProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [showCelebration, setShowCelebration] = useState<{ points: number } | null>(null);
  const [celebrationTimer, setCelebrationTimer] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const { session } = useAuth();
  const queryClient = useQueryClient();

  // Cleanup celebration timer on unmount
  useEffect(() => {
    return () => {
      if (celebrationTimer) {
        clearTimeout(celebrationTimer);
      }
    };
  }, [celebrationTimer]);

  const submitPrediction = useMutation({
    mutationFn: async (data: { poolId: string; prediction: string; score: number }) => {
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';

      const response = await fetch(`${supabaseUrl}/functions/v1/predictions/predict`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pool_id: data.poolId,
          prediction: data.prediction,
          score: data.score
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to submit trivia answer: ${errorText}`);
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/predictions/pools'] });
    }
  });

  const handleNext = () => {
    if (!selectedAnswer) return;

    const isCorrect = selectedAnswer === questions[currentQuestion].correct;
    const newAnswers = [...userAnswers, selectedAnswer];
    setUserAnswers(newAnswers);
    
    if (isCorrect) {
      setScore(score + 1);
    }

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer("");
    } else {
      // Game complete
      setIsComplete(true);
      const finalScore = isCorrect ? score + 1 : score;
      const pointsPerQuestion = Math.floor(pointsReward / questions.length);
      const totalPointsEarned = finalScore * pointsPerQuestion;
      
      submitPrediction.mutate({
        poolId,
        prediction: JSON.stringify(newAnswers),
        score: totalPointsEarned
      });

      // Show celebration if they earned points (got at least one question right)
      if (totalPointsEarned > 0) {
        setShowCelebration({ points: totalPointsEarned });
        // Auto-hide celebration after 3 seconds
        const timer = setTimeout(() => {
          setShowCelebration(null);
        }, 3000);
        setCelebrationTimer(timer);
      } else {
        toast({
          title: "Trivia Complete!",
          description: `You scored ${finalScore}/${questions.length} correct.`,
        });
      }
    }
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setSelectedAnswer("");
    setUserAnswers([]);
    setScore(0);
    setIsComplete(false);
  };

  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const currentQ = questions[currentQuestion];

  const pointsPerQuestion = Math.floor(pointsReward / questions.length);
  const totalPointsEarned = score * pointsPerQuestion;

  if (isComplete) {
    return (
      <>
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="max-w-lg bg-white border-gray-200 text-gray-800">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-gray-900 text-center">
                <Trophy className="inline-block mr-2 text-yellow-500" size={24} />
                Trivia Complete!
              </DialogTitle>
            </DialogHeader>

            <div className="text-center py-6">
              <div className="text-5xl font-bold text-purple-600 mb-3">
                {score}/{questions.length}
              </div>
              <div className="text-xl text-gray-700 mb-2">
                {score} Correct × {pointsPerQuestion} pts each
              </div>
              <div className="text-base text-gray-600">
                Points Earned: {totalPointsEarned}
              </div>
            </div>

            <div className="flex justify-center space-x-3">
              <Button 
                variant="outline" 
                className="text-gray-900 bg-white hover:bg-gray-50 border-purple-500" 
                onClick={() => {
                  onClose();
                  window.location.href = `/leaderboard?category=trivia_leader&challenge=${poolId}`;
                }}
                data-testid="button-view-leaderboard"
              >
                View Leaderboard
              </Button>
              <Button 
                className="bg-purple-600 hover:bg-purple-700 text-white" 
                onClick={() => {
                  onClose();
                  window.location.href = '/play';
                }}
                data-testid="button-play-more"
              >
                Play More Games
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Celebration Modal - must be outside the Dialog */}
        {showCelebration && (
          <CelebrationModal
            points={showCelebration.points}
            onClose={() => setShowCelebration(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg bg-white border-gray-200 text-gray-800" onEscapeKeyDown={onClose} onInteractOutside={onClose}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">{title}</DialogTitle>
            <div className="flex items-center justify-between mt-3">
              <Badge variant="outline" className="text-xs text-gray-900 border-gray-300">
                Question {currentQuestion + 1} of {questions.length}
              </Badge>
              <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 text-xs">
                Score: {score}/{currentQuestion}
              </Badge>
            </div>
            <Progress value={progress} className="mt-2" />
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="text-lg font-semibold text-gray-800">
              {currentQ.question}
            </div>

            <div className="space-y-2">
              {currentQ.options.map((option, index) => (
                <button
                  key={`${currentQuestion}-${index}`}
                  onClick={() => setSelectedAnswer(option)}
                  className={`w-full p-3 text-left rounded-lg border transition-all ${
                    selectedAnswer === option
                      ? 'border-purple-500 bg-purple-50 text-purple-900'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-800'
                  }`}
                >
                  <div className="font-medium">{option}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-4 pt-4 border-t">
            <Button variant="outline" className="text-gray-900 bg-white" onClick={onClose}>Cancel</Button>
            <Button 
              className="bg-purple-700 hover:bg-purple-800 text-white"
              disabled={!selectedAnswer}
              onClick={handleNext}
            >
              {currentQuestion < questions.length - 1 ? 'Next Question' : 'Finish'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Celebration Modal for Correct Answers */}
      {showCelebration && (
        <CelebrationModal
          points={showCelebration.points}
          onClose={() => setShowCelebration(null)}
        />
      )}
    </>
  );
}
