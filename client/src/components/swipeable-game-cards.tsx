import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Brain, Vote, Trophy, ChevronLeft, ChevronRight, Gamepad2, Check, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface TriviaQuestion {
  question: string;
  options: string[];
  correct: string;
}

interface Game {
  id: string;
  title: string;
  options: any[];
  type: 'vote' | 'trivia' | 'predict';
  points_reward: number;
  category?: string;
  tags?: string[];
  correct_answer?: any;
}

interface SwipeableGameCardsProps {
  className?: string;
  initialGameId?: string;
}

export default function SwipeableGameCards({ className, initialGameId }: SwipeableGameCardsProps) {
  const [currentGameIndex, setCurrentGameIndex] = useState(0);
  const [initialIndexSet, setInitialIndexSet] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedGames, setSubmittedGames] = useState<Set<string>>(new Set());
  const [triviaScore, setTriviaScore] = useState(0);
  const [triviaComplete, setTriviaComplete] = useState(false);
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

  // Filter to only show curated Consumed polls and trivia (no predictions for now)
  // MUST match GameCarousel filtering to ensure clicked games are found
  const availableGames = games.filter((game) => {
    if (userPredictions[game.id] || submittedGames.has(game.id)) return false;
    // Ensure game has required fields
    if (!game.id || !game.title || !game.type) return false;
    // Only show Consumed polls and trivia (exclude predictions for now)
    if (game.type === 'predict') return false;
    // Include Consumed platform content (consumed-*) and legacy trivia (trivia-*)
    const isConsumedContent = game.id.startsWith('consumed-') || game.id.startsWith('trivia-');
    if (!isConsumedContent) return false;
    // Ensure options exist for vote types
    if (game.type === 'vote' && (!game.options || game.options.length < 2)) return false;
    return true;
  });

  // Jump to the selected game when initialGameId is provided
  if (initialGameId && !initialIndexSet && availableGames.length > 0) {
    const targetIndex = availableGames.findIndex(g => g.id === initialGameId);
    if (targetIndex !== -1 && targetIndex !== currentGameIndex) {
      setCurrentGameIndex(targetIndex);
    }
    setInitialIndexSet(true);
  }

  const submitAnswer = useMutation({
    mutationFn: async ({ poolId, answer, score, game }: { poolId: string; answer: string; score?: number; game: Game }) => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Must be logged in');
      }

      const pointsEarned = score ?? game.points_reward;

      const { error } = await supabase
        .from('user_predictions')
        .insert({
          user_id: user.id,
          pool_id: poolId,
          prediction: answer,
          points_earned: pointsEarned,
          created_at: new Date().toISOString()
        });

      if (error) {
        if (error.code === '23505') {
          throw new Error('Already submitted');
        }
        throw new Error('Failed to submit');
      }

      return { success: true, points: pointsEarned };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['feed-user-predictions'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit. Try again.",
        variant: "destructive",
      });
    },
  });

  const currentGame = availableGames[currentGameIndex];

  // Safety: if currentGameIndex is out of bounds, reset to 0
  if (!currentGame && availableGames.length > 0 && currentGameIndex !== 0) {
    setCurrentGameIndex(0);
  }

  // For trivia games, get the current question from the nested structure
  const getCurrentTriviaQuestion = (): TriviaQuestion | null => {
    if (!currentGame || currentGame.type !== 'trivia') return null;
    if (!Array.isArray(currentGame.options)) return null;
    const questions = currentGame.options;
    if (questions.length === 0 || currentQuestionIndex >= questions.length) return null;
    const q = questions[currentQuestionIndex];
    if (q && typeof q === 'object' && 'question' in q && 'options' in q && 'correct' in q) {
      return q as TriviaQuestion;
    }
    return null;
  };

  const triviaQuestion = getCurrentTriviaQuestion();
  const totalTriviaQuestions = currentGame?.type === 'trivia' && Array.isArray(currentGame.options) 
    ? currentGame.options.length 
    : 0;

  const handlePrevGame = () => {
    setSelectedAnswer(null);
    setCurrentQuestionIndex(0);
    setTriviaScore(0);
    setTriviaComplete(false);
    setCurrentGameIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextGame = () => {
    setSelectedAnswer(null);
    setCurrentQuestionIndex(0);
    setTriviaScore(0);
    setTriviaComplete(false);
    setCurrentGameIndex((prev) => Math.min(availableGames.length - 1, prev + 1));
  };

  const handleTriviaAnswer = async () => {
    if (!currentGame || !triviaQuestion || !selectedAnswer) return;
    
    const isCorrect = selectedAnswer === triviaQuestion.correct;
    const pointsPerQuestion = Math.floor(currentGame.points_reward / totalTriviaQuestions);
    const earnedPoints = isCorrect ? pointsPerQuestion : 0;
    
    // Update score
    const newScore = isCorrect ? triviaScore + earnedPoints : triviaScore;
    if (isCorrect) {
      setTriviaScore(newScore);
    }
    
    // Show toast feedback
    toast({
      title: isCorrect ? "✓ Correct!" : "✗ Wrong",
      description: isCorrect 
        ? `+${earnedPoints} points` 
        : `Answer: ${triviaQuestion.correct}`,
      duration: 2000,
    });
    
    // Immediately go to next question
    setSelectedAnswer(null);
    
    if (currentQuestionIndex < totalTriviaQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // Trivia complete - submit final score
      setTriviaComplete(true);
      setIsSubmitting(true);
      try {
        await submitAnswer.mutateAsync({
          poolId: currentGame.id,
          answer: `Completed with score: ${newScore}`,
          score: newScore,
          game: currentGame,
        });
        setSubmittedGames(prev => new Set([...prev, currentGame.id]));
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleVoteSubmit = async () => {
    if (!currentGame || !selectedAnswer) return;
    
    setIsSubmitting(true);
    try {
      await submitAnswer.mutateAsync({
        poolId: currentGame.id,
        answer: selectedAnswer,
        game: currentGame,
      });
      setSubmittedGames(prev => new Set([...prev, currentGame.id]));
      toast({
        title: "Vote submitted!",
        description: `+${currentGame.points_reward} points`,
      });
      // Move to next game
      handleNextGame();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishTrivia = () => {
    setTriviaComplete(false);
    setTriviaScore(0);
    setCurrentQuestionIndex(0);
    handleNextGame();
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

  // Get next trivia game title for display
  const getNextTriviaTitle = () => {
    for (let i = currentGameIndex + 1; i < availableGames.length; i++) {
      if (availableGames[i].type === 'trivia') {
        return availableGames[i].title;
      }
    }
    return null;
  };
  
  const nextTriviaTitle = getNextTriviaTitle();

  // Trivia complete screen
  if (triviaComplete) {
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
              <span className="text-white text-sm font-semibold">Play</span>
            </div>
            <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
              <Icon size={12} className="mr-1" />
              Complete!
            </Badge>
          </div>
        </div>
        
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Trophy className="text-yellow-500" size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Trivia Complete!</h3>
          <p className="text-sm text-gray-500 mb-3">{currentGame.title}</p>
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-3 mb-4">
            <p className="text-2xl font-bold text-orange-600">{triviaScore}</p>
            <p className="text-xs text-gray-500">points earned</p>
          </div>
          
          <div className="space-y-2">
            {nextTriviaTitle ? (
              <Button
                onClick={handleFinishTrivia}
                className="w-full bg-purple-600 hover:bg-purple-700"
                data-testid="button-next-trivia"
              >
                <ChevronRight size={16} className="mr-1" />
                Play: {nextTriviaTitle}
              </Button>
            ) : currentGameIndex < availableGames.length - 1 ? (
              <Button
                onClick={handleFinishTrivia}
                className="w-full bg-purple-600 hover:bg-purple-700"
                data-testid="button-next-game"
              >
                <ChevronRight size={16} className="mr-1" />
                Next Game
              </Button>
            ) : null}
            
            <a 
              href="/play" 
              className="block w-full text-center py-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
              data-testid="link-find-more-trivia"
            >
              Find more trivia →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={cn("bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden", className)}
      data-testid="swipeable-game-card"
    >
      {/* Header */}
      <div className={cn("bg-gradient-to-r p-3", getGradient(currentGame.type))}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gamepad2 className="text-white" size={18} />
            <span className="text-white text-sm font-semibold">Play</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
              <Icon size={12} className="mr-1" />
              {getGameLabel(currentGame.type)}
            </Badge>
            <span className="text-white/80 text-xs">
              {currentGameIndex + 1}/{availableGames.length}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* TRIVIA TYPE */}
        {currentGame.type === 'trivia' && triviaQuestion && (
          <>
            {/* Game title - prominent */}
            <h2 className="text-xl font-bold text-gray-900 mb-2">{currentGame.title}</h2>
            
            {/* Category and tags pills */}
            {(currentGame.category || (currentGame.tags && currentGame.tags.length > 0)) && (
              <div className="flex flex-wrap gap-2 mb-3">
                {currentGame.category && (
                  <Badge className="bg-purple-100 text-purple-700 border-0 text-xs px-3 py-1">
                    {currentGame.category}
                  </Badge>
                )}
                {currentGame.tags?.map((tag: string, idx: number) => (
                  <Badge key={idx} className="bg-blue-100 text-blue-700 border-0 text-xs px-3 py-1">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Progress bar for trivia */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Question {currentQuestionIndex + 1} of {totalTriviaQuestions}</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-300"
                  style={{ width: `${((currentQuestionIndex + 1) / totalTriviaQuestions) * 100}%` }}
                />
              </div>
            </div>

            <p className="text-sm text-gray-700 mb-4 leading-snug">
              {triviaQuestion.question}
            </p>

            <div className="space-y-2 mb-4">
              {triviaQuestion.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedAnswer(option)}
                  disabled={isSubmitting}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm",
                    selectedAnswer === option
                      ? "border-purple-500 bg-purple-50 text-purple-700"
                      : "border-gray-200 hover:border-gray-300 bg-white text-gray-700"
                  )}
                  data-testid={`option-${idx}`}
                >
                  <div className="flex items-center justify-between">
                    <span>{option}</span>
                    {selectedAnswer === option && (
                      <Check size={16} className="text-purple-600" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Star size={12} className="text-yellow-500 fill-yellow-500" />
                <span>Score: {triviaScore} pts</span>
              </div>
              
              <Button
                onClick={handleTriviaAnswer}
                disabled={!selectedAnswer || isSubmitting}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-submit-answer"
              >
                Submit
              </Button>
            </div>
            
            {/* Skip options */}
            <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-gray-100">
              {currentGameIndex < availableGames.length - 1 && (
                <button
                  onClick={handleNextGame}
                  className="text-xs text-gray-500 hover:text-purple-600"
                  data-testid="button-skip-game"
                >
                  Skip to next game
                </button>
              )}
              <a
                href="/play"
                className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                data-testid="link-find-games"
              >
                Find more games
              </a>
            </div>
          </>
        )}

        {/* VOTE/POLL TYPE */}
        {currentGame.type === 'vote' && (
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
                <span>{currentGame.points_reward} pts</span>
              </div>
              
              <Button
                onClick={handleVoteSubmit}
                disabled={!selectedAnswer || isSubmitting}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-submit-vote"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </Button>
            </div>
          </>
        )}

        {/* PREDICT TYPE */}
        {currentGame.type === 'predict' && (
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
                <span>Up to {currentGame.points_reward} pts</span>
              </div>
              
              <Button
                onClick={handleVoteSubmit}
                disabled={!selectedAnswer || isSubmitting}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-submit-prediction"
              >
                {isSubmitting ? 'Submitting...' : 'Predict'}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Navigation footer - only show when not in trivia question mode or showing result */}
      {availableGames.length > 1 && currentGame.type !== 'trivia' && (
        <div className="flex items-center justify-between px-4 pb-3 pt-0 border-t border-gray-100">
          <button
            onClick={handlePrevGame}
            disabled={currentGameIndex === 0}
            className={cn(
              "flex items-center gap-1 text-sm py-2",
              currentGameIndex === 0 ? "text-gray-300" : "text-gray-600 hover:text-purple-600"
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
                  idx === currentGameIndex ? "bg-purple-600 w-3" : "bg-gray-300"
                )}
              />
            ))}
            {availableGames.length > 5 && (
              <span className="text-xs text-gray-400 ml-1">+{availableGames.length - 5}</span>
            )}
          </div>
          
          <button
            onClick={handleNextGame}
            disabled={currentGameIndex === availableGames.length - 1}
            className={cn(
              "flex items-center gap-1 text-sm py-2",
              currentGameIndex === availableGames.length - 1 ? "text-gray-300" : "text-gray-600 hover:text-purple-600"
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
