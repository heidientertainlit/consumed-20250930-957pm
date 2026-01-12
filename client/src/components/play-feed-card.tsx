import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Brain, Vote, Sparkles, ChevronLeft, ChevronRight, Trophy, Zap, Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

interface PlayFeedCardProps {
  variant: 'mixed' | 'polls' | 'trivia';
  className?: string;
}

export default function PlayFeedCard({ variant, className }: PlayFeedCardProps) {
  const [currentGameIndex, setCurrentGameIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedGames, setSubmittedGames] = useState<Set<string>>(new Set());
  const [triviaQuestionIndex, setTriviaQuestionIndex] = useState(0);
  const [triviaScore, setTriviaScore] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && currentGameIndex < availableGames.length - 1) {
      goToNextGame();
    } else if (isRightSwipe && currentGameIndex > 0) {
      goToPrevGame();
    }
  };

  const { data: games = [], isLoading } = useQuery({
    queryKey: ['play-feed-games', variant],
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
        const isConsumedContent = game.id.startsWith('consumed-') || game.id.startsWith('trivia-') || game.id.startsWith('poll-');
        if (!isConsumedContent) return false;
        if (variant === 'polls' && game.type !== 'vote') return false;
        if (variant === 'trivia' && game.type !== 'trivia') return false;
        return true;
      }) as Game[];
    },
  });

  const { data: userPredictions = {} } = useQuery({
    queryKey: ['play-feed-user-predictions'],
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

  const activeGame = availableGames[currentGameIndex];

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
      queryClient.invalidateQueries({ queryKey: ['play-feed-user-predictions'] });
      queryClient.invalidateQueries({ queryKey: ['inline-user-predictions'] });
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
      toast({
        title: "Nice work!",
        description: `+${activeGame.points_reward} points earned`,
        duration: 2500,
      });
      setTimeout(() => {
        setCurrentGameIndex(prev => prev + 1);
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
    if (isCorrect) setTriviaScore(newScore);
    
    toast({
      title: isCorrect ? "Correct!" : "Wrong",
      description: isCorrect 
        ? `+${earnedPoints} points` 
        : `Answer: ${triviaQuestion.correct}`,
      duration: 2000,
    });
    
    setSelectedAnswer(null);
    
    if (triviaQuestionIndex < totalTriviaQuestions - 1) {
      setTriviaQuestionIndex(prev => prev + 1);
    } else {
      setIsSubmitting(true);
      try {
        await submitAnswer.mutateAsync({
          poolId: activeGame.id,
          answer: `Completed with score: ${newScore}`,
          score: newScore,
          game: activeGame,
        });
        setSubmittedGames(prev => new Set([...prev, activeGame.id]));
        toast({
          title: "Trivia Complete!",
          description: `+${newScore} points earned`,
          duration: 2500,
        });
        setTimeout(() => {
          setCurrentGameIndex(prev => prev + 1);
          setTriviaQuestionIndex(0);
          setTriviaScore(0);
          setSelectedAnswer(null);
        }, 300);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const goToNextGame = () => {
    setCurrentGameIndex(prev => prev + 1);
    setTriviaQuestionIndex(0);
    setTriviaScore(0);
    setSelectedAnswer(null);
  };

  const goToPrevGame = () => {
    if (currentGameIndex > 0) {
      setCurrentGameIndex(prev => prev - 1);
      setTriviaQuestionIndex(0);
      setTriviaScore(0);
      setSelectedAnswer(null);
    }
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

  const getVariantLabel = () => {
    switch (variant) {
      case 'mixed': return 'Play';
      case 'polls': return 'Polls';
      case 'trivia': return 'Trivia';
    }
  };

  const getVariantIcon = () => {
    switch (variant) {
      case 'mixed': return Gamepad2;
      case 'polls': return Vote;
      case 'trivia': return Brain;
    }
  };

  if (isLoading) {
    return (
      <div className={cn("bg-gradient-to-br from-[#0a0a1a] via-[#1a1a3e] to-[#2d1f5e] rounded-2xl shadow-lg border border-purple-800/30 p-6", className)}>
        <div className="animate-pulse">
          <div className="h-4 bg-purple-800/50 rounded w-1/4 mb-3" />
          <div className="h-6 bg-purple-800/50 rounded w-3/4 mb-4" />
          <div className="space-y-2">
            <div className="h-12 bg-purple-800/30 rounded-xl" />
            <div className="h-12 bg-purple-800/30 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (availableGames.length === 0 || !activeGame) {
    return null;
  }

  const VariantIcon = getVariantIcon();

  return (
    <div 
      ref={cardRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className={cn(
        "bg-gradient-to-br from-[#0a0a1a] via-[#1a1a3e] to-[#2d1f5e] rounded-2xl shadow-xl border border-purple-700/30 overflow-hidden touch-pan-y",
        className
      )}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <VariantIcon className="text-purple-400" size={18} />
            <span className="text-purple-300 text-sm font-medium">{getVariantLabel()}</span>
            <Badge className="bg-purple-600/50 text-purple-200 text-xs border-0">
              +{activeGame.points_reward} pts
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={goToPrevGame}
              disabled={currentGameIndex === 0}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="text-white" size={16} />
            </button>
            <span className="text-purple-300/70 text-xs px-2">
              {currentGameIndex + 1} / {Math.min(availableGames.length, 5)}
            </span>
            <button
              onClick={goToNextGame}
              disabled={currentGameIndex >= availableGames.length - 1}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="text-white" size={16} />
            </button>
          </div>
        </div>

        <h3 className="text-white font-semibold text-lg leading-tight mb-3">
          {activeGame.type === 'trivia' && triviaQuestion 
            ? triviaQuestion.question 
            : activeGame.title}
        </h3>
        {activeGame.type === 'trivia' && totalTriviaQuestions > 1 && (
          <p className="text-purple-300/70 text-xs mb-3">
            Question {triviaQuestionIndex + 1} of {totalTriviaQuestions}
          </p>
        )}

        <div className="space-y-2 mb-4">
          {activeGame.type === 'vote' ? (
            activeGame.options.map((option: string, idx: number) => (
              <button
                key={idx}
                onClick={() => setSelectedAnswer(option)}
                className={cn(
                  "w-full p-3.5 rounded-xl text-left transition-all border",
                  selectedAnswer === option
                    ? "bg-purple-600 border-purple-400 text-white"
                    : "bg-white/5 border-purple-700/30 text-white hover:bg-white/10 hover:border-purple-600/50"
                )}
              >
                <span className="font-medium">{option}</span>
              </button>
            ))
          ) : activeGame.type === 'trivia' && triviaQuestion ? (
            triviaQuestion.options.map((option: string, idx: number) => (
              <button
                key={idx}
                onClick={() => setSelectedAnswer(option)}
                className={cn(
                  "w-full p-3.5 rounded-xl text-left transition-all border",
                  selectedAnswer === option
                    ? "bg-purple-600 border-purple-400 text-white"
                    : "bg-white/5 border-purple-700/30 text-white hover:bg-white/10 hover:border-purple-600/50"
                )}
              >
                <span className="font-medium">{option}</span>
              </button>
            ))
          ) : null}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={activeGame.type === 'trivia' ? handleTriviaAnswer : handleVoteSubmit}
            disabled={!selectedAnswer || isSubmitting}
            className="flex-1 bg-purple-600 hover:bg-purple-500 text-white rounded-xl py-3 font-medium disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : activeGame.type === 'trivia' ? 'Answer' : 'Vote'}
          </Button>
          <Link href="/play">
            <Button
              variant="outline"
              className="border-purple-600/50 text-purple-300 hover:bg-purple-600/20 rounded-xl px-4"
            >
              See All
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}