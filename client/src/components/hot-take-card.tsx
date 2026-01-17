import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { Flame, ThumbsUp, ThumbsDown, ChevronRight, Loader2 } from 'lucide-react';
import { Link } from 'wouter';

interface HotTake {
  id: string;
  title: string;
  category?: string;
  options: string[];
  pointsReward: number;
}

export function HotTakeCard() {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const [voted, setVoted] = useState<{ take: string; vote: 'agree' | 'disagree'; stats?: { agree: number; disagree: number } } | null>(null);

  const { data: hotTake, isLoading } = useQuery({
    queryKey: ['hot-take-feed'],
    queryFn: async () => {
      const { data: pools, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('type', 'vote')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      
      const hotTakes = (pools || []).filter(p => 
        p.options && 
        p.options.length === 2 && 
        (p.options.includes('Agree') || p.options.includes('Yes') || p.options.includes('Hot') || p.options.includes('Not'))
      );
      
      if (hotTakes.length === 0 && pools && pools.length > 0) {
        const randomPool = pools[Math.floor(Math.random() * pools.length)];
        return {
          id: randomPool.id,
          title: randomPool.title,
          category: randomPool.category,
          options: ['Agree', 'Disagree'],
          pointsReward: randomPool.points_reward || 2
        } as HotTake;
      }
      
      if (hotTakes.length > 0) {
        const randomTake = hotTakes[Math.floor(Math.random() * hotTakes.length)];
        return {
          id: randomTake.id,
          title: randomTake.title,
          category: randomTake.category,
          options: randomTake.options,
          pointsReward: randomTake.points_reward || 2
        } as HotTake;
      }
      
      return null;
    },
    enabled: !!session?.access_token
  });

  const voteMutation = useMutation({
    mutationFn: async ({ takeId, vote }: { takeId: string; vote: 'agree' | 'disagree' }) => {
      if (!user?.id) throw new Error('Not logged in');
      
      const { data: existing } = await supabase
        .from('user_predictions')
        .select('id')
        .eq('user_id', user.id)
        .eq('pool_id', takeId)
        .single();
      
      if (existing) throw new Error('Already voted');
      
      const prediction = vote === 'agree' ? 'Agree' : 'Disagree';
      const { error } = await supabase
        .from('user_predictions')
        .insert({
          user_id: user.id,
          pool_id: takeId,
          prediction,
          points_earned: hotTake?.pointsReward || 2
        });
      
      if (error) throw error;
      
      await supabase.rpc('increment_user_points', { user_id_param: user.id, points_to_add: hotTake?.pointsReward || 2 });
      
      const { data: allVotes } = await supabase
        .from('user_predictions')
        .select('prediction')
        .eq('pool_id', takeId);
      
      const total = allVotes?.length || 1;
      const agreeCount = allVotes?.filter(v => v.prediction === 'Agree' || v.prediction === 'Yes' || v.prediction === 'Hot').length || 0;
      
      return { 
        vote, 
        stats: { 
          agree: Math.round((agreeCount / total) * 100), 
          disagree: Math.round(((total - agreeCount) / total) * 100) 
        },
        points: hotTake?.pointsReward || 2
      };
    },
    onSuccess: (result) => {
      setVoted({ take: hotTake?.id || '', vote: result.vote, stats: result.stats });
      queryClient.invalidateQueries({ queryKey: ['hot-take-feed'] });
      toast({
        title: `+${result.points} points!`,
        description: 'Your take has been recorded',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Already Voted',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  if (!session || isLoading) return null;
  if (!hotTake) return null;

  return (
    <Card className="bg-gradient-to-r from-orange-600 to-red-600 border-0 rounded-2xl p-4 shadow-lg mb-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
          <Flame className="w-3.5 h-3.5 text-white fill-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Hot Take</p>
          <p className="text-[10px] text-white/70">Do you agree?</p>
        </div>
        <div className="px-2 py-0.5 rounded-full bg-orange-400/40 border border-orange-300/30">
          <span className="text-xs text-orange-100 font-medium">+{hotTake.pointsReward} pts</span>
        </div>
      </div>

      <h3 className="text-white font-bold text-base mb-4 leading-snug">{hotTake.title}</h3>

      {!voted ? (
        <div className="flex gap-3">
          <button
            onClick={() => voteMutation.mutate({ takeId: hotTake.id, vote: 'agree' })}
            disabled={voteMutation.isPending}
            className="flex-1 py-3 rounded-xl bg-white/20 hover:bg-white/30 border border-white/30 flex items-center justify-center gap-2 text-white font-medium transition-all"
          >
            <ThumbsUp className="w-4 h-4" />
            Agree
          </button>
          <button
            onClick={() => voteMutation.mutate({ takeId: hotTake.id, vote: 'disagree' })}
            disabled={voteMutation.isPending}
            className="flex-1 py-3 rounded-xl bg-white/20 hover:bg-white/30 border border-white/30 flex items-center justify-center gap-2 text-white font-medium transition-all"
          >
            <ThumbsDown className="w-4 h-4" />
            Disagree
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className={`relative py-3 px-4 rounded-xl border overflow-hidden ${voted.vote === 'agree' ? 'border-white bg-white/20' : 'border-white/30 bg-white/10'}`}>
            <div className="absolute left-0 top-0 bottom-0 bg-white/20" style={{ width: `${voted.stats?.agree || 50}%` }} />
            <div className="relative flex justify-between items-center">
              <span className="text-sm text-white flex items-center gap-2">
                <ThumbsUp className="w-4 h-4" /> Agree
              </span>
              <span className="text-sm font-bold text-white">{voted.stats?.agree || 50}%</span>
            </div>
          </div>
          <div className={`relative py-3 px-4 rounded-xl border overflow-hidden ${voted.vote === 'disagree' ? 'border-white bg-white/20' : 'border-white/30 bg-white/10'}`}>
            <div className="absolute left-0 top-0 bottom-0 bg-white/20" style={{ width: `${voted.stats?.disagree || 50}%` }} />
            <div className="relative flex justify-between items-center">
              <span className="text-sm text-white flex items-center gap-2">
                <ThumbsDown className="w-4 h-4" /> Disagree
              </span>
              <span className="text-sm font-bold text-white">{voted.stats?.disagree || 50}%</span>
            </div>
          </div>
        </div>
      )}

      <Link href="/play-hot-takes">
        <div className="flex items-center justify-center gap-1.5 mt-4 pt-3 border-t border-white/20 cursor-pointer hover:opacity-80">
          <Flame className="w-3.5 h-3.5 text-white/80 fill-white/80" />
          <span className="text-xs text-white/80 font-medium">More hot takes</span>
          <ChevronRight className="w-3.5 h-3.5 text-white/80" />
        </div>
      </Link>

      {voteMutation.isPending && (
        <div className="absolute inset-0 bg-orange-600/50 flex items-center justify-center rounded-2xl">
          <Loader2 className="w-6 h-6 animate-spin text-white" />
        </div>
      )}
    </Card>
  );
}
