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
import { Calendar, Trophy, CheckCircle, Loader2, Send, Play, ChevronDown, ChevronUp } from 'lucide-react';

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

  const { data: existingResponse } = useQuery({
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
        return data.response as DailyChallengeResponse;
      }
      return null;
    },
    enabled: !!challenge && !!session?.access_token
  });

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
        correctAnswer: data.correctAnswer
      };
    },
    onSuccess: (result) => {
      setHasSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['daily-challenge-response'] });
      
      if (challenge?.challenge_type === 'trivia') {
        if (result.isCorrect) {
          toast({
            title: "Correct! 🎉",
            description: `You earned ${result.pointsEarned} points!`
          });
        } else {
          toast({
            title: "Not quite!",
            description: `The correct answer was: ${result.correctAnswer}`
          });
        }
      } else {
        toast({
          title: "Challenge Complete! 🎯",
          description: `You earned ${result.pointsEarned} points!`
        });
      }
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
      if (isCorrect) {
        toast({
          title: "Correct! 🎉",
          description: `You earned ${fallbackChallenge.points_reward} points!`
        });
      } else {
        toast({
          title: "Not quite!",
          description: `The correct answer was: ${fallbackChallenge.correct_answer}`
        });
      }
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

  if (challengeLoading) {
    return (
      <Card className="p-4 bg-gradient-to-r from-cyan-500 to-blue-500 border-cyan-400/50">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
        </div>
      </Card>
    );
  }

  const alreadyCompleted = !!existingResponse || hasSubmitted;

  return (
    <Card 
      className="bg-gradient-to-r from-cyan-500 to-blue-500 border-cyan-400/50 overflow-hidden"
      data-testid="daily-challenge-card"
    >
      {/* Collapsed Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Play className="w-6 h-6 text-purple-400 fill-purple-400" />
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Daily Challenge</span>
              {alreadyCompleted && (
                <CheckCircle className="w-4 h-4 text-green-400" />
              )}
            </div>
            <p className="text-xs text-gray-400 line-clamp-1">{displayChallenge.title}</p>
          </div>
        </div>
        <div className="flex items-center">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 border-t border-purple-500/20">
          <div className="flex items-center gap-1 text-xs text-gray-400 mt-3 mb-3">
            <Calendar className="w-3 h-3" />
            {new Date(displayChallenge.scheduled_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          
          <h3 className="text-lg font-bold text-white mb-2">{displayChallenge.title}</h3>
          {displayChallenge.description && (
            <p className="text-sm text-gray-300 mb-4">{displayChallenge.description}</p>
          )}

          {alreadyCompleted ? (
            <div className="flex items-center gap-2 p-3 bg-green-500/20 rounded-lg border border-green-500/30">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-green-300 font-medium">Challenge Complete!</p>
                {existingResponse && (
                  <p className="text-xs text-green-400/70">
                    You earned {existingResponse.points_earned} points
                  </p>
                )}
              </div>
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
                    className="w-full bg-purple-600 hover:bg-purple-700"
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
                      onClick={() => setSelectedOption(option)}
                      className={`w-full p-3 rounded-lg text-left transition-all ${
                        selectedOption === option
                          ? 'bg-purple-600 text-white border-2 border-purple-400'
                          : 'bg-white/10 text-gray-200 border-2 border-transparent hover:bg-white/20'
                      }`}
                      data-testid={`challenge-option-${idx}`}
                    >
                      {option}
                    </button>
                  ))}
                  <Button
                    onClick={handleSubmit}
                    disabled={!selectedOption || submitMutation.isPending}
                    className="w-full mt-3 bg-purple-600 hover:bg-purple-700"
                    data-testid="submit-challenge"
                  >
                    {submitMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Submit Answer
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
