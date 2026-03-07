import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Link, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Brain, Star, Users, UserPlus, ChevronLeft, ChevronRight, Search, ChevronDown, Trophy, CheckCircle, XCircle } from 'lucide-react';
import Navigation from '@/components/navigation';
import ConsumptionTracker from '@/components/consumption-tracker';
import { TriviaGameModal } from '@/components/trivia-game-modal';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { copyLink } from "@/lib/share";
import GameShareModal from "@/components/game-share-modal";
import CelebrationModal from '@/components/celebration-modal';
import { useFirstSessionHooks } from '@/components/first-session-hooks';

export default function PlayTriviaPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { markTrivia } = useFirstSessionHooks();
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [selectedTriviaGame, setSelectedTriviaGame] = useState<any>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [shareModalGame, setShareModalGame] = useState<any>(null);
  const [submissionResults, setSubmissionResults] = useState<Record<string, { correct: boolean; points: number; stats?: Record<string, number>; userAnswer?: string }>>({});
  const [celebratingItems, setCelebratingItems] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [triviaType, setTriviaType] = useState<'all' | 'challenges' | 'quick'>('all');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [expandedFilter, setExpandedFilter] = useState<'type' | 'topic' | 'genre' | null>(null);
  const [categoryIndices, setCategoryIndices] = useState<Record<string, number>>({});
  const categoryScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  const triviaTypeFilters = [
    { id: 'all', label: 'All' },
    { id: 'challenges', label: 'Challenges' },
    { id: 'quick', label: 'Quick Trivia' },
  ];

  const categoryFilters = [
    { id: 'Movies', label: 'Movies', icon: '🎬' },
    { id: 'TV', label: 'TV', icon: '📺' },
    { id: 'Music', label: 'Music', icon: '🎵' },
    { id: 'Books', label: 'Books', icon: '📚' },
    { id: 'Games', label: 'Sports', icon: '🎮' },
    { id: 'Podcasts', label: 'Podcasts', icon: '🎙️' },
    { id: 'Pop Culture', label: 'Pop Culture', icon: '⭐' },
  ];


  // Extract game ID from URL hash if present (format: /play/trivia#game-id)
  const gameIdFromUrl = window.location.hash.replace('#', '');

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  // Fetch trivia games directly from Supabase - always fetch all (including answered)
  const { data: games = [], isLoading } = useQuery({
    queryKey: ['/api/predictions/trivia'],
    queryFn: async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      const { data: pools, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('status', 'open')
        .eq('type', 'trivia')
        .order('created_at', { ascending: false });

      if (error) throw new Error('Failed to fetch trivia');
      return (pools || []).map((p: any) => ({
        ...p,
        isConsumed: p.id?.startsWith('consumed-trivia-') || p.origin_type === 'consumed'
      }));
    },
  });

  // Fetch all predictions
  const { data: userPredictionsData } = useQuery({
    queryKey: ['/api/predictions/user-predictions'],
    queryFn: async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = 'https://mahpgcogwpawvviapqza.supabase.co';
      const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1haHBnY29nd3Bhd3Z2aWFwcXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxNTczOTMsImV4cCI6MjA2MTczMzM5M30.cv34J_2INF3_GExWw9zN1Vaa-AOFWI2Py02h0vAlW4c';
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {};
      const { data, error } = await supabase
        .from('user_predictions')
        .select('pool_id, prediction')
        .eq('user_id', user.id);
      if (error) return {};
      const predictions: Record<string, string> = {};
      data?.forEach((pred) => { predictions[pred.pool_id] = pred.prediction; });
      return predictions;
    },
  });

  const allPredictions = userPredictionsData || {};

  // Submit prediction — direct Supabase insert + stats in one shot, exactly like TriviaCarousel
  const submitPrediction = useMutation({
    mutationFn: async ({ gameId, poolId, answer, options, correctAnswer, pointsReward }: {
      gameId: string; poolId: string; answer: string; options: string[]; correctAnswer?: string; pointsReward: number;
    }) => {
      if (!user?.id) throw new Error('Not logged in');
      const isCorrect = correctAnswer ? answer === correctAnswer : false;
      const points = isCorrect ? pointsReward : 0;

      const { error } = await supabase
        .from('user_predictions')
        .insert({ user_id: user.id, pool_id: poolId, prediction: answer, points_earned: points });

      if (error) {
        if (error.message?.includes('duplicate') || error.code === '23505') throw new Error('Already answered');
        throw error;
      }

      if (points > 0) {
        await supabase.rpc('increment_user_points', { user_id_param: user.id, points_to_add: points });
      }

      const { data: allPreds } = await supabase
        .from('user_predictions').select('prediction').eq('pool_id', poolId);

      const total = allPreds?.length || 1;
      const stats: Record<string, number> = {};
      for (const opt of options) {
        const count = allPreds?.filter((p: any) => p.prediction === opt).length || 0;
        stats[opt] = Math.round((count / total) * 100);
      }

      return { gameId, answer, isCorrect, points, stats };
    },
    onSuccess: (result) => {
      if (result.isCorrect) {
        setCelebratingItems(prev => ({ ...prev, [result.gameId]: result.points }));
        setTimeout(() => {
          setCelebratingItems(prev => { const next = { ...prev }; delete next[result.gameId]; return next; });
        }, 1600);
      }
      setSubmissionResults(prev => ({
        ...prev,
        [result.gameId]: { correct: result.isCorrect, points: result.points, stats: result.stats, userAnswer: result.answer }
      }));
      markTrivia();
      queryClient.invalidateQueries({ queryKey: ['/api/predictions/user-predictions'] });
    },
    onError: (error: Error) => {
      if (error.message !== 'Already answered') {
        toast({ title: "Error", description: "Failed to submit answer. Please try again.", variant: "destructive" });
      }
    },
  });

  const handleOptionSelect = (gameId: string, option: string) => {
    setSelectedAnswers(prev => ({ ...prev, [gameId]: option }));
  };

  const handleTapAndSubmit = (game: any, option: string) => {
    if (allPredictions[game.id] || submissionResults[game.id]) return;
    setSelectedAnswers(prev => ({ ...prev, [game.id]: option }));
    submitPrediction.mutate({
      gameId: game.id, poolId: game.id, answer: option,
      options: game.options || [],
      correctAnswer: game.correct_answer || game.correctAnswer,
      pointsReward: game.points_reward || 10,
    });
  };

  const handleSubmitAnswer = (game: any) => {
    const answer = selectedAnswers[game.id];
    if (!answer || submissionResults[game.id]) return;
    submitPrediction.mutate({
      gameId: game.id, poolId: game.id, answer,
      options: game.options || [],
      correctAnswer: game.correct_answer || game.correctAnswer,
      pointsReward: game.points_reward || 10,
    });
  };

  const handleInviteFriends = (item: any) => {
    setShareModalGame(item);
  };

  // Process and filter games
  const processedGames = games.map((pool: any) => {
    const isLongFormTrivia = pool.type === 'trivia' && 
      Array.isArray(pool.options) && 
      pool.options.length > 0 && 
      typeof pool.options[0] === 'object';

    return {
      ...pool,
      points: pool.points_reward,
      isLongForm: isLongFormTrivia,
    };
  });

  // Filter for trivia games only with search and category
  const triviaGames = useMemo(() => {
    let filtered = processedGames.filter((game: any) => game.type === 'trivia');
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((game: any) => {
        const titleMatch = game.title?.toLowerCase().includes(query);
        const descMatch = game.description?.toLowerCase().includes(query);
        // Also search in questions if available
        const questionsMatch = Array.isArray(game.options) && game.options.some((opt: any) => 
          typeof opt === 'object' && opt.question?.toLowerCase().includes(query)
        );
        return titleMatch || descMatch || questionsMatch;
      });
    }
    
    // Apply category filter
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter((game: any) => game.category === selectedCategory);
    }
    
    // Apply trivia type filter (challenges = 10 questions, quick = 1 question)
    if (triviaType === 'challenges') {
      filtered = filtered.filter((game: any) => {
        const questionCount = Array.isArray(game.options) ? game.options.length : 0;
        return questionCount >= 10;
      });
    } else if (triviaType === 'quick') {
      filtered = filtered.filter((game: any) => {
        const questionCount = Array.isArray(game.options) ? game.options.length : 0;
        return questionCount === 1;
      });
    }
    
    // Apply genre filter (tags array)
    if (selectedGenre) {
      filtered = filtered.filter((game: any) => {
        const tags = game.tags || [];
        return tags.includes(selectedGenre);
      });
    }
    
    return filtered;
  }, [processedGames, searchQuery, selectedCategory, triviaType, selectedGenre]);
  
  const lowStakesGames = triviaGames.filter((game: any) => !game.isHighStakes);
  const highStakesGames = triviaGames.filter((game: any) => game.isHighStakes);

  // Normalize category names to consistent format
  const CATEGORY_ORDER = ['Movies', 'TV', 'Music', 'Podcasts', 'Gaming', 'Sports', 'Books', 'Pop Culture', 'Other'];

  const normalizeCategory = (cat: string): string => {
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
    return 'Other';
  };

  // Category display info
  const categoryInfo: Record<string, { label: string }> = {
    'Movies': { label: 'Movies' },
    'TV': { label: 'TV Shows' },
    'Music': { label: 'Music' },
    'Podcasts': { label: 'Podcasts' },
    'Gaming': { label: 'Gaming' },
    'Sports': { label: 'Sports' },
    'Books': { label: 'Books' },
    'Pop Culture': { label: 'Pop Culture' },
    'Other': { label: 'General' },
  };

  // Group games by category for carousel display, sorted by defined order
  const gamesByCategory = useMemo(() => {
    const groups: Record<string, any[]> = {};
    lowStakesGames.forEach((game: any) => {
      const category = normalizeCategory(game.category);
      if (!groups[category]) groups[category] = [];
      groups[category].push(game);
    });
    // Return as ordered array of [category, games] entries
    return CATEGORY_ORDER
      .filter(cat => groups[cat])
      .map(cat => [cat, groups[cat]] as [string, any[]]);
  }, [lowStakesGames]);

  // Auto-open game if gameId is in URL
  React.useEffect(() => {
    if (gameIdFromUrl && !selectedTriviaGame && triviaGames.length > 0) {
      const gameToOpen = triviaGames.find((g: any) => g.id === gameIdFromUrl);
      if (gameToOpen) {
        setSelectedTriviaGame(gameToOpen);
      }
    }
  }, [gameIdFromUrl, triviaGames, selectedTriviaGame]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation onTrackConsumption={handleTrackConsumption} />
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center py-20">
            <div className="text-xl">Loading trivia...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation onTrackConsumption={handleTrackConsumption} />

      {/* Header Section with Gradient */}
      <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] pb-6 -mt-px">
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => window.history.back()}
              className="flex items-center text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-2xl font-semibold text-white" data-testid="trivia-title">Trivia</h1>
          </div>

            {/* Search Row */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <Input
                type="text"
                placeholder="Search trivia..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/10 border-white/20 rounded-xl text-white placeholder:text-gray-400"
                data-testid="trivia-search-input"
              />
            </div>

        </div>
      </div>

      {/* Pill category filters — scrollable row in the light section */}
      {gamesByCategory.length > 0 && (
        <div className="bg-gray-50 px-4 pt-4 pb-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => setSelectedCategory(null)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                !selectedCategory
                  ? 'bg-purple-700 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-purple-300'
              }`}
            >
              All
            </button>
            {gamesByCategory.map(([cat]) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-purple-700 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-purple-300'
                }`}
              >
                {categoryInfo[cat]?.label || cat}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-4">

        {/* Trivia Games by Category */}
        {gamesByCategory.length > 0 ? (
          <div className="space-y-5">
            {gamesByCategory
              .filter(([cat]) => !selectedCategory || cat === selectedCategory)
              .map(([category, games]) => {
              const label = categoryInfo[category]?.label || category;
              const currentIndex = categoryIndices[category] || 0;
              
              return (
                <div key={category}>
                  <Card className="bg-white border border-gray-200 rounded-2xl p-4 pb-3 shadow-sm overflow-hidden">
                    {/* Card Header — same as TriviaCarousel feed style */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-purple-900 flex items-center justify-center flex-shrink-0">
                          <Brain className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{label} Trivia</p>
                          <p className="text-[10px] text-gray-500">One question trivia</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {currentIndex > 0 && (
                          <button
                            onClick={() => scrollCategoryTo(category, currentIndex - 1, games.length)}
                            className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4 text-gray-600" />
                          </button>
                        )}
                        {currentIndex < games.length - 1 && (
                          <button
                            onClick={() => scrollCategoryTo(category, currentIndex + 1, games.length)}
                            className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                          >
                            <ChevronRight className="w-4 h-4 text-gray-600" />
                          </button>
                        )}
                        <span className="text-xs text-gray-500 ml-1">{currentIndex + 1}/{games.length}</span>
                      </div>
                    </div>

                    {/* Questions snap-scroll container */}
                    <div
                      ref={el => { categoryScrollRefs.current[category] = el; }}
                      onScroll={() => handleCategoryScroll(category, games.length)}
                      className="flex overflow-x-auto snap-x snap-mandatory"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      {(games as any[]).map((game: any, gameIdx: number) => (
                        <div key={game.id} className="flex-shrink-0 w-full snap-center">
                          {/* Media tag chip */}
                          {(game.tags?.[0] || game.media_title || game.description) && (
                            <div className="mb-2">
                              <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 border border-purple-200">
                                <span className="text-[10px] text-purple-700 font-medium">
                                  {game.tags?.[0] || game.media_title || game.description}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Question */}
                          <h3 className="text-gray-900 font-semibold text-base leading-snug mb-4">{game.title}</h3>

                          {/* Answer state */}
                          {allPredictions[game.id] || submissionResults[game.id] || celebratingItems[game.id] !== undefined ? (
                            (() => {
                              const result = submissionResults[game.id];
                              const prevAnswer = allPredictions[game.id];
                              const userAnswer = result?.userAnswer || prevAnswer?.prediction;
                              const correctAnswer = game.correct_answer || game.correctAnswer;
                              const gotItRight = result ? result.correct : (userAnswer && userAnswer === correctAnswer);
                              const stats = result?.stats;
                              return (
                                <div className="relative">
                                  <div className="flex flex-col gap-2">
                                    {/* Incorrect / already-played header */}
                                    {result && !gotItRight && (
                                      <div className="py-2.5 px-4 rounded-xl flex items-center gap-2 bg-red-50 border border-red-200">
                                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <span className="text-sm font-bold text-red-700">Incorrect</span>
                                          {correctAnswer && (
                                            <span className="text-xs text-gray-500 ml-2">Correct: {correctAnswer}</span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {!result && prevAnswer && (
                                      <div className="py-2 px-4 rounded-xl flex items-center gap-2 bg-gray-100 border border-gray-200">
                                        <CheckCircle className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                        <span className="text-sm font-semibold text-gray-500">Already completed</span>
                                      </div>
                                    )}

                                    {/* Percentage bars */}
                                    {(game.options || []).map((opt: string, oi: number) => {
                                      const pct = stats ? (stats[opt] || 0) : 0;
                                      const isCorrect = opt === correctAnswer;
                                      const isUser = opt === userAnswer;
                                      return (
                                        <div
                                          key={oi}
                                          className={`relative py-3 px-4 rounded-full overflow-hidden transition-all ${
                                            isCorrect ? 'bg-green-100' : isUser ? 'bg-red-100' : 'bg-gray-100'
                                          }`}
                                        >
                                          <div
                                            className={`absolute inset-0 transition-all duration-1000 ease-out ${
                                              isCorrect ? 'bg-green-200/60' : 'bg-gray-200/40'
                                            }`}
                                            style={{ width: `${pct}%` }}
                                          />
                                          <div className="relative flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                              {isCorrect && <CheckCircle className="w-4 h-4 text-green-600" />}
                                              {isUser && !isCorrect && <XCircle className="w-4 h-4 text-red-500" />}
                                              <span className={`text-sm font-medium ${
                                                isCorrect ? 'text-green-800' : isUser ? 'text-red-800' : 'text-gray-800'
                                              }`}>{opt}</span>
                                              {isUser && (
                                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                                  isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                                                }`}>You</span>
                                              )}
                                            </div>
                                            <span className="text-xs font-medium text-gray-600">{pct}%</span>
                                          </div>
                                        </div>
                                      );
                                    })}

                                    {/* Continue button */}
                                    <button
                                      onClick={() => {
                                        if (gameIdx < (games as any[]).length - 1) {
                                          scrollCategoryTo(category, gameIdx + 1, (games as any[]).length);
                                        }
                                      }}
                                      className="w-full mt-2 py-2.5 rounded-xl font-semibold text-sm text-white transition-all bg-gradient-to-r from-blue-500 via-purple-500 to-purple-600 hover:opacity-90"
                                    >
                                      Next question
                                    </button>
                                  </div>

                                  {/* Celebration overlay — dims bars, shows Correct! + pts */}
                                  <div className={`absolute inset-0 rounded-xl flex flex-col items-center justify-center gap-3 transition-opacity duration-300 bg-black/60 ${
                                    celebratingItems[game.id] !== undefined ? 'opacity-100' : 'opacity-0 pointer-events-none'
                                  }`}>
                                    <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg">
                                      <CheckCircle className="w-7 h-7 text-white" />
                                    </div>
                                    <p className="text-xl font-bold text-white">Correct!</p>
                                    <div className="bg-white/20 rounded-xl px-5 py-2.5 border border-white/30">
                                      <span className="text-2xl font-bold text-white">+{celebratingItems[game.id] ?? 0} pts</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()
                          ) : game.isLongForm ? (
                            <Button
                              onClick={() => setSelectedTriviaGame(game)}
                              className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-full py-3 text-sm"
                              data-testid={`play-${game.id}`}
                            >
                              <Brain size={14} className="mr-2" />
                              Play Challenge
                            </Button>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {(game.options || []).map((option: string, index: number) => (
                                <button
                                  key={`${game.id}-${index}`}
                                  onClick={() => handleTapAndSubmit(game, option)}
                                  disabled={submitPrediction.isPending}
                                  className={`py-3 px-4 rounded-full text-sm font-medium transition-all text-left ${
                                    selectedAnswers[game.id] === option
                                      ? 'bg-purple-600 text-white shadow-md'
                                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                  }`}
                                  data-testid={`option-${game.id}-${index}`}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Footer */}
                          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                            <button
                              onClick={() => handleInviteFriends(game)}
                              className="flex items-center gap-1.5 text-purple-600 text-xs font-medium"
                            >
                              <Users className="w-3.5 h-3.5" />
                              Challenge a friend
                            </button>
                            <span className="text-green-600 text-xs font-medium">+{game.points || 10} pts</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        ) : lowStakesGames.length > 0 && (
          <div className="mb-8">
            <div className="space-y-4">
              {lowStakesGames.map((game: any) => (
                <Card key={game.id} className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        {game.isConsumed ? (
                          <Badge className="bg-purple-600 text-white hover:bg-purple-700 text-[10px] py-0 px-1.5 font-bold uppercase tracking-wider">
                            Consumed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-bold uppercase tracking-wider border-gray-300 text-gray-500">
                            User
                          </Badge>
                        )}
                        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-xs font-medium uppercase">
                          {game.isLongForm ? 'Trivia' : 'Quick Trivia'}
                        </Badge>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleInviteFriends(game)}
                        className="px-3 py-1.5 text-xs bg-purple-600 text-white hover:bg-purple-700 border-0 rounded-lg"
                        data-testid={`invite-${game.id}`}
                      >
                        <UserPlus size={14} className="mr-1" />
                        Invite to Play
                      </Button>
                    </div>

                    <CardTitle className="text-xl font-bold text-gray-900 mb-2 mt-2">{game.title}</CardTitle>
                    <p className="text-gray-600 text-sm mb-4">{game.description}</p>

                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <Star size={14} className="text-purple-600" />
                        <span className="font-medium text-purple-600">You Earn: {game.points || 10} pts</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Users size={14} />
                        <span>{game.participants || 0}</span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {allPredictions[game.id] || submissionResults[game.id] || celebratingItems[game.id] !== undefined ? (
                      (() => {
                        const result = submissionResults[game.id];
                        const prevAnswer = allPredictions[game.id];
                        const userAnswer = result?.userAnswer || prevAnswer?.prediction;
                        const correctAnswer = game.correct_answer || game.correctAnswer;
                        const stats = result?.stats;
                        const isCelebrating = celebratingItems[game.id] !== undefined;
                        return (
                          <div className="relative">
                            <div className="flex flex-col gap-2">
                              {(game.options || []).map((opt: string) => {
                                const pct = stats ? (stats[opt] || 0) : 0;
                                const isUserPick = opt === userAnswer;
                                const isCorrectOpt = correctAnswer ? opt === correctAnswer : false;
                                return (
                                  <div key={opt} className="relative rounded-full overflow-hidden bg-gray-100 h-10">
                                    <div
                                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
                                      style={{
                                        width: `${pct}%`,
                                        background: isCorrectOpt
                                          ? 'linear-gradient(90deg,#22c55e,#16a34a)'
                                          : isUserPick
                                          ? 'linear-gradient(90deg,#ef4444,#b91c1c)'
                                          : '#d1d5db'
                                      }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-between px-3">
                                      <div className="flex items-center gap-2">
                                        {isCorrectOpt
                                          ? <CheckCircle size={14} className="text-green-600 shrink-0" />
                                          : isUserPick
                                          ? <XCircle size={14} className="text-red-500 shrink-0" />
                                          : <div className="w-3.5 h-3.5" />
                                        }
                                        <span className="text-sm font-medium text-gray-800 truncate">{opt}</span>
                                        {isUserPick && (
                                          <span className="text-[10px] bg-gray-300 text-gray-700 px-1.5 py-0.5 rounded-full font-semibold">You</span>
                                        )}
                                      </div>
                                      <span className="text-xs font-bold text-gray-600">{pct}%</span>
                                    </div>
                                  </div>
                                );
                              })}
                              <button
                                className="w-full mt-2 py-2.5 rounded-xl font-semibold text-sm text-white transition-all bg-gradient-to-r from-blue-500 via-purple-500 to-purple-600 hover:opacity-90"
                              >
                                Next question
                              </button>
                            </div>
                            <div className={`absolute inset-0 bg-black/70 rounded-xl flex flex-col items-center justify-center gap-2 transition-opacity duration-500 ${isCelebrating ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                              <CheckCircle size={32} className="text-green-400" />
                              <p className="text-white font-bold text-lg">Correct!</p>
                              <p className="text-green-400 font-semibold text-sm">+{celebratingItems[game.id] || result?.points || 0} pts</p>
                            </div>
                          </div>
                        );
                      })()
                    ) : game.isLongForm ? (
                      <Button 
                        onClick={() => setSelectedTriviaGame(game)}
                        className="w-full bg-gray-500 hover:bg-gray-600 text-white rounded-xl py-6"
                        data-testid={`play-${game.id}`}
                      >
                        <Brain size={16} className="mr-2" />
                        Play Trivia Game
                      </Button>
                    ) : (
                      <>
                        <div className="text-gray-600 text-sm font-medium">Quick Answer:</div>
                        <div className="grid grid-cols-2 gap-3">
                          {(game.options || []).slice(0, 2).map((option: string, index: number) => (
                            <button
                              key={`${game.id}-${index}`}
                              onClick={() => handleOptionSelect(game.id, option)}
                              className={`p-4 text-left rounded-lg border-2 transition-all ${
                                selectedAnswers[game.id] === option
                                  ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                              data-testid={`option-${game.id}-${index}`}
                            >
                              <div className="text-sm font-medium text-gray-900">{option}</div>
                            </button>
                          ))}
                        </div>
                        <Button 
                          onClick={() => handleSubmitAnswer(game)}
                          disabled={!selectedAnswers[game.id] || submitPrediction.isPending}
                          className="w-full bg-gray-500 hover:bg-gray-600 text-white disabled:opacity-50 rounded-xl py-6"
                          data-testid={`submit-${game.id}`}
                        >
                          {submitPrediction.isPending ? 'Submitting...' : 'Submit'}
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* HIGH STAKES Section */}
        {highStakesGames.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <span>High Stakes</span>
              <Badge className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white text-xs font-bold border-0">
                ⭐ PREMIUM
              </Badge>
            </h2>
            <div className="space-y-4">
              {highStakesGames.map((game: any) => (
                <Card key={game.id} className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300 shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        {game.isConsumed ? (
                          <Badge className="bg-purple-600 text-white hover:bg-purple-700 text-[10px] py-0 px-1.5 font-bold uppercase tracking-wider">
                            Consumed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-bold uppercase tracking-wider border-gray-300 text-gray-500">
                            User
                          </Badge>
                        )}
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs font-medium uppercase">
                          High Stakes Trivia
                        </Badge>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleInviteFriends(game)}
                        className="px-3 py-1.5 text-xs bg-purple-600 text-white hover:bg-purple-700 border-0 rounded-lg"
                        data-testid={`invite-${game.id}`}
                      >
                        <UserPlus size={14} className="mr-1" />
                        Invite to Play
                      </Button>
                    </div>

                    <CardTitle className="text-xl font-bold text-amber-900 mb-2 mt-2">{game.title}</CardTitle>
                    <p className="text-amber-800 text-sm mb-4">{game.description}</p>

                    <div className="flex items-center space-x-4 text-sm text-amber-900">
                      <div className="flex items-center space-x-1">
                        <Star size={14} className="text-amber-600" />
                        <span className="font-medium">Entry: {game.entryCost || 50} pts</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Star size={14} className="text-amber-600" />
                        <span className="font-medium">Win: {game.payout || 100} pts</span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <Button 
                      onClick={() => setSelectedTriviaGame(game)}
                      className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white rounded-xl py-6"
                      data-testid={`play-${game.id}`}
                    >
                      <Brain size={16} className="mr-2" />
                      Play High Stakes Game
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {triviaGames.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Brain className="mx-auto mb-4 text-gray-400" size={48} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery || selectedCategory || triviaType !== 'all' ? 'No matching trivia found' : 'No trivia games available'}
            </h3>
            <p className="text-gray-600">
              {searchQuery || selectedCategory || triviaType !== 'all'
                ? 'Try a different search term or filter' 
                : 'Check back soon for new trivia!'}
            </p>
            {(searchQuery || selectedCategory || triviaType !== 'all') && (
              <Button
                variant="outline"
                onClick={() => { setSearchQuery(''); setSelectedCategory(null); setTriviaType('all'); }}
                className="mt-4"
                data-testid="clear-filters"
              >
                Clear Filters
              </Button>
            )}
          </div>
        )}
      </div>

      <ConsumptionTracker 
        isOpen={isTrackModalOpen} 
        onClose={() => setIsTrackModalOpen(false)} 
      />

      {selectedTriviaGame && (
        <TriviaGameModal
          poolId={selectedTriviaGame.id}
          title={selectedTriviaGame.title}
          questions={selectedTriviaGame.options}
          pointsReward={selectedTriviaGame.points}
          isOpen={!!selectedTriviaGame}
          onClose={() => {
            setSelectedTriviaGame(null);
            // Clear URL hash to prevent useEffect from reopening
            if (window.location.hash) {
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }
          }}
        />
      )}

      {/* Game Share Modal */}
      {shareModalGame && (
        <GameShareModal
          isOpen={!!shareModalGame}
          onClose={() => setShareModalGame(null)}
          gameId={shareModalGame.id}
          gameTitle={shareModalGame.title}
          gameType={shareModalGame.type || "trivia"}
        />
      )}


    </div>
  );
}