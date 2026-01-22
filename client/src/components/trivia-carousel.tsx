import { useState, useRef, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { trackEvent } from '@/lib/posthog';
import { Brain, Loader2, ChevronLeft, ChevronRight, Trophy, Users, CheckCircle, XCircle } from 'lucide-react';

interface TriviaItem {
  id: string;
  title: string;
  question: string;
  options: string[];
  correctAnswer?: string;
  category?: string;
  mediaTitle?: string;
  pointsReward: number;
  isChallenge: boolean;
  questionCount: number;
  rawOptions: any;
  poolId?: string;
  questionIndex?: number;
}

interface FriendAnswer {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  answer: string;
  isCorrect: boolean;
}

interface TriviaCarouselProps {
  expanded?: boolean;
  category?: string;
  challengesOnly?: boolean;
}

export function TriviaCarousel({ expanded = false, category, challengesOnly = false }: TriviaCarouselProps) {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<Record<string, string>>({});
  const [answeredQuestions, setAnsweredQuestions] = useState<Record<string, { answer: string; isCorrect: boolean; stats: any; friendAnswers?: FriendAnswer[] }>>({});

  const { data: leaderboardData } = useQuery({
    queryKey: ['trivia-leaderboard-position', user?.id, session?.access_token],
    queryFn: async () => {
      if (!user?.id || !session?.access_token) return { position: null, nextPerson: null };
      
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-leaderboards?category=trivia&scope=global&period=weekly`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (!response.ok) return { position: null, nextPerson: null };
        
        const data = await response.json();
        const triviaLeaderboard = data?.categories?.trivia || [];
        
        const userIndex = triviaLeaderboard.findIndex((p: any) => p.user_id === user.id);
        
        if (userIndex === 0) return { position: 1, nextPerson: null, isFirst: true };
        
        if (userIndex > 0) {
          const nextPerson = triviaLeaderboard[userIndex - 1];
          const userScore = triviaLeaderboard[userIndex]?.score || 0;
          const nextScore = nextPerson?.score || 0;
          const pointsNeeded = Math.max(1, Math.ceil((nextScore - userScore) / 10));
          
          return { 
            position: userIndex + 1, 
            nextPerson: nextPerson?.display_name || 'someone',
            pointsNeeded
          };
        }
        
        // User not in leaderboard, show generic message with position estimate
        return { 
          position: triviaLeaderboard.length + 1, 
          nextPerson: triviaLeaderboard[triviaLeaderboard.length - 1]?.display_name || 'someone',
          pointsNeeded: 3
        };
      } catch (error) {
        console.error('Leaderboard fetch error:', error);
        return { position: null, nextPerson: null };
      }
    },
    enabled: !!user?.id && !!session?.access_token,
    staleTime: 30000
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['trivia-carousel', user?.id],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data: pools, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('type', 'trivia')
        .eq('status', 'open')
        .or(`publish_at.is.null,publish_at.lte.${now}`)
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
      
      // Flatten pools into individual trivia questions
      const items: TriviaItem[] = [];
      
      for (const pool of unansweredPools) {
        if (pool.options && Array.isArray(pool.options)) {
          const firstOpt = pool.options[0];
          const isObject = typeof firstOpt === 'object' && firstOpt !== null;
          const hasQuestion = isObject && 'question' in firstOpt;
          
          if (isObject && hasQuestion) {
            // Pool contains question objects - flatten each into individual trivia items
            for (let i = 0; i < pool.options.length; i++) {
              const q = pool.options[i];
              if (q.question && q.options && Array.isArray(q.options)) {
                // Extract media title from question if not provided in pool
                let mediaTitle = pool.media_title;
                if (!mediaTitle && q.question) {
                  // Try to extract movie/show name from question patterns:
                  // "Movie Name - question?" or "Was Movie Name released before..."
                  const dashMatch = q.question.match(/^(.+?)\s*[-–—]\s*.+\?$/);
                  const wasReleasedMatch = q.question.match(/^Was\s+(.+?)\s+released\s+/i);
                  
                  if (dashMatch) {
                    mediaTitle = dashMatch[1].trim();
                  } else if (wasReleasedMatch) {
                    mediaTitle = wasReleasedMatch[1].trim();
                  }
                }
                
                items.push({
                  id: `${pool.id}_q${i}`,
                  title: pool.title,
                  question: q.question,
                  options: q.options,
                  correctAnswer: q.answer || pool.correct_answer,
                  category: pool.category,
                  mediaTitle: mediaTitle,
                  pointsReward: 10,
                  isChallenge: false,
                  questionCount: 1,
                  rawOptions: pool.options,
                  poolId: pool.id,
                  questionIndex: i
                });
              }
            }
          } else {
            // Simple string options format - single question
            const optionsList = pool.options.filter((o: any) => typeof o === 'string');
            if (optionsList.length > 0) {
              items.push({
                id: pool.id,
                title: pool.title,
                question: pool.title,
                options: optionsList,
                correctAnswer: pool.correct_answer,
                category: pool.category,
                mediaTitle: pool.media_title,
                pointsReward: 10,
                isChallenge: false,
                questionCount: 1,
                rawOptions: pool.options,
                poolId: pool.id,
                questionIndex: 0
              });
            }
          }
        }
      }
      
      return items;
    },
    enabled: !!session?.access_token
  });

  useEffect(() => {
    const loadAnswered = async () => {
      if (!user?.id || !data || data.length === 0) return;
      
      // Get unique pool IDs from our flattened items
      const uniquePoolIds = [...new Set(data.map(q => q.poolId || q.id))];
      
      const { data: predictions } = await supabase
        .from('user_predictions')
        .select('pool_id, prediction')
        .eq('user_id', user.id)
        .in('pool_id', uniquePoolIds);
      
      if (predictions && predictions.length > 0) {
        const answered: Record<string, { answer: string; isCorrect: boolean; stats: any }> = {};
        
        for (const p of predictions) {
          // Find all questions from this pool
          const poolQuestions = data.filter(q => (q.poolId || q.id) === p.pool_id);
          
          for (const question of poolQuestions) {
            // Check if this prediction matches this question's answer
            if (question.options.includes(p.prediction)) {
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
              
              answered[question.id] = {
                answer: p.prediction,
                isCorrect: question?.correctAnswer === p.prediction,
                stats
              };
              break; // Only match one question per prediction
            }
          }
        }
        setAnsweredQuestions(answered);
      }
    };
    
    loadAnswered();
  }, [data, user?.id]);

  const answerMutation = useMutation({
    mutationFn: async ({ itemId, poolId, answer, pointsReward, correctAnswer, options }: { itemId: string; poolId: string; answer: string; pointsReward: number; correctAnswer?: string; options: string[] }) => {
      if (!user?.id) throw new Error('Not logged in');
      
      const { data: existingAnswer } = await supabase
        .from('user_predictions')
        .select('id')
        .eq('user_id', user.id)
        .eq('pool_id', poolId)
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
          pool_id: poolId,
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
        .select('prediction, user_id')
        .eq('pool_id', poolId);
      
      const total = allPredictions?.length || 1;
      const stats: Record<string, number> = {};
      for (const opt of options) {
        const count = allPredictions?.filter(p => p.prediction === opt).length || 0;
        stats[opt] = Math.round((count / total) * 100);
      }
      
      // Fetch friend answers
      let friendAnswers: FriendAnswer[] = [];
      try {
        // Get user's friends
        const { data: friendships } = await supabase
          .from('friendships')
          .select('user_id, friend_id')
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
          .eq('status', 'accepted');
        
        const friendIds = (friendships || []).map(f => 
          f.user_id === user.id ? f.friend_id : f.user_id
        );
        
        if (friendIds.length > 0) {
          // Get friend predictions for this question
          const friendPredictions = (allPredictions || []).filter(p => 
            friendIds.includes(p.user_id) && p.user_id !== user.id
          );
          
          if (friendPredictions.length > 0) {
            // Get friend user info
            const { data: friendUsers } = await supabase
              .from('users')
              .select('id, display_name, first_name, last_name, avatar_url')
              .in('id', friendPredictions.map(p => p.user_id));
            
            friendAnswers = friendPredictions.map(p => {
              const friendUser = friendUsers?.find(u => u.id === p.user_id);
              const displayName = friendUser?.first_name 
                ? `${friendUser.first_name}${friendUser.last_name ? ' ' + friendUser.last_name : ''}`
                : friendUser?.display_name || 'Friend';
              return {
                userId: p.user_id,
                displayName,
                avatarUrl: friendUser?.avatar_url,
                answer: p.prediction,
                isCorrect: p.prediction === correctAnswer
              };
            });
          }
        }
      } catch (err) {
        console.error('Error fetching friend answers:', err);
      }
      
      return { itemId, answer, isCorrect, points, stats, friendAnswers };
    },
    onSuccess: (result) => {
      setAnsweredQuestions(prev => ({
        ...prev,
        [result.itemId]: {
          answer: result.answer,
          isCorrect: result.isCorrect,
          stats: result.stats,
          friendAnswers: result.friendAnswers
        }
      }));
      
      queryClient.invalidateQueries({ queryKey: ['trivia-carousel'] });
      
      toast({
        title: result.isCorrect ? `Correct! +${result.points} points` : 'Wrong!',
        description: result.isCorrect ? 'Nice work!' : 'Better luck next time!',
      });
      
      // No auto-advance - user swipes manually to see next question
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
      itemId: item.id,
      poolId: item.poolId || item.id,
      answer: option,
      pointsReward: item.pointsReward,
      correctAnswer: item.correctAnswer,
      options: item.options
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
  
  let filteredData = data;
  
  // Filter by category
  if (category) {
    if (category.toLowerCase() === 'other') {
      filteredData = filteredData.filter(item => !item.category || !knownCategories.includes(item.category.toLowerCase()));
    } else if (category.toLowerCase() === 'mixed') {
      // Mixed shows items without a specific category or multi-category
      filteredData = filteredData.filter(item => !item.category || item.category.toLowerCase() === 'mixed' || item.category.toLowerCase() === 'entertainment');
    } else {
      filteredData = filteredData.filter(item => item.category?.toLowerCase() === category.toLowerCase());
    }
  }
  
  // Filter by challenges (multi-question trivia)
  if (challengesOnly) {
    console.log(`🎮 TriviaCarousel [${category}] challengesOnly - before filter:`, filteredData.length, 'challenges:', filteredData.filter(i => i.isChallenge).length);
    filteredData = filteredData.filter(item => item.isChallenge);
    console.log(`🎮 TriviaCarousel [${category}] challengesOnly - after filter:`, filteredData.length);
  }

  if (filteredData.length === 0) {
    if (challengesOnly) {
      console.log(`🎮 TriviaCarousel [${category}] - no challenges found, returning null`);
    }
    return null;
  }

  return (
    <>
      <Card className="bg-white border border-gray-200 rounded-2xl p-4 pb-2 shadow-sm overflow-hidden relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {category ? (
              <>
                <div className={`w-7 h-7 rounded-full ${challengesOnly ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-purple-900'} flex items-center justify-center`}>
                  {challengesOnly ? <Trophy className="w-3.5 h-3.5 text-white" /> : <Brain className="w-3.5 h-3.5 text-white" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{category === 'Movies' ? 'Movie' : category} {challengesOnly ? 'Challenges' : 'Trivia'}</p>
                  <p className="text-[10px] text-gray-500">{challengesOnly ? 'Multi-question challenges' : 'One question trivia'}</p>
                </div>
              </>
            ) : (
              <>
                <div className={`w-7 h-7 rounded-full ${challengesOnly ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-purple-900'} flex items-center justify-center`}>
                  {challengesOnly ? <Trophy className="w-3.5 h-3.5 text-white" /> : <Brain className="w-3.5 h-3.5 text-white" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{challengesOnly ? 'Trivia Challenges' : 'Quick Trivia'}</p>
                  <p className="text-[10px] text-gray-500">{challengesOnly ? 'Multi-question challenges' : 'One question trivia'}</p>
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
          className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-1 px-1 items-start"
        >
          {filteredData.map((item) => {
            const answered = answeredQuestions[item.id];
            const selected = selectedAnswer[item.id];
            
            return (
              <div key={item.id} className="flex-shrink-0 w-full snap-center h-auto relative">
                {item.mediaTitle && (
                  <div className="mb-2">
                    <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 border border-purple-200">
                      <span className="text-[10px] text-purple-700 font-medium">{item.mediaTitle}</span>
                    </div>
                  </div>
                )}
                
                <h3 className="text-gray-900 font-semibold text-base leading-snug mb-4">{item.question}</h3>
                
                {!answered ? (
                  <div className="flex flex-col gap-2">
                    {item.options.map((option, idx) => (
                      <button
                        key={idx}
                        className={`py-3 px-4 rounded-full text-sm font-medium transition-all text-left ${
                          selected === option 
                            ? 'bg-purple-600 text-white shadow-md' 
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                        onClick={() => handleSelectAndSubmit(item, option)}
                        disabled={answerMutation.isPending}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {item.options.map((option, idx) => {
                      const isUserAnswer = answered.answer === option;
                      const isCorrect = item.correctAnswer === option;
                      const percentage = answered.stats?.[option] || 0;
                      
                      return (
                        <div 
                          key={idx}
                          className={`relative py-3 px-4 rounded-full overflow-hidden transition-all ${
                            isCorrect
                              ? 'bg-green-100'
                              : isUserAnswer
                                ? 'bg-red-100'
                                : 'bg-gray-100'
                          }`}
                        >
                          <div 
                            className={`absolute inset-0 transition-all duration-1000 ease-out ${
                              isCorrect ? 'bg-green-200/60' : 'bg-gray-200/40'
                            }`} 
                            style={{ width: `${percentage}%` }} 
                          />
                          <div className="relative flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              {isCorrect && <CheckCircle className="w-4 h-4 text-green-600" />}
                              {isUserAnswer && !isCorrect && <XCircle className="w-4 h-4 text-red-500" />}
                              <span className={`text-sm font-medium ${isCorrect ? 'text-green-800' : isUserAnswer ? 'text-red-800' : 'text-gray-800'}`}>
                                {option}
                              </span>
                            </div>
                            <span className="text-xs font-medium text-gray-600">{percentage}%</span>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Friend answers section */}
                    {answered.friendAnswers && answered.friendAnswers.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-4 h-4 text-purple-600" />
                          <span className="text-xs font-semibold text-gray-700">Friends who played</span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {/* Friends who got it right */}
                          {answered.friendAnswers.filter(f => f.isCorrect).length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <div className="flex -space-x-2">
                                {answered.friendAnswers.filter(f => f.isCorrect).slice(0, 4).map((friend, idx) => (
                                  <div 
                                    key={friend.userId}
                                    className="w-7 h-7 rounded-full bg-green-100 border-2 border-white flex items-center justify-center overflow-hidden"
                                    title={friend.displayName}
                                  >
                                    {friend.avatarUrl ? (
                                      <img src={friend.avatarUrl} alt={friend.displayName} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-xs font-medium text-green-700">{friend.displayName.charAt(0).toUpperCase()}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                              <div className="flex items-center gap-1">
                                <CheckCircle className="w-3 h-3 text-green-600" />
                                <span className="text-xs text-green-700 font-medium">
                                  {answered.friendAnswers.filter(f => f.isCorrect).length === 1 
                                    ? answered.friendAnswers.find(f => f.isCorrect)?.displayName
                                    : `${answered.friendAnswers.filter(f => f.isCorrect).length} got it right`}
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {/* Friends who got it wrong */}
                          {answered.friendAnswers.filter(f => !f.isCorrect).length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <div className="flex -space-x-2">
                                {answered.friendAnswers.filter(f => !f.isCorrect).slice(0, 4).map((friend, idx) => (
                                  <div 
                                    key={friend.userId}
                                    className="w-7 h-7 rounded-full bg-red-100 border-2 border-white flex items-center justify-center overflow-hidden"
                                    title={friend.displayName}
                                  >
                                    {friend.avatarUrl ? (
                                      <img src={friend.avatarUrl} alt={friend.displayName} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-xs font-medium text-red-700">{friend.displayName.charAt(0).toUpperCase()}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                              <div className="flex items-center gap-1">
                                <XCircle className="w-3 h-3 text-red-500" />
                                <span className="text-xs text-red-600 font-medium">
                                  {answered.friendAnswers.filter(f => !f.isCorrect).length === 1 
                                    ? answered.friendAnswers.find(f => !f.isCorrect)?.displayName
                                    : `${answered.friendAnswers.filter(f => !f.isCorrect).length} missed it`}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-4">
                  <button 
                    className="flex items-center gap-1 text-xs text-purple-600 font-medium hover:text-purple-700 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (navigator.share) {
                        navigator.share({
                          title: 'Trivia Question',
                          text: `Can you answer this? ${item.question}`,
                          url: window.location.origin
                        });
                      } else {
                        navigator.clipboard.writeText(`Can you answer this? ${item.question} - Play at ${window.location.origin}`);
                        toast({ title: "Link copied!", description: "Share it with your friends" });
                      }
                    }}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Challenge a friend
                  </button>
                  <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-[10px] font-bold">
                    +{item.pointsReward} pts
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {!category && (
          <Link href="/leaderboard">
            <div className="flex items-center justify-center gap-1.5 py-1 border-t border-gray-200 cursor-pointer hover:opacity-80 transition-opacity">
              <Trophy className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-xs text-purple-600 font-medium">
                {leaderboardData?.isFirst 
                  ? "Keep playing to stay ahead!" 
                  : leaderboardData?.nextPerson 
                    ? `Get ${leaderboardData.pointsNeeded} more points to pass ${leaderboardData.nextPerson}`
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

    </>
  );
}
