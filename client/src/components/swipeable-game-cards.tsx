import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Brain, Vote, Trophy, ChevronLeft, ChevronRight, Gamepad2, Check, Star, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Game {
  id: string;
  title: string;
  options: any[];
  type: 'vote' | 'trivia' | 'predict';
  points_reward: number;
  category?: string;
  correct_answer?: any;
}

interface SwipeableGameCardsProps {
  className?: string;
}

export default function SwipeableGameCards({ className }: SwipeableGameCardsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedGames, setSubmittedGames] = useState<Set<string>>(new Set());
  const [showResult, setShowResult] = useState<{ correct: boolean; points: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: games = [], isLoading } = useQuery({
    queryKey: ['feed-games'],
    queryFn: async () => {
      const { data: pools, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw new Error('Failed to fetch games');
      return (pools || []) as Game[];
    },
  });

  const { data: userPredictions = {} } = useQuery({
    queryKey: ['feed-user-predictions'],
    queryFn: async () => {
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

  const availableGames = games.filter(
    (game) => !userPredictions[game.id] && !submittedGames.has(game.id)
  );

  const submitAnswer = useMutation({
    mutationFn: async ({ poolId, answer, game }: { poolId: string; answer: string; game: Game }) => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Must be logged in');
      }

      const gameType = game.type;
      let immediatePoints = 0;
      let isCorrect = false;

      if (gameType === 'trivia' && game.correct_answer) {
        const correctAnswerText = typeof game.correct_answer === 'string' 
          ? game.correct_answer 
          : (game.correct_answer?.label || game.correct_answer?.text || game.correct_answer?.option || '');
        isCorrect = answer === correctAnswerText;
        immediatePoints = isCorrect ? game.points_reward : 0;
      } else if (gameType === 'vote') {
        immediatePoints = game.points_reward;
      }

      const { error } = await supabase
        .from('user_predictions')
        .insert({
          user_id: user.id,
          pool_id: poolId,
          prediction: answer,
          points_earned: immediatePoints,
          created_at: new Date().toISOString()
        });

      if (error) {
        if (error.code === '23505') {
          throw new Error('Already submitted');
        }
        throw new Error('Failed to submit');
      }

      return { success: true, points: immediatePoints, isCorrect, gameType };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['feed-user-predictions'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      
      if (data.gameType === 'trivia') {
        setShowResult({ correct: data.isCorrect, points: data.points });
      } else if (data.gameType === 'vote') {
        toast({
          title: "Vote submitted!",
          description: `+${data.points} points`,
        });
      } else {
        toast({
          title: "Prediction submitted!",
          description: "Points will be awarded when the result is known.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit. Try again.",
        variant: "destructive",
      });
    },
  });

  const currentGame = availableGames[currentIndex];

  const handlePrev = () => {
    setSelectedAnswer(null);
    setShowResult(null);
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setShowResult(null);
    setCurrentIndex((prev) => Math.min(availableGames.length - 1, prev + 1));
  };

  const handleSubmit = async () => {
    if (!currentGame || !selectedAnswer) return;
    
    setIsSubmitting(true);
    try {
      await submitAnswer.mutateAsync({
        poolId: currentGame.id,
        answer: selectedAnswer,
        game: currentGame,
      });
      setSubmittedGames(prev => new Set([...prev, currentGame.id]));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinue = () => {
    setSelectedAnswer(null);
    setShowResult(null);
    if (currentIndex < availableGames.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const getGameIcon = (type: string) => {
    switch (type) {
      case 'trivia': return Brain;
      case 'vote': return Vote;
      case 'predict': return Trophy;
      default: return Gamepad2;
    }
  };

  const getGameLabel = (type: string) => {
    switch (type) {
      case 'trivia': return 'Trivia';
      case 'vote': return 'Poll';
      case 'predict': return 'Prediction';
      default: return 'Game';
    }
  };

  const getGradient = (type: string) => {
    switch (type) {
      case 'trivia': return 'from-yellow-500 to-orange-500';
      case 'vote': return 'from-blue-500 to-cyan-500';
      case 'predict': return 'from-green-500 to-emerald-500';
      default: return 'from-purple-500 to-pink-500';
    }
  };

  if (isLoading) {
    return (
      <div className={cn("bg-white rounded-2xl border border-gray-200 shadow-sm p-6", className)}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-6 bg-gray-200 rounded w-3/4 mb-4" />
          <div className="space-y-2">
            <div className="h-10 bg-gray-200 rounded" />
            <div className="h-10 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (availableGames.length === 0) {
    return null;
  }

  const Icon = getGameIcon(currentGame.type);

  return (
    <div 
      ref={containerRef}
      className={cn("bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden", className)}
      data-testid="swipeable-game-card"
    >
      <div className={cn("bg-gradient-to-r p-3", getGradient(currentGame.type))}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gamepad2 className="text-white" size={18} />
            <span className="text-white text-sm font-semibold">Quick Play</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
              <Icon size={12} className="mr-1" />
              {getGameLabel(currentGame.type)}
            </Badge>
            <span className="text-white/80 text-xs">
              {currentIndex + 1}/{availableGames.length}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4">
        {showResult ? (
          <div className="text-center py-4">
            {showResult.correct ? (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="text-green-600" size={32} />
                </div>
                <p className="text-lg font-bold text-green-600 mb-1">Correct!</p>
                <p className="text-sm text-gray-600">+{showResult.points} points</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">😅</span>
                </div>
                <p className="text-lg font-bold text-red-600 mb-1">Not quite!</p>
                <p className="text-sm text-gray-600">The answer was: {
                  typeof currentGame.correct_answer === 'string' 
                    ? currentGame.correct_answer 
                    : (currentGame.correct_answer?.label || currentGame.correct_answer?.text || 'See the correct answer')
                }</p>
              </>
            )}
            <Button
              onClick={handleContinue}
              className="mt-4 bg-purple-600 hover:bg-purple-700"
              data-testid="button-continue-game"
            >
              {currentIndex < availableGames.length - 1 ? 'Next Game' : 'Done'}
            </Button>
          </div>
        ) : (
          <>
            <p className="text-base font-medium text-gray-900 mb-4 leading-snug">
              {currentGame.title}
            </p>

            <div className="space-y-2 mb-4">
              {currentGame.options.map((option: any, idx: number) => {
                const optionText = typeof option === 'string' ? option : (option.label || option.text || option.option || String(option));
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedAnswer(optionText)}
                    disabled={isSubmitting}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm",
                      selectedAnswer === optionText
                        ? "border-purple-500 bg-purple-50 text-purple-700"
                        : "border-gray-200 hover:border-gray-300 bg-white text-gray-700"
                    )}
                    data-testid={`option-${idx}`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{optionText}</span>
                      {selectedAnswer === optionText && (
                        <Check size={16} className="text-purple-600" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Star size={12} className="text-yellow-500 fill-yellow-500" />
                <span>
                  {currentGame.type === 'predict' 
                    ? `Up to ${currentGame.points_reward} pts` 
                    : `${currentGame.points_reward} pts`}
                </span>
              </div>
              
              <Button
                onClick={handleSubmit}
                disabled={!selectedAnswer || isSubmitting}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-submit-answer"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </Button>
            </div>
          </>
        )}
      </div>

      {availableGames.length > 1 && !showResult && (
        <div className="flex items-center justify-between px-4 pb-3 pt-0 border-t border-gray-100">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className={cn(
              "flex items-center gap-1 text-sm py-2",
              currentIndex === 0 ? "text-gray-300" : "text-gray-600 hover:text-purple-600"
            )}
            data-testid="button-prev-game"
          >
            <ChevronLeft size={16} />
            Prev
          </button>
          
          <div className="flex gap-1">
            {availableGames.slice(0, 5).map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all",
                  idx === currentIndex ? "bg-purple-600 w-3" : "bg-gray-300"
                )}
              />
            ))}
            {availableGames.length > 5 && (
              <span className="text-xs text-gray-400 ml-1">+{availableGames.length - 5}</span>
            )}
          </div>
          
          <button
            onClick={handleNext}
            disabled={currentIndex === availableGames.length - 1}
            className={cn(
              "flex items-center gap-1 text-sm py-2",
              currentIndex === availableGames.length - 1 ? "text-gray-300" : "text-gray-600 hover:text-purple-600"
            )}
            data-testid="button-next-game"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
