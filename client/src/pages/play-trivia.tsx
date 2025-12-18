import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Brain, Star, Users, UserPlus, ChevronLeft, Search } from 'lucide-react';
import Navigation from '@/components/navigation';
import ConsumptionTracker from '@/components/consumption-tracker';
import { TriviaGameModal } from '@/components/trivia-game-modal';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { copyLink } from "@/lib/share";
import GameShareModal from "@/components/game-share-modal";
import CelebrationModal from '@/components/celebration-modal';

export default function PlayTriviaPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [selectedTriviaGame, setSelectedTriviaGame] = useState<any>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [shareModalGame, setShareModalGame] = useState<any>(null);
  const [submissionResults, setSubmissionResults] = useState<Record<string, { correct: boolean; points: number }>>({});
  const [showCelebration, setShowCelebration] = useState<{ points: number } | null>(null);
  const [celebrationTimer, setCelebrationTimer] = useState<NodeJS.Timeout | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categoryFilters = [
    { id: 'all', label: 'All', icon: '🎯' },
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

  // Fetch trivia games directly from Supabase - only trivia type
  const { data: games = [], isLoading } = useQuery({
    queryKey: ['/api/predictions/trivia'],
    queryFn: async () => {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = 'https://mahpgcogwpawvviapqza.supabase.co';
      const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1haHBnY29nd3Bhd3Z2aWFwcXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYxNTczOTMsImV4cCI6MjA2MTczMzM5M30.cv34J_2INF3_GExWw9zN1Vaa-AOFWI2Py02h0vAlW4c';
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: pools, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('status', 'open')
        .eq('type', 'trivia')
        .order('created_at', { ascending: false });
      if (error) throw new Error('Failed to fetch games');
      return pools || [];
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
    
    return filtered;
  }, [processedGames, searchQuery, selectedCategory]);
  
  const lowStakesGames = triviaGames.filter((game: any) => !game.isHighStakes);
  const highStakesGames = triviaGames.filter((game: any) => game.isHighStakes);

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
            <Brain className="text-purple-600" size={32} />
            <h1 className="text-3xl font-semibold text-black" data-testid="trivia-title">Trivia</h1>
          </div>
          <p className="text-gray-600 text-center mb-6">
            Test your knowledge against friends on different entertainment topics
          </p>

          {/* Search Input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              type="text"
              placeholder="Search trivia (e.g., Harry Potter, Friends, Taylor Swift...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white border-gray-200 rounded-xl"
              data-testid="trivia-search-input"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-2 justify-center">
            {categoryFilters.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id === 'all' ? null : cat.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  (cat.id === 'all' && !selectedCategory) || selectedCategory === cat.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                data-testid={`filter-${cat.id}`}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Trivia Games Section */}
        {lowStakesGames.length > 0 && (
          <div className="mb-8">
            <div className="space-y-4">
              {lowStakesGames.map((game: any) => (
                <Card key={game.id} className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
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
              {searchQuery || selectedCategory ? 'No matching trivia found' : 'No trivia games available'}
            </h3>
            <p className="text-gray-600">
              {searchQuery || selectedCategory 
                ? 'Try a different search term or category filter' 
                : 'Check back soon for new trivia!'}
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