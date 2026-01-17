import { useState, useRef, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { BarChart3, Loader2, ChevronLeft, ChevronRight, Users, Check } from 'lucide-react';

interface PollItem {
  id: string;
  title: string;
  options: string[];
  category?: string;
  pointsReward: number;
}

export function PollsCarousel() {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<Record<string, string>>({});
  const [votedPolls, setVotedPolls] = useState<Record<string, { vote: string; stats: Record<string, number> }>>({});

  const { data, isLoading, isError } = useQuery({
    queryKey: ['polls-carousel'],
    queryFn: async () => {
      const { data: pools, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('type', 'vote')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      const uniqueTitles = new Map<string, any>();
      for (const pool of (pools || [])) {
        if (!uniqueTitles.has(pool.title)) {
          uniqueTitles.set(pool.title, pool);
        }
      }
      
      const items: PollItem[] = Array.from(uniqueTitles.values()).map(pool => ({
        id: pool.id,
        title: pool.title,
        options: Array.isArray(pool.options) ? pool.options.filter((o: any) => typeof o === 'string') : [],
        category: pool.category,
        pointsReward: pool.points_reward || 2
      })).filter(item => item.options.length > 0);
      
      return items;
    },
    enabled: !!session?.access_token
  });

  useEffect(() => {
    const loadVoted = async () => {
      if (!user?.id || !data || data.length === 0) return;
      
      const { data: predictions } = await supabase
        .from('user_predictions')
        .select('pool_id, prediction')
        .eq('user_id', user.id)
        .in('pool_id', data.map(p => p.id));
      
      if (predictions && predictions.length > 0) {
        const voted: Record<string, { vote: string; stats: Record<string, number> }> = {};
        
        for (const p of predictions) {
          const poll = data.find(item => item.id === p.pool_id);
          if (!poll) continue;
          
          const { data: allVotes } = await supabase
            .from('user_predictions')
            .select('prediction')
            .eq('pool_id', p.pool_id);
          
          const total = allVotes?.length || 1;
          const stats: Record<string, number> = {};
          for (const opt of poll.options) {
            const count = allVotes?.filter(v => v.prediction === opt).length || 0;
            stats[opt] = Math.round((count / total) * 100);
          }
          
          voted[p.pool_id] = { vote: p.prediction, stats };
        }
        setVotedPolls(voted);
      }
    };
    
    loadVoted();
  }, [data, user?.id]);

  const voteMutation = useMutation({
    mutationFn: async ({ pollId, vote, pointsReward }: { pollId: string; vote: string; pointsReward: number }) => {
      if (!user?.id) throw new Error('Not logged in');
      
      const { data: existing } = await supabase
        .from('user_predictions')
        .select('id')
        .eq('user_id', user.id)
        .eq('pool_id', pollId)
        .single();
      
      if (existing) throw new Error('Already voted');
      
      const { error } = await supabase
        .from('user_predictions')
        .insert({
          user_id: user.id,
          pool_id: pollId,
          prediction: vote,
          points_earned: pointsReward
        });
      
      if (error) throw error;
      
      await supabase.rpc('increment_user_points', { user_id_param: user.id, points_to_add: pointsReward });
      
      const poll = data?.find(p => p.id === pollId);
      const { data: allVotes } = await supabase
        .from('user_predictions')
        .select('prediction')
        .eq('pool_id', pollId);
      
      const total = allVotes?.length || 1;
      const stats: Record<string, number> = {};
      for (const opt of poll?.options || []) {
        const count = allVotes?.filter(v => v.prediction === opt).length || 0;
        stats[opt] = Math.round((count / total) * 100);
      }
      
      return { pollId, vote, stats, points: pointsReward };
    },
    onSuccess: (result) => {
      setVotedPolls(prev => ({
        ...prev,
        [result.pollId]: { vote: result.vote, stats: result.stats }
      }));
      
      queryClient.invalidateQueries({ queryKey: ['polls-carousel'] });
      
      toast({
        title: `+${result.points} points!`,
        description: 'Your vote has been counted',
      });
      
      setTimeout(() => {
        if (data && currentIndex < data.length - 1) {
          scrollToNext();
        }
      }, 1500);
    },
    onError: (error: Error) => {
      toast({
        title: 'Already Voted',
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

  const handleVote = (poll: PollItem) => {
    const vote = selectedOption[poll.id];
    if (!vote) return;
    
    voteMutation.mutate({
      pollId: poll.id,
      vote,
      pointsReward: poll.pointsReward
    });
  };

  if (!session) return null;
  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-blue-500 via-blue-400 to-cyan-400 border-0 rounded-2xl p-5 shadow-lg mb-4">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-white" />
        </div>
      </Card>
    );
  }
  if (isError || !data || data.length === 0) return null;

  return (
    <Card className="bg-gradient-to-br from-blue-500 via-blue-400 to-cyan-400 border-0 rounded-2xl p-4 shadow-lg mb-4 overflow-hidden relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            <BarChart3 className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Quick Polls</p>
            <p className="text-[10px] text-white/70">Share your opinion</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {currentIndex > 0 && (
            <button onClick={scrollToPrev} className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30">
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
          )}
          {currentIndex < data.length - 1 && (
            <button onClick={scrollToNext} className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30">
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          )}
          <span className="text-xs text-white/60 ml-1">{currentIndex + 1}/{data.length}</span>
        </div>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-1 px-1">
        {data.map((poll) => {
          const voted = votedPolls[poll.id];
          const selected = selectedOption[poll.id];
          
          return (
            <div key={poll.id} className="flex-shrink-0 w-full snap-center">
              <div className="inline-flex items-center gap-1 mb-3 px-2.5 py-1 rounded-full bg-white/20">
                <span className="text-xs text-white font-medium">+{poll.pointsReward} pts</span>
              </div>
              
              <h3 className="text-white font-semibold text-base mb-3">{poll.title}</h3>
              
              {!voted ? (
                <div className="flex flex-col gap-2">
                  {poll.options.slice(0, 4).map((option, idx) => (
                    <button
                      key={idx}
                      className={`py-3 px-4 rounded-2xl border-0 text-white text-sm font-medium transition-all text-left ${
                        selected === option 
                          ? 'bg-white/40 shadow-lg ring-2 ring-white/50' 
                          : 'bg-white/25 hover:bg-white/35'
                      }`}
                      onClick={() => setSelectedOption(prev => ({ ...prev, [poll.id]: option }))}
                      disabled={voteMutation.isPending}
                    >
                      {option}
                    </button>
                  ))}
                  
                  {selected && (
                    <button
                      onClick={() => handleVote(poll)}
                      disabled={voteMutation.isPending}
                      className="mt-2 w-full py-2.5 rounded-2xl bg-white/40 text-white font-semibold hover:bg-white/50 transition-all"
                    >
                      {voteMutation.isPending ? 'Voting...' : 'Vote'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {poll.options.slice(0, 4).map((option, idx) => {
                    const isUserVote = voted.vote === option;
                    const percentage = voted.stats[option] || 0;
                    
                    return (
                      <div 
                        key={idx}
                        className={`relative py-3 px-4 rounded-xl border overflow-hidden ${
                          isUserVote ? 'border-white bg-white/20' : 'border-blue-400/30 bg-blue-800/30'
                        }`}
                      >
                        <div className="absolute left-0 top-0 bottom-0 bg-white/20" style={{ width: `${percentage}%` }} />
                        <div className="relative flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            {isUserVote && <Check className="w-4 h-4 text-white" />}
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
        <div className="flex items-center justify-center gap-1.5 mt-4 pt-3 border-t border-white/20 cursor-pointer hover:opacity-80">
          <BarChart3 className="w-3.5 h-3.5 text-white/80" />
          <span className="text-xs text-white/80 font-medium">See all polls</span>
        </div>
      </Link>

      {voteMutation.isPending && (
        <div className="absolute inset-0 bg-blue-600/50 flex items-center justify-center rounded-2xl">
          <Loader2 className="w-6 h-6 animate-spin text-white" />
        </div>
      )}
    </Card>
  );
}
