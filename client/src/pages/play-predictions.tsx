import React, { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { Trophy, Star, Users, Target, ChevronLeft, Lock, ChevronRight, Plus, Check } from 'lucide-react';
import Navigation from '@/components/navigation';
import ConsumptionTracker from '@/components/consumption-tracker';
import { PredictionGameModal } from '@/components/prediction-game-modal';
import { QuickAddModal } from '@/components/quick-add-modal';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

function PredictionCarouselSection({
  label,
  games,
  allPredictions,
  voteCounts,
  selectedAnswers,
  onOptionSelect,
  onSubmit,
  onOpenModal,
  isSubmitting,
}: {
  label: string;
  games: any[];
  allPredictions: Record<string, string>;
  voteCounts: Record<string, Record<string, number>>;
  selectedAnswers: Record<string, string>;
  onOptionSelect: (gameId: string, option: string) => void;
  onSubmit: (game: any) => void;
  onOpenModal: (game: any) => void;
  isSubmitting: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const scrollToNext = () => {
    if (scrollRef.current && currentIndex < games.length - 1) {
      const cardWidth = scrollRef.current.children[0]?.clientWidth || 280;
      scrollRef.current.scrollBy({ left: cardWidth + 12, behavior: 'smooth' });
    }
  };
  const scrollToPrev = () => {
    if (scrollRef.current && currentIndex > 0) {
      const cardWidth = scrollRef.current.children[0]?.clientWidth || 280;
      scrollRef.current.scrollBy({ left: -(cardWidth + 12), behavior: 'smooth' });
    }
  };
  const handleScroll = () => {
    if (scrollRef.current && games.length > 0) {
      const cardWidth = scrollRef.current.children[0]?.clientWidth || 280;
      const newIndex = Math.round(scrollRef.current.scrollLeft / (cardWidth + 12));
      setCurrentIndex(newIndex);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-purple-900 flex items-center justify-center flex-shrink-0">
            <Target className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{label} Predictions</p>
            <p className="text-[10px] text-gray-500">Tap to predict</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {currentIndex > 0 && (
            <button onClick={scrollToPrev} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
          )}
          {currentIndex < games.length - 1 && (
            <button onClick={scrollToNext} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          )}
          <span className="text-xs text-gray-500 ml-1">{currentIndex + 1}/{games.length}</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
      >
        {games.map((game) => {
          const voted = allPredictions[game.id];
          const selected = selectedAnswers[game.id];
          return (
            <div key={game.id} className="flex-shrink-0 w-full snap-center">
              <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-xs font-medium uppercase tracking-wide">
                      Predict
                    </Badge>
                    {game.origin_type === 'consumed' ? (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs flex items-center gap-1">
                        <Trophy size={10} />
                        Consumed
                      </Badge>
                    ) : (
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs flex items-center gap-1">
                        <Users size={10} />
                        Community
                      </Badge>
                    )}
                  </div>

                  {game.media_title && (
                    <div className="text-sm font-medium text-purple-600 mb-1">{game.media_title}</div>
                  )}
                  <h3 className="font-semibold text-gray-900 text-base leading-snug mb-3">{game.title}</h3>

                  <div className="flex items-center gap-4 text-xs mb-4">
                    <div className="flex items-center gap-1">
                      <Star size={12} className="text-purple-600" />
                      <span className="text-purple-600 font-medium">{game.points || 10} pts</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-400">
                      <Users size={12} />
                      <span>{
                        (() => {
                          const counts = voteCounts[game.id] || {};
                          const total = Object.values(counts).reduce((s: number, n: any) => s + n, 0);
                          const voted = allPredictions[game.id];
                          return total || game.participants || (voted ? 1 : 0);
                        })()
                      } players</span>
                    </div>
                  </div>

                  {voted ? (
                    <div className="flex flex-col gap-2">
                      {(game.options || []).map((option: string, i: number) => {
                        const rawCounts = voteCounts[game.id] || {};
                        // Fallback: if RLS hides other votes, at least count the current user's vote
                        const counts = Object.keys(rawCounts).length === 0
                          ? { [voted]: 1 }
                          : rawCounts;
                        const total = Object.values(counts).reduce((s: number, n: any) => s + n, 0);
                        const count = counts[option] || 0;
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        const isChosen = voted === option;
                        return (
                          <div
                            key={i}
                            className={`w-full rounded-full px-4 py-3 flex items-center justify-between transition-all duration-300 ${
                              isChosen
                                ? 'bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 ring-2 ring-blue-300'
                                : 'bg-gradient-to-r from-purple-950/60 via-purple-800/60 to-violet-500/60 opacity-70'
                            }`}
                          >
                            <span className="text-sm font-medium text-white flex items-center gap-2">
                              {isChosen && <Check size={14} className="flex-shrink-0" />}
                              {option}
                            </span>
                            <span className="text-sm font-semibold text-white">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : game.isMultiCategory ? (
                    <Button
                      onClick={() => onOpenModal(game)}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
                    >
                      Make Prediction
                    </Button>
                  ) : (
                    <>
                      <div className="flex flex-col gap-2 mb-3">
                        {(game.options || []).slice(0, 4).map((option: string, i: number) => (
                          <button
                            key={i}
                            onClick={() => onOptionSelect(game.id, option)}
                            className={`w-full py-3 px-5 rounded-full text-sm font-medium transition-all text-left ${
                              selected === option
                                ? 'bg-gradient-to-r from-purple-700 to-purple-500 text-white shadow-md ring-2 ring-purple-300'
                                : 'bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:from-purple-700 hover:to-purple-600'
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                      <Button
                        onClick={() => onSubmit(game)}
                        disabled={!selected || isSubmitting}
                        className="w-full bg-gray-200 hover:bg-gray-300 text-gray-600 disabled:opacity-40 rounded-full font-medium"
                      >
                        {isSubmitting ? 'Submitting...' : 'Submit'}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PlayPredictionsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [selectedPredictionGame, setSelectedPredictionGame] = useState<any>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [showComposer, setShowComposer] = useState(false);


  // Extract game ID from URL hash if present (format: /play/predictions#game-id)
  const gameIdFromUrl = window.location.hash.replace('#', '');

  const handleTrackConsumption = () => {
    setIsTrackModalOpen(true);
  };

  // Fetch games directly from Supabase - all predictions
  const { data: games = [], isLoading } = useQuery({
    queryKey: ['/api/predictions/pools'],
    queryFn: async () => {
      const { data: pools, error } = await supabase
        .from('prediction_pools')
        .select('*')
        .eq('status', 'open')
        .eq('type', 'predict')
        .order('created_at', { ascending: false });
      if (error) throw new Error('Failed to fetch games');
      // Return all predictions, mark which are consumed vs community
      return (pools || []).map((p: any) => ({
        ...p,
        isConsumed: p.origin_type === 'consumed' || p.id?.startsWith('consumed-'),
      }));
    },
  });

  // Fetch awards events
  const { data: awardsEvents = [] } = useQuery({
    queryKey: ['/api/awards/events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('awards_events')
        .select('id, name, year, status, ceremony_date, deadline');
      if (error) return [];
      // Open events first (latest ceremony date first), then locked (latest first)
      return (data || []).sort((a: any, b: any) => {
        if (a.status === 'open' && b.status !== 'open') return -1;
        if (a.status !== 'open' && b.status === 'open') return 1;
        return new Date(b.ceremony_date).getTime() - new Date(a.ceremony_date).getTime();
      });
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

  // Fetch vote counts for all prediction pools
  const { data: voteCountsData = {} } = useQuery({
    queryKey: ['/api/predictions/vote-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_predictions')
        .select('pool_id, prediction');
      if (error || !data) return {};
      const counts: Record<string, Record<string, number>> = {};
      data.forEach((row: any) => {
        if (!counts[row.pool_id]) counts[row.pool_id] = {};
        counts[row.pool_id][row.prediction] = (counts[row.pool_id][row.prediction] || 0) + 1;
      });
      return counts;
    },
  });

  // Submit prediction mutation - directly to Supabase
  const submitPrediction = useMutation({
    mutationFn: async ({ poolId, answer }: { poolId: string; answer: string }) => {
      console.log('🚀 Saving prediction to user_predictions table...');
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Must be logged in to submit predictions');
      }
      
      const { data: game, error: gameError } = await supabase
        .from('prediction_pools')
        .select('points_reward, type')
        .eq('id', poolId)
        .single();
        
      if (gameError || !game) {
        throw new Error('Game not found');
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
        console.error('❌ Error saving prediction:', error);
        if (error.code === '23505') {
          throw new Error('You have already submitted a prediction for this');
        }
        throw new Error('Failed to save prediction');
      }
      
      console.log('✅ Prediction saved successfully:', data);
      
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
      queryClient.invalidateQueries({ queryKey: ['/api/predictions/vote-counts'] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      
      toast({
        title: "Prediction Submitted!",
        description: data.game_type === 'predict' 
          ? `You predicted "${data.prediction}" - points will be awarded when the result is known!`
          : `You earned ${data.points_earned} points!`,
      });
    },
    onError: () => {
      toast({
        title: "Submission Failed",
        description: "Could not submit your prediction. Please try again.",
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

  // Process and filter games
  const processedGames = games.map((pool: any) => {
    const isMultiCategoryPrediction = pool.type === 'predict' &&
      Array.isArray(pool.options) &&
      pool.options.length > 0 &&
      typeof pool.options[0] === 'object';

    return {
      ...pool,
      points: pool.points_reward,
      isMultiCategory: isMultiCategoryPrediction,
    };
  });

  const predictionGames = React.useMemo(() => {
    return processedGames.filter((game: any) => game.type === 'predict');
  }, [processedGames]);
  
  // Auto-open prediction if gameId is in URL hash
  React.useEffect(() => {
    if (gameIdFromUrl && !selectedPredictionGame && predictionGames.length > 0) {
      const gameToOpen = predictionGames.find((g: any) => g.id === gameIdFromUrl);
      if (gameToOpen) {
        setSelectedPredictionGame(gameToOpen);
      }
    }
  }, [gameIdFromUrl, predictionGames, selectedPredictionGame]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Navigation onTrackConsumption={handleTrackConsumption} />
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center py-20">
            <div className="text-xl">Loading predictions...</div>
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.history.back()}
                className="flex items-center text-gray-400 hover:text-white transition-colors"
                data-testid="back-button"
              >
                <ChevronLeft size={20} />
              </button>
              <h1 className="text-2xl font-semibold text-white" data-testid="predictions-title">Predictions</h1>
            </div>
            <Button
              onClick={() => setShowComposer(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-blue-500 to-green-400 hover:from-blue-600 hover:to-green-500 text-white rounded-full px-3 py-1.5 text-xs font-semibold shadow-md border-0"
              data-testid="create-prediction-btn"
            >
              <Plus size={13} />
              Create Prediction
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4">

        {/* Awards Events Section */}
        {(() => {
          const visibleAwards = awardsEvents.filter((e: any) =>
            !['gg-2026', 'sag-awards-2026'].includes(e.id)
          );
          if (visibleAwards.length === 0) return null;
          return (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={16} className="text-amber-500" />
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Awards</h2>
              </div>
              <div className="space-y-3">
                {visibleAwards.map((event: any) => {
                  const isOpen = event.status === 'open';
                  const isCompleted = event.status === 'completed';
                  return (
                    <button
                      key={event.id}
                      onClick={() => setLocation(`/play/awards/${event.id}`)}
                      className="w-full text-left"
                    >
                      <Card className={`border shadow-sm rounded-2xl overflow-hidden transition-all hover:shadow-md ${
                        isOpen
                          ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200'
                          : isCompleted
                            ? 'bg-gray-50 border-gray-200'
                            : 'bg-white border-gray-200'
                      }`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                isOpen ? 'bg-amber-100' : 'bg-gray-100'
                              }`}>
                                <Trophy size={20} className={isOpen ? 'text-amber-600' : 'text-gray-400'} />
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900 text-sm">{event.name} {event.year}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {isOpen && (
                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs px-2 py-0">
                                      Open
                                    </Badge>
                                  )}
                                  {event.status === 'locked' && (
                                    <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 text-xs px-2 py-0 flex items-center gap-1">
                                      <Lock size={10} />
                                      Locked
                                    </Badge>
                                  )}
                                  {isCompleted && (
                                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs px-2 py-0">
                                      Results In
                                    </Badge>
                                  )}
                                  {event.deadline && isOpen && (
                                    <span className="text-xs text-gray-400">
                                      Closes {new Date(event.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Predictions grouped by media type */}
        {predictionGames.length > 0 && (() => {
          const CATEGORY_ORDER = ['movie', 'movies', 'tv', 'music', 'books', 'podcast', 'podcasts', 'sports', 'games'];
          const LABEL_MAP: Record<string, string> = {
            movie: 'Movies', movies: 'Movies', tv: 'TV', music: 'Music',
            books: 'Books', podcast: 'Podcasts', podcasts: 'Podcasts',
            sports: 'Sports', games: 'Gaming',
          };
          const grouped: Record<string, any[]> = {};
          predictionGames.forEach((g: any) => {
            const cat = (g.category || 'other').toLowerCase().trim();
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(g);
          });
          const sortedCats = Object.keys(grouped).sort((a, b) => {
            const ai = CATEGORY_ORDER.indexOf(a);
            const bi = CATEGORY_ORDER.indexOf(b);
            if (ai === -1 && bi === -1) return 0;
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
          });
          return sortedCats.map(cat => (
            <PredictionCarouselSection
              key={cat}
              label={LABEL_MAP[cat] || cat.charAt(0).toUpperCase() + cat.slice(1)}
              games={grouped[cat]}
              allPredictions={allPredictions}
              voteCounts={voteCountsData as Record<string, Record<string, number>>}
              selectedAnswers={selectedAnswers}
              onOptionSelect={handleOptionSelect}
              onSubmit={handleSubmitAnswer}
              onOpenModal={(game) => setSelectedPredictionGame(game)}
              isSubmitting={submitPrediction.isPending}
            />
          ));
        })()}

        {predictionGames.length === 0 && awardsEvents.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <Trophy className="mx-auto mb-4 text-gray-400" size={48} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No predictions available</h3>
            <p className="text-gray-600 mb-4">Be the first — create a prediction for others to weigh in on.</p>
            <Button
              onClick={() => setShowComposer(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
            >
              <Plus size={16} className="mr-2" />
              Create Prediction
            </Button>
          </div>
        )}
      </div>

      <ConsumptionTracker
        isOpen={isTrackModalOpen}
        onClose={() => setIsTrackModalOpen(false)}
      />

      {selectedPredictionGame && (
        <PredictionGameModal
          poolId={selectedPredictionGame.id}
          title={selectedPredictionGame.title}
          categories={selectedPredictionGame.options}
          pointsReward={selectedPredictionGame.points}
          isOpen={!!selectedPredictionGame}
          onClose={() => {
            setSelectedPredictionGame(null);
          }}
        />
      )}

      <QuickAddModal
        isOpen={showComposer}
        onClose={() => {
          setShowComposer(false);
          queryClient.invalidateQueries({ queryKey: ['/api/predictions/pools'] });
        }}
        initialPostType="predict"
        skipToComposer={true}
      />

    </div>
  );
}