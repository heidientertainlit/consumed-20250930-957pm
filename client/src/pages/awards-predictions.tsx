import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Trophy, Check, X, ChevronDown, ChevronUp, Share2, 
  Users, TrendingUp, Info, ArrowLeft,
  Sparkles, Lock, Clock, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import Navigation from "@/components/navigation";

interface Nominee {
  id: string;
  name: string;
  title: string | null;
  subtitle?: string | null;
  poster_url: string | null;
  tmdb_popularity: number;
  display_order: number;
}

interface Category {
  id: string;
  name: string;
  short_name: string;
  display_order: number;
  winner_nominee_id: string | null;
  nominees: Nominee[];
}

interface AwardsEvent {
  id: string;
  slug: string;
  name: string;
  year: number;
  status: 'open' | 'locked' | 'completed';
  deadline: string | null;
  ceremony_date: string | null;
  points_per_correct: number;
  categories: Category[];
}

interface UserPick {
  category_id: string;
  nominee_id: string;
}

export default function AwardsPredictions() {
  const [, navigate] = useLocation();
  const [matchPlay, paramsPlay] = useRoute('/play/awards/:slug');
  const [matchAwards, paramsAwards] = useRoute('/awards/:eventId');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [showBallotModal, setShowBallotModal] = useState(false);
  const [localPicks, setLocalPicks] = useState<Map<string, string>>(new Map());
  const tabsRef = useRef<HTMLDivElement>(null);

  const eventSlug = paramsPlay?.slug || paramsAwards?.eventId || 'golden-globes-2026';

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch event data directly from Supabase
  const { data: event, isLoading, error } = useQuery<AwardsEvent>({
    queryKey: ['awards-event', eventSlug],
    queryFn: async () => {
      // Fetch the event
      const { data: eventData, error: eventError } = await supabase
        .from('awards_events')
        .select('*')
        .eq('slug', eventSlug)
        .single();
      
      if (eventError) throw eventError;
      if (!eventData) throw new Error('Event not found');

      // Fetch categories for this event
      const { data: categoriesData, error: catError } = await supabase
        .from('awards_categories')
        .select('*')
        .eq('event_id', eventData.id)
        .order('display_order');
      
      if (catError) throw catError;

      // Fetch all nominees for these categories
      const categoryIds = categoriesData?.map(c => c.id) || [];
      const { data: nomineesData, error: nomError } = await supabase
        .from('awards_nominees')
        .select('*')
        .in('category_id', categoryIds)
        .order('display_order');
      
      if (nomError) throw nomError;

      // Group nominees by category
      const nomineesByCategory = (nomineesData || []).reduce((acc, nom) => {
        if (!acc[nom.category_id]) acc[nom.category_id] = [];
        acc[nom.category_id].push(nom);
        return acc;
      }, {} as Record<string, Nominee[]>);

      // Build the full event object
      const categories: Category[] = (categoriesData || []).map(cat => ({
        ...cat,
        nominees: nomineesByCategory[cat.id] || []
      }));

      return {
        ...eventData,
        categories
      } as AwardsEvent;
    },
  });

  // Fetch user picks
  const { data: userPicks } = useQuery<UserPick[]>({
    queryKey: ['awards-picks', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      
      const { data, error } = await supabase
        .from('awards_picks')
        .select('category_id, nominee_id')
        .eq('user_id', session.user.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!session?.user?.id,
  });

  // Fetch participants (users who have submitted ballots)
  interface Participant {
    user_id: string;
    picks_count: number;
    display_name: string | null;
    avatar_url: string | null;
    is_friend: boolean;
  }
  
  const { data: participants } = useQuery<{ friends: Participant[]; totalCount: number }>({
    queryKey: ['awards-participants', event?.id],
    queryFn: async () => {
      if (!event?.id) return { friends: [], totalCount: 0 };
      
      const categoryIds = event.categories.map(c => c.id);
      
      // Get all users who have made picks for this event's categories
      const { data: picksData, error: picksError } = await supabase
        .from('awards_picks')
        .select('user_id')
        .in('category_id', categoryIds);
      
      if (picksError) throw picksError;
      
      // Count unique users and their picks
      const userPickCounts = (picksData || []).reduce((acc, pick) => {
        acc[pick.user_id] = (acc[pick.user_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const uniqueUserIds = Object.keys(userPickCounts);
      const totalCount = uniqueUserIds.length;
      
      if (totalCount === 0) return { friends: [], totalCount: 0 };
      
      // Get user profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', uniqueUserIds.slice(0, 20)); // Limit to first 20
      
      if (profilesError) throw profilesError;
      
      // Get current user's friends
      let friendIds: string[] = [];
      if (session?.user?.id) {
        const { data: friendships } = await supabase
          .from('friendships')
          .select('friend_id, user_id')
          .or(`user_id.eq.${session.user.id},friend_id.eq.${session.user.id}`)
          .eq('status', 'accepted');
        
        friendIds = (friendships || []).map(f => 
          f.user_id === session.user.id ? f.friend_id : f.user_id
        );
      }
      
      const friends: Participant[] = (profiles || [])
        .filter(p => friendIds.includes(p.id))
        .map(p => ({
          user_id: p.id,
          picks_count: userPickCounts[p.id] || 0,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          is_friend: true
        }));
      
      return { friends, totalCount };
    },
    enabled: !!event?.id,
  });

  // Initialize local picks from fetched data
  useEffect(() => {
    if (userPicks) {
      const picksMap = new Map<string, string>();
      userPicks.forEach(pick => {
        picksMap.set(pick.category_id, pick.nominee_id);
      });
      setLocalPicks(picksMap);
    }
  }, [userPicks]);

  // Set initial active category
  useEffect(() => {
    if (event?.categories?.length && !activeCategory) {
      setActiveCategory(event.categories[0].id);
    }
  }, [event?.categories, activeCategory]);

  // Mutation for saving picks
  const savePick = useMutation({
    mutationFn: async ({ categoryId, nomineeId }: { categoryId: string; nomineeId: string }) => {
      if (!session?.user?.id) {
        throw new Error('Must be logged in to make picks');
      }
      
      const { error } = await supabase
        .from('awards_picks')
        .upsert({
          user_id: session.user.id,
          category_id: categoryId,
          nominee_id: nomineeId,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,category_id'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['awards-picks'] });
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
        // Toggle off - but we don't support deleting picks yet
        return prev;
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

  const getBallotPicks = () => {
    if (!event) return [];
    
    const picks: { categoryId: string; nomineeId: string; nomineeName: string; categoryName: string }[] = [];
    localPicks.forEach((nomineeId, categoryId) => {
      const category = event.categories.find(c => c.id === categoryId);
      const nominee = category?.nominees.find(n => n.id === nomineeId);
      if (category && nominee) {
        picks.push({
          categoryId,
          nomineeId,
          nomineeName: nominee.name,
          categoryName: category.short_name
        });
      }
    });
    return picks;
  };

  const handleShare = async () => {
    if (!event) return;
    
    const shareUrl = `${window.location.origin}/awards/${event.slug}/ballot?user=${session?.user?.id}`;
    const shareText = `Check out my ${event.year} ${event.name} predictions!`;
    
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
          <p className="text-gray-400 mb-6">The awards event could not be loaded. Make sure the database is set up.</p>
          <Button onClick={() => navigate('/play/awards')} variant="outline">
            Back to Awards
          </Button>
        </div>
        <Navigation />
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
            onClick={() => navigate('/play/awards')}
            className="flex items-center text-gray-400 hover:text-white mb-4 transition-colors"
            data-testid="button-back-awards"
          >
            <ArrowLeft size={20} className="mr-2" />
            Back to Awards
          </button>
          
          <div className="mb-4">
            <Badge className="bg-purple-600 text-white hover:bg-purple-700 text-[10px] py-0.5 px-2 font-bold uppercase tracking-wider">
              Consumed
            </Badge>
          </div>

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

          {/* Who's Playing Section */}
          <div className="mt-6 bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center">
                <Users size={16} className="mr-2 text-purple-400" />
                Who's Playing
              </h3>
              <button
                onClick={() => navigate('/leaderboard?tab=games')}
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center"
                data-testid="button-see-leaderboard"
              >
                See Leaderboard
                <TrendingUp size={14} className="ml-1" />
              </button>
            </div>
            
            {participants?.friends && participants.friends.length > 0 ? (
              <div className="flex items-center gap-2 mb-2">
                <div className="flex -space-x-2">
                  {participants.friends.slice(0, 5).map((friend, i) => (
                    <div
                      key={friend.user_id}
                      className="w-8 h-8 rounded-full border-2 border-gray-800 overflow-hidden bg-purple-600 flex items-center justify-center"
                      title={friend.display_name || 'Friend'}
                    >
                      {friend.avatar_url ? (
                        <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-white font-medium">
                          {(friend.display_name || '?')[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                  ))}
                  {participants.friends.length > 5 && (
                    <div className="w-8 h-8 rounded-full border-2 border-gray-800 bg-gray-700 flex items-center justify-center">
                      <span className="text-xs text-gray-300">+{participants.friends.length - 5}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
            
            <p className="text-xs text-gray-400">
              {participants?.friends?.length || 0} friend{(participants?.friends?.length || 0) !== 1 ? 's' : ''} playing
              {participants?.totalCount ? ` • ${participants.totalCount} total ballot${participants.totalCount !== 1 ? 's' : ''}` : ''}
            </p>
          </div>
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
                  {category.short_name}
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

      {/* Active Category Panel */}
      <div className="px-4 py-6">
        {event.categories.filter(c => c.id === activeCategory).map(category => {
          const userPickId = localPicks.get(category.id);
          
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

              {/* Nominee Cards */}
              <div className="space-y-3">
                {category.nominees.map(nominee => {
                  const isPicked = userPickId === nominee.id;
                  const isWinner = event.status === 'completed' && category.winner_nominee_id === nominee.id;
                  const userWasCorrect = event.status === 'completed' && userPickId === category.winner_nominee_id;
                  
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
                      <div className="w-16 h-24 rounded-lg overflow-hidden shadow-lg flex-shrink-0 mr-4 bg-gray-700">
                        {nominee.poster_url ? (
                          <img 
                            src={nominee.poster_url} 
                            alt={nominee.title || nominee.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
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
                        
                        {/* Result indicator */}
                        {event.status === 'completed' && isPicked && (
                          <div className={`mt-2 flex items-center text-sm ${userWasCorrect ? 'text-green-400' : 'text-red-400'}`}>
                            {userWasCorrect ? (
                              <>
                                <Check size={16} className="mr-1" />
                                You got this right! (+{event.points_per_correct} pts)
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
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end justify-center"
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
              <div className="sticky bottom-0 bg-gray-900 px-6 pt-4 pb-6 border-t border-gray-800 space-y-3">
                <div className="flex items-center justify-between text-sm text-gray-400">
                  <span>{picksCount} of {totalCategories} categories picked</span>
                  <span className="text-amber-400">
                    Potential: +{picksCount * event.points_per_correct} pts
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
                    onClick={() => setShowBallotModal(false)}
                    className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold"
                    data-testid="button-done-ballot"
                  >
                    <Check size={18} className="mr-2" />
                    Done
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
