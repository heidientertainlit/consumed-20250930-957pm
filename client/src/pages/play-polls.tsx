import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Vote, Star, Users, UserPlus, ChevronLeft, Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Navigation from '@/components/navigation';
import ConsumptionTracker from '@/components/consumption-tracker';
import FeedbackFooter from '@/components/feedback-footer';
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
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categoryFilters = [
    { id: 'Movies', label: 'Movies', icon: '🎬' },
    { id: 'TV', label: 'TV', icon: '📺' },
    { id: 'Music', label: 'Music', icon: '🎵' },
    { id: 'Books', label: 'Books', icon: '📚' },
    { id: 'Sports', label: 'Sports', icon: '🏆' },
    { id: 'Podcasts', label: 'Podcasts', icon: '🎙️' },
    { id: 'Pop Culture', label: 'Pop Culture', icon: '⭐' },
  ];

  // Extract game ID from URL hash if present (format: /play/polls#game-id)
  const gameIdFromUrl = window.location.hash.replace('#', '');

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  // Fetch games directly from Supabase - only curated Consumed polls
  const { data: games = [], isLoading } = useQuery({
    queryKey: ['/api/predictions/polls'],
    queryFn: async () => {
      const { data: pools, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('status', 'open')
        .eq('type', 'vote')
        .order('created_at', { ascending: false });
      if (error) throw new Error('Failed to fetch games');
      // Filter to only show curated Consumed polls
      return (pools || []).filter((p: any) => p.id?.startsWith('consumed-poll-'));
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

  // Filter for poll/vote games with search and category
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
    
    return filtered;
  }, [processedGames, searchQuery, selectedCategory]);

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

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Back Button and Header */}
        <button
          onClick={() => setLocation('/play')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          data-testid="back-to-play"
        >
          <ChevronLeft size={20} />
          <span className="ml-1">Back to Play</span>
        </button>

        <div className="mb-6">
          <div className="flex items-center justify-center space-x-2 mb-3">
            <Vote className="text-blue-600" size={32} />
            <h1 className="text-3xl font-semibold text-black" data-testid="polls-title">Polls</h1>
          </div>
          <p className="text-gray-600 text-center mb-6">
            Vote on trending topics and see how your opinions compare to others
          </p>

          {/* Search and Filter Row */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <Input
                type="text"
                placeholder="Search polls..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-gray-200 rounded-xl"
                data-testid="polls-search-input"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                showFilters || selectedCategory
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
              data-testid="filter-toggle"
            >
              <SlidersHorizontal size={18} />
              <span className="text-sm font-medium">Filter</span>
              {selectedCategory && (
                <span className="w-2 h-2 bg-blue-600 rounded-full" />
              )}
            </button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <div className="flex items-start gap-3">
                <span className="text-sm font-medium text-gray-600 w-12 pt-2">Topic:</span>
                <div className="flex flex-wrap gap-2">
                  {categoryFilters.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        selectedCategory === cat.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      data-testid={`filter-${cat.id}`}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Polls Section */}
        {pollGames.length > 0 && (
          <div className="mb-8">
            <div className="space-y-4">
              {pollGames.map((game: any) => (
                <Card key={game.id} className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
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

      <FeedbackFooter />

    </div>
  );
}