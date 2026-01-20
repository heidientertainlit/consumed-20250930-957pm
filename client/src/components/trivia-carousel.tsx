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

interface TriviaCarouselProps {
  expanded?: boolean;
  category?: string;
}

export function TriviaCarousel({ expanded = false, category }: TriviaCarouselProps) {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<Record<string, string>>({});
  const [answeredQuestions, setAnsweredQuestions] = useState<Record<string, { answer: string; isCorrect: boolean; stats: any }>>({});
  const [selectedChallenge, setSelectedChallenge] = useState<TriviaItem | null>(null);

  const { data: leaderboardData } = useQuery({
    queryKey: ['trivia-leaderboard-position', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data: leaderboard } = await supabase
        .from('profiles')
        .select('id, display_name, total_points')
        .order('total_points', { ascending: false })
        .limit(20);
      
      if (!leaderboard) return null;
      
      const userIndex = leaderboard.findIndex(p => p.id === user.id);
      if (userIndex === -1) return { position: null, nextPerson: null };
      if (userIndex === 0) return { position: 1, nextPerson: null, isFirst: true };
      
      const nextPerson = leaderboard[userIndex - 1];
      const pointsNeeded = (nextPerson?.total_points || 0) - (leaderboard[userIndex]?.total_points || 0);
      
      return { 
        position: userIndex + 1, 
        nextPerson: nextPerson?.display_name || 'the next spot',
        pointsNeeded: Math.max(1, Math.ceil(pointsNeeded / 10))
      };
    },
    enabled: !!user?.id
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['trivia-carousel', user?.id],
    queryFn: async () => {
      const { data: pools, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('type', 'trivia')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      
      let answeredPoolIds: string[] = [];
      if (user?.id) {
        const { data: userPredictions } = await supabase
          .from('user_predictions')
          .select('pool_id')
          .eq('user_id', user.id);
        answeredPoolIds = (userPredictions || []).map(p => p.pool_id);
      }
      
      const unansweredPools = (pools || []).filter(pool => !answeredPoolIds.includes(pool.id));
      
      const uniqueTitles = new Map<string, any>();
      for (const pool of unansweredPools) {
        if (!uniqueTitles.has(pool.title)) {
          uniqueTitles.set(pool.title, pool);
        }
      }
      const uniquePools = Array.from(uniqueTitles.values());
      
      const items: TriviaItem[] = uniquePools.map(pool => {
        let questionText = pool.title;
        let optionsList: string[] = [];
        let isChallenge = false;
        let questionCount = 1;
        let correctAns = pool.correct_answer;
        
        if (pool.options && Array.isArray(pool.options)) {
          if (pool.options.length > 0 && typeof pool.options[0] === 'object' && pool.options[0]?.question) {
            isChallenge = pool.options.length > 1;
            questionCount = pool.options.length;
            const firstQ = pool.options[0];
            questionText = firstQ.question || pool.title;
            optionsList = firstQ.options || [];
            correctAns = firstQ.answer || pool.correct_answer;
          } else {
            optionsList = pool.options.filter((o: any) => typeof o === 'string');
          }
        }
        
        return {
          id: pool.id,
          title: pool.title,
          question: questionText,
          options: optionsList,
          correctAnswer: correctAns,
          category: pool.category,
          pointsReward: pool.points_reward || 10,
          isChallenge,
          questionCount,
          rawOptions: pool.options
        };
      }).filter(item => item.options.length > 0);
      
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
      const points = isCorrect ? pointsReward : 0;
      
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
        title: result.isCorrect ? `Correct! +${result.points} points` : 'Wrong!',
        description: result.isCorrect ? 'Nice work!' : 'Better luck next time!',
      });
      
      setTimeout(() => {
        if (data && currentIndex < data.length - 1) {
          scrollToNext();
        }
      }, 4000);
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

  const handleSelectAndSubmit = (item: TriviaItem, option: string) => {
    setSelectedAnswer(prev => ({ ...prev, [item.id]: option }));
    answerMutation.mutate({
      questionId: item.id,
      answer: option,
      pointsReward: item.pointsReward,
      correctAnswer: item.correctAnswer
    });
  };

  if (!session) return null;

  if (isLoading) {
    return (
      <Card className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        </div>
      </Card>
    );
  }

  if (isError || !data || data.length === 0) return null;

  const knownCategories = ['movies', 'tv', 'books', 'music', 'sports', 'podcasts', 'games'];
  
  const filteredData = category 
    ? category.toLowerCase() === 'other'
      ? data.filter(item => !item.category || !knownCategories.includes(item.category.toLowerCase()))
      : data.filter(item => item.category?.toLowerCase() === category.toLowerCase())
    : data;

  if (filteredData.length === 0) return null;

  return (
    <>
      <Card className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm overflow-hidden relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {category ? (
              <>
                <div className="w-7 h-7 rounded-full bg-purple-900 flex items-center justify-center">
                  <Brain className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{category}</p>
                  <p className="text-[10px] text-gray-500">{filteredData.length} trivia questions</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-7 h-7 rounded-full bg-purple-900 flex items-center justify-center">
                  <Brain className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Quick Trivia</p>
                  <p className="text-[10px] text-gray-500">Test your knowledge</p>
                </div>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {currentIndex > 0 && (
              <button
                onClick={scrollToPrev}
                className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
            )}
            {currentIndex < filteredData.length - 1 && (
              <button
                onClick={scrollToNext}
                className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            )}
            <span className="text-xs text-gray-500 ml-1">
              {currentIndex + 1}/{filteredData.length}
            </span>
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-1 px-1"
        >
          {filteredData.map((item) => {
            const answered = answeredQuestions[item.id];
            const selected = selectedAnswer[item.id];
            
            if (item.isChallenge) {
              return (
                <div key={item.id} className="flex-shrink-0 w-full snap-center">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 border border-green-200">
                      <span className="text-xs text-green-700 font-medium">+{item.pointsReward} pts</span>
                    </div>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200">
                      <span className="text-xs text-amber-700 font-medium">{item.questionCount} questions</span>
                    </div>
                  </div>
                  
                  <h3 className="text-gray-900 font-semibold text-base mb-3">{item.title}</h3>
                  <p className="text-gray-500 text-sm mb-4">Challenge yourself with {item.questionCount} trivia questions!</p>
                  
                  {answered ? (
                    <div className="py-3 px-4 rounded-xl bg-green-50 border border-green-200 text-center">
                      <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-1" />
                      <span className="text-sm text-green-600">Challenge Completed!</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectedChallenge(item)}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-slate-900 via-purple-900 to-indigo-900 hover:from-slate-800 hover:via-purple-800 hover:to-indigo-800 text-white font-medium flex items-center justify-center gap-2 transition-colors"
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
                <div className="inline-flex items-center gap-1 mb-3 px-2 py-0.5 rounded-full bg-green-100 border border-green-200">
                  <span className="text-xs text-green-700 font-medium">+{item.pointsReward} pts</span>
                </div>
                
                <h3 className="text-gray-900 font-semibold text-base mb-3">{item.question}</h3>
                
                {!answered ? (
                  <div className="flex flex-col gap-2">
                    {item.options.slice(0, 4).map((option, idx) => (
                      <button
                        key={idx}
                        className={`py-3 px-4 rounded-full border text-sm font-medium transition-all text-left ${
                          selected === option 
                            ? 'bg-gradient-to-r from-slate-800 via-purple-900 to-indigo-900 border-purple-500/50 text-white shadow-lg' 
                            : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => handleSelectAndSubmit(item, option)}
                        disabled={answerMutation.isPending}
                      >
                        {option}
                      </button>
                    ))}
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
                          className={`relative py-3 px-4 rounded-full border overflow-hidden ${
                            isUserAnswer && isCorrect
                              ? 'border-green-500 bg-gradient-to-r from-slate-800 via-purple-900 to-indigo-900'
                              : isUserAnswer && !isCorrect
                                ? 'border-red-500 bg-red-50'
                                : isCorrect
                                  ? 'border-green-500 bg-gradient-to-r from-slate-800 via-purple-900 to-indigo-900'
                                  : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div className="relative flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              {isCorrect && <Trophy className={`w-4 h-4 ${isCorrect ? 'text-white' : 'text-green-500'}`} />}
                              {isUserAnswer && !isCorrect && <XCircle className="w-4 h-4 text-red-500" />}
                              <span className={`text-sm ${isCorrect ? 'text-white font-medium' : 'text-gray-700'}`}>{option}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className={`w-3 h-3 ${isCorrect ? 'text-white/70' : 'text-gray-400'}`} />
                              <span className={`text-sm ${isCorrect ? 'text-white font-bold' : 'text-gray-400'}`}>{percentage}%</span>
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
        
        {!category && (
          <Link href="/leaderboard">
            <div className="flex items-center justify-center gap-1.5 pt-2 border-t border-gray-200 cursor-pointer hover:opacity-80 transition-opacity">
              <Trophy className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-xs text-purple-600 font-medium">
                {leaderboardData?.isFirst 
                  ? "Keep playing to stay ahead!" 
                  : leaderboardData?.nextPerson 
                    ? `Get ${leaderboardData.pointsNeeded} more right to pass ${leaderboardData.nextPerson}`
                    : "Play to climb the leaderboard"}
              </span>
            </div>
          </Link>
        )}

        {answerMutation.isPending && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-2xl">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
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
