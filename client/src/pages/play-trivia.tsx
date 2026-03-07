import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Brain, Star, Users, UserPlus, ChevronLeft, ChevronRight, Search, ChevronDown, Trophy } from 'lucide-react';
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
  const { markTrivia } = useFirstSessionHooks();
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [selectedTriviaGame, setSelectedTriviaGame] = useState<any>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [shareModalGame, setShareModalGame] = useState<any>(null);
  const [submissionResults, setSubmissionResults] = useState<Record<string, { correct: boolean; points: number }>>({});
  const [showCelebration, setShowCelebration] = useState<{ points: number } | null>(null);
  const [celebrationTimer, setCelebrationTimer] = useState<NodeJS.Timeout | null>(null);
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

  // Cleanup celebration timer on unmount
  React.useEffect(() => {
    return () => {
      if (celebrationTimer) {
        clearTimeout(celebrationTimer);
      }
    };
  }, [celebrationTimer]);

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

  // Submit prediction mutation
  const submitPrediction = useMutation({
    mutationFn: async ({ poolId, answer }: { poolId: string; answer: string }) => {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = 'https://mahpgcogwpawvviapqza.supabase.co';
      const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1haHBnY29nd3Bhd3Z2aWFwcXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxNTczOTMsImV4cCI6MjA2MTczMzM5M30.cv34J_2INF3_GExWw9zN1Vaa-AOFWI2Py02h0vAlW4c';
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/predictions/predict`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pool_id: poolId,
          prediction: answer,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to submit answer: ${errorText}`);
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/predictions/pools'] });
      queryClient.invalidateQueries({ queryKey: ['/api/predictions/user-predictions'] });
      toast({
        title: "Success!",
        description: "Your answer has been submitted",
      });
    },
  });

  const handleOptionSelect = (gameId: string, option: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [gameId]: option
    }));
  };

  const handleTapAndSubmit = async (game: any, option: string) => {
    if (allPredictions[game.id] || submissionResults[game.id]) return;
    setSelectedAnswers(prev => ({ ...prev, [game.id]: option }));
    try {
      const result = await submitPrediction.mutateAsync({ poolId: game.id, answer: option });
      const pointsEarned = result.points_earned || 0;
      const isCorrect = pointsEarned > 0;
      setSubmissionResults(prev => ({ ...prev, [game.id]: { correct: isCorrect, points: pointsEarned } }));
      if (isCorrect && pointsEarned > 0) {
        setShowCelebration({ points: pointsEarned });
        const timer = setTimeout(() => setShowCelebration(null), 3000);
        setCelebrationTimer(timer);
      }
      markTrivia();
    } catch (error) {
      console.error('Error submitting answer:', error);
      toast({ title: "Error", description: "Failed to submit answer. Please try again.", variant: "destructive" });
    }
  };

  const handleSubmitAnswer = async (game: any) => {
    const answer = selectedAnswers[game.id];
    if (!answer) return;

    try {
      // Submit to backend - it will check if answer is correct and return points_earned
      const result = await submitPrediction.mutateAsync({
        poolId: game.id,
        answer
      });

      // Backend returns { success: true, points_earned: number }
      const pointsEarned = result.points_earned || 0;
      const isCorrect = pointsEarned > 0;

      // Store result for UI feedback
      setSubmissionResults(prev => ({
        ...prev,
        [game.id]: { correct: isCorrect, points: pointsEarned }
      }));

      // Show celebration modal for correct answers
      if (isCorrect && pointsEarned > 0) {
        setShowCelebration({ points: pointsEarned });
        // Auto-hide celebration after 3 seconds
        const timer = setTimeout(() => {
          setShowCelebration(null);
        }, 3000);
        setCelebrationTimer(timer);
      }
      
      markTrivia();
    } catch (error) {
      console.error('Error submitting answer:', error);
      toast({
        title: "Error",
        description: "Failed to submit answer. Please try again.",
        variant: "destructive"
      });
    }
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
    
    // Sort: uncompleted games first, completed games at the bottom
    filtered.sort((a: any, b: any) => {
      const aCompleted = allPredictions[a.id] ? 1 : 0;
      const bCompleted = allPredictions[b.id] ? 1 : 0;
      return aCompleted - bCompleted;
    });
    
    return filtered;
  }, [processedGames, searchQuery, selectedCategory, triviaType, selectedGenre, allPredictions]);
  
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
                      {(games as any[]).map((game: any) => (
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
                          {allPredictions[game.id] || submissionResults[game.id] ? (
                            <div className="flex flex-col gap-2">
                              {submissionResults[game.id] ? (
                                submissionResults[game.id].correct ? (
                                  <div className="py-3 px-4 rounded-full bg-green-100 text-center">
                                    <span className="text-sm font-medium text-green-800">Correct! +{submissionResults[game.id].points} pts</span>
                                  </div>
                                ) : (
                                  <div className="py-3 px-4 rounded-full bg-gray-100 text-center">
                                    <span className="text-sm font-medium text-gray-600">Answered</span>
                                  </div>
                                )
                              ) : (
                                <div className="py-3 px-4 rounded-full bg-gray-100 text-center">
                                  <span className="text-sm font-medium text-gray-500">Already answered</span>
                                </div>
                              )}
                            </div>
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
                    {allPredictions[game.id] || submissionResults[game.id] ? (
                      submissionResults[game.id] ? (
                        submissionResults[game.id].correct ? (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                            <div className="text-green-800 font-bold text-lg">✓ Correct!</div>
                            <div className="text-green-700 text-sm mt-1">
                              You earned {submissionResults[game.id].points} points
                            </div>
                          </div>
                        ) : (
                          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 text-center">
                            <div className="text-4xl mb-2">💪</div>
                            <div className="text-blue-900 font-bold text-lg mb-2">Keep Going!</div>
                            <div className="text-blue-700 text-sm">
                              Every attempt makes you smarter. Try another trivia challenge!
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                          <div className="text-gray-800 font-medium">✓ Submitted</div>
                          <div className="text-gray-700 text-sm">Game completed!</div>
                        </div>
                      )
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

      {/* Celebration Modal for Correct Answers */}
      {showCelebration && (
        <CelebrationModal
          points={showCelebration.points}
          onClose={() => setShowCelebration(null)}
        />
      )}

    </div>
  );
}