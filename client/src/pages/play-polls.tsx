import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Vote, Star, Users, UserPlus, ChevronLeft, Search, ChevronDown, Trophy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Navigation from '@/components/navigation';
import ConsumptionTracker from '@/components/consumption-tracker';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import GameShareModal from "@/components/game-share-modal";
import { supabase } from '@/lib/supabase';

export default function PlayPollsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [shareModalGame, setShareModalGame] = useState<any>(null);
  const [selectedPoll, setSelectedPoll] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [expandedFilter, setExpandedFilter] = useState<'topic' | 'genre' | null>(null);

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

  // Extract game ID from URL hash if present (format: /play/polls#game-id)
  const gameIdFromUrl = window.location.hash.replace('#', '');

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  // Fetch games directly from Supabase - both curated Consumed polls and user polls
  const { data: games = [], isLoading } = useQuery({
    queryKey: ['/api/predictions/polls', selectedCategory, searchQuery, selectedGenre],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (selectedCategory) params.set('category', selectedCategory);
        if (searchQuery) params.set('search', searchQuery);
        if (selectedGenre) params.set('genre', selectedGenre);

        // Try to invoke the edge function
        const queryString = params.toString();
        const { data, error } = await supabase.functions.invoke(
          queryString ? `get-polls?${queryString}` : 'get-polls',
          { method: 'GET' }
        );

        if (error) {
          console.error('Error invoking get-polls:', error);
          // Fallback to direct client fetch if function fails
          const { data: pools, error: directError } = await supabase
            .from('prediction_pools')
            .select('*')
            .eq('status', 'open')
            .eq('type', 'vote')
            .order('created_at', { ascending: false });
          
          if (directError) throw new Error('Failed to fetch games');
          return (pools || []).map((p: any) => ({
            ...p,
            isConsumed: p.id?.startsWith('consumed-poll-') || p.origin_type === 'consumed'
          }));
        }

        return data.polls || [];
      } catch (err) {
        console.error('Fetch polls error:', err);
        return [];
      }
    },
  });

  // Fetch all predictions
  const { data: userPredictionsData } = useQuery({
    queryKey: ['/api/predictions/user-predictions'],
    queryFn: async () => {
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

  // Submit vote mutation - directly to Supabase
  const submitPrediction = useMutation({
    mutationFn: async ({ poolId, answer }: { poolId: string; answer: string }) => {
      console.log('🚀 Saving vote to user_predictions table...');
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Must be logged in to vote');
      }
      
      const { data: game, error: gameError } = await supabase
        .from('prediction_pools')
        .select('points_reward, type')
        .eq('id', poolId)
        .single();
        
      if (gameError || !game) {
        throw new Error('Poll not found');
      }
      
      const gameType = game.type;
      let immediatePoints = 0;
      
      if (gameType === 'vote' || gameType === 'trivia') {
        immediatePoints = game.points_reward;
      } else if (gameType === 'predict') {
        immediatePoints = 0;
      }

      const { data, error } = await supabase
        .from('user_predictions')
        .insert({
          user_id: user.id,
          pool_id: poolId,
          prediction: answer,
          points_earned: immediatePoints,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) {
        console.error('❌ Error saving vote:', error);
        if (error.code === '23505') {
          throw new Error('You have already voted on this poll');
        }
        throw new Error('Failed to save vote');
      }
      
      console.log('✅ Vote saved successfully:', data);
      
      return { 
        success: true, 
        points_earned: immediatePoints,
        pool_id: poolId,
        prediction: answer,
        game_type: gameType
      };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/predictions/user-predictions'] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      
      toast({
        title: "Vote Submitted!",
        description: `You voted for "${data.prediction}" and earned ${data.points_earned} points!`,
      });
    },
    onError: () => {
      toast({
        title: "Submission Failed",
        description: "Could not submit your vote. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleOptionSelect = (gameId: string, option: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [gameId]: option
    }));
  };

  const handleSubmitAnswer = async (game: any) => {
    const answer = selectedAnswers[game.id];
    if (!answer) {
      toast({
        title: "Please select an option",
        description: "Choose one of the options before submitting.",
        variant: "destructive"
      });
      return;
    }

    await submitPrediction.mutateAsync({
      poolId: game.id,
      answer
    });
  };

  const handleInviteFriends = (item: any) => {
    setShareModalGame(item);
  };

  // Process and filter games
  const processedGames = games.map((pool: any) => {
    return {
      ...pool,
      points: pool.points_reward,
    };
  });

  // Filter for poll/vote games with search, category, type, and genre
  const pollGames = React.useMemo(() => {
    let filtered = processedGames.filter((game: any) => game.type === 'vote');
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((game: any) => {
        const titleMatch = game.title?.toLowerCase().includes(query);
        const descMatch = game.description?.toLowerCase().includes(query);
        return titleMatch || descMatch;
      });
    }
    
    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter((game: any) => game.category === selectedCategory);
    }
    
    // Apply genre filter (tags array)
    if (selectedGenre) {
      filtered = filtered.filter((game: any) => {
        const tags = game.tags || [];
        return tags.includes(selectedGenre);
      });
    }
    
    // Sort: uncompleted polls first, completed polls at the bottom
    filtered.sort((a: any, b: any) => {
      const aCompleted = allPredictions[a.id] ? 1 : 0;
      const bCompleted = allPredictions[b.id] ? 1 : 0;
      return aCompleted - bCompleted;
    });
    
    return filtered;
  }, [processedGames, searchQuery, selectedCategory, selectedGenre, allPredictions]);

  // Normalize category names to consistent format
  const normalizeCategory = (cat: string): string => {
    if (!cat) return 'Other';
    const lower = cat.toLowerCase().trim();
    if (lower === 'movies' || lower === 'movie') return 'Movies';
    if (lower === 'tv' || lower === 'tv shows' || lower === 'tv-show' || lower === 'tv show') return 'TV';
    if (lower === 'books' || lower === 'book') return 'Books';
    if (lower === 'sports' || lower === 'sport') return 'Sports';
    if (lower === 'music') return 'Music';
    if (lower === 'podcasts' || lower === 'podcast') return 'Podcasts';
    if (lower === 'pop culture') return 'Pop Culture';
    return cat;
  };

  // Group polls by category for carousel display
  const pollsByCategory = useMemo(() => {
    const groups: Record<string, any[]> = {};
    pollGames.forEach((game: any) => {
      const category = normalizeCategory(game.category);
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(game);
    });
    return groups;
  }, [pollGames]);

  // Category display info
  const categoryInfo: Record<string, { label: string }> = {
    'Movies': { label: 'Movies' },
    'TV': { label: 'TV Shows' },
    'Music': { label: 'Music' },
    'Books': { label: 'Books' },
    'Sports': { label: 'Sports' },
    'Podcasts': { label: 'Podcasts' },
    'Pop Culture': { label: 'Pop Culture' },
    'Other': { label: 'General' },
  };

  // Auto-open poll if gameId is in URL hash
  React.useEffect(() => {
    if (gameIdFromUrl && !selectedPoll && pollGames.length > 0) {
      const gameToOpen = pollGames.find((g: any) => g.id === gameIdFromUrl);
      if (gameToOpen) {
        setSelectedPoll(gameToOpen);
      }
    }
  }, [gameIdFromUrl, pollGames, selectedPoll]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation onTrackConsumption={handleTrackConsumption} />
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center py-20">
            <div className="text-xl">Loading polls...</div>
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
          <div className="mb-2">
            <h1 className="text-3xl font-semibold text-white" data-testid="polls-title">Polls</h1>
          </div>
          <p className="text-gray-400 text-left mb-6">
            Vote on trending topics and see how your opinions compare to others
          </p>

            {/* Search Row */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <Input
                type="text"
                placeholder="Search polls..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/10 border-white/20 rounded-xl text-white placeholder:text-gray-400"
                data-testid="polls-search-input"
              />
            </div>

            {/* Filter Dropdowns Row */}
            <div className="flex flex-wrap gap-3">
              {/* Topic Filter Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setExpandedFilter(expandedFilter === 'topic' ? null : 'topic')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all text-sm ${
                    selectedCategory
                      ? 'text-purple-300'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  data-testid="topic-filter-toggle"
                >
                  <span>
                    Topic{selectedCategory ? `: ${categoryFilters.find(c => c.id === selectedCategory)?.label}` : ''}
                  </span>
                  <ChevronDown size={14} className={`transition-transform ${expandedFilter === 'topic' ? 'rotate-180' : ''}`} />
                </button>
                {expandedFilter === 'topic' && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg p-2 z-20 min-w-[160px]">
                    <button
                      onClick={() => {
                        setSelectedCategory(null);
                        setExpandedFilter(null);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${
                        !selectedCategory
                          ? 'bg-purple-100 text-purple-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      data-testid="filter-all-topics"
                    >
                      All Topics
                    </button>
                    {categoryFilters.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setSelectedCategory(cat.id);
                          setExpandedFilter(null);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${
                          selectedCategory === cat.id
                            ? 'bg-purple-100 text-purple-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                        data-testid={`filter-${cat.id}`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Genre Filter Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setExpandedFilter(expandedFilter === 'genre' ? null : 'genre')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all text-sm ${
                    selectedGenre
                      ? 'text-purple-300'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                  data-testid="genre-filter-toggle"
                >
                  <span>
                    Genre{selectedGenre ? `: ${selectedGenre}` : ''}
                  </span>
                  <ChevronDown size={14} className={`transition-transform ${expandedFilter === 'genre' ? 'rotate-180' : ''}`} />
                </button>
                {expandedFilter === 'genre' && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg p-2 z-20 min-w-[150px]">
                    <button
                      onClick={() => {
                        setSelectedGenre(null);
                        setExpandedFilter(null);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${
                        !selectedGenre
                          ? 'bg-purple-100 text-purple-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      data-testid="genre-filter-all"
                    >
                      All Genres
                    </button>
                    {genreFilters.map((genre) => (
                      <button
                        key={genre.id}
                        onClick={() => {
                          setSelectedGenre(genre.id);
                          setExpandedFilter(null);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${
                          selectedGenre === genre.id
                            ? 'bg-purple-100 text-purple-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                        data-testid={`genre-filter-${genre.id}`}
                      >
                        {genre.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Polls by Category */}
        {Object.keys(pollsByCategory).length > 0 ? (
          <div className="space-y-8">
            {Object.entries(pollsByCategory).map(([category, games]) => (
              <div key={category} className="mb-6">
                {/* Category Header */}
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-xl font-bold text-gray-900">{categoryInfo[category]?.label || category}</h2>
                  <span className="text-sm text-gray-500">({games.length})</span>
                </div>
                
                {/* Horizontal Scrolling Cards */}
                <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {games.map((game: any) => (
                    <div key={game.id} className="flex-shrink-0 w-72">
                      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden h-full">
                        <CardHeader className="pb-3 pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {game.isConsumed ? (
                                <Badge className="bg-purple-600 text-white hover:bg-purple-700 text-[10px] py-0 px-1.5 font-bold uppercase tracking-wider">
                                  Consumed
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-bold uppercase tracking-wider border-gray-300 text-gray-500">
                                  User
                                </Badge>
                              )}
                              <span className="text-sm font-medium text-purple-600">{game.points || 10} pts</span>
                            </div>
                            <button
                              onClick={() => handleInviteFriends(game)}
                              className="p-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 transition-colors"
                              data-testid={`invite-${game.id}`}
                            >
                              <UserPlus size={14} className="text-purple-600" />
                            </button>
                          </div>

                          <CardTitle className="text-lg font-bold text-gray-900 line-clamp-2 leading-tight">{game.title}</CardTitle>
                        </CardHeader>

                        <CardContent className="pt-0 pb-4 space-y-2">
                          {allPredictions[game.id] ? (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                              <div className="text-green-800 font-bold text-sm">✓ Voted</div>
                              <div className="text-green-700 text-xs line-clamp-1">"{allPredictions[game.id]}"</div>
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-col gap-1.5">
                                {(game.options || []).slice(0, 3).map((option: any, index: number) => {
                                  const optionText = typeof option === 'string' ? option : (option.label || option.text || String(option));
                                  return (
                                    <button
                                      key={index}
                                      onClick={() => handleOptionSelect(game.id, optionText)}
                                      className={`w-full px-3 py-2 text-center rounded-full border-2 transition-all text-xs font-medium ${
                                        selectedAnswers[game.id] === optionText
                                          ? 'border-purple-500 bg-purple-600 text-white'
                                          : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300'
                                      }`}
                                      data-testid={`option-${game.id}-${index}`}
                                    >
                                      <span className="line-clamp-1">{optionText}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              <Button
                                onClick={() => handleSubmitAnswer(game)}
                                disabled={!selectedAnswers[game.id] || submitPrediction.isPending}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 rounded-full py-2 text-sm"
                                data-testid={`submit-${game.id}`}
                              >
                                {submitPrediction.isPending ? '...' : 'Vote'}
                              </Button>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : pollGames.length > 0 && (
          <div className="mb-8">
            <div className="space-y-4">
              {pollGames.map((game: any) => (
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
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs font-medium uppercase">
                          Poll
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
                    {allPredictions[game.id] ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                        <div className="text-green-800 font-medium">✓ Submitted</div>
                        <div className="text-green-700 text-sm">
                          You voted for "{allPredictions[game.id]}"
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col gap-2">
                          {(game.options || []).map((option: any, index: number) => {
                            const optionText = typeof option === 'string' ? option : (option.label || option.text || String(option));
                            return (
                              <button
                                key={index}
                                onClick={() => handleOptionSelect(game.id, optionText)}
                                className={`w-full px-4 py-3 text-center rounded-full border-2 transition-all text-sm font-medium ${
                                  selectedAnswers[game.id] === optionText
                                    ? 'border-purple-500 bg-purple-600 text-white'
                                    : 'border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                                data-testid={`option-${game.id}-${index}`}
                              >
                                {optionText}
                              </button>
                            );
                          })}
                        </div>
                        <Button
                          onClick={() => handleSubmitAnswer(game)}
                          disabled={!selectedAnswers[game.id] || submitPrediction.isPending}
                          className="w-full bg-gray-500 hover:bg-gray-600 text-white disabled:opacity-50 rounded-full py-4"
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

        {pollGames.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Vote className="mx-auto mb-4 text-gray-400" size={48} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery || selectedCategory ? 'No matching polls found' : 'No polls available'}
            </h3>
            <p className="text-gray-600">
              {searchQuery || selectedCategory 
                ? 'Try a different search term or filter' 
                : 'Check back soon for new polls!'}
            </p>
            {(searchQuery || selectedCategory) && (
              <Button
                variant="outline"
                onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}
                className="mt-4"
                data-testid="clear-filters"
              >
                Clear Filters
              </Button>
            )}
          </div>
        )}
      </div>

      {shareModalGame && (
        <GameShareModal
          isOpen={!!shareModalGame}
          onClose={() => setShareModalGame(null)}
          gameId={shareModalGame.id}
          gameTitle={shareModalGame.title}
          gameType={shareModalGame.type || "vote"}
        />
      )}

      <ConsumptionTracker
        isOpen={isTrackModalOpen}
        onClose={() => setIsTrackModalOpen(false)}
      />


    </div>
  );
}