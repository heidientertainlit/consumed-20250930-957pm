import { useState, useRef, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { Brain, Loader2, ChevronLeft, ChevronRight, Trophy, Users, CheckCircle, XCircle, Play } from 'lucide-react';
import { TriviaGameModal } from '@/components/trivia-game-modal';

interface TriviaItem {
  id: string;
  title: string;
  question: string;
  options: string[];
  correctAnswer?: string;
  category?: string;
  pointsReward: number;
  isChallenge: boolean;
  questionCount: number;
  rawOptions: any;
}

export function TriviaCarousel() {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<Record<string, string>>({});
  const [answeredQuestions, setAnsweredQuestions] = useState<Record<string, { answer: string; isCorrect: boolean; stats: any }>>({});
  const [selectedChallenge, setSelectedChallenge] = useState<TriviaItem | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['trivia-carousel'],
    queryFn: async () => {
      const { data: pools, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('type', 'trivia')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      const items: TriviaItem[] = (pools || []).map(pool => {
        let questionText = pool.title;
        let optionsList: string[] = [];
        let isChallenge = false;
        let questionCount = 1;
        
        if (pool.options && Array.isArray(pool.options)) {
          if (pool.options.length > 0 && typeof pool.options[0] === 'object' && pool.options[0]?.question) {
            isChallenge = pool.options.length > 1;
            questionCount = pool.options.length;
            const firstQ = pool.options[0];
            questionText = firstQ.question || pool.title;
            optionsList = firstQ.options || [];
          } else {
            optionsList = pool.options.filter((o: any) => typeof o === 'string');
          }
        }
        
        return {
          id: pool.id,
          title: pool.title,
          question: questionText,
          options: optionsList,
          correctAnswer: pool.correct_answer,
          category: pool.category,
          pointsReward: pool.points_reward || 10,
          isChallenge,
          questionCount,
          rawOptions: pool.options
        };
      });
      
      return items;
    },
    enabled: !!session?.access_token
  });

  useEffect(() => {
    const loadAnswered = async () => {
      if (!user?.id || !data || data.length === 0) return;
      
      const { data: predictions } = await supabase
        .from('user_predictions')
        .select('pool_id, prediction')
        .eq('user_id', user.id)
        .in('pool_id', data.map(q => q.id));
      
      if (predictions && predictions.length > 0) {
        const answered: Record<string, { answer: string; isCorrect: boolean; stats: any }> = {};
        
        for (const p of predictions) {
          const question = data.find(q => q.id === p.pool_id);
          if (!question) continue;
          
          const { data: allPredictions } = await supabase
            .from('user_predictions')
            .select('prediction')
            .eq('pool_id', p.pool_id);
          
          const total = allPredictions?.length || 1;
          const stats: Record<string, number> = {};
          for (const opt of question?.options || []) {
            const count = allPredictions?.filter(pred => pred.prediction === opt).length || 0;
            stats[opt] = Math.round((count / total) * 100);
          }
          
          answered[p.pool_id] = {
            answer: p.prediction,
            isCorrect: question?.correctAnswer === p.prediction,
            stats
          };
        }
        setAnsweredQuestions(answered);
      }
    };
    
    loadAnswered();
  }, [data, user?.id]);

  const answerMutation = useMutation({
    mutationFn: async ({ questionId, answer, pointsReward, correctAnswer }: { questionId: string; answer: string; pointsReward: number; correctAnswer?: string }) => {
      if (!user?.id) throw new Error('Not logged in');
      
      const { data: existingAnswer } = await supabase
        .from('user_predictions')
        .select('id')
        .eq('user_id', user.id)
        .eq('pool_id', questionId)
        .single();
      
      if (existingAnswer) {
        throw new Error('You already answered this question');
      }
      
      const isCorrect = correctAnswer === answer;
      const points = isCorrect ? pointsReward : Math.floor(pointsReward / 2);
      
      const { error } = await supabase
        .from('user_predictions')
        .insert({
          user_id: user.id,
          pool_id: questionId,
          prediction: answer,
          points_earned: points
        });
      
      if (error) {
        if (error.message.includes('duplicate')) {
          throw new Error('You already answered this question');
        }
        throw error;
      }
      
      await supabase.rpc('increment_user_points', { user_id_param: user.id, points_to_add: points });
      
      const { data: allPredictions } = await supabase
        .from('user_predictions')
        .select('prediction')
        .eq('pool_id', questionId);
      
      const question = data?.find(q => q.id === questionId);
      const total = allPredictions?.length || 1;
      const stats: Record<string, number> = {};
      for (const opt of question?.options || []) {
        const count = allPredictions?.filter(p => p.prediction === opt).length || 0;
        stats[opt] = Math.round((count / total) * 100);
      }
      
      return { questionId, answer, isCorrect, points, stats };
    },
    onSuccess: (result) => {
      setAnsweredQuestions(prev => ({
        ...prev,
        [result.questionId]: {
          answer: result.answer,
          isCorrect: result.isCorrect,
          stats: result.stats
        }
      }));
      
      queryClient.invalidateQueries({ queryKey: ['trivia-carousel'] });
      
      toast({
        title: result.isCorrect ? `Correct! +${result.points} points` : `Wrong! +${result.points} points`,
        description: result.isCorrect ? 'Nice work!' : 'Half points for trying!',
      });
      
      setTimeout(() => {
        if (data && currentIndex < data.length - 1) {
          scrollToNext();
        }
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: 'Already Played',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const scrollToNext = () => {
    if (scrollRef.current && data && currentIndex < data.length - 1) {
      const cardWidth = scrollRef.current.children[0]?.clientWidth || 280;
      scrollRef.current.scrollBy({ left: cardWidth + 12, behavior: 'smooth' });
      setCurrentIndex(prev => Math.min(prev + 1, data.length - 1));
    }
  };

  const scrollToPrev = () => {
    if (scrollRef.current && currentIndex > 0) {
      const cardWidth = scrollRef.current.children[0]?.clientWidth || 280;
      scrollRef.current.scrollBy({ left: -(cardWidth + 12), behavior: 'smooth' });
      setCurrentIndex(prev => Math.max(prev - 1, 0));
    }
  };

  const handleScroll = () => {
    if (scrollRef.current && data) {
      const cardWidth = scrollRef.current.children[0]?.clientWidth || 280;
      const scrollLeft = scrollRef.current.scrollLeft;
      const newIndex = Math.round(scrollLeft / (cardWidth + 12));
      setCurrentIndex(Math.min(Math.max(newIndex, 0), data.length - 1));
    }
  };

  const handleSelectOption = (questionId: string, option: string) => {
    setSelectedAnswer(prev => ({ ...prev, [questionId]: option }));
  };

  const handleSubmitAnswer = (item: TriviaItem) => {
    const answer = selectedAnswer[item.id];
    if (!answer) return;
    
    answerMutation.mutate({
      questionId: item.id,
      answer,
      pointsReward: item.pointsReward,
      correctAnswer: item.correctAnswer
    });
  };

  if (!session) return null;

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-b from-slate-900 via-purple-950 to-indigo-950 border-0 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-white" />
        </div>
      </Card>
    );
  }

  if (isError || !data || data.length === 0) return null;

  return (
    <>
      <Card className="bg-gradient-to-b from-slate-900 via-purple-950 to-indigo-950 border-0 rounded-2xl p-4 shadow-lg overflow-hidden relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
              <Brain className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Quick Trivia</p>
              <p className="text-[10px] text-white/70">Test your knowledge</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {currentIndex > 0 && (
              <button
                onClick={scrollToPrev}
                className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
            )}
            {currentIndex < data.length - 1 && (
              <button
                onClick={scrollToNext}
                className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            )}
            <span className="text-xs text-white/60 ml-1">
              {currentIndex + 1}/{data.length}
            </span>
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-1 px-1"
        >
          {data.map((item) => {
            const answered = answeredQuestions[item.id];
            const selected = selectedAnswer[item.id];
            
            if (item.isChallenge) {
              return (
                <div key={item.id} className="flex-shrink-0 w-full snap-center">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-600/40 border border-purple-500/30">
                      <span className="text-xs text-purple-300 font-medium">+{item.pointsReward} pts</span>
                    </div>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-600/40 border border-amber-500/30">
                      <span className="text-xs text-amber-300 font-medium">{item.questionCount} questions</span>
                    </div>
                  </div>
                  
                  <h3 className="text-white font-semibold text-base mb-3">{item.title}</h3>
                  <p className="text-white/70 text-sm mb-4">Challenge yourself with {item.questionCount} trivia questions!</p>
                  
                  {answered ? (
                    <div className="py-3 px-4 rounded-xl bg-green-600/30 border border-green-500/50 text-center">
                      <CheckCircle className="w-5 h-5 text-green-400 mx-auto mb-1" />
                      <span className="text-sm text-green-300">Challenge Completed!</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectedChallenge(item)}
                      className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      Start Challenge
                    </button>
                  )}
                </div>
              );
            }
            
            return (
              <div key={item.id} className="flex-shrink-0 w-full snap-center">
                <div className="inline-flex items-center gap-1 mb-3 px-2 py-0.5 rounded-full bg-purple-600/40 border border-purple-500/30">
                  <span className="text-xs text-purple-300 font-medium">+{item.pointsReward} pts</span>
                </div>
                
                <h3 className="text-white font-semibold text-base mb-3">{item.question}</h3>
                
                {!answered ? (
                  <div className="flex flex-col gap-2">
                    {item.options.slice(0, 4).map((option, idx) => (
                      <button
                        key={idx}
                        className={`py-3 px-4 rounded-xl border text-white text-sm font-medium transition-all text-left ${
                          selected === option 
                            ? 'bg-gradient-to-r from-purple-500 to-indigo-500 border-purple-300 shadow-lg shadow-purple-500/30' 
                            : 'bg-purple-900/60 border-purple-700/50 hover:bg-purple-800/70 hover:border-purple-600'
                        }`}
                        onClick={() => handleSelectOption(item.id, option)}
                        disabled={answerMutation.isPending}
                      >
                        {option}
                      </button>
                    ))}
                    
                    {selected && (
                      <button
                        onClick={() => handleSubmitAnswer(item)}
                        disabled={answerMutation.isPending}
                        className="mt-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium transition-colors disabled:opacity-50"
                      >
                        {answerMutation.isPending ? 'Submitting...' : 'Submit'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {item.options.slice(0, 4).map((option, idx) => {
                      const isUserAnswer = answered.answer === option;
                      const isCorrect = item.correctAnswer === option;
                      const percentage = answered.stats?.[option] || 0;
                      
                      return (
                        <div 
                          key={idx}
                          className={`relative py-3 px-4 rounded-xl border overflow-hidden ${
                            isUserAnswer && isCorrect
                              ? 'border-green-400 bg-green-500/20'
                              : isUserAnswer && !isCorrect
                                ? 'border-red-400 bg-red-500/20'
                                : isCorrect
                                  ? 'border-green-400/50 bg-green-500/10'
                                  : 'border-purple-700/30 bg-purple-900/40'
                          }`}
                        >
                          <div 
                            className="absolute left-0 top-0 bottom-0 bg-white/10 transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                          <div className="relative flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              {isCorrect && <Trophy className="w-4 h-4 text-green-400" />}
                              {isUserAnswer && !isCorrect && <XCircle className="w-4 h-4 text-red-400" />}
                              <span className="text-sm text-white">{option}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="w-3 h-3 text-white/60" />
                              <span className="text-sm font-bold text-white">{percentage}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        <Link href="/play/trivia">
          <div className="flex items-center justify-center gap-1.5 mt-4 pt-3 border-t border-white/20 cursor-pointer hover:opacity-80 transition-opacity">
            <Trophy className="w-3.5 h-3.5 text-white/80" />
            <span className="text-xs text-white/80 font-medium">See all trivia & games</span>
          </div>
        </Link>

        {answerMutation.isPending && (
          <div className="absolute inset-0 bg-purple-950/50 flex items-center justify-center rounded-2xl">
            <Loader2 className="w-6 h-6 animate-spin text-white" />
          </div>
        )}
      </Card>

      {selectedChallenge && (
        <TriviaGameModal
          poolId={selectedChallenge.id}
          title={selectedChallenge.title}
          questions={selectedChallenge.rawOptions}
          pointsReward={selectedChallenge.pointsReward}
          correctAnswer={selectedChallenge.correctAnswer}
          isOpen={true}
          onClose={() => {
            setSelectedChallenge(null);
            queryClient.invalidateQueries({ queryKey: ['trivia-carousel'] });
          }}
        />
      )}
    </>
  );
}
