import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Trophy, Check, X, ChevronDown, ChevronUp, Share2, 
  Users, TrendingUp, Info, ExternalLink, ArrowLeft,
  Sparkles, Lock, Clock, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import Navigation from "@/components/navigation";

interface Nominee {
  id: string;
  name: string;
  title: string;
  subtitle?: string;
  posterUrl: string;
  tmdbPopularity: number;
  tmdbId?: string;
}

interface CategoryInsight {
  mostPicked: string;
  percentage: number;
  trending: number;
  friendsPicked: number;
  totalPicks?: number;
}

interface Category {
  id: string;
  name: string;
  shortName: string;
  nominees: Nominee[];
  insight?: CategoryInsight | null;
  winner?: string;
}

interface AwardsEvent {
  id: string;
  slug: string;
  name: string;
  year: number;
  bannerUrl?: string;
  status: 'open' | 'locked' | 'completed';
  deadline?: string;
  ceremonyDate?: string;
  pointsPerCorrect?: number;
  categories: Category[];
  userPicks: Record<string, string>;
}

interface BallotPick {
  categoryId: string;
  nomineeId: string;
  nomineeName: string;
  categoryName: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function AwardsPredictions() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [showBallotModal, setShowBallotModal] = useState(false);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [localPicks, setLocalPicks] = useState<Map<string, string>>(new Map());
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch event data from Supabase edge function
  const { data: event, isLoading, error } = useQuery<AwardsEvent>({
    queryKey: ['awards-event', 'golden-globes-2026', session?.user?.id],
    queryFn: async () => {
      const params = new URLSearchParams({
        slug: 'golden-globes-2026'
      });
      if (session?.user?.id) {
        params.append('user_id', session.user.id);
      }
      
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/awards-event?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${session?.access_token || ''}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch awards event');
      }
      
      return response.json();
    },
    enabled: true, // Always fetch, even without session (for public viewing)
  });

  // Initialize local picks from server data
  useEffect(() => {
    if (event?.userPicks) {
      setLocalPicks(new Map(Object.entries(event.userPicks)));
    }
  }, [event?.userPicks]);

  // Mutation for saving picks
  const savePick = useMutation({
    mutationFn: async ({ categoryId, nomineeId }: { categoryId: string; nomineeId: string }) => {
      if (!session?.user?.id) {
        throw new Error('Must be logged in to make picks');
      }
      
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/awards-pick`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: session.user.id,
            category_id: categoryId,
            nominee_id: nomineeId
          })
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save pick');
      }
      
      return response.json();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const totalCategories = event?.categories?.length || 0;
  const picksCount = localPicks.size;

  // Set initial active category
  useEffect(() => {
    if (event?.categories?.length && !activeCategory) {
      setActiveCategory(event.categories[0].id);
    }
  }, [event?.categories, activeCategory]);

  const handlePick = (categoryId: string, nomineeId: string) => {
    if (!event || event.status !== 'open') return;
    
    if (!session?.user?.id) {
      toast({
        title: "Sign in required",
        description: "Please sign in to make predictions",
        variant: "destructive"
      });
      return;
    }
    
    // Optimistic update
    setLocalPicks(prev => {
      const newPicks = new Map(prev);
      if (newPicks.get(categoryId) === nomineeId) {
        newPicks.delete(categoryId);
      } else {
        newPicks.set(categoryId, nomineeId);
        // Save to server
        savePick.mutate({ categoryId, nomineeId });
      }
      return newPicks;
    });
  };

  const switchToCategory = (categoryId: string) => {
    setActiveCategory(categoryId);
  };

  const getBallotPicks = (): BallotPick[] => {
    if (!event) return [];
    
    const picks: BallotPick[] = [];
    localPicks.forEach((nomineeId, categoryId) => {
      const category = event.categories.find(c => c.id === categoryId);
      const nominee = category?.nominees.find(n => n.id === nomineeId);
      if (category && nominee) {
        picks.push({
          categoryId,
          nomineeId,
          nomineeName: nominee.name,
          categoryName: category.shortName
        });
      }
    });
    return picks;
  };

  const handleShare = async () => {
    if (!event) return;
    
    const shareUrl = `${window.location.origin}/awards/${event.slug}/ballot?user=${session?.user?.id}`;
    const shareText = `Check out my ${event.year} ${event.name} predictions! 🏆`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: `${event.name} ${event.year}`, text: shareText, url: shareUrl });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copied!", description: "Share your ballot with friends" });
    }
  };

  const handleSubmitBallot = () => {
    toast({ title: "Ballot saved!", description: `${picksCount} predictions locked in` });
    setShowBallotModal(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-4" />
          <p className="text-gray-400">Loading predictions...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !event) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center px-4">
          <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Awards Not Found</h1>
          <p className="text-gray-400 mb-6">The awards event could not be loaded.</p>
          <Button onClick={() => navigate('/play')} variant="outline">
            Back to Play
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white pb-24">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/30 via-transparent to-purple-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />
        
        <div className="relative px-4 pt-12 pb-8">
          <button 
            onClick={() => navigate('/play')}
            className="flex items-center text-gray-400 hover:text-white mb-4 transition-colors"
            data-testid="button-back-play"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back to Play
          </button>
          
          <div className="flex items-center space-x-3 mb-3">
            <Trophy className="w-10 h-10 text-amber-400" />
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-300 bg-clip-text text-transparent">
                {event.year} {event.name} Predictions
              </h1>
              <p className="text-gray-400 text-sm">
                Make your picks. See how your predictions stack up.
              </p>
            </div>
          </div>
          
          {event.deadline && event.status === 'open' && (
            <div className="flex items-center text-amber-400/80 text-sm mt-4">
              <Clock size={14} className="mr-2" />
              Predictions close: {new Date(event.deadline).toLocaleDateString('en-US', { 
                month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
              })}
            </div>
          )}

          {event.status === 'locked' && (
            <div className="flex items-center text-amber-500 text-sm mt-4 bg-amber-500/10 px-3 py-2 rounded-lg">
              <Lock size={14} className="mr-2" />
              Predictions are locked. Results coming soon!
            </div>
          )}
          
          <Button 
            onClick={() => switchToCategory(event.categories[0]?.id)}
            className="mt-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold px-8"
            data-testid="button-start-ballot"
          >
            <Sparkles className="mr-2" size={18} />
            Start My Ballot
          </Button>
        </div>
      </div>

      {/* Sticky Category Tabs */}
      <div 
        ref={tabsRef}
        className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur-md border-b border-gray-800"
      >
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex px-4 py-3 space-x-2 min-w-max">
            {event.categories.map(category => {
              const hasPick = localPicks.has(category.id);
              const isActive = activeCategory === category.id;
              
              return (
                <button
                  key={category.id}
                  onClick={() => switchToCategory(category.id)}
                  className={`relative flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                    isActive 
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black' 
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                  data-testid={`tab-category-${category.id}`}
                >
                  {category.shortName}
                  {hasPick && (
                    <span className="ml-2 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                      <Check size={10} className="text-white" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Category Panel - Only shows one category at a time */}
      <div className="px-4 py-6">
        {event.categories.filter(c => c.id === activeCategory).map(category => {
          const userPickId = localPicks.get(category.id);
          const isInsightExpanded = expandedInsight === category.id;
          
          return (
            <motion.div 
              key={category.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Category Title */}
              <h2 className="text-xl font-bold text-white mb-4">{category.name}</h2>
              
              {/* Insight Panel */}
              {category.insight && (
                <div className="mb-4">
                  <button
                    onClick={() => setExpandedInsight(isInsightExpanded ? null : category.id)}
                    className="flex items-center justify-between w-full bg-gray-800/50 rounded-lg px-4 py-3 text-left"
                    data-testid={`button-insight-${category.id}`}
                  >
                    <div className="flex items-center text-amber-400">
                      <Sparkles size={16} className="mr-2" />
                      <span className="text-sm font-medium">Category Insight</span>
                    </div>
                    {isInsightExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  
                  <AnimatePresence>
                    {isInsightExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-gray-800/30 rounded-b-lg px-4 py-3 space-y-2 text-sm">
                          <div className="flex items-center text-gray-300">
                            <Trophy size={14} className="mr-2 text-amber-400" />
                            <span>Most picked: <span className="text-white font-medium">{category.insight.mostPicked}</span></span>
                          </div>
                          <div className="flex items-center text-gray-300">
                            <Users size={14} className="mr-2 text-blue-400" />
                            <span><span className="text-white font-medium">{category.insight.percentage}%</span> of users chose this nominee</span>
                          </div>
                          <div className="flex items-center text-gray-300">
                            <TrendingUp size={14} className="mr-2 text-green-400" />
                            <span>Trending <span className="text-green-400">↑ {category.insight.trending}%</span> in the last 48 hours</span>
                          </div>
                          <div className="flex items-center text-gray-300">
                            <Users size={14} className="mr-2 text-purple-400" />
                            <span><span className="text-white font-medium">{category.insight.friendsPicked}</span> of your friends picked this</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Nominee Cards */}
              <div className="space-y-3">
                {category.nominees.map(nominee => {
                  const isPicked = userPickId === nominee.id;
                  const isWinner = event.status === 'completed' && category.winner === nominee.id;
                  const userWasCorrect = event.status === 'completed' && userPickId === category.winner;
                  
                  return (
                    <motion.div
                      key={nominee.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handlePick(category.id, nominee.id)}
                      className={`relative flex items-start p-4 rounded-xl cursor-pointer transition-all ${
                        isPicked 
                          ? 'bg-gradient-to-r from-amber-900/40 to-amber-800/30 border-2 border-amber-500 shadow-lg shadow-amber-500/20' 
                          : 'bg-gray-800/50 border border-gray-700 hover:border-gray-600'
                      } ${event.status !== 'open' ? 'cursor-default' : ''}`}
                      data-testid={`card-nominee-${nominee.id}`}
                    >
                      {/* Winner Badge */}
                      {isWinner && (
                        <div className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-400 to-amber-500 text-black px-3 py-1 rounded-full text-xs font-bold flex items-center">
                          <Trophy size={12} className="mr-1" />
                          WINNER
                        </div>
                      )}
                      
                      {/* Poster */}
                      <div className="w-16 h-24 rounded-lg overflow-hidden shadow-lg flex-shrink-0 mr-4">
                        {nominee.posterUrl ? (
                          <img 
                            src={nominee.posterUrl} 
                            alt={nominee.title || nominee.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                            <Trophy size={24} className="text-gray-500" />
                          </div>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white text-lg">{nominee.name}</h3>
                        {nominee.title && (
                          <p className="text-gray-400 text-sm truncate">{nominee.title}</p>
                        )}
                        {nominee.subtitle && (
                          <p className="text-gray-500 text-xs">{nominee.subtitle}</p>
                        )}
                        
                        {/* Buzz Score */}
                        <div className="flex items-center mt-2 text-sm">
                          <span className="text-amber-400 font-medium">
                            Buzz Score: {Math.round(nominee.tmdbPopularity)}
                          </span>
                          <button 
                            onClick={(e) => e.stopPropagation()}
                            className="ml-1 text-gray-500 hover:text-gray-300"
                            title="Based on TMDB's global popularity metric"
                          >
                            <Info size={14} />
                          </button>
                          <span className="text-gray-500 text-xs ml-1">(TMDB)</span>
                        </div>
                        
                        {/* Result indicator */}
                        {event.status === 'completed' && isPicked && (
                          <div className={`mt-2 flex items-center text-sm ${userWasCorrect ? 'text-green-400' : 'text-red-400'}`}>
                            {userWasCorrect ? (
                              <>
                                <Check size={16} className="mr-1" />
                                You got this right! (+{event.pointsPerCorrect || 20} pts)
                              </>
                            ) : (
                              <>
                                <X size={16} className="mr-1" />
                                You missed this one.
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Pick Button */}
                      <div className="flex-shrink-0 ml-4">
                        {event.status === 'open' && (
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            isPicked 
                              ? 'border-amber-500 bg-amber-500' 
                              : 'border-gray-500'
                          }`}>
                            {isPicked && <Check size={14} className="text-black" />}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Sticky Ballot Button */}
      <div className="fixed bottom-20 left-0 right-0 px-4 z-50">
        <button
          onClick={() => setShowBallotModal(true)}
          className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white py-4 rounded-xl font-semibold shadow-lg shadow-purple-500/30 flex items-center justify-center"
          data-testid="button-view-ballot"
        >
          <Trophy size={20} className="mr-2" />
          View My Ballot ({picksCount} / {totalCategories} Picks Made)
        </button>
      </div>

      {/* My Ballot Modal */}
      <AnimatePresence>
        {showBallotModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center"
            onClick={() => setShowBallotModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg bg-gradient-to-b from-gray-900 to-gray-950 rounded-t-3xl max-h-[80vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-gray-900 px-6 py-4 border-b border-gray-800 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center">
                  <Trophy size={24} className="mr-2 text-amber-400" />
                  My {event.year} {event.name} Ballot
                </h2>
                <button onClick={() => setShowBallotModal(false)} className="text-gray-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>
              
              {/* Ballot Picks List */}
              <div className="px-6 py-4 overflow-y-auto max-h-[50vh]">
                {getBallotPicks().length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No picks yet. Start making your predictions!</p>
                ) : (
                  <div className="space-y-3">
                    {getBallotPicks().map(pick => (
                      <div 
                        key={pick.categoryId}
                        className="flex items-center justify-between bg-gray-800/50 rounded-lg px-4 py-3"
                      >
                        <div>
                          <p className="text-gray-400 text-xs">{pick.categoryName}</p>
                          <p className="text-white font-medium">{pick.nomineeName}</p>
                        </div>
                        <button 
                          onClick={() => {
                            setShowBallotModal(false);
                            switchToCategory(pick.categoryId);
                          }}
                          className="text-amber-400 text-sm hover:underline"
                        >
                          Edit
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-gray-900 px-6 py-4 border-t border-gray-800 space-y-3">
                <div className="flex items-center justify-between text-sm text-gray-400">
                  <span>{picksCount} of {totalCategories} categories picked</span>
                  <span className="text-amber-400">
                    Potential: +{picksCount * (event.pointsPerCorrect || 20)} pts
                  </span>
                </div>
                
                <div className="flex space-x-3">
                  <Button
                    onClick={handleShare}
                    variant="outline"
                    className="flex-1 border-gray-600"
                    disabled={picksCount === 0}
                    data-testid="button-share-ballot"
                  >
                    <Share2 size={18} className="mr-2" />
                    Share
                  </Button>
                  <Button
                    onClick={handleSubmitBallot}
                    className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold"
                    disabled={picksCount === 0}
                    data-testid="button-submit-ballot"
                  >
                    <Check size={18} className="mr-2" />
                    Save Ballot
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Navigation />
    </div>
  );
}
