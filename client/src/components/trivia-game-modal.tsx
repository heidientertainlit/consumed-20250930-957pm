
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const submitPrediction = useMutation({
    mutationFn: async (data: { poolId: string; prediction: string; score: number }) => {
      return await apiRequest('/api/predictions/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pool_id: data.poolId,
          prediction: data.prediction,
          score: data.score
        })
      });
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
      const percentage = Math.round((finalScore / questions.length) * 100);
      
      submitPrediction.mutate({
        poolId,
        prediction: JSON.stringify(newAnswers),
        score: finalScore
      });

      toast({
        title: "Trivia Complete!",
        description: `You scored ${finalScore}/${questions.length} (${percentage}%) and earned ${Math.round(pointsReward * (percentage / 100))} points!`,
      });
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

  if (isComplete) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl bg-white border-gray-200 text-gray-800">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 text-center">
              <Trophy className="inline-block mr-2 text-yellow-500" size={32} />
              Trivia Complete!
            </DialogTitle>
          </DialogHeader>

          <div className="text-center py-8">
            <div className="text-6xl font-bold text-purple-600 mb-4">
              {score}/{questions.length}
            </div>
            <div className="text-2xl text-gray-700 mb-2">
              {percentage}% Correct
            </div>
            <div className="text-lg text-gray-600">
              Points Earned: {Math.round(pointsReward * (percentage / 100))}
            </div>
          </div>

          <div className="flex justify-center space-x-3">
            <Button variant="outline" onClick={handleRestart}>
              Try Again
            </Button>
            <Button className="bg-purple-700 hover:bg-purple-800" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white border-gray-200 text-gray-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">{title}</DialogTitle>
          <div className="flex items-center justify-between mt-4">
            <Badge variant="outline" className="text-sm">
              Question {currentQuestion + 1} of {questions.length}
            </Badge>
            <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
              Score: {score}/{currentQuestion}
            </Badge>
          </div>
          <Progress value={progress} className="mt-2" />
        </DialogHeader>

        <div className="space-y-6 mt-6">
          <div className="text-xl font-semibold text-gray-800">
            {currentQ.question}
          </div>

          <div className="space-y-3">
            {currentQ.options.map((option) => (
              <button
                key={option}
                onClick={() => setSelectedAnswer(option)}
                className={`w-full p-4 text-left rounded-lg border transition-all ${
                  selectedAnswer === option
                    ? 'border-purple-500 bg-purple-50 text-purple-900'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium text-gray-800">{option}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            className="bg-purple-700 hover:bg-purple-800"
            disabled={!selectedAnswer}
            onClick={handleNext}
          >
            {currentQuestion < questions.length - 1 ? 'Next Question' : 'Finish'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
