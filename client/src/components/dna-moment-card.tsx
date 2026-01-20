import { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { Dna, Loader2, Users, Sparkles, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';

interface DnaMoment {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC?: string;
  category: string;
}

interface DnaMomentData {
  moment: DnaMoment | null;
  moments?: DnaMoment[];
  hasAnswered: boolean;
  userAnswer: string | null;
  stats: {
    totalResponses: number;
    optionAPercent: number;
    optionBPercent: number;
    optionCPercent?: number;
  };
  friendResponses: any[];
}

export function DnaMomentCard() {
  const { session } = useAuth();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answeredMoments, setAnsweredMoments] = useState<Set<string>>(new Set());
  const [momentResults, setMomentResults] = useState<Record<string, any>>({});

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dna-moments-carousel'],
    queryFn: async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/get-dna-moment?count=5`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load DNA moments');
      }
      
      const result = await response.json();
      
      if (result.moments && result.moments.length > 0) {
        return result as { moments: DnaMoment[], answeredIds: string[] };
      }
      
      if (result.moment) {
        return { moments: [result.moment], answeredIds: result.hasAnswered ? [result.moment.id] : [] };
      }
      
      return { moments: [], answeredIds: [] };
    },
    enabled: !!session?.access_token
  });

  useEffect(() => {
    if (data?.answeredIds) {
      setAnsweredMoments(new Set(data.answeredIds));
    }
  }, [data?.answeredIds]);

  const answerMutation = useMutation({
    mutationFn: async ({ momentId, answer }: { momentId: string, answer: 'a' | 'b' }) => {
      if (!session?.access_token) throw new Error('Missing data');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/answer-dna-moment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ momentId, answer })
      });
      
      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }
      
      return { momentId, result };
    },
    onSuccess: ({ momentId, result }) => {
      setAnsweredMoments(prev => new Set([...prev, momentId]));
      setMomentResults(prev => ({ ...prev, [momentId]: result }));
      
      toast({
        title: `+${result.pointsEarned} points!`,
        description: result.message,
      });
      
      setTimeout(() => {
        if (data?.moments && currentIndex < data.moments.length - 1) {
          scrollToNext();
        }
      }, 4000);
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
    if (scrollRef.current && data?.moments && currentIndex < data.moments.length - 1) {
      const cardWidth = scrollRef.current.children[0]?.clientWidth || 280;
      scrollRef.current.scrollBy({ left: cardWidth + 12, behavior: 'smooth' });
      setCurrentIndex(prev => Math.min(prev + 1, data.moments.length - 1));
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
    if (scrollRef.current && data?.moments) {
      const cardWidth = scrollRef.current.children[0]?.clientWidth || 280;
      const scrollLeft = scrollRef.current.scrollLeft;
      const newIndex = Math.round(scrollLeft / (cardWidth + 12));
      setCurrentIndex(Math.min(Math.max(newIndex, 0), data.moments.length - 1));
    }
  };

  if (!session) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        </div>
      </Card>
    );
  }

  if (isError || !data?.moments || data.moments.length === 0) {
    return null;
  }

  const moments = data.moments;

  return (
    <Card className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm overflow-hidden relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
            <Dna className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">DNA Moments</p>
            <p className="text-[10px] text-gray-500">Build your Entertainment DNA</p>
          </div>
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
          {currentIndex < moments.length - 1 && (
            <button
              onClick={scrollToNext}
              className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          )}
          <span className="text-xs text-gray-400 ml-1">
            {currentIndex + 1}/{moments.length}
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-1 px-1"
      >
        {moments.map((moment, index) => {
          const isAnswered = answeredMoments.has(moment.id);
          const result = momentResults[moment.id];
          
          return (
            <div
              key={moment.id}
              className="flex-shrink-0 w-full snap-center"
            >
              <h3 className="text-gray-900 font-semibold text-base mb-3">{moment.questionText}</h3>
              
              {!isAnswered ? (
                <div className="flex flex-col gap-2">
                  <button
                    className="py-2.5 px-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm font-medium hover:bg-purple-50 hover:border-purple-300 transition-all text-left"
                    onClick={() => answerMutation.mutate({ momentId: moment.id, answer: 'a' })}
                    disabled={answerMutation.isPending}
                  >
                    {moment.optionA}
                  </button>
                  <button
                    className="py-2.5 px-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm font-medium hover:bg-purple-50 hover:border-purple-300 transition-all text-left"
                    onClick={() => answerMutation.mutate({ momentId: moment.id, answer: 'b' })}
                    disabled={answerMutation.isPending}
                  >
                    {moment.optionB}
                  </button>
                  {moment.optionC && (
                    <button
                      className="py-2.5 px-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm font-medium hover:bg-purple-50 hover:border-purple-300 transition-all text-left"
                      onClick={() => answerMutation.mutate({ momentId: moment.id, answer: 'c' })}
                      disabled={answerMutation.isPending}
                    >
                      {moment.optionC}
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs text-gray-700">{moment.optionA}</span>
                      <span className="text-sm font-bold text-purple-600">{result?.stats?.optionAPercent || 33}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${result?.stats?.optionAPercent || 33}%` }}
                      />
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs text-gray-700">{moment.optionB}</span>
                      <span className="text-sm font-bold text-purple-600">{result?.stats?.optionBPercent || 33}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${result?.stats?.optionBPercent || 33}%` }}
                      />
                    </div>
                  </div>
                  {moment.optionC && (
                    <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs text-gray-700">{moment.optionC}</span>
                        <span className="text-sm font-bold text-purple-600">{result?.stats?.optionCPercent || 33}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-500 rounded-full transition-all duration-500"
                          style={{ width: `${result?.stats?.optionCPercent || 33}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <Link href="/entertainment-dna">
        <div className="flex items-center justify-center gap-1.5 mt-4 pt-3 border-t border-gray-100 cursor-pointer hover:opacity-80 transition-opacity">
          <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          <span className="text-xs text-gray-600 font-medium">See your Entertainment DNA profile</span>
          <ArrowRight className="w-3 h-3 text-gray-400" />
        </div>
      </Link>

      {answerMutation.isPending && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-2xl">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        </div>
      )}
    </Card>
  );
}
