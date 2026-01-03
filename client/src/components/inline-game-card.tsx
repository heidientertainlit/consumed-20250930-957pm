import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Brain, Vote, Sparkles, ArrowRight, Trophy, Zap, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';

interface TriviaQuestion {
  question: string;
  options: string[];
  correct: string;
  answer?: string;
}

interface Game {
  id: string;
  title: string;
  description?: string;
  options: any[];
  type: 'vote' | 'trivia' | 'predict';
  points_reward: number;
  category?: string;
  tags?: string[];
}

interface InlineGameCardProps {
  className?: string;
  gameIndex?: number;
  gameType?: 'vote' | 'trivia' | 'all'; // Filter to show only polls, only trivia, or both (alternating)
}

export default function InlineGameCard({ className, gameIndex = 0, gameType = 'all' }: InlineGameCardProps) {
  const [currentGameOffset, setCurrentGameOffset] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedGames, setSubmittedGames] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);
  const [lastEarnedPoints, setLastEarnedPoints] = useState(0);
  const [triviaQuestionIndex, setTriviaQuestionIndex] = useState(0);
  const [triviaScore, setTriviaScore] = useState(0);
  const [triviaComplete, setTriviaComplete] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: games = [], isLoading } = useQuery({
    queryKey: ['inline-games', gameType],
    queryFn: async () => {
      const { data: pools, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error('Failed to fetch games');
      return (pools || []).filter((game: any) => {
        if (!game.id || !game.title || !game.type) return false;
        if (game.type === 'predict') return false;
        // Include Consumed platform content (consumed-*) and legacy trivia (trivia-*)
        const isConsumedContent = game.id.startsWith('consumed-') || game.id.startsWith('trivia-');
        if (!isConsumedContent) return false;
        // Filter by gameType if specified
        if (gameType !== 'all' && game.type !== gameType) return false;
        return true;
      }) as Game[];
    },
  });

  const { data: userPredictions = {} } = useQuery({
    queryKey: ['inline-user-predictions'],
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

  const availableGames = games.filter((game) => {
    if (userPredictions[game.id] || submittedGames.has(game.id)) return false;
    if (game.type === 'vote' && (!game.options || game.options.length < 2)) return false;
    return true;
  });

  // When gameType is specified, use simple index-based navigation
  // When 'all', alternate between polls and trivia
  let currentGame: Game | undefined;
  if (gameType !== 'all') {
    // Simple: just use offset to navigate through filtered games
    const effectiveIndex = currentGameOffset % Math.max(availableGames.length, 1);
    currentGame = availableGames[effectiveIndex];
  } else {
    // Legacy alternating behavior
    const polls = availableGames.filter(g => g.type === 'vote');
    const trivia = availableGames.filter(g => g.type === 'trivia');
    const shouldShowTrivia = (gameIndex + currentGameOffset) % 2 === 1;
    const targetList = shouldShowTrivia ? trivia : polls;
    const fallbackList = shouldShowTrivia ? polls : trivia;
    const activeList = targetList.length > 0 ? targetList : fallbackList;
    const effectiveIndex = Math.floor((gameIndex + currentGameOffset) / 2) % Math.max(activeList.length, 1);
    currentGame = activeList[effectiveIndex];
  }

  const submitAnswer = useMutation({
    mutationFn: async ({ poolId, answer, score, game }: { poolId: string; answer: string; score?: number; game: Game }) => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Must be logged in');

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

      if (error) throw error;

      return { pointsEarned };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inline-user-predictions'] });
      queryClient.invalidateQueries({ queryKey: ['feed-user-predictions'] });
    },
  });

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
      setLastEarnedPoints(currentGame.points_reward);
      // Show toast and immediately advance to next game
      toast({
        title: "🎉 Nice work!",
        description: `+${currentGame.points_reward} points earned`,
        duration: 2500,
      });
      // Advance to next game immediately
      setTimeout(() => {
        setCurrentGameOffset(prev => prev + 1);
        setSelectedAnswer(null);
      }, 300);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCurrentTriviaQuestion = (): TriviaQuestion | null => {
    if (!currentGame || currentGame.type !== 'trivia') return null;
    if (!Array.isArray(currentGame.options)) return null;
    const q = currentGame.options[triviaQuestionIndex];
    if (q && typeof q === 'object' && 'question' in q && 'options' in q) {
      // Handle both 'correct' and 'answer' field names
      const correctAnswer = q.correct || q.answer;
      if (correctAnswer) {
        return { ...q, correct: correctAnswer } as TriviaQuestion;
      }
    }
    return null;
  };

  const triviaQuestion = getCurrentTriviaQuestion();
  const totalTriviaQuestions = currentGame?.type === 'trivia' && Array.isArray(currentGame.options) 
    ? currentGame.options.length 
    : 0;

  const handleTriviaAnswer = async () => {
    if (!currentGame || !triviaQuestion || !selectedAnswer) return;
    
    const isCorrect = selectedAnswer === triviaQuestion.correct;
    const pointsPerQuestion = Math.floor(currentGame.points_reward / totalTriviaQuestions);
    const earnedPoints = isCorrect ? pointsPerQuestion : 0;
    
    const newScore = isCorrect ? triviaScore + earnedPoints : triviaScore;
    if (isCorrect) {
      setTriviaScore(newScore);
    }
    
    toast({
      title: isCorrect ? "✓ Correct!" : "✗ Wrong",
      description: isCorrect 
        ? `+${earnedPoints} points` 
        : `Answer: ${triviaQuestion.correct}`,
      duration: 2000,
    });
    
    setSelectedAnswer(null);
    
    if (triviaQuestionIndex < totalTriviaQuestions - 1) {
      setTriviaQuestionIndex(prev => prev + 1);
    } else {
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
        setLastEarnedPoints(newScore);
        // Show toast and immediately advance to next game
        toast({
          title: "🎉 Trivia Complete!",
          description: `+${newScore} points earned`,
          duration: 2500,
        });
        // Advance to next game immediately
        setTimeout(() => {
          setCurrentGameOffset(prev => prev + 1);
          setTriviaQuestionIndex(0);
          setTriviaScore(0);
          setTriviaComplete(false);
          setSelectedAnswer(null);
        }, 300);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const advanceToNextGame = () => {
    setCurrentGameOffset(prev => prev + 1);
    setTriviaQuestionIndex(0);
    setTriviaScore(0);
    setTriviaComplete(false);
    setSelectedAnswer(null);
  };

  const goToPrevGame = () => {
    if (currentGameOffset > 0) {
      setCurrentGameOffset(prev => prev - 1);
      setTriviaQuestionIndex(0);
      setTriviaScore(0);
      setTriviaComplete(false);
      setSelectedAnswer(null);
    }
  };

  const goToNextGame = () => {
    setCurrentGameOffset(prev => prev + 1);
    setTriviaQuestionIndex(0);
    setTriviaScore(0);
    setTriviaComplete(false);
    setSelectedAnswer(null);
  };

  const handlePlayAnother = () => {
    setShowCompleted(false);
  };

  // Calculate if we can navigate prev/next
  const canGoPrev = currentGameOffset > 0;
  const canGoNext = availableGames.length > 1;

  const getGameIcon = (type: string) => {
    switch (type) {
      case 'trivia': return Brain;
      case 'vote': return Vote;
      default: return Sparkles;
    }
  };

  const getGameLabel = (type: string) => {
    switch (type) {
      case 'trivia': return 'Trivia';
      case 'vote': return 'Poll';
      default: return 'Game';
    }
  };

  const getGradient = (type: string) => {
    switch (type) {
      case 'trivia': return 'from-purple-600 to-indigo-600';
      case 'vote': return 'from-blue-600 to-purple-600';
      default: return 'from-purple-600 to-pink-600';
    }
  };

  if (isLoading) {
    return (
      <div className={cn("bg-white rounded-2xl border border-gray-200 shadow-sm p-6", className)}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-3" />
          <div className="h-6 bg-gray-200 rounded w-3/4 mb-4" />
          <div className="space-y-2">
            <div className="h-12 bg-gray-200 rounded-full" />
            <div className="h-12 bg-gray-200 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!currentGame || availableGames.length === 0) {
    return null;
  }

  const Icon = getGameIcon(currentGame.type);

  // Completion popup dialog
  const CompletionDialog = () => (
    <Dialog open={showCompleted} onOpenChange={(open) => !open && handlePlayAnother()}>
      <DialogContent className="sm:max-w-md text-center border-0 bg-white rounded-3xl p-8" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Game Completed</DialogTitle>
        <div className="flex flex-col items-center gap-4">
          <div className="text-5xl">🎉</div>
          <div className="space-y-2">
            <p className="text-2xl font-bold text-gray-900">
              Nice work!
            </p>
            <p className="text-lg text-purple-600 font-semibold">
              +{lastEarnedPoints} points earned
            </p>
            <p className="text-gray-500 text-sm">
              Keep playing to climb the leaderboard
            </p>
          </div>
          <Button
            onClick={handlePlayAnother}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-full px-8 py-3 mt-2"
            data-testid="button-play-another"
          >
            See Other Games
            <ArrowRight className="ml-2" size={16} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (showCompleted && availableGames.length <= 1) {
    // No more games available, just show the popup and then nothing
    return <CompletionDialog />;
  }

  // For trivia games, we must have a valid question - if not, skip rendering
  if (currentGame.type === 'trivia') {
    if (!triviaQuestion) {
      // Trivia without valid questions - skip to next game
      return null;
    }
    const isQuickTrivia = totalTriviaQuestions === 1;
    const TriviaTypeIcon = isQuickTrivia ? Zap : Trophy;
    
    // For multi-question trivia challenges, show preview card with "Play Trivia Game" button
    if (!isQuickTrivia) {
      return (
        <>
          <CompletionDialog />
          <div className={cn("bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative", className)} data-testid="inline-trivia-preview-card">
            {/* Navigation arrows */}
            {canGoPrev && (
              <button
                onClick={goToPrevGame}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1 hover:opacity-70 transition-opacity"
                data-testid="trivia-preview-nav-prev"
              >
                <ChevronLeft size={24} className="text-gray-400" />
              </button>
            )}
            {canGoNext && (
              <button
                onClick={goToNextGame}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1 hover:opacity-70 transition-opacity"
                data-testid="trivia-preview-nav-next"
              >
                <ChevronRight size={24} className="text-gray-400" />
              </button>
            )}
            
            {/* Category and Invite row */}
            <div className="p-4 pb-0 flex items-center justify-between px-4">
              {currentGame.category && (
                <Badge className="bg-purple-100 text-purple-700 border-0 text-xs px-3 py-1">
                  {currentGame.category}
                </Badge>
              )}
              <button className="flex items-center gap-1.5 text-purple-600 text-sm font-medium hover:text-purple-700">
                <Users size={16} />
                Invite to Play
              </button>
            </div>
            
            <div className="p-4 pt-3 px-4">
              <h3 className="text-xl font-bold text-gray-900 mb-1">{currentGame.title}</h3>
              {currentGame.description && (
                <p className="text-gray-600 text-sm mb-3">{currentGame.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                <span className="text-amber-600 font-medium">☆ You Earn: {currentGame.points_reward} pts</span>
                <span className="flex items-center gap-1">
                  <Users size={14} />
                  0
                </span>
              </div>
              
              <Link href={`/play/trivia#${currentGame.id}`}>
                <Button
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white rounded-full py-4"
                  data-testid="button-play-trivia"
                >
                  <Brain size={18} className="mr-2" />
                  Play Trivia Game
                </Button>
              </Link>
            </div>
          </div>
        </>
      );
    }
    
    // Quick trivia (1 question) - show inline playable
    return (
      <>
        <CompletionDialog />
        <div className={cn("bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative", className)} data-testid="inline-trivia-card">
          {/* Navigation arrows */}
          {canGoPrev && (
            <button
              onClick={goToPrevGame}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1 hover:opacity-70 transition-opacity"
              data-testid="trivia-nav-prev"
            >
              <ChevronLeft size={24} className="text-gray-400" />
            </button>
          )}
          {canGoNext && (
            <button
              onClick={goToNextGame}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1 hover:opacity-70 transition-opacity"
              data-testid="trivia-nav-next"
            >
              <ChevronRight size={24} className="text-gray-400" />
            </button>
          )}
          
          <div className={cn("bg-gradient-to-r p-4", getGradient(currentGame.type))}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="text-white" size={20} />
                <TriviaTypeIcon className="text-white" size={16} />
                <span className="text-white font-semibold">
                  Quick Trivia
                </span>
              </div>
              <Badge className="bg-white/20 text-white border-0">
                +{currentGame.points_reward} pts
              </Badge>
            </div>
          </div>
          {/* Category and tags pills row */}
          {(currentGame.category || (currentGame.tags && currentGame.tags.length > 0)) && (
            <div className="px-4 pt-4 flex flex-wrap gap-2">
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
          <div className="p-5 px-4 pt-3">
            <p className="text-base font-semibold text-gray-900 mb-4 leading-snug">{triviaQuestion.question}</p>
            <div className="flex flex-col gap-2 mb-4">
              {triviaQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedAnswer(option)}
                  disabled={isSubmitting}
                  className={cn(
                    "w-full px-4 py-3 text-left rounded-full border-2 transition-all text-sm font-medium",
                    selectedAnswer === option
                      ? "border-transparent bg-gradient-to-r from-purple-800 to-purple-400 text-white"
                      : "border-gray-200 bg-white text-gray-900 hover:border-gray-300"
                  )}
                  data-testid={`trivia-option-${index}`}
                >
                  {option}
                </button>
              ))}
            </div>
            <Button
              onClick={handleTriviaAnswer}
              disabled={!selectedAnswer || isSubmitting}
              className="w-full bg-gradient-to-r from-purple-800 to-purple-400 hover:from-purple-900 hover:to-purple-500 text-white rounded-full py-4 disabled:opacity-50"
              data-testid="button-submit-trivia"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Answer'}
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <CompletionDialog />
      <div className={cn("bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative", className)} data-testid="inline-poll-card">
        {/* Navigation arrows */}
        {canGoPrev && (
          <button
            onClick={goToPrevGame}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1 hover:opacity-70 transition-opacity"
            data-testid="poll-nav-prev"
          >
            <ChevronLeft size={24} className="text-gray-400" />
          </button>
        )}
        {canGoNext && (
          <button
            onClick={goToNextGame}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1 hover:opacity-70 transition-opacity"
            data-testid="poll-nav-next"
          >
            <ChevronRight size={24} className="text-gray-400" />
          </button>
        )}
        
        <div className={cn("bg-gradient-to-r p-4", getGradient(currentGame.type))}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="text-white" size={20} />
              <span className="text-white font-semibold">{getGameLabel(currentGame.type)}</span>
            </div>
            <Badge className="bg-white/20 text-white border-0">
              +{currentGame.points_reward} pts
            </Badge>
          </div>
        </div>
        <div className="p-5 px-4">
          <p className="text-base font-semibold text-gray-900 mb-4 leading-snug">{currentGame.title}</p>
          <div className="flex flex-col gap-2 mb-4">
            {(currentGame.options || []).map((option: any, index: number) => {
              const optionText = typeof option === 'string' ? option : (option.label || option.text || String(option));
              return (
                <button
                  key={index}
                  onClick={() => setSelectedAnswer(optionText)}
                  disabled={isSubmitting}
                  className={cn(
                    "w-full px-4 py-3 text-left rounded-full border-2 transition-all text-sm font-medium",
                    selectedAnswer === optionText
                      ? "border-transparent bg-gradient-to-r from-purple-800 to-purple-400 text-white"
                      : "border-gray-200 bg-white text-gray-900 hover:border-gray-300"
                  )}
                  data-testid={`poll-option-${index}`}
                >
                  {optionText}
                </button>
              );
            })}
          </div>
          <Button
            onClick={handleVoteSubmit}
            disabled={!selectedAnswer || isSubmitting}
            className="w-full bg-gradient-to-r from-purple-800 to-purple-400 hover:from-purple-900 hover:to-purple-500 text-white rounded-full py-4 disabled:opacity-50"
            data-testid="button-submit-poll"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Vote'}
          </Button>
        </div>
      </div>
    </>
  );
}
