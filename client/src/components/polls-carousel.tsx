import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/posthog';
import { BarChart3, Loader2, ChevronLeft, ChevronRight, Users, Check, Search, Plus, X } from 'lucide-react';
import { incrementActivityCount } from '@/components/dna-survey-nudge';

function normalizeCategory(cat: string | null | undefined): string {
  if (!cat) return 'Other';
  const lower = cat.toLowerCase().trim();
  if (lower === 'movies' || lower === 'movie') return 'Movies';
  if (lower === 'tv' || lower === 'tv shows' || lower === 'tv-show' || lower === 'tv show' ||
      lower === 'reality' || lower === 'reality tv' || lower === 'reality-tv') return 'TV';
  if (lower === 'music') return 'Music';
  if (lower === 'podcasts' || lower === 'podcast') return 'Podcasts';
  if (lower === 'gaming' || lower === 'games' || lower === 'game' || lower === 'video games') return 'Gaming';
  if (lower === 'sports' || lower === 'sport') return 'Sports';
  if (lower === 'books' || lower === 'book') return 'Books';
  if (lower === 'pop culture') return 'Pop Culture';
  return cat;
}

function shuffleArray<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  let currentSeed = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    const j = Math.floor((currentSeed / 233280) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

interface PollItem {
  id: string;
  title: string;
  options: string[];
  category?: string;
  pointsReward: number;
  origin_type?: string;
  origin_user_id?: string;
  creatorName?: string;
  creatorAvatar?: string;
}

interface PollsCarouselProps {
  expanded?: boolean;
  category?: string;
}

export function PollsCarousel({ expanded = false, category }: PollsCarouselProps) {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<Record<string, string>>({});
  const [votedPolls, setVotedPolls] = useState<Record<string, { vote: string; stats: Record<string, number> }>>({});
  const [votedLoaded, setVotedLoaded] = useState(false);
  const [lockedOrder, setLockedOrder] = useState<PollItem[] | null>(null);
  const [otherSearchOpen, setOtherSearchOpen] = useState<Record<string, boolean>>({});
  const [otherSearchQuery, setOtherSearchQuery] = useState<Record<string, string>>({});
  const [otherSearchResults, setOtherSearchResults] = useState<Record<string, any[]>>({});
  const [isSearching, setIsSearching] = useState<Record<string, boolean>>({});

  const { data, isLoading, isError } = useQuery({
    queryKey: ['polls-carousel', user?.id],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data: pools, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('type', 'vote')
        .eq('status', 'open')
        .is('partner_tag', null)
        .or(`publish_at.is.null,publish_at.lte.${now}`)
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      
      // Filter out polls user has already voted on
      let votedPoolIds: string[] = [];
      if (user?.id) {
        const { data: userPredictions } = await supabase
          .from('user_predictions')
          .select('pool_id')
          .eq('user_id', user.id);
        votedPoolIds = (userPredictions || []).map(p => p.pool_id);
      }
      
      const unvotedPools = (pools || []).filter(pool => !votedPoolIds.includes(pool.id) && pool.origin_type !== 'user');
      
      const uniqueTitles = new Map<string, any>();
      for (const pool of unvotedPools) {
        if (!uniqueTitles.has(pool.title)) {
          uniqueTitles.set(pool.title, pool);
        }
      }
      
      const poolsList = Array.from(uniqueTitles.values());
      
      const userCreatorIds = [...new Set(poolsList.filter(p => p.origin_type === 'user' && p.origin_user_id).map(p => p.origin_user_id))];
      let creatorMap = new Map<string, { display_name: string; avatar: string; user_name: string }>();
      if (userCreatorIds.length > 0) {
        const { data: creators } = await supabase
          .from('users')
          .select('id, display_name, avatar, user_name')
          .in('id', userCreatorIds);
        if (creators) {
          creatorMap = new Map(creators.map(c => [c.id, c]));
        }
      }
      
      const items: PollItem[] = poolsList.map(pool => {
        const creator = pool.origin_user_id ? creatorMap.get(pool.origin_user_id) : null;
        return {
          id: pool.id,
          title: pool.title,
          options: Array.isArray(pool.options) ? pool.options.filter((o: any) => typeof o === 'string') : [],
          category: normalizeCategory(pool.category),
          pointsReward: pool.points_reward || 2,
          origin_type: pool.origin_type || undefined,
          origin_user_id: pool.origin_user_id || undefined,
          creatorName: creator?.display_name || creator?.user_name || undefined,
          creatorAvatar: creator?.avatar || undefined,
        };
      }).filter(item => item.options.length > 0);
      
      return items;
    },
    enabled: !!session?.access_token,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    setVotedLoaded(false);
    setLockedOrder(null);

    const computeOrder = (votedState: Record<string, any>, items: PollItem[]) => {
      const knownCats = ['movies', 'tv', 'books', 'music', 'sports', 'podcasts', 'games'];
      const catFiltered = category
        ? category.toLowerCase() === 'other'
          ? items.filter(p => !p.category || !knownCats.includes(p.category.toLowerCase()))
          : items.filter(p => p.category?.toLowerCase() === category.toLowerCase())
        : items;
      const catOffset = category ? category.charCodeAt(0) : 0;
      const shuffled = shuffleArray(catFiltered, sessionSeed + catOffset);
      return [
        ...shuffled.filter(p => !votedState[p.id]),
        ...shuffled.filter(p => !!votedState[p.id]),
      ];
    };

    const loadVoted = async () => {
      if (!user?.id || !data || data.length === 0) {
        setLockedOrder(computeOrder({}, data || []));
        setVotedLoaded(true);
        return;
      }

      // Query 1: get this user's votes for displayed polls
      const { data: predictions } = await supabase
        .from('user_predictions')
        .select('pool_id, prediction')
        .eq('user_id', user.id)
        .in('pool_id', data.map(p => p.id));

      if (!predictions || predictions.length === 0) {
        setLockedOrder(computeOrder({}, data));
        setVotedLoaded(true);
        return;
      }

      // Query 2: batch-fetch all votes for every voted poll in one go
      const votedPoolIds = [...new Set(predictions.map(p => p.pool_id))];
      const { data: allVotes } = await supabase
        .from('user_predictions')
        .select('pool_id, prediction')
        .in('pool_id', votedPoolIds);

      // Build stats client-side — no more per-poll queries
      const votesByPool: Record<string, string[]> = {};
      for (const v of allVotes || []) {
        if (!votesByPool[v.pool_id]) votesByPool[v.pool_id] = [];
        votesByPool[v.pool_id].push(v.prediction);
      }

      const voted: Record<string, { vote: string; stats: Record<string, number> }> = {};
      for (const p of predictions) {
        const poll = data.find(item => item.id === p.pool_id);
        if (!poll) continue;
        const poolVotes = votesByPool[p.pool_id] || [];
        const total = poolVotes.length || 1;
        const stats: Record<string, number> = {};
        for (const opt of poll.options) {
          stats[opt] = Math.round((poolVotes.filter(v => v === opt).length / total) * 100);
        }
        const otherCount = poolVotes.filter(v => v === 'Other').length;
        if (otherCount > 0) stats['Other'] = Math.round((otherCount / total) * 100);
        voted[p.pool_id] = { vote: p.prediction, stats };
      }

      setVotedPolls(voted);
      setLockedOrder(computeOrder(voted, data));
      setVotedLoaded(true);
    };

    loadVoted();
  }, [data, user?.id]);

  const voteMutation = useMutation({
    mutationFn: async ({ pollId, vote, pointsReward, otherPickMetadata }: { pollId: string; vote: string; pointsReward: number; otherPickMetadata?: any }) => {
      if (!user?.id) throw new Error('Not logged in');
      
      const { data: existing } = await supabase
        .from('user_predictions')
        .select('id')
        .eq('user_id', user.id)
        .eq('pool_id', pollId)
        .single();
      
      if (existing) throw new Error('Already voted');
      
      const insertData: any = {
        user_id: user.id,
        pool_id: pollId,
        prediction: vote,
        points_earned: pointsReward
      };
      
      let { error } = await supabase
        .from('user_predictions')
        .insert(insertData);
      
      if (!error && otherPickMetadata) {
        const { error: updateError } = await supabase
          .from('user_predictions')
          .update({ other_pick_metadata: otherPickMetadata })
          .eq('user_id', user.id)
          .eq('pool_id', pollId);
        if (updateError) {
          console.log('Note: other_pick_metadata column not available yet, skipping metadata storage');
        }
      }
      
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
      const otherCount = allVotes?.filter(v => v.prediction === 'Other').length || 0;
      if (otherCount > 0) {
        stats['Other'] = Math.round((otherCount / total) * 100);
      }
      
      return { pollId, vote, stats, points: pointsReward };
    },
    onSuccess: (result) => {
      setVotedPolls(prev => ({
        ...prev,
        [result.pollId]: { vote: result.vote, stats: result.stats }
      }));
      
      incrementActivityCount();
      trackEvent('poll_voted', { poll_id: result.pollId, points_earned: result.points });
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

  const handleSelectAndVote = (poll: PollItem, option: string) => {
    setSelectedOption(prev => ({ ...prev, [poll.id]: option }));
    voteMutation.mutate({
      pollId: poll.id,
      vote: option,
      pointsReward: poll.pointsReward
    });
  };

  const handleOtherSearch = async (pollId: string, query: string) => {
    if (!query.trim() || !session?.access_token) return;
    
    setIsSearching(prev => ({ ...prev, [pollId]: true }));
    
    try {
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/media-search',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: query.trim() }),
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const results = Array.isArray(data) ? data : (data.results || []);
        setOtherSearchResults(prev => ({ ...prev, [pollId]: results.slice(0, 5) }));
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(prev => ({ ...prev, [pollId]: false }));
    }
  };

  const handleSelectOther = (poll: PollItem, media: any) => {
    setSelectedOption(prev => ({ ...prev, [poll.id]: 'Other' }));
    setOtherSearchOpen(prev => ({ ...prev, [poll.id]: false }));
    setOtherSearchQuery(prev => ({ ...prev, [poll.id]: '' }));
    setOtherSearchResults(prev => ({ ...prev, [poll.id]: [] }));
    
    voteMutation.mutate({
      pollId: poll.id,
      vote: 'Other',
      pointsReward: poll.pointsReward,
      otherPickMetadata: {
        title: media.title,
        type: media.type,
        year: media.year,
        external_id: media.external_id || media.id,
        external_source: media.external_source || media.source,
        poster_url: media.poster_url || media.image_url
      }
    });
  };

  // Generate a session-based seed that changes daily (must be before any returns)
  const sessionSeed = useMemo(() => {
    const today = new Date();
    return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  }, []);

  if (!session) return null;
  if (isLoading || !votedLoaded) {
    return (
      <div className="bg-white border border-gray-100 shadow rounded-2xl p-4 overflow-hidden">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500 opacity-40" />
        </div>
      </div>
    );
  }
  if (isError || !data || data.length === 0) return null;

  // Use the locked order (computed once at load time) so voting never causes a re-sort
  const filteredData = lockedOrder || [];

  if (filteredData.length === 0) return null;

  return (
    <div className="bg-white border border-gray-100 shadow rounded-2xl p-4 overflow-hidden relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {category && (
            <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold tracking-wide">
              {category}
            </span>
          )}
          <p className="text-sm font-semibold text-gray-900">Cast Your Vote</p>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 font-medium">{currentIndex + 1}/{filteredData.length}</span>
          {currentIndex < filteredData.length - 1 && (
            <button onClick={scrollToNext} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-1 px-1">
        {filteredData.map((poll) => {
          const voted = votedPolls[poll.id];
          const selected = selectedOption[poll.id];
          
          return (
            <div key={poll.id} className="flex-shrink-0 w-full snap-center">
              <h3 className="text-gray-900 font-semibold text-base mb-3">{poll.title}</h3>
              
              {!voted ? (
                <div className="grid grid-cols-4 gap-2">
                  {poll.options.slice(0, 4).map((option, idx) => (
                    <button
                      key={idx}
                      className={`min-h-[96px] py-3 px-2 rounded-2xl border text-[13px] font-medium transition-all flex items-center justify-center text-center leading-tight ${
                        selected === option
                          ? 'bg-gradient-to-br from-slate-800 to-blue-900 border-blue-500/50 text-white shadow-lg'
                          : 'bg-gray-50 border-gray-200/80 text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => handleSelectAndVote(poll, option)}
                      disabled={voteMutation.isPending}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-2">
                    {poll.options.slice(0, 4).map((option, idx) => {
                      const isUserVote = voted.vote === option;
                      const percentage = voted.stats[option] || 0;

                      return (
                        <div
                          key={idx}
                          className={`relative min-h-[96px] py-2 px-2 rounded-2xl border flex flex-col items-center justify-center text-center leading-tight ${
                            isUserVote
                              ? 'border-blue-500 bg-gradient-to-br from-slate-800 to-blue-900'
                              : 'border-gray-200/80 bg-gray-50'
                          }`}
                        >
                          {isUserVote && (
                            <Check className="w-3 h-3 text-white absolute top-1.5 right-1.5" />
                          )}
                          <span className={`text-[12px] ${isUserVote ? 'text-white font-medium' : 'text-gray-700'}`}>{option}</span>
                          <span className={`text-[11px] font-bold mt-1 ${isUserVote ? 'text-white' : 'text-gray-400'}`}>{percentage}%</span>
                        </div>
                      );
                    })}
                  </div>
                  {(voted.stats['Other'] > 0 || voted.vote === 'Other') && (
                    <div
                      className={`relative py-2.5 px-4 rounded-full border flex justify-between items-center ${
                        voted.vote === 'Other'
                          ? 'border-blue-500 bg-gradient-to-r from-slate-800 to-blue-900'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {voted.vote === 'Other' && <Check className="w-4 h-4 text-white" />}
                        <span className={`text-sm ${voted.vote === 'Other' ? 'text-white font-medium' : 'text-gray-700'}`}>Other</span>
                      </div>
                      <span className={`text-sm font-bold ${voted.vote === 'Other' ? 'text-white' : 'text-gray-400'}`}>{voted.stats['Other'] || 0}%</span>
                    </div>
                  )}
                  {currentIndex < filteredData.length - 1 && (
                    <button
                      onClick={scrollToNext}
                      className="w-full mt-1 py-3 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold"
                    >
                      Next question
                    </button>
                  )}
                </div>
              )}
              <div className="flex items-center justify-end mt-4">
                <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-[10px] font-bold">
                  +{poll.pointsReward} pts
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {!category && (
        <Link href="/play">
          <div className="flex items-center justify-center gap-1.5 mt-2 pt-2 border-t border-gray-200 cursor-pointer hover:opacity-80">
            <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs text-blue-600 font-medium">See all polls</span>
          </div>
        </Link>
      )}

      {voteMutation.isPending && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-2xl">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      )}
    </div>
  );
}
