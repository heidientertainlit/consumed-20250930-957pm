import { Flame } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { trackEvent } from '@/lib/posthog';
import { Calendar, Trophy, CheckCircle, Loader2, Send, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { incrementActivityCount } from '@/components/dna-survey-nudge';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';

interface DailyChallenge {
  id: string;
  scheduled_date: string;
  challenge_type: 'trivia' | 'poll' | 'predict' | 'rank' | 'custom';
  title: string;
  description: string | null;
  options: string[] | null;
  correct_answer: string | null;
  points_reward: number;
  category: string | null;
  icon: string;
  status: string;
}

interface DailyChallengeResponse {
  id: string;
  challenge_id: string;
  user_id: string;
  response: any;
  points_earned: number;
}

export function DailyChallengeCard() {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [customResponse, setCustomResponse] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{ isCorrect: boolean; correctAnswer: string; userAnswer: string } | null>(null);
  const [runInfo, setRunInfo] = useState<{ currentRun: number; bonusPoints: number; nextMilestone: number; longestRun: number } | null>(null);

  const { data: challenge, isLoading: challengeLoading } = useQuery({
    queryKey: ['daily-challenge'],
    queryFn: async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/daily-challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({ action: 'getToday' })
      });
      
      const data = await response.json();
      if (data.error || !data.challenge) {
        console.log('No daily challenge for today');
        return null;
      }
      console.log('Found daily challenge:', data.challenge);
      return data.challenge as DailyChallenge;
    }
  });

  const { data: existingResponseData } = useQuery({
    queryKey: ['daily-challenge-response', challenge?.id],
    queryFn: async () => {
      if (!challenge || !session?.access_token) return null;
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/daily-challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          action: 'checkResponse',
          challengeId: challenge.id 
        })
      });
      
      const data = await response.json();
      if (data.hasResponded) {
        // If we have run info from a previous session, set it
        if (data.run && !runInfo) {
          setRunInfo(data.run);
        }
        return { response: data.response as DailyChallengeResponse, run: data.run };
      }
      return null;
    },
    enabled: !!challenge && !!session?.access_token
  });

  const existingResponse = existingResponseData?.response;

  const submitMutation = useMutation({
    mutationFn: async (responseData: any) => {
      if (!challenge || !session?.access_token) throw new Error('Missing data');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/daily-challenge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          action: 'submit',
          challengeId: challenge.id,
          response: responseData
        })
      });
      
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      return { 
        pointsEarned: data.pointsEarned, 
        isCorrect: data.isCorrect,
        correctAnswer: data.correctAnswer,
        run: data.run
      };
    },
    onSuccess: (result) => {
      setHasSubmitted(true);
      setSubmittedResult({
        isCorrect: result.isCorrect,
        correctAnswer: result.correctAnswer || '',
        userAnswer: selectedOption || ''
      });
      if (result.run) {
        setRunInfo(result.run);
      }
      queryClient.invalidateQueries({ queryKey: ['daily-challenge-response'] });
      
      incrementActivityCount();
      trackEvent('daily_challenge_completed', { 
        points_earned: result.pointsEarned, 
        is_correct: result.isCorrect,
        challenge_type: challenge?.challenge_type 
      });
      
      // Feedback shown inline - no toast needed
    },
    onError: (error: any) => {
      if (error.message?.includes('Already submitted')) {
        toast({
          title: "Already submitted",
          description: "You've already completed today's challenge!"
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to submit response",
          variant: "destructive"
        });
      }
    }
  });

  const fallbackChallenge: DailyChallenge = {
    id: 'fallback-daily',
    scheduled_date: new Date().toISOString().split('T')[0],
    challenge_type: 'trivia',
    title: 'Which streaming service originally aired Squid Game?',
    description: 'Test your entertainment knowledge!',
    options: ['Netflix', 'Amazon Prime', 'Hulu', 'Disney+'],
    correct_answer: 'Netflix',
    points_reward: 10,
    category: 'TV',
    icon: '🎬',
    status: 'active'
  };

  const displayChallenge = challenge || fallbackChallenge;
  const isFallback = !challenge;

  const handleSubmit = () => {
    if (isFallback) {
      const isCorrect = selectedOption === fallbackChallenge.correct_answer;
      setHasSubmitted(true);
      setSubmittedResult({
        isCorrect,
        correctAnswer: fallbackChallenge.correct_answer || '',
        userAnswer: selectedOption || ''
      });
      // Feedback shown inline - no toast needed
      return;
    }
    
    if (displayChallenge.challenge_type === 'custom') {
      if (!customResponse.trim()) return;
      submitMutation.mutate({ text: customResponse });
    } else {
      if (!selectedOption) return;
      submitMutation.mutate({ answer: selectedOption });
    }
  };

  // Fetch challenge stats (percentage who answered correctly and friend responses)
  const { data: challengeStats } = useQuery({
    queryKey: ['daily-challenge-stats', challenge?.id, user?.id],
    queryFn: async () => {
      if (!challenge || !session?.access_token || !user?.id) return null;
      
      // First get the user's friends
      const { data: friendships } = await supabase
        .from('friendships')
        .select('friend_id, user_id')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted');
      
      const friendIds = (friendships || []).map((f: any) => 
        f.user_id === user.id ? f.friend_id : f.user_id
      );
      
      // Get total responses and correct count
      const { data: responses, error } = await supabase
        .from('daily_challenge_responses')
        .select('response, user_id, users!inner(username, display_name, avatar_url)')
        .eq('challenge_id', challenge.id)
        .limit(100);
      
      if (error || !responses) return { totalResponses: 0, correctPercentage: 0, friendResponses: [] };
      
      const totalResponses = responses.length;
      const correctResponses = responses.filter((r: any) => 
        r.response?.answer === challenge.correct_answer
      ).length;
      const correctPercentage = totalResponses > 0 ? Math.round((correctResponses / totalResponses) * 100) : 0;
      
      // Filter to only friend responses
      const friendResponsesFiltered = responses.filter((r: any) => friendIds.includes(r.user_id));
      const friendResponses = friendResponsesFiltered.slice(0, 3).map((r: any) => ({
        username: r.users?.display_name || r.users?.username || 'User',
        avatar: r.users?.avatar_url,
        isCorrect: r.response?.answer === challenge.correct_answer
      }));
      
      return { totalResponses, correctPercentage, friendResponses };
    },
    enabled: !!challenge && !!session?.access_token && !!user?.id
  });

  if (challengeLoading) {
    return (
      <Card className="p-4 bg-gradient-to-r from-slate-900 via-purple-900 to-indigo-900 border-0">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-white" />
        </div>
      </Card>
    );
  }

  const alreadyCompleted = !!existingResponse || hasSubmitted;

  return (
    <Card 
      className="bg-gradient-to-r from-slate-900 via-purple-900 to-indigo-900 border border-purple-500/30 rounded-xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
      onClick={() => setIsExpanded(!isExpanded)}
      data-testid="daily-challenge-card"
    >
      {/* Collapsed Header - Simple design */}
      <div className="w-full p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <Play className="w-5 h-5 text-white fill-white" />
          <div className="text-left flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">The Daily Call</span>
              {!alreadyCompleted && (
                <span className="text-[10px] text-blue-400 font-medium">LIVE</span>
              )}
              {alreadyCompleted && (
                <CheckCircle className="w-4 h-4 text-green-400" />
              )}
            </div>
            <p className="text-xs text-gray-400 line-clamp-1">{displayChallenge.title}</p>
          </div>
        </div>
        
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 border-t border-white/20" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1 text-xs text-white/70 mt-3 mb-3">
            <Calendar className="w-3 h-3" />
            {new Date(displayChallenge.scheduled_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          
          <h3 className="text-lg font-bold text-white mb-2">{displayChallenge.title}</h3>
          {displayChallenge.description && (
            <p className="text-sm text-white/80 mb-4">{displayChallenge.description}</p>
          )}

          {alreadyCompleted ? (
            <div className="space-y-2">
              {displayChallenge.options?.map((option, idx) => {
                const isCorrect = option === (submittedResult?.correctAnswer || displayChallenge.correct_answer);
                const isUserAnswer = option === (submittedResult?.userAnswer || existingResponse?.response?.answer);
                
                return (
                  <div 
                    key={idx}
                    className={`relative py-3 px-4 rounded-2xl overflow-hidden ${
                      isCorrect 
                        ? 'bg-green-500/30 border border-green-400/50' 
                        : isUserAnswer && !isCorrect
                          ? 'bg-red-500/20 border border-red-400/30'
                          : 'bg-white/15 border border-white/20'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {isCorrect && <CheckCircle className="w-4 h-4 text-green-400" />}
                        <span className="text-sm text-white font-medium">{option}</span>
                      </div>
                      {isCorrect && (
                        <span className="text-xs text-green-300 font-medium">Correct Answer</span>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-white/20">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-white font-medium">
                  +{existingResponse?.points_earned || displayChallenge.points_reward} points earned
                </span>
              </div>
              
              {/* Daily Run Info */}
              {(runInfo || existingResponseData?.run) && (
                <div className="mt-3 pt-3 border-t border-white/20 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Flame className="w-4 h-4 text-orange-400" />
                    <span className="text-sm font-bold text-orange-300">
                      {(runInfo?.currentRun || existingResponseData?.run?.currentRun || 1)} day{(runInfo?.currentRun || existingResponseData?.run?.currentRun || 1) !== 1 ? 's' : ''} in a row!
                    </span>
                  </div>
                  {runInfo?.bonusPoints && runInfo.bonusPoints > 0 && (
                    <div className="text-xs text-yellow-300 font-medium mb-1">
                      🎉 Milestone bonus: +{runInfo.bonusPoints} points!
                    </div>
                  )}
                  <p className="text-xs text-white/60">
                    {(() => {
                      const currentRun = runInfo?.currentRun || existingResponseData?.run?.currentRun || 1;
                      const nextMilestone = runInfo?.nextMilestone || existingResponseData?.run?.nextMilestone || 3;
                      const longestRun = runInfo?.longestRun || existingResponseData?.run?.longestRun || 1;
                      if (currentRun < nextMilestone) {
                        const daysLeft = nextMilestone - currentRun;
                        return `Keep it up! ${daysLeft} more day${daysLeft !== 1 ? 's' : ''} until bonus points`;
                      }
                      return `You're on fire! Best run: ${longestRun} days`;
                    })()}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              {displayChallenge.challenge_type === 'custom' ? (
                <div className="space-y-3">
                  <Textarea
                    value={customResponse}
                    onChange={(e) => setCustomResponse(e.target.value)}
                    placeholder="Share your answer..."
                    className="min-h-[80px] bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                  />
                  <Button
                    onClick={handleSubmit}
                    disabled={!customResponse.trim() || submitMutation.isPending}
                    className="w-full bg-white text-purple-900 hover:bg-gray-100 font-semibold"
                    data-testid="submit-custom-challenge"
                  >
                    {submitMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Submit Response
                  </Button>
                </div>
              ) : displayChallenge.options ? (
                <div className="space-y-2">
                  {displayChallenge.options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => { e.stopPropagation(); setSelectedOption(option); }}
                      className={`w-full p-3 rounded-2xl text-left transition-all ${
                        selectedOption === option
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg ring-2 ring-white font-semibold'
                          : 'bg-white/30 text-white hover:bg-white/40'
                      }`}
                      data-testid={`challenge-option-${idx}`}
                    >
                      {option}
                    </button>
                  ))}
                  <Button
                    onClick={(e) => { e.stopPropagation(); handleSubmit(); }}
                    disabled={!selectedOption || submitMutation.isPending}
                    className="w-full mt-3 bg-white/30 hover:bg-white/40 text-white font-semibold"
                    data-testid="submit-challenge"
                  >
                    {submitMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Submit
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
