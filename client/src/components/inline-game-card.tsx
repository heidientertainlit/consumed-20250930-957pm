import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Brain, Vote, Sparkles, ArrowRight, Trophy, Zap, Users } from 'lucide-react';
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
  
  // Swipe gesture state
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const isSwiping = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleSwipeStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    swipeStartX.current = clientX;
    swipeStartY.current = clientY;
    isSwiping.current = false;
  };

  const handleSwipeMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (swipeStartX.current === null) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaX = Math.abs(clientX - swipeStartX.current);
    const deltaY = Math.abs(clientY - (swipeStartY.current || 0));
    if (deltaX > 10 && deltaX > deltaY) {
      isSwiping.current = true;
      e.preventDefault();
    }
  };

  const handleSwipeEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (swipeStartX.current === null) return;
    const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX;
    const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : e.clientY;
    const diff = swipeStartX.current - clientX;
    
    if (Math.abs(diff) > 50 && isSwiping.current) {
      // It's a swipe - handle navigation
      if (diff > 0 && availableGames.length > 1) {
        // Swipe left - go to next
        setCurrentGameOffset(prev => prev + 1);
        setSelectedAnswer(null);
      } else if (diff < 0 && currentGameOffset > 0) {
        // Swipe right - go to prev
        setCurrentGameOffset(prev => prev - 1);
        setSelectedAnswer(null);
      }
    } else {
      // It's a tap - find and click the element underneath
      const overlay = e.currentTarget as HTMLElement;
      overlay.style.pointerEvents = 'none';
      const elementBelow = document.elementFromPoint(clientX, clientY) as HTMLElement;
      overlay.style.pointerEvents = 'auto';
      if (elementBelow && elementBelow !== overlay) {
        elementBelow.click();
      }
    }
    swipeStartX.current = null;
    swipeStartY.current = null;
    isSwiping.current = false;
  };

  const goToPrev = () => {
    if (currentGameOffset > 0) {
      setCurrentGameOffset(prev => prev - 1);
      setSelectedAnswer(null);
    }
  };

  const goToNext = () => {
    setCurrentGameOffset(prev => prev + 1);
    setSelectedAnswer(null);
  };

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

  // activeGame is derived from scroll position
  const activeGame = availableGames[currentGameOffset % Math.max(availableGames.length, 1)];

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
    if (!activeGame || !selectedAnswer) return;
    
    setIsSubmitting(true);
    try {
      await submitAnswer.mutateAsync({
        poolId: activeGame.id,
        answer: selectedAnswer,
        game: activeGame,
      });
      setSubmittedGames(prev => new Set([...prev, activeGame.id]));
      setLastEarnedPoints(activeGame.points_reward);
      // Show toast and immediately advance to next game
      toast({
        title: "🎉 Nice work!",
        description: `+${activeGame.points_reward} points earned`,
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
    if (!activeGame || activeGame.type !== 'trivia') return null;
    if (!Array.isArray(activeGame.options)) return null;
    const q = activeGame.options[triviaQuestionIndex];
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
  const totalTriviaQuestions = activeGame?.type === 'trivia' && Array.isArray(activeGame.options) 
    ? activeGame.options.length 
    : 0;

  const handleTriviaAnswer = async () => {
    if (!activeGame || !triviaQuestion || !selectedAnswer) return;
    
    const isCorrect = selectedAnswer === triviaQuestion.correct;
    const pointsPerQuestion = Math.floor(activeGame.points_reward / totalTriviaQuestions);
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
          poolId: activeGame.id,
          answer: `Completed with score: ${newScore}`,
          score: newScore,
          game: activeGame,
        });
        setSubmittedGames(prev => new Set([...prev, activeGame.id]));
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

  if (availableGames.length === 0 || !activeGame) {
    return null;
  }
  
  const Icon = getGameIcon(activeGame.type);

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
  if (activeGame.type === 'trivia') {
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
          <div 
            className={cn("bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden", className)} 
            data-testid="inline-trivia-preview-card"
          >
            {/* Category and Invite row */}
            <div className="p-4 pb-0 flex items-center justify-between px-4">
              {activeGame.category && (
                <Badge className="bg-purple-100 text-purple-700 border-0 text-xs px-3 py-1">
                  {activeGame.category}
                </Badge>
              )}
              <button className="flex items-center gap-1.5 text-purple-600 text-sm font-medium hover:text-purple-700">
                <Users size={16} />
                Invite to Play
              </button>
            </div>
            
            <div className="p-4 pt-3 px-4">
              <h3 className="text-xl font-bold text-gray-900 mb-1">{activeGame.title}</h3>
              {activeGame.description && (
                <p className="text-gray-600 text-sm mb-3">{activeGame.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                <span className="text-amber-600 font-medium">☆ You Earn: {activeGame.points_reward} pts</span>
                <span className="flex items-center gap-1">
                  <Users size={14} />
                  0
                </span>
              </div>
              
              <Link href={`/play/trivia#${activeGame.id}`}>
                <Button
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white rounded-full py-4"
                  data-testid="button-play-trivia"
                >
                  <Brain size={18} className="mr-2" />
                  Play Trivia Game
                </Button>
              </Link>
              {availableGames.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 mt-3" data-testid="trivia-preview-carousel-dots">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                </div>
              )}
            </div>
          </div>
        </>
      );
    }
    
    // Quick trivia (1 question) - show inline playable
    return (
      <>
        <CompletionDialog />
        <div 
          className={cn("bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden", className)} 
          data-testid="inline-trivia-card"
                  >
          <div className={cn("bg-gradient-to-r p-4", getGradient(activeGame.type))}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="text-white" size={20} />
                <TriviaTypeIcon className="text-white" size={16} />
                <span className="text-white font-semibold">
                  Quick Trivia
                </span>
              </div>
              <Badge className="bg-white/20 text-white border-0">
                +{activeGame.points_reward} pts
              </Badge>
            </div>
          </div>
          {/* Category and tags pills row */}
          {(activeGame.category || (activeGame.tags && activeGame.tags.length > 0)) && (
            <div className="px-4 pt-4 flex flex-wrap gap-2">
              {activeGame.category && (
                <Badge className="bg-purple-100 text-purple-700 border-0 text-xs px-3 py-1">
                  {activeGame.category}
                </Badge>
              )}
              {activeGame.tags?.map((tag: string, idx: number) => (
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
                      ? "border-transparent bg-purple-600 text-white"
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
              className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-full py-4 disabled:opacity-50"
              data-testid="button-submit-trivia"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Answer'}
            </Button>
            {availableGames.length > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-3" data-testid="trivia-carousel-dots">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  const canGoPrev = currentGameOffset > 0;
  const canGoNext = availableGames.length > 1;

  // Handle scroll snap to update current game offset
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollLeft = container.scrollLeft;
    const cardWidth = container.offsetWidth;
    const newIndex = Math.round(scrollLeft / cardWidth);
    if (newIndex !== currentGameOffset && newIndex >= 0 && newIndex < availableGames.length) {
      setCurrentGameOffset(newIndex);
      setSelectedAnswer(null);
    }
  };

  // Render a single poll card content
  const renderPollCard = (game: any, index: number) => {
    const GameIcon = game.type === 'trivia' ? Brain : game.type === 'prediction' ? Sparkles : Vote;
    return (
      <div 
        key={game.id} 
        className="min-w-full snap-center"
        style={{ scrollSnapAlign: 'center' }}
      >
        <div className={cn("bg-gradient-to-r p-4", getGradient(game.type))}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GameIcon className="text-white" size={20} />
              <span className="text-white font-semibold">{getGameLabel(game.type)}</span>
            </div>
            <Badge className="bg-white/20 text-white border-0">
              +{game.points_reward} pts
            </Badge>
          </div>
        </div>
        <div className="p-5 px-4">
          <p className="text-base font-semibold text-gray-900 mb-4 leading-snug">{game.title}</p>
          <div className="flex flex-col gap-2 mb-4">
            {(game.options || []).map((option: any, optIndex: number) => {
              const optionText = typeof option === 'string' ? option : (option.label || option.text || String(option));
              return (
                <button
                  key={optIndex}
                  onClick={() => setSelectedAnswer(optionText)}
                  disabled={isSubmitting}
                  className={cn(
                    "w-full px-4 py-3 text-left rounded-full border-2 transition-all text-sm font-medium",
                    selectedAnswer === optionText && index === currentGameOffset
                      ? "border-transparent bg-purple-600 text-white"
                      : "border-gray-200 bg-white text-gray-900 hover:border-gray-300"
                  )}
                  data-testid={`poll-option-${optIndex}`}
                >
                  {optionText}
                </button>
              );
            })}
          </div>
          <Button
            onClick={handleVoteSubmit}
            disabled={!selectedAnswer || isSubmitting}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-full py-4 disabled:opacity-50"
            data-testid="button-submit-poll"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Vote'}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <CompletionDialog />
      <div 
        className={cn("bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative", className)} 
        data-testid="inline-poll-card"
      >
        {/* Horizontal scroll container with snap */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
        >
          {availableGames.map((game, index) => renderPollCard(game, index))}
        </div>
        
        {/* Static 3-dot visual indicator for swipe hint */}
        {availableGames.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 pb-4" data-testid="poll-carousel-dots">
            <div className={cn("w-1.5 h-1.5 rounded-full", currentGameOffset % 3 === 0 ? "bg-purple-600" : "bg-gray-300")} />
            <div className={cn("w-1.5 h-1.5 rounded-full", currentGameOffset % 3 === 1 ? "bg-purple-600" : "bg-gray-300")} />
            <div className={cn("w-1.5 h-1.5 rounded-full", currentGameOffset % 3 === 2 ? "bg-purple-600" : "bg-gray-300")} />
          </div>
        )}
      </div>
    </>
  );
}
