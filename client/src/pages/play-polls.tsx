import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Vote, ChevronLeft, ChevronRight, ChevronDown, CheckCircle } from 'lucide-react';
import Navigation from '@/components/navigation';
import ConsumptionTracker from '@/components/consumption-tracker';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import GameShareModal from '@/components/game-share-modal';

export default function PlayPollsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [shareModalGame, setShareModalGame] = useState<any>(null);
  const [submissionResults, setSubmissionResults] = useState<Record<string, { points: number; stats: Record<string, number>; userAnswer: string }>>({});
  const [celebratingItems, setCelebratingItems] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [expandedFilter, setExpandedFilter] = useState<'topic' | 'genre' | null>(null);
  const [categoryIndices, setCategoryIndices] = useState<Record<string, number>>({});
  const categoryScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const categoryFilters = [
    { id: 'Movies', label: 'Movies' },
    { id: 'TV', label: 'TV Shows' },
    { id: 'Music', label: 'Music' },
    { id: 'Books', label: 'Books' },
    { id: 'Sports', label: 'Sports' },
    { id: 'Podcasts', label: 'Podcasts' },
    { id: 'Pop Culture', label: 'Pop Culture' },
  ];

  const genreFilters = [
    { id: 'True Crime', label: 'True Crime' },
    { id: 'Comedy', label: 'Comedy' },
    { id: 'Drama', label: 'Drama' },
    { id: 'Sci-Fi', label: 'Sci-Fi' },
    { id: 'Fantasy', label: 'Fantasy' },
    { id: 'Horror', label: 'Horror' },
    { id: 'Romance', label: 'Romance' },
    { id: 'Action', label: 'Action' },
    { id: 'Documentary', label: 'Documentary' },
  ];

  const scrollCategoryTo = (category: string, index: number, total: number) => {
    if (index < 0 || index >= total) return;
    const container = categoryScrollRefs.current[category];
    if (container) {
      container.scrollTo({ left: index * container.clientWidth, behavior: 'smooth' });
      setCategoryIndices(prev => ({ ...prev, [category]: index }));
    }
  };

  const handleCategoryScroll = (category: string, total: number) => {
    const container = categoryScrollRefs.current[category];
    if (container) {
      const newIndex = Math.round(container.scrollLeft / container.clientWidth);
      setCategoryIndices(prev => ({ ...prev, [category]: Math.min(Math.max(newIndex, 0), total - 1) }));
    }
  };

  const { data: games = [], isLoading } = useQuery({
    queryKey: ['/api/predictions/polls'],
    queryFn: async () => {
      const { data: pools, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('status', 'open')
        .eq('type', 'vote')
        .order('created_at', { ascending: false });
      if (error) throw new Error('Failed to fetch polls');
      return (pools || []).map((p: any) => ({
        ...p,
        isConsumed: p.id?.startsWith('consumed-poll-') || p.origin_type === 'consumed',
      }));
    },
  });

  const { data: userPredictionsData } = useQuery({
    queryKey: ['/api/predictions/user-predictions'],
    queryFn: async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return {};
      const { data, error } = await supabase
        .from('user_predictions')
        .select('pool_id, prediction')
        .eq('user_id', u.id);
      if (error) return {};
      const predictions: Record<string, string> = {};
      data?.forEach((pred) => { predictions[pred.pool_id] = pred.prediction; });
      return predictions;
    },
  });

  const allPredictions = userPredictionsData || {};

  const submitVote = useMutation({
    mutationFn: async ({ gameId, poolId, answer, options, pointsReward }: {
      gameId: string; poolId: string; answer: string; options: string[]; pointsReward: number;
    }) => {
      if (!user?.id) throw new Error('Not logged in');

      const { error } = await supabase
        .from('user_predictions')
        .insert({ user_id: user.id, pool_id: poolId, prediction: answer, points_earned: pointsReward });

      if (error) {
        if (error.message?.includes('duplicate') || error.code === '23505') throw new Error('Already voted');
        throw error;
      }

      if (pointsReward > 0) {
        await supabase.rpc('increment_user_points', { user_id_param: user.id, points_to_add: pointsReward });
      }

      const { data: allPreds } = await supabase
        .from('user_predictions').select('prediction').eq('pool_id', poolId);

      const total = allPreds?.length || 1;
      const stats: Record<string, number> = {};
      for (const opt of options) {
        const count = allPreds?.filter((p: any) => p.prediction === opt).length || 0;
        stats[opt] = Math.round((count / total) * 100);
      }

      return { gameId, answer, points: pointsReward, stats };
    },
    onSuccess: (result) => {
      setCelebratingItems(prev => ({ ...prev, [result.gameId]: result.points }));
      setTimeout(() => {
        setCelebratingItems(prev => { const next = { ...prev }; delete next[result.gameId]; return next; });
      }, 1600);
      setSubmissionResults(prev => ({
        ...prev,
        [result.gameId]: { points: result.points, stats: result.stats, userAnswer: result.answer }
      }));
      queryClient.invalidateQueries({ queryKey: ['/api/predictions/user-predictions'] });
    },
    onError: (error: Error) => {
      if (error.message !== 'Already voted') {
        toast({ title: 'Error', description: 'Failed to submit vote. Please try again.', variant: 'destructive' });
      }
    },
  });

  const handleTapAndVote = (game: any, option: string) => {
    if (allPredictions[game.id] || submissionResults[game.id]) return;
    const optionText = typeof option === 'string' ? option : (option.label || option.text || String(option));
    submitVote.mutate({
      gameId: game.id, poolId: game.id, answer: optionText,
      options: (game.options || []).map((o: any) => typeof o === 'string' ? o : (o.label || o.text || String(o))),
      pointsReward: game.points_reward || 2,
    });
  };

  const normalizeCategory = (cat: string): string => {
    if (!cat) return 'Other';
    const lower = cat.toLowerCase().trim();
    if (lower === 'movies' || lower === 'movie') return 'Movies';
    if (lower === 'tv' || lower === 'tv shows' || lower === 'tv-show' || lower === 'tv show' ||
        lower === 'reality' || lower === 'reality tv') return 'TV';
    if (lower === 'music') return 'Music';
    if (lower === 'podcasts' || lower === 'podcast') return 'Podcasts';
    if (lower === 'sports' || lower === 'sport') return 'Sports';
    if (lower === 'books' || lower === 'book') return 'Books';
    if (lower === 'pop culture') return 'Pop Culture';
    return 'Other';
  };

  const CATEGORY_ORDER = ['Movies', 'TV', 'Music', 'Podcasts', 'Sports', 'Books', 'Pop Culture', 'Other'];

  const categoryInfo: Record<string, { label: string }> = {
    'Movies': { label: 'Movies' },
    'TV': { label: 'TV Shows' },
    'Music': { label: 'Music' },
    'Podcasts': { label: 'Podcasts' },
    'Sports': { label: 'Sports' },
    'Books': { label: 'Books' },
    'Pop Culture': { label: 'Pop Culture' },
    'Other': { label: 'General' },
  };

  const pollGames = useMemo(() => {
    let filtered = [...games];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((g: any) => g.title?.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q));
    }
    if (selectedCategory) {
      filtered = filtered.filter((g: any) => normalizeCategory(g.category) === selectedCategory);
    }
    if (selectedGenre) {
      filtered = filtered.filter((g: any) => (g.tags || []).includes(selectedGenre));
    }
    return filtered;
  }, [games, searchQuery, selectedCategory, selectedGenre]);

  const pollsByCategory = useMemo(() => {
    const groups: Record<string, any[]> = {};
    pollGames.forEach((game: any) => {
      const cat = normalizeCategory(game.category);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(game);
    });
    return CATEGORY_ORDER.filter(cat => groups[cat]).map(cat => [cat, groups[cat]] as [string, any[]]);
  }, [pollGames]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation onTrackConsumption={() => setIsTrackModalOpen(true)} />
        <div className="flex items-center justify-center py-20">
          <div className="text-xl text-gray-500">Loading polls...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={() => setIsTrackModalOpen(true)} />

      {/* Header */}
      <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] pb-6 -mt-px">
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => window.history.back()} className="flex items-center text-gray-400 hover:text-white transition-colors">
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-2xl font-semibold text-white">Polls</h1>
          </div>

          {/* Filter dropdowns */}
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <button
                onClick={() => setExpandedFilter(expandedFilter === 'topic' ? null : 'topic')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all text-sm ${selectedCategory ? 'text-purple-300' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <span>Topic{selectedCategory ? `: ${categoryFilters.find(c => c.id === selectedCategory)?.label}` : ''}</span>
                <ChevronDown size={14} className={`transition-transform ${expandedFilter === 'topic' ? 'rotate-180' : ''}`} />
              </button>
              {expandedFilter === 'topic' && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg p-2 z-20 min-w-[160px]">
                  <button onClick={() => { setSelectedCategory(null); setExpandedFilter(null); }} className={`w-full text-left px-3 py-2 rounded-md text-sm ${!selectedCategory ? 'bg-purple-100 text-purple-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}>All Topics</button>
                  {categoryFilters.map(cat => (
                    <button key={cat.id} onClick={() => { setSelectedCategory(cat.id); setExpandedFilter(null); }} className={`w-full text-left px-3 py-2 rounded-md text-sm ${selectedCategory === cat.id ? 'bg-purple-100 text-purple-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}>{cat.label}</button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setExpandedFilter(expandedFilter === 'genre' ? null : 'genre')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all text-sm ${selectedGenre ? 'text-purple-300' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <span>Genre{selectedGenre ? `: ${selectedGenre}` : ''}</span>
                <ChevronDown size={14} className={`transition-transform ${expandedFilter === 'genre' ? 'rotate-180' : ''}`} />
              </button>
              {expandedFilter === 'genre' && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg p-2 z-20 min-w-[150px]">
                  <button onClick={() => { setSelectedGenre(null); setExpandedFilter(null); }} className={`w-full text-left px-3 py-2 rounded-md text-sm ${!selectedGenre ? 'bg-purple-100 text-purple-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}>All Genres</button>
                  {genreFilters.map(genre => (
                    <button key={genre.id} onClick={() => { setSelectedGenre(genre.id); setExpandedFilter(null); }} className={`w-full text-left px-3 py-2 rounded-md text-sm ${selectedGenre === genre.id ? 'bg-purple-100 text-purple-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}>{genre.label}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4">
        {pollsByCategory.length > 0 ? (
          <div className="space-y-5">
            {pollsByCategory
              .filter(([cat]) => !selectedCategory || cat === selectedCategory)
              .map(([category, categoryGames]) => {
                const label = categoryInfo[category]?.label || category;
                const currentIndex = categoryIndices[category] || 0;
                return (
                  <div key={category}>
                    <Card className="bg-white border border-gray-200 rounded-2xl p-4 pb-3 shadow-sm overflow-hidden">
                      {/* Card header — matches trivia style */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-purple-900 flex items-center justify-center flex-shrink-0">
                            <Vote className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{label} Polls</p>
                            <p className="text-[10px] text-gray-500">Tap to vote</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {currentIndex > 0 && (
                            <button onClick={() => scrollCategoryTo(category, currentIndex - 1, categoryGames.length)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                              <ChevronLeft className="w-4 h-4 text-gray-600" />
                            </button>
                          )}
                          {currentIndex < categoryGames.length - 1 && (
                            <button onClick={() => scrollCategoryTo(category, currentIndex + 1, categoryGames.length)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                              <ChevronRight className="w-4 h-4 text-gray-600" />
                            </button>
                          )}
                          <span className="text-xs text-gray-500 ml-1">{currentIndex + 1}/{categoryGames.length}</span>
                        </div>
                      </div>

                      {/* Snap-scroll container */}
                      <div
                        ref={el => { categoryScrollRefs.current[category] = el; }}
                        onScroll={() => handleCategoryScroll(category, categoryGames.length)}
                        className="flex overflow-x-auto snap-x snap-mandatory"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                      >
                        {(categoryGames as any[]).map((game: any, gameIdx: number) => {
                          const options: string[] = (game.options || []).map((o: any) =>
                            typeof o === 'string' ? o : (o.label || o.text || String(o))
                          );
                          return (
                            <div key={game.id} className="flex-shrink-0 w-full snap-center">
                              {/* Media tag chip */}
                              {(game.media_title || game.tags?.[0]) && (
                                <div className="mb-2">
                                  <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 border border-purple-200">
                                    <span className="text-[10px] text-purple-700 font-medium">{game.media_title || game.tags?.[0]}</span>
                                  </div>
                                </div>
                              )}

                              <h3 className="text-gray-900 font-semibold text-base leading-snug mb-4">{game.title}</h3>

                              {/* Voted / unanswered state */}
                              {allPredictions[game.id] || submissionResults[game.id] || celebratingItems[game.id] !== undefined ? (
                                (() => {
                                  const result = submissionResults[game.id];
                                  const prevAnswer = allPredictions[game.id];
                                  const userAnswer = result?.userAnswer || prevAnswer;
                                  const stats = result?.stats;
                                  const isCelebrating = celebratingItems[game.id] !== undefined;
                                  return (
                                    <div className="relative">
                                      <div className="flex flex-col gap-2">
                                        {options.map((opt, oi) => {
                                          const pct = stats ? (stats[opt] || 0) : 0;
                                          const isUserPick = opt === userAnswer;
                                          return (
                                            <div
                                              key={oi}
                                              className={`relative py-3 px-4 rounded-full overflow-hidden transition-all ${isUserPick ? 'bg-purple-100' : 'bg-gray-100'}`}
                                            >
                                              <div
                                                className={`absolute inset-0 transition-all duration-1000 ease-out ${isUserPick ? 'bg-purple-200/60' : 'bg-gray-200/40'}`}
                                                style={{ width: `${pct}%` }}
                                              />
                                              <div className="relative flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                  {isUserPick && <CheckCircle className="w-4 h-4 text-purple-600 shrink-0" />}
                                                  <span className={`text-sm font-medium ${isUserPick ? 'text-purple-800' : 'text-gray-800'}`}>{opt}</span>
                                                  {isUserPick && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-200 text-purple-800">You</span>}
                                                </div>
                                                <span className="text-xs font-medium text-gray-600">{pct}%</span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                        <button
                                          onClick={() => { if (gameIdx < categoryGames.length - 1) scrollCategoryTo(category, gameIdx + 1, categoryGames.length); }}
                                          className="w-full mt-2 py-2.5 rounded-xl font-semibold text-sm text-white transition-all bg-gradient-to-r from-blue-500 via-purple-500 to-purple-600 hover:opacity-90"
                                        >
                                          Next poll
                                        </button>
                                      </div>

                                      {/* Voted! overlay */}
                                      <div className={`absolute inset-0 rounded-xl flex flex-col items-center justify-center gap-3 transition-opacity duration-300 bg-black/60 ${isCelebrating ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                                        <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center shadow-lg">
                                          <CheckCircle className="w-7 h-7 text-white" />
                                        </div>
                                        <p className="text-xl font-bold text-white">Voted!</p>
                                        <div className="bg-white/20 rounded-xl px-5 py-2.5 border border-white/30">
                                          <span className="text-2xl font-bold text-white">+{celebratingItems[game.id] ?? result?.points ?? 0} pts</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()
                              ) : (
                                <div className="flex flex-col gap-2">
                                  {options.map((opt, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => handleTapAndVote(game, opt)}
                                      disabled={submitVote.isPending}
                                      className="py-3 px-4 rounded-full text-sm font-medium transition-all text-left bg-gray-100 text-gray-800 hover:bg-gray-200 active:scale-[0.98]"
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Vote className="mx-auto mb-4 text-gray-400" size={48} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery || selectedCategory ? 'No matching polls found' : 'No polls available'}
            </h3>
            <p className="text-gray-600 text-sm">
              {searchQuery || selectedCategory ? 'Try a different filter' : 'Check back soon for new polls!'}
            </p>
          </div>
        )}
      </div>

      {isTrackModalOpen && <ConsumptionTracker isOpen={isTrackModalOpen} onClose={() => setIsTrackModalOpen(false)} />}
      {shareModalGame && <GameShareModal game={shareModalGame} onClose={() => setShareModalGame(null)} />}
    </div>
  );
}
