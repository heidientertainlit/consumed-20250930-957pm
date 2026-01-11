
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Trophy, Share2 } from "lucide-react";
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
  questions: TriviaQuestion[] | string[] | any[];
  pointsReward: number;
  isOpen: boolean;
  onClose: () => void;
  correctAnswer?: string;
}

export function TriviaGameModal({ poolId, title, questions, pointsReward, isOpen, onClose, correctAnswer }: TriviaGameModalProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [showCelebration, setShowCelebration] = useState<{ points: number } | null>(null);
  const [celebrationTimer, setCelebrationTimer] = useState<NodeJS.Timeout | null>(null);
  const [hasSharedToFeed, setHasSharedToFeed] = useState(false);
  const { toast } = useToast();
  const { session } = useAuth();
  const queryClient = useQueryClient();

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentQuestion(0);
      setSelectedAnswer("");
      setUserAnswers([]);
      setScore(0);
      setIsComplete(false);
      setShowCelebration(null);
      setHasSharedToFeed(false);
    }
  }, [isOpen]);

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

  const shareToFeed = useMutation({
    mutationFn: async (data: { title: string; score: number; total: number; points: number }) => {
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';

      const response = await fetch(`${supabaseUrl}/functions/v1/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: `Just scored ${data.score}/${data.total} on ${data.title} and earned ${data.points} points! 🎯`,
          post_type: 'trivia_score'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to share to feed: ${errorText}`);
      }

      return await response.json();
    },
    onSuccess: () => {
      setHasSharedToFeed(true);
      queryClient.invalidateQueries({ queryKey: ['/api/feed'] });
      toast({
        title: "Shared!",
        description: "Your score has been posted to your feed",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to share to feed. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Normalize questions to handle various data formats - ensure at least 1 question with at least 1 option
  // Formats:
  // 1. String array (quick trivia): ["Option A", "Option B", ...] - entire array is options for single question
  // 2. Object array (long-form): [{ question: "...", options: [...], correct: "..." }]
  const fallbackQuestion = { question: title || 'Trivia Question', options: ['No options available'], correct: '' };
  
  const normalizeQuestions = (): TriviaQuestion[] => {
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return [fallbackQuestion];
    }
    
    // Check if first element is a string - this means it's a quick trivia with string array options
    if (typeof questions[0] === 'string') {
      // String array = single question with title as question text, array as options
      return [{
        question: title || 'Trivia Question',
        options: questions as string[],
        correct: correctAnswer || '' // Use correctAnswer prop for quick trivia
      }];
    }
    
    // Object array - map each to TriviaQuestion format
    return questions.map((q: any) => ({
      question: q?.question || q?.text || title || 'Question',
      options: Array.isArray(q?.options) && q.options.length > 0 ? q.options : ['No options'],
      correct: q?.correct || q?.answer || ''
    }));
  };
  
  const safeQuestions = normalizeQuestions();
  const questionsCount = Math.max(1, safeQuestions.length);
  const progress = ((currentQuestion + 1) / questionsCount) * 100;
  const currentQ = safeQuestions[currentQuestion] || fallbackQuestion;
  const pointsPerQuestion = Math.floor(pointsReward / questionsCount);

  // Helper to get correct answer (database uses 'answer', interface expects 'correct')
  const getCorrectAnswer = (question: any): string => {
    return question?.correct || question?.answer || '';
  };

  const handleNext = () => {
    if (!selectedAnswer) return;

    // Handle both 'correct' and 'answer' field names (database uses 'answer')
    const correctAnswer = getCorrectAnswer(safeQuestions[currentQuestion]);
    const isCorrect = selectedAnswer === correctAnswer;
    const newAnswers = [...userAnswers, selectedAnswer];
    setUserAnswers(newAnswers);
    
    if (isCorrect) {
      setScore(score + 1);
    }

    if (currentQuestion < safeQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer("");
    } else {
      // Game complete
      setIsComplete(true);
      const finalScore = isCorrect ? score + 1 : score;
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
          description: `You scored ${finalScore}/${safeQuestions.length} correct.`,
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
  const totalPointsEarned = score * pointsPerQuestion;

  if (isComplete) {
    return (
      <>
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
          <DialogContent className="max-w-lg bg-white border-gray-200 text-gray-800">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-gray-900 text-center">
                <Trophy className="inline-block mr-2 text-yellow-500" size={24} />
                Trivia Complete!
              </DialogTitle>
            </DialogHeader>

            <div className="text-center py-6">
              <div className="text-5xl font-bold text-purple-600 mb-3">
                {score}/{safeQuestions.length}
              </div>
              <div className="text-xl text-gray-700 mb-2">
                {score} Correct × {pointsPerQuestion} pts each
              </div>
              <div className="text-base text-gray-600">
                Points Earned: {totalPointsEarned}
              </div>
            </div>

            <div className="flex flex-col items-center space-y-3">
              <Button
                variant="outline"
                className={`w-full max-w-xs border-purple-500 ${hasSharedToFeed ? 'bg-green-50 text-green-700 border-green-500' : 'text-purple-700 hover:bg-purple-50'}`}
                onClick={() => shareToFeed.mutate({ title, score, total: safeQuestions.length, points: totalPointsEarned })}
                disabled={hasSharedToFeed || shareToFeed.isPending}
                data-testid="button-share-to-feed"
              >
                <Share2 size={16} className="mr-2" />
                {hasSharedToFeed ? 'Shared to Feed!' : shareToFeed.isPending ? 'Sharing...' : 'Add My Score to Feed'}
              </Button>

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
                    window.location.href = '/play/trivia';
                  }}
                  data-testid="button-play-more"
                >
                  Play More Games
                </Button>
              </div>
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
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-lg bg-white border-gray-200 text-gray-800">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900">{title}</DialogTitle>
            <div className="flex items-center justify-between mt-3">
              <Badge variant="outline" className="text-xs text-gray-900 border-gray-300">
                Question {currentQuestion + 1} of {safeQuestions.length}
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
              {(currentQ.options || []).map((option, index) => (
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
              {(!currentQ.options || currentQ.options.length === 0) && (
                <p className="text-gray-500 text-center py-4">No answer options available</p>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-4 pt-4 border-t">
            <Button variant="outline" className="text-gray-900 bg-white" onClick={onClose}>Cancel</Button>
            <Button 
              className="bg-purple-700 hover:bg-purple-800 text-white"
              disabled={!selectedAnswer}
              onClick={handleNext}
            >
              {currentQuestion < safeQuestions.length - 1 ? 'Next Question' : 'Finish'}
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
