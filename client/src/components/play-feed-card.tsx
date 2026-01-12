import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Brain, Vote, Sparkles, Gamepad2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

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
  correct_answer?: string;
}

interface VoteResult {
  option: string;
  count: number;
  percentage: number;
  isUserChoice: boolean;
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
  const [showingResults, setShowingResults] = useState<string | null>(null);
  const [voteResults, setVoteResults] = useState<VoteResult[]>([]);
  const [userVotedOption, setUserVotedOption] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: games = [], isLoading } = useQuery({
    queryKey: ['play-feed-games', variant],
    queryFn: async () => {
      const { data: pools, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('status', 'open')
        .in('type', ['vote', 'trivia'])
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw new Error('Failed to fetch games');
      return (pools || []).filter((game: any) => {
        if (!game.id || !game.title || !game.type) return false;
        if (!game.options || game.options.length < 2) return false;
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

  // Deduplicate games by title, prioritizing unplayed games
  const seenTitles = new Set<string>();
  const unplayedGames: Game[] = [];
  const playedGames: Game[] = [];
  
  games.forEach((game) => {
    if (seenTitles.has(game.title)) return;
    if (game.type === 'vote' && (!game.options || game.options.length < 2)) return;
    seenTitles.add(game.title);
    
    const isPlayed = userPredictions[game.id] || submittedGames.has(game.id);
    if (isPlayed) {
      playedGames.push(game);
    } else {
      unplayedGames.push(game);
    }
  });
  
  // Offset games by variant so each Play card shows different content first
  const variantOffset = variant === 'mixed' ? 0 : variant === 'polls' ? 3 : 6;
  const rotateArray = <T,>(arr: T[], offset: number): T[] => {
    if (arr.length === 0) return arr;
    const realOffset = offset % arr.length;
    return [...arr.slice(realOffset), ...arr.slice(0, realOffset)];
  };
  
  // Show unplayed first (rotated by variant), then played games
  const rotatedUnplayed = rotateArray(unplayedGames, variantOffset);
  const availableGames = [...rotatedUnplayed, ...playedGames];

  const fetchVoteResults = async (poolId: string, options: string[], userChoice: string) => {
    const { data: votes } = await supabase
      .from('user_predictions')
      .select('prediction')
      .eq('pool_id', poolId);
    
    const voteCounts: Record<string, number> = {};
    options.forEach(opt => voteCounts[opt] = 0);
    
    (votes || []).forEach((v: any) => {
      if (voteCounts[v.prediction] !== undefined) {
        voteCounts[v.prediction]++;
      }
    });
    
    const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);
    
    const results: VoteResult[] = options.map(opt => ({
      option: opt,
      count: voteCounts[opt],
      percentage: totalVotes > 0 ? Math.round((voteCounts[opt] / totalVotes) * 100) : 0,
      isUserChoice: opt === userChoice
    }));
    
    return results.sort((a, b) => b.count - a.count);
  };

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

  const handleScroll = () => {
    if (!scrollContainerRef.current || showingResults) return;
    const container = scrollContainerRef.current;
    const scrollLeft = container.scrollLeft;
    const cardWidth = container.offsetWidth;
    const newIndex = Math.round(scrollLeft / cardWidth);
    if (newIndex !== currentGameIndex && newIndex >= 0 && newIndex < availableGames.length) {
      setCurrentGameIndex(newIndex);
      setSelectedAnswer(null);
      setTriviaQuestionIndex(0);
      setTriviaScore(0);
    }
  };

  const scrollToGame = (index: number) => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const cardWidth = container.offsetWidth;
    container.scrollTo({ left: cardWidth * index, behavior: 'smooth' });
  };

  const getGameOptions = (game: Game): string[] => {
    if (!game.options || !Array.isArray(game.options)) return [];
    if (game.options.length === 0) return [];
    if (typeof game.options[0] === 'string') {
      return game.options as string[];
    }
    return [];
  };

  const getTriviaQuestion = (game: Game, questionIndex: number): TriviaQuestion | null => {
    if (!game.options || !Array.isArray(game.options)) return null;
    if (game.options.length === 0) return null;
    if (typeof game.options[0] === 'string') {
      return {
        question: game.title,
        options: game.options as string[],
        correct: game.correct_answer || ''
      };
    }
    const q = game.options[questionIndex];
    if (q && typeof q === 'object' && 'question' in q && 'options' in q) {
      const correctAnswer = q.correct || q.answer || '';
      return { question: q.question, options: q.options, correct: correctAnswer };
    }
    return null;
  };

  const handleVoteSubmit = async (game: Game) => {
    if (!selectedAnswer) return;
    setIsSubmitting(true);
    const userChoice = selectedAnswer;
    try {
      await submitAnswer.mutateAsync({
        poolId: game.id,
        answer: selectedAnswer,
        game: game,
      });
      
      toast({
        title: `+${game.points_reward} points`,
        duration: 1500,
      });
      
      const options = getGameOptions(game);
      const results = await fetchVoteResults(game.id, options, userChoice);
      setVoteResults(results);
      setUserVotedOption(userChoice);
      setShowingResults(game.id);
      setSubmittedGames(prev => new Set([...prev, game.id]));
      
      setTimeout(() => {
        setShowingResults(null);
        setVoteResults([]);
        setUserVotedOption(null);
        setSelectedAnswer(null);
        if (currentGameIndex < availableGames.length - 1) {
          scrollToGame(currentGameIndex + 1);
        }
      }, 2500);
      
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTriviaAnswer = async (game: Game, triviaQuestion: TriviaQuestion, totalQuestions: number) => {
    if (!selectedAnswer) return;
    const isCorrect = selectedAnswer === triviaQuestion.correct;
    const pointsPerQuestion = Math.floor(game.points_reward / Math.max(totalQuestions, 1));
    const earnedPoints = isCorrect ? pointsPerQuestion : 0;
    const newScore = triviaScore + earnedPoints;
    if (isCorrect) setTriviaScore(newScore);
    
    toast({
      title: isCorrect ? `Correct! +${earnedPoints} pts` : `Wrong! Answer: ${triviaQuestion.correct}`,
      duration: 1500,
    });
    
    setSelectedAnswer(null);
    
    if (triviaQuestionIndex < totalQuestions - 1) {
      setTriviaQuestionIndex(prev => prev + 1);
    } else {
      setIsSubmitting(true);
      try {
        await submitAnswer.mutateAsync({
          poolId: game.id,
          answer: `Completed with score: ${newScore}`,
          score: newScore,
          game: game,
        });
        setSubmittedGames(prev => new Set([...prev, game.id]));
        setTriviaQuestionIndex(0);
        setTriviaScore(0);
        setTimeout(() => {
          if (currentGameIndex < availableGames.length - 1) {
            scrollToGame(currentGameIndex + 1);
          }
        }, 500);
      } finally {
        setIsSubmitting(false);
      }
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

  if (availableGames.length === 0) {
    return null;
  }

  const VariantIcon = getVariantIcon();

  const renderResultsView = (game: Game) => {
    const totalVotes = voteResults.reduce((sum, r) => sum + r.count, 0);
    
    return (
      <div 
        key={`results-${game.id}`}
        className="min-w-full snap-center px-4 py-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <Check className="text-green-400" size={20} />
          <span className="text-green-400 font-medium">Voted!</span>
          <span className="text-purple-300/60 text-xs ml-auto">
            {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
          </span>
        </div>
        <h3 className="text-white font-semibold text-lg leading-tight mb-4">
          {game.title}
        </h3>
        <div className="space-y-3">
          {voteResults.map((result, idx) => (
            <div key={idx} className="relative">
              <div 
                className={cn(
                  "absolute inset-0 rounded-xl transition-all",
                  result.isUserChoice ? "bg-purple-600/40" : "bg-white/10"
                )}
                style={{ width: `${Math.max(result.percentage, 2)}%` }}
              />
              <div className={cn(
                "relative flex items-center justify-between p-3.5 rounded-xl border",
                result.isUserChoice ? "border-purple-400" : "border-purple-700/30"
              )}>
                <span className="font-medium text-white flex items-center gap-2">
                  {result.option}
                  {result.isUserChoice && <Check size={16} className="text-purple-300" />}
                </span>
                <span className="text-purple-300 font-semibold">
                  {totalVotes > 0 ? `${result.percentage}%` : '-'}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-purple-300/60 text-xs mt-4">
          {totalVotes <= 1 ? "You're the first to vote!" : "Next game in a moment..."}
        </p>
      </div>
    );
  };

  const renderGameCard = (game: Game, index: number) => {
    const isActive = index === currentGameIndex;
    const options = getGameOptions(game);
    const isTrivia = game.type === 'trivia';
    const triviaQuestion = isTrivia ? getTriviaQuestion(game, triviaQuestionIndex) : null;
    const totalTriviaQuestions = isTrivia && Array.isArray(game.options) && typeof game.options[0] === 'object' 
      ? game.options.length 
      : 1;
    const displayOptions = isTrivia && triviaQuestion ? triviaQuestion.options : options;
    const displayQuestion = isTrivia && triviaQuestion ? triviaQuestion.question : game.title;
    const isAlreadyPlayed = userPredictions[game.id] !== undefined;

    if (showingResults === game.id) {
      return renderResultsView(game);
    }

    // Show completed state for already played games
    if (isAlreadyPlayed) {
      return (
        <div 
          key={game.id}
          className="min-w-full snap-center px-4 py-4 opacity-60"
          style={{ scrollSnapAlign: 'center' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Check className="text-green-400" size={18} />
            <span className="text-green-400 text-sm font-medium">Already played</span>
          </div>
          <h3 className="text-white font-semibold text-lg leading-tight mb-3">
            {displayQuestion}
          </h3>
          <div className="space-y-2">
            {displayOptions.map((option: string, idx: number) => (
              <div
                key={idx}
                className={cn(
                  "w-full p-3.5 rounded-xl text-left border",
                  userPredictions[game.id] === option
                    ? "bg-purple-600/30 border-purple-400"
                    : "bg-white/5 border-purple-700/30"
                )}
              >
                <span className="font-medium text-white/70 flex items-center gap-2">
                  {option}
                  {userPredictions[game.id] === option && <Check size={14} className="text-purple-300" />}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div 
        key={game.id}
        className="min-w-full snap-center px-4 py-4"
        style={{ scrollSnapAlign: 'center' }}
      >
        <h3 className="text-white font-semibold text-lg leading-tight mb-3">
          {displayQuestion}
        </h3>
        {isTrivia && totalTriviaQuestions > 1 && (
          <p className="text-purple-300/70 text-xs mb-3">
            Question {triviaQuestionIndex + 1} of {totalTriviaQuestions}
          </p>
        )}

        <div className="space-y-2 mb-4">
          {displayOptions.map((option: string, idx: number) => (
            <button
              key={idx}
              onClick={() => isActive && setSelectedAnswer(option)}
              disabled={!isActive}
              className={cn(
                "w-full p-3.5 rounded-xl text-left transition-all border",
                isActive && selectedAnswer === option
                  ? "bg-purple-600 border-purple-400 text-white"
                  : "bg-white/5 border-purple-700/30 text-white hover:bg-white/10 hover:border-purple-600/50"
              )}
            >
              <span className="font-medium">{option}</span>
            </button>
          ))}
        </div>

        <Button
          onClick={() => isTrivia && triviaQuestion 
            ? handleTriviaAnswer(game, triviaQuestion, totalTriviaQuestions) 
            : handleVoteSubmit(game)
          }
          disabled={!selectedAnswer || isSubmitting || !isActive}
          className="w-full bg-purple-600 hover:bg-purple-500 text-white rounded-xl py-3 font-medium disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting...' : isTrivia ? 'Answer' : 'Vote'}
        </Button>
      </div>
    );
  };

  return (
    <div className={cn(
      "bg-gradient-to-br from-[#0a0a1a] via-[#1a1a3e] to-[#2d1f5e] rounded-2xl shadow-xl border border-purple-700/30 overflow-hidden",
      className
    )}>
      <div className="p-4 pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <VariantIcon className="text-purple-400" size={18} />
            <span className="text-purple-300 text-sm font-medium">{getVariantLabel()}</span>
            <Badge className="bg-purple-600/50 text-purple-200 text-xs border-0">
              +{availableGames[currentGameIndex]?.points_reward || 0} pts
            </Badge>
          </div>
          <span className="text-purple-300/70 text-xs">
            {currentGameIndex + 1} / {Math.min(availableGames.length, 30)}
          </span>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
      >
        {availableGames.slice(0, 30).map((game, index) => renderGameCard(game, index))}
      </div>

      <div className="flex items-center justify-center gap-1.5 pb-4">
        {availableGames.slice(0, Math.min(availableGames.length, 10)).map((_, idx) => (
          <div 
            key={idx} 
            className={cn(
              "w-1.5 h-1.5 rounded-full transition-colors",
              idx === currentGameIndex ? "bg-purple-400" : "bg-purple-400/40"
            )} 
          />
        ))}
      </div>
    </div>
  );
}