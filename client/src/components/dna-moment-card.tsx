import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { Dna, Loader2, Users, Sparkles } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';

interface DnaMoment {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  category: string;
}

interface DnaMomentData {
  moment: DnaMoment | null;
  hasAnswered: boolean;
  userAnswer: string | null;
  stats: {
    totalResponses: number;
    optionAPercent: number;
    optionBPercent: number;
  };
  friendResponses: any[];
}

export function DnaMomentCard() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [selectedAnswer, setSelectedAnswer] = useState<'a' | 'b' | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [resultData, setResultData] = useState<any>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dna-moment'],
    queryFn: async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/get-dna-moment`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load DNA moment');
      }
      
      return await response.json() as DnaMomentData;
    },
    enabled: !!session?.access_token
  });

  useEffect(() => {
    if (!data?.moment) return;
    
    if (data.hasAnswered) {
      setShowResults(true);
      setSelectedAnswer(data.userAnswer as 'a' | 'b' | null);
      setResultData({
        stats: data.stats,
        friendResponses: data.friendResponses,
      });
    } else {
      setShowResults(false);
      setSelectedAnswer(null);
      setResultData(null);
    }
  }, [data?.moment?.id, data?.hasAnswered]);

  const answerMutation = useMutation({
    mutationFn: async (answer: 'a' | 'b') => {
      if (!data?.moment || !session?.access_token) throw new Error('Missing data');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/answer-dna-moment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          momentId: data.moment.id,
          answer
        })
      });
      
      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result;
    },
    onSuccess: (result) => {
      setShowResults(true);
      setResultData(result);
      queryClient.invalidateQueries({ queryKey: ['dna-moment'] });
      
      toast({
        title: `+${result.pointsEarned} points!`,
        description: result.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleAnswer = (answer: 'a' | 'b') => {
    setSelectedAnswer(answer);
    answerMutation.mutate(answer);
  };

  if (!session) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-purple-900/40 via-indigo-900/30 to-blue-900/40 border-purple-500/30 p-4 mb-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
        </div>
      </Card>
    );
  }

  if (isError || !data?.moment) {
    return null;
  }

  const { moment, stats } = data;

  return (
    <Card className="bg-gradient-to-br from-purple-900/40 via-indigo-900/30 to-blue-900/40 border-purple-500/30 p-4 mb-4 overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
          <Dna className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <p className="text-xs text-purple-300 font-medium uppercase tracking-wide">DNA Moment</p>
          <p className="text-[10px] text-gray-400">Shapes your Entertainment DNA</p>
        </div>
        {stats.totalResponses > 0 && (
          <div className="ml-auto flex items-center gap-1 text-xs text-gray-400">
            <Users className="w-3 h-3" />
            <span>{stats.totalResponses}</span>
          </div>
        )}
      </div>

      <h3 className="text-white font-semibold text-lg mb-4">{moment.questionText}</h3>

      {!showResults ? (
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className={`h-auto py-4 px-4 text-left flex flex-col items-center justify-center border-2 transition-all duration-200 ${
              selectedAnswer === 'a' 
                ? 'border-purple-500 bg-purple-500/20 text-white' 
                : 'border-gray-600 bg-gray-800/50 text-gray-200 hover:border-purple-400 hover:bg-purple-500/10'
            }`}
            onClick={() => handleAnswer('a')}
            disabled={answerMutation.isPending}
          >
            <span className="text-base font-medium">{moment.optionA}</span>
          </Button>
          <Button
            variant="outline"
            className={`h-auto py-4 px-4 text-left flex flex-col items-center justify-center border-2 transition-all duration-200 ${
              selectedAnswer === 'b' 
                ? 'border-purple-500 bg-purple-500/20 text-white' 
                : 'border-gray-600 bg-gray-800/50 text-gray-200 hover:border-purple-400 hover:bg-purple-500/10'
            }`}
            onClick={() => handleAnswer('b')}
            disabled={answerMutation.isPending}
          >
            <span className="text-base font-medium">{moment.optionB}</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className={`relative p-3 rounded-lg border-2 ${
              selectedAnswer === 'a' ? 'border-purple-500 bg-purple-500/20' : 'border-gray-700 bg-gray-800/30'
            }`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-white">{moment.optionA}</span>
                <span className="text-lg font-bold text-purple-300">{resultData?.stats?.optionAPercent || stats.optionAPercent}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${resultData?.stats?.optionAPercent || stats.optionAPercent}%` }}
                />
              </div>
              {selectedAnswer === 'a' && (
                <div className="absolute -top-2 -right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
            <div className={`relative p-3 rounded-lg border-2 ${
              selectedAnswer === 'b' ? 'border-purple-500 bg-purple-500/20' : 'border-gray-700 bg-gray-800/30'
            }`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-white">{moment.optionB}</span>
                <span className="text-lg font-bold text-purple-300">{resultData?.stats?.optionBPercent || stats.optionBPercent}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${resultData?.stats?.optionBPercent || stats.optionBPercent}%` }}
                />
              </div>
              {selectedAnswer === 'b' && (
                <div className="absolute -top-2 -right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
          </div>

          {resultData?.matchingFriends && resultData.matchingFriends.length > 0 && (
            <div className="pt-2 border-t border-gray-700/50">
              <p className="text-xs text-gray-400 mb-2">Friends who agree with you:</p>
              <div className="flex gap-2">
                {resultData.matchingFriends.slice(0, 3).map((friend: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-1.5 bg-purple-500/10 rounded-full px-2 py-1">
                    <div className="w-5 h-5 rounded-full bg-purple-500/30 flex items-center justify-center text-[10px] font-medium text-purple-300">
                      {friend.users?.display_name?.[0] || '?'}
                    </div>
                    <span className="text-xs text-gray-300">{friend.users?.display_name || 'Friend'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-center text-purple-300/70 pt-1">
            Your DNA is evolving...
          </p>
        </div>
      )}

      {answerMutation.isPending && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
          <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
        </div>
      )}
    </Card>
  );
}
