import React, { useState } from 'react';
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
  icon: IconComponent,
  games,
  allPredictions,
  voteCounts,
  selectedAnswers,
  onOptionSelect,
  onSubmit,
  onOpenModal,
  isSubmitting,
  creatorNames = {},
  mediaPosterMap = {},
  socialPostMediaMap = {},
}: {
  label: string;
  icon?: React.ElementType;
  games: any[];
  allPredictions: Record<string, string>;
  voteCounts: Record<string, Record<string, number>>;
  selectedAnswers: Record<string, string>;
  onOptionSelect: (gameId: string, option: string) => void;
  onSubmit: (game: any) => void;
  onOpenModal: (game: any) => void;
  isSubmitting: boolean;
  creatorNames?: Record<string, string>;
  mediaPosterMap?: Record<string, { title: string; image_url: string; detected_type?: string }>;
  socialPostMediaMap?: Record<string, { image?: string; title?: string; externalId?: string; externalSource?: string }>;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (games.length === 0) return null;

  const game = games[Math.min(currentIndex, games.length - 1)];
  const voted = allPredictions[game.id];
  const selected = selectedAnswers[game.id];
  const socialMedia = socialPostMediaMap[game.id];
  const mediaInfo = game.media_external_id ? mediaPosterMap[game.media_external_id] : null;
  const displayTitle = game.media_title || socialMedia?.title || mediaInfo?.title;
  const posterUrl = game.media_image_url || socialMedia?.image || mediaInfo?.image_url;
  const hasPoster = !!(posterUrl);
  const Icon = IconComponent || Target;

  return (
    <div className="mb-4">
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
        {/* Section header — inside the card */}
        <div className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-purple-900 flex items-center justify-center flex-shrink-0">
              <Icon className="w-3 h-3 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{label}</p>
              <p className="text-[10px] text-gray-400 leading-none mt-0.5">Tap to predict</p>
            </div>
          </div>
          {games.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
                className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center disabled:opacity-30 hover:bg-gray-200 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
              </button>
              <span className="text-xs text-gray-500 min-w-[32px] text-center">{currentIndex + 1}/{games.length}</span>
              <button
                onClick={() => setCurrentIndex(i => Math.min(games.length - 1, i + 1))}
                disabled={currentIndex === games.length - 1}
                className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center disabled:opacity-30 hover:bg-gray-200 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
              </button>
            </div>
          )}
        </div>

        {/* Card body for current prediction */}
        <CardContent className="p-4 flex flex-col gap-3" id={`prediction-${game.id}`}>
          {/* Creator + title — one fluid line */}
          {(creatorNames[game.origin_user_id] || game.origin_type === 'consumed' || displayTitle) && (
            <p className="text-xs text-gray-500 leading-snug">
              {game.origin_type === 'consumed'
                ? <span className="text-amber-600 font-medium">Consumed</span>
                : creatorNames[game.origin_user_id]
                  ? <>{creatorNames[game.origin_user_id]} posted a prediction</>
                  : 'Community prediction'}
              {displayTitle ? <> about {displayTitle}</> : null}
            </p>
          )}

          {/* Question */}
          <h3 className="font-bold text-gray-900 text-base leading-snug">{game.title}</h3>

          {/* Poster + options */}
          <div className="flex gap-3 items-start">
            {hasPoster && (
              <img
                src={posterUrl!}
                alt={displayTitle || ''}
                className="w-[88px] rounded-xl object-cover flex-shrink-0 shadow-sm"
                style={{ aspectRatio: '2/3' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div className="flex-1 flex flex-col gap-2">
              {voted ? (
                (game.options || []).map((option: string, i: number) => {
                  const rawCounts = voteCounts[game.id] || {};
                  const counts = Object.keys(rawCounts).length === 0 ? { [voted]: 1 } : rawCounts;
                  const total = Object.values(counts).reduce((s: number, n: any) => s + n, 0);
                  const pct = total > 0 ? Math.round(((counts[option] || 0) / total) * 100) : 0;
                  const isChosen = voted === option;
                  return (
                    <div key={i} className={`w-full rounded-full px-3 py-2.5 flex items-center justify-between ${isChosen ? 'bg-purple-600' : 'bg-gray-100 opacity-70'}`}>
                      <span className={`text-sm font-medium flex items-center gap-1.5 ${isChosen ? 'text-white' : 'text-gray-700'}`}>
                        {isChosen && <Check size={12} />}{option}
                      </span>
                      <span className={`text-sm font-semibold ${isChosen ? 'text-white' : 'text-gray-500'}`}>{pct}%</span>
                    </div>
                  );
                })
              ) : game.isMultiCategory ? (
                <Button onClick={() => onOpenModal(game)} className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm">
                  Make Prediction
                </Button>
              ) : (
                (game.options || []).slice(0, 4).map((option: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => onOptionSelect(game.id, option)}
                    className={`w-full py-2.5 px-4 rounded-full text-sm font-medium transition-all text-left flex items-center gap-2 ${
                      selected === option ? 'bg-gray-200 border border-gray-300 text-gray-900' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {selected === option && <div className="w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0"><Check size={10} className="text-white" /></div>}
                    {option}
                  </button>
                ))
              )}
            </div>
          </div>

          {!voted && !game.isMultiCategory && (
            <Button
              onClick={() => onSubmit(game)}
              disabled={!selected || isSubmitting}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-500 disabled:opacity-40 rounded-full font-medium text-sm"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </Button>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="text-purple-600 font-medium flex items-center gap-1"><Star size={11} />{game.points || 10} pts</span>
            <span className="flex items-center gap-1"><Users size={11} />{(() => { const c = voteCounts[game.id] || {}; const t = Object.values(c).reduce((s: number, n: any) => s + n, 0); return t || game.participants || 0; })()} players</span>
          </div>
        </CardContent>
      </Card>
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
  const [activeTab, setActiveTab] = useState<'awards' | 'predictions'>('predictions'); // kept for URL compat


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

  // Fetch media info (poster + title) for predictions that need TMDB lookup
  // Only look up IDs where media_image_url is not already stored
  const gamesNeedingLookup = games.filter((g: any) => g.media_external_id && !g.media_image_url);
  const mediaExternalIds = [...new Set(gamesNeedingLookup.map((g: any) => g.media_external_id))];

  // Build expected titles map so the backend can validate the right movie/TV type
  const expectedTitlesMap: Record<string, string> = {};
  for (const g of gamesNeedingLookup) {
    if (g.media_external_id && g.media_title) {
      expectedTitlesMap[g.media_external_id] = g.media_title;
    }
  }

  const { data: mediaPosterMap = {} } = useQuery({
    queryKey: ['/api/media/posters/tmdb', mediaExternalIds, expectedTitlesMap],
    queryFn: async () => {
      if (mediaExternalIds.length === 0) return {};
      // Send all IDs in one request; backend now fetches both movie+TV and uses title to pick
      const params = new URLSearchParams({
        ids: mediaExternalIds.join(','),
        expectedTitles: JSON.stringify(expectedTitlesMap),
      });
      const res = await fetch(`/api/tmdb/media-details?${params}`).then(r => r.ok ? r.json() : {}).catch(() => ({}));
      return res as Record<string, { title: string; image_url: string; detected_type: string }>;
    },
    enabled: mediaExternalIds.length > 0,
  });

  // Fetch social_posts as reliable fallback — image + title saved at prediction-creation time
  const poolIds = games.filter((g: any) => !g.media_image_url || !g.media_title).map((g: any) => g.id);
  const { data: socialPostMediaMap = {} } = useQuery({
    queryKey: ['/api/social-posts/pool-media', poolIds],
    queryFn: async () => {
      if (poolIds.length === 0) return {};
      const { data } = await supabase
        .from('social_posts')
        .select('prediction_pool_id, image_url, media_title, media_external_id, media_external_source')
        .in('prediction_pool_id', poolIds);
      const map: Record<string, { image?: string; title?: string; externalId?: string; externalSource?: string }> = {};
      for (const row of data || []) {
        if (row.prediction_pool_id && !map[row.prediction_pool_id]) {
          map[row.prediction_pool_id] = {
            image: row.image_url || undefined,
            title: row.media_title || undefined,
            externalId: row.media_external_id || undefined,
            externalSource: row.media_external_source || undefined,
          };
        }
      }
      return map;
    },
    enabled: poolIds.length > 0,
  });

  // Fetch creator names for community predictions
  const communityUserIds = [...new Set(
    games
      .filter((g: any) => g.origin_type !== 'consumed' && g.origin_user_id)
      .map((g: any) => g.origin_user_id)
  )];

  const { data: creatorNames = {} } = useQuery({
    queryKey: ['/api/users/creator-names', communityUserIds],
    queryFn: async () => {
      if (communityUserIds.length === 0) return {};
      const { data, error } = await supabase
        .from('users')
        .select('id, display_name, user_name')
        .in('id', communityUserIds);
      if (error || !data) return {};
      const map: Record<string, string> = {};
      data.forEach((u: any) => {
        map[u.id] = u.display_name || u.user_name || 'someone';
      });
      return map;
    },
    enabled: communityUserIds.length > 0,
  });

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
  
  // Auto-open or scroll-to prediction from URL hash
  React.useEffect(() => {
    if (!gameIdFromUrl || predictionGames.length === 0) return;
    const gameToOpen = predictionGames.find((g: any) => g.id === gameIdFromUrl);
    if (!gameToOpen) return;

    if (gameToOpen.isMultiCategory && !selectedPredictionGame) {
      setSelectedPredictionGame(gameToOpen);
    } else {
      // For simple predictions, scroll to the card and briefly highlight it
      const el = document.getElementById(`prediction-${gameIdFromUrl}`);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.transition = 'box-shadow 0.3s ease';
          el.style.boxShadow = '0 0 0 3px #7c3aed';
          setTimeout(() => { el.style.boxShadow = ''; }, 1800);
        }, 400);
      }
    }
  }, [gameIdFromUrl, predictionGames]);

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

      {/* Hero Section — same gradient as nav bar for seamless look */}
      <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] -mt-px">
        <div className="max-w-4xl mx-auto px-4 pt-10 pb-8 relative">
          {/* Back button — left-anchored */}
          <button
            onClick={() => window.history.back()}
            className="absolute left-4 top-6 flex items-center text-gray-400 hover:text-white transition-colors"
            data-testid="back-button"
          >
            <ChevronLeft size={20} />
          </button>

          {/* Centered title */}
          <div className="flex flex-col items-center gap-4 pt-1">
            <h1 className="text-2xl font-semibold text-white tracking-tight" data-testid="predictions-title">
              Predictions
            </h1>

            {/* Create Prediction — centered below title */}
            <Button
              onClick={() => setShowComposer(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-blue-500 to-green-400 hover:from-blue-600 hover:to-green-500 text-white rounded-full px-5 py-2 text-sm font-semibold shadow-lg border-0"
              data-testid="create-prediction-btn"
            >
              <Plus size={14} />
              Create Prediction
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4">

        {/* Community Predictions */}
        {(() => {
          const communityGames = predictionGames.filter((g: any) => g.origin_type !== 'consumed');
          if (communityGames.length > 0) return (
            <PredictionCarouselSection
              label="Community Predictions"
              icon={Users}
              games={communityGames}
              allPredictions={allPredictions}
              voteCounts={voteCountsData as Record<string, Record<string, number>>}
              selectedAnswers={selectedAnswers}
              onOptionSelect={handleOptionSelect}
              onSubmit={handleSubmitAnswer}
              onOpenModal={(game) => setSelectedPredictionGame(game)}
              isSubmitting={submitPrediction.isPending}
              creatorNames={creatorNames as Record<string, string>}
              mediaPosterMap={mediaPosterMap as Record<string, { title: string; image_url: string }>}
              socialPostMediaMap={socialPostMediaMap}
            />
          );
          return null;
        })()}

        {/* Consumed Predictions */}
        {(() => {
          const consumedGames = predictionGames.filter((g: any) => g.origin_type === 'consumed');
          if (consumedGames.length > 0) return (
            <PredictionCarouselSection
              label="Consumed Predictions"
              icon={Trophy}
              games={consumedGames}
              allPredictions={allPredictions}
              voteCounts={voteCountsData as Record<string, Record<string, number>>}
              selectedAnswers={selectedAnswers}
              onOptionSelect={handleOptionSelect}
              onSubmit={handleSubmitAnswer}
              onOpenModal={(game) => setSelectedPredictionGame(game)}
              isSubmitting={submitPrediction.isPending}
              creatorNames={creatorNames as Record<string, string>}
              mediaPosterMap={mediaPosterMap as Record<string, { title: string; image_url: string }>}
              socialPostMediaMap={socialPostMediaMap}
            />
          );
          return null;
        })()}

        {predictionGames.length === 0 && (
          <div className="text-center py-10 bg-white rounded-xl border border-gray-200 mb-4">
            <Target className="mx-auto mb-3 text-gray-300" size={36} />
            <p className="text-sm font-medium text-gray-700 mb-1">No predictions yet</p>
            <p className="text-xs text-gray-400 mb-4">Be the first — create one for others to weigh in on.</p>
            <Button onClick={() => setShowComposer(true)} className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm">
              <Plus size={14} className="mr-1.5" />Create Prediction
            </Button>
          </div>
        )}

        {/* Awards — stacked rows */}
        {(() => {
          const visibleAwards = awardsEvents.filter((e: any) => !['gg-2026', 'sag-awards-2026'].includes(e.id));
          if (visibleAwards.length === 0) return null;
          return (
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                <Trophy size={14} className="text-amber-500" />Awards
              </p>
              <div className="space-y-2">
                {visibleAwards.map((event: any) => {
                  const isOpen = event.status === 'open';
                  const isCompleted = event.status === 'completed';
                  return (
                    <button key={event.id} onClick={() => setLocation(`/play/awards/${event.id}`)} className="w-full text-left">
                      <Card className={`border shadow-sm rounded-2xl overflow-hidden transition-all hover:shadow-md ${
                        isOpen ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200'
                          : isCompleted ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
                      }`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isOpen ? 'bg-amber-100' : 'bg-gray-100'}`}>
                                <Trophy size={20} className={isOpen ? 'text-amber-600' : 'text-gray-400'} />
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900 text-sm">{event.name} {event.year}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {isOpen && <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs px-2 py-0">Open</Badge>}
                                  {event.status === 'locked' && <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 text-xs px-2 py-0 flex items-center gap-1"><Lock size={10} />Locked</Badge>}
                                  {isCompleted && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs px-2 py-0">Results In</Badge>}
                                  {event.deadline && isOpen && <span className="text-xs text-gray-400">Closes {new Date(event.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
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