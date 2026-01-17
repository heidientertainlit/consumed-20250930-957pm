import { useState, useRef, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { Brain, Loader2, ChevronLeft, ChevronRight, Trophy, Users, Zap } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';

interface TriviaQuestion {
  id: string;
  title: string;
  question: string;
  options: string[];
  correctAnswer?: string;
  category?: string;
  pointsReward: number;
}

export function TriviaCarousel() {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answeredQuestions, setAnsweredQuestions] = useState<Record<string, { answer: string; isCorrect: boolean; stats: any }>>({});

  const { data, isLoading, isError } = useQuery({
    queryKey: ['trivia-carousel'],
    queryFn: async () => {
      const { data: pools, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('type', 'trivia')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      
      const questions: TriviaQuestion[] = (pools || []).map(pool => {
        let questionText = pool.title;
        let optionsList: string[] = [];
        
        if (pool.options && Array.isArray(pool.options)) {
          if (pool.options.length > 0 && typeof pool.options[0] === 'object' && pool.options[0]?.question) {
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
          pointsReward: pool.points_reward || 10
        };
      });
      
      return questions;
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
    mutationFn: async ({ questionId, answer, pointsReward }: { questionId: string; answer: string; pointsReward: number }) => {
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
      
      const question = data?.find(q => q.id === questionId);
      const isCorrect = question?.correctAnswer === answer;
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
        title: result.isCorrect ? `Correct! +${result.points} points` : `+${result.points} points`,
        description: result.isCorrect ? 'Great job!' : 'Better luck next time!',
      });
      
      setTimeout(() => {
        if (data && currentIndex < data.length - 1) {
          scrollToNext();
        }
      }, 1500);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
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
        {data.map((question) => {
          const answered = answeredQuestions[question.id];
          
          return (
            <div key={question.id} className="flex-shrink-0 w-full snap-center">
              <div className="inline-flex items-center gap-1 mb-3 px-2 py-0.5 rounded-full bg-purple-600/40 border border-purple-500/30">
                <span className="text-xs text-purple-300 font-medium">+{question.pointsReward} pts</span>
              </div>
              
              <h3 className="text-white font-semibold text-base mb-3">{question.question}</h3>
              
              {!answered ? (
                <div className="flex flex-col gap-2">
                  {question.options.slice(0, 4).map((option, idx) => (
                    <button
                      key={idx}
                      className="py-3 px-4 rounded-xl bg-purple-900/60 border border-purple-700/50 text-white text-sm font-medium hover:bg-purple-800/70 hover:border-purple-600 transition-all text-left"
                      onClick={() => answerMutation.mutate({ 
                        questionId: question.id, 
                        answer: option,
                        pointsReward: question.pointsReward 
                      })}
                      disabled={answerMutation.isPending}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {question.options.slice(0, 4).map((option, idx) => {
                    const isSelected = answered.answer === option;
                    const isCorrect = question.correctAnswer === option;
                    const percentage = answered.stats?.[option] || 0;
                    
                    return (
                      <div 
                        key={idx}
                        className={`relative p-2 rounded-xl border-2 overflow-hidden ${
                          isCorrect 
                            ? 'border-green-400 bg-green-500/20' 
                            : isSelected 
                              ? 'border-red-400 bg-red-500/20'
                              : 'border-white/20 bg-white/10'
                        }`}
                      >
                        <div 
                          className={`absolute left-0 top-0 bottom-0 transition-all duration-500 ${
                            isCorrect ? 'bg-green-500/30' : 'bg-white/10'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                        <div className="relative flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            {isCorrect && <Trophy className="w-4 h-4 text-green-400" />}
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
      
      <Link href="/play">
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
  );
}
