import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { trackEvent } from '@/lib/posthog';
import { Dna, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import { incrementActivityCount } from '@/components/dna-survey-nudge';

interface DnaMoment {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  category: string;
}

export function DnaMomentFeaturedCard() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [chosenOption, setChosenOption] = useState<'a' | 'b' | null>(null);
  const [stats, setStats] = useState<{ aPercent: number; bPercent: number; total: number } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['dna-moment-featured', session?.user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const userId = session?.user?.id;

      // 1. Try today's scheduled featured question
      const { data: scheduled } = await supabase
        .from('dna_moments')
        .select('*')
        .eq('is_active', true)
        .in('display_type', ['featured', 'both'])
        .gte('display_date', `${today}T00:00:00`)
        .lte('display_date', `${today}T23:59:59`)
        .limit(1)
        .single();

      // 2. Fallback: most recent active featured question
      let moment = scheduled;
      if (!moment) {
        const { data: fallback } = await supabase
          .from('dna_moments')
          .select('*')
          .eq('is_active', true)
          .in('display_type', ['featured', 'both'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        moment = fallback;
      }

      if (!moment) return null;

      // Check if user already answered
      let hasAnswered = false;
      let userAnswer: string | null = null;
      if (userId) {
        const { data: existing } = await supabase
          .from('dna_moment_responses')
          .select('answer')
          .eq('user_id', userId)
          .eq('moment_id', moment.id)
          .single();
        if (existing) {
          hasAnswered = true;
          userAnswer = existing.answer;
        }
      }

      // Get community stats
      const { data: responses } = await supabase
        .from('dna_moment_responses')
        .select('answer')
        .eq('moment_id', moment.id);
      const total = responses?.length || 0;
      const aCount = (responses || []).filter((r: any) => r.answer === 'a').length;
      const communityStats = total > 0
        ? { aPercent: Math.round((aCount / total) * 100), bPercent: Math.round(((total - aCount) / total) * 100), total }
        : null;

      return {
        moment: {
          id: moment.id,
          questionText: moment.question_text,
          optionA: moment.option_a,
          optionB: moment.option_b,
          category: moment.category,
        } as DnaMoment,
        hasAnswered,
        userAnswer,
        communityStats,
      };
    },
    enabled: !!session?.access_token,
  });

  const answerMutation = useMutation({
    mutationFn: async ({ momentId, answer }: { momentId: string; answer: 'a' | 'b' }) => {
      const userId = session?.user?.id;
      if (!userId) throw new Error('Not logged in');
      const { error } = await supabase
        .from('dna_moment_responses')
        .insert({ user_id: userId, moment_id: momentId, answer, points_earned: 5 });
      if (error) throw error;

      // Fetch updated stats
      const { data: responses } = await supabase
        .from('dna_moment_responses')
        .select('answer')
        .eq('moment_id', momentId);
      const total = responses?.length || 1;
      const aCount = (responses || []).filter((r: any) => r.answer === 'a').length;
      return { aPercent: Math.round((aCount / total) * 100), bPercent: Math.round(((total - aCount) / total) * 100), total };
    },
    onSuccess: (newStats, { answer }) => {
      setChosenOption(answer);
      setSubmitted(true);
      setStats(newStats);
      incrementActivityCount();
      queryClient.invalidateQueries({ queryKey: ['dna-moment-featured'] });
      trackEvent('dna_moment_featured_answered', { answer, points_earned: 5 });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  if (!session || isLoading) return null;
  if (!data?.moment) return null;

  const { moment, hasAnswered, userAnswer, communityStats } = data;
  const isAnswered = submitted || hasAnswered;
  const displayAnswer = chosenOption || userAnswer;
  const displayStats = stats || communityStats;

  const categoryLabel = moment.category
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

  return (
    <div className="bg-gradient-to-br from-violet-950 via-purple-950 to-indigo-950 rounded-2xl overflow-hidden shadow-lg border border-violet-800/30">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Dna className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-violet-300 tracking-wider uppercase">Today's DNA Question</p>
            <p className="text-[10px] text-violet-400/60">{categoryLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-violet-400" />
          <span className="text-[10px] text-violet-400 font-medium">+5 pts</span>
        </div>
      </div>

      {/* Question */}
      <div className="px-4 pb-4">
        <h2 className="text-white font-bold text-lg leading-snug mb-4">{moment.questionText}</h2>

        {!isAnswered ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => answerMutation.mutate({ momentId: moment.id, answer: 'a' })}
              disabled={answerMutation.isPending}
              className="w-full py-3.5 px-5 rounded-xl bg-white/10 border border-white/20 text-white text-sm font-semibold hover:bg-violet-600/40 hover:border-violet-500/50 active:scale-[0.98] transition-all text-left"
            >
              {moment.optionA}
            </button>
            <button
              onClick={() => answerMutation.mutate({ momentId: moment.id, answer: 'b' })}
              disabled={answerMutation.isPending}
              className="w-full py-3.5 px-5 rounded-xl bg-white/10 border border-white/20 text-white text-sm font-semibold hover:bg-violet-600/40 hover:border-violet-500/50 active:scale-[0.98] transition-all text-left"
            >
              {moment.optionB}
            </button>
            {answerMutation.isPending && (
              <div className="flex justify-center pt-1">
                <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 animate-in fade-in duration-300">
            {(['a', 'b'] as const).map(opt => {
              const label = opt === 'a' ? moment.optionA : moment.optionB;
              const pct = displayStats ? (opt === 'a' ? displayStats.aPercent : displayStats.bPercent) : 50;
              const isChosen = displayAnswer === opt;
              return (
                <div
                  key={opt}
                  className={`rounded-xl overflow-hidden border transition-all ${isChosen ? 'border-violet-500' : 'border-white/10'}`}
                >
                  <div className="relative px-4 py-3">
                    <div
                      className={`absolute inset-0 transition-all duration-700 ease-out ${isChosen ? 'bg-violet-600/30' : 'bg-white/5'}`}
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative flex items-center justify-between">
                      <span className={`text-sm font-semibold ${isChosen ? 'text-white' : 'text-gray-300'}`}>
                        {isChosen && <span className="text-violet-300 mr-1.5">✓</span>}
                        {label}
                      </span>
                      <span className={`text-sm font-bold ml-3 shrink-0 ${isChosen ? 'text-violet-300' : 'text-gray-400'}`}>{pct}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {displayStats && (
              <p className="text-center text-[10px] text-violet-400/60 mt-1">{displayStats.total} answers so far</p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <Link href="/entertainment-dna">
        <div className="border-t border-white/5 px-4 py-2.5 flex items-center justify-center gap-1.5 hover:bg-white/5 transition-colors cursor-pointer">
          <Sparkles className="w-3 h-3 text-violet-400" />
          <span className="text-xs text-violet-300 font-medium">See your Entertainment DNA</span>
          <ArrowRight className="w-3 h-3 text-violet-400" />
        </div>
      </Link>
    </div>
  );
}
