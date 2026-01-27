import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Trophy, Check, X, ChevronDown, ChevronUp, Share2, 
  Users, TrendingUp, Info, ArrowLeft, ChevronLeft,
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="w-10 h-10 text-purple-600 animate-spin mb-4" />
          <p className="text-gray-500">Loading predictions...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center px-4">
          <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Awards Not Found</h1>
          <p className="text-gray-500 mb-6">The awards event could not be loaded. Make sure the database is set up.</p>
          <Button onClick={() => navigate('/play/awards')} variant="outline">
            Back to Awards
          </Button>
        </div>
        <Navigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navigation />
      
      {/* Hero Header - Dark purple gradient matching app */}
      <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] pb-12 pt-6 -mt-px text-center">
          <div className="mb-3">
            <Badge className="bg-purple-600 text-white hover:bg-purple-700 text-[10px] py-0.5 px-2 font-bold uppercase tracking-wider">
              Consumed
            </Badge>
          </div>

          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 mb-3 shadow-lg">
            <Trophy className="w-7 h-7 text-white" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-1">
            {event.year} {event.name}
          </h1>
          <p className="text-gray-400 max-w-md mx-auto text-sm">
            {event.deadline && event.status === 'open' ? (
              <span className="flex items-center justify-center">
                <Clock size={14} className="mr-1 text-amber-400" />
                Closes: {new Date(event.deadline).toLocaleDateString('en-US', { 
                  month: 'short', day: 'numeric', year: 'numeric'
                })}
              </span>
            ) : event.status === 'locked' ? (
              <span className="flex items-center justify-center text-amber-500">
                <Lock size={14} className="mr-1" />
                Predictions Locked
              </span>
            ) : (
              "Make your picks. See how your predictions stack up."
            )}
          </p>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-2">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm text-center">
            <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Picks</p>
            <p className="text-lg font-bold text-gray-900">{picksCount}/{totalCategories}</p>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm text-center">
            <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Points</p>
            <p className="text-lg font-bold text-purple-600">{event.points_per_correct * picksCount}</p>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm text-center">
            <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Status</p>
            <p className="text-lg font-bold text-amber-600 capitalize">{event.status}</p>
          </div>
        </div>

        {/* Who's Playing Section */}
        <div className="mb-6 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center">
              <Users size={18} className="mr-2 text-purple-600" />
              Who's Playing
            </h3>
            <button
              onClick={() => navigate('/leaderboard?tab=games')}
              className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center"
              data-testid="button-see-leaderboard"
            >
              See Leaderboard
              <TrendingUp size={14} className="ml-1" />
            </button>
          </div>
          
          {participants?.friends && participants.friends.length > 0 ? (
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {participants.friends.slice(0, 5).map((friend) => (
                  <div
                    key={friend.user_id}
                    className="w-10 h-10 rounded-full border-2 border-white overflow-hidden bg-purple-100 flex items-center justify-center"
                    title={friend.display_name || 'Friend'}
                  >
                    {friend.avatar_url ? (
                      <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-purple-600 font-bold">
                        {(friend.display_name || '?')[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                ))}
                {participants.friends.length > 5 && (
                  <div className="w-10 h-10 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center">
                    <span className="text-xs text-gray-500 font-bold">+{participants.friends.length - 5}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 font-medium">
                {participants.friends.length} friend{participants.friends.length !== 1 ? 's' : ''} playing
                {participants.totalCount ? ` • ${participants.totalCount} total ballots` : ''}
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic">No friends playing yet. Invite them to join!</p>
          )}
        </div>
      </div>

      {/* Sticky Category Tabs */}
      <div 
        ref={tabsRef}
        className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm"
      >
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex px-4 py-4 space-x-2 min-w-max">
            {event.categories.map(category => {
              const hasPick = localPicks.has(category.id);
              const isActive = activeCategory === category.id;
              
              return (
                <button
                  key={category.id}
                  onClick={() => switchToCategory(category.id)}
                  className={`relative flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                    isActive 
                      ? 'bg-gradient-to-r from-[#5b21b6] to-[#a855f7] text-white shadow-md' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                  }`}
                  data-testid={`tab-category-${category.id}`}
                >
                  {category.short_name}
                  {hasPick && (
                    <span className={`ml-2 w-4 h-4 rounded-full flex items-center justify-center ${isActive ? 'bg-white' : 'bg-green-500'}`}>
                      <Check size={10} className={isActive ? 'text-purple-600' : 'text-white'} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Category Panel */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {event.categories.filter(c => c.id === activeCategory).map(category => {
          const userPickId = localPicks.get(category.id);
          
          return (
            <motion.div 
              key={category.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-normal text-gray-900 mb-6">{category.name}</h2>

              <div className="grid grid-cols-1 gap-4">
                {category.nominees.map(nominee => {
                  const isPicked = userPickId === nominee.id;
                  const isWinner = event.status === 'completed' && category.winner_nominee_id === nominee.id;
                  const userWasCorrect = event.status === 'completed' && userPickId === category.winner_nominee_id;
                  
                  return (
                    <motion.div
                      key={nominee.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handlePick(category.id, nominee.id)}
                      className={`relative flex items-center px-4 py-3 rounded-2xl cursor-pointer transition-all ${
                        isPicked 
                          ? 'bg-purple-100 border-2 border-purple-500' 
                          : 'bg-gray-100 border border-gray-200 hover:bg-gray-200'
                      } ${event.status !== 'open' ? 'cursor-default' : ''}`}
                      data-testid={`card-nominee-${nominee.id}`}
                    >
                      {isWinner && (
                        <div className="absolute -top-2 right-4 bg-amber-500 text-white px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center shadow-sm uppercase tracking-wider">
                          <Trophy size={8} className="mr-1" />
                          Winner
                        </div>
                      )}
                      
                      {/* Poster thumbnail */}
                      <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 mr-3 bg-gray-200">
                        {nominee.poster_url ? (
                          <img 
                            src={nominee.poster_url} 
                            alt={nominee.title || nominee.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Trophy size={16} className="text-gray-400" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-base ${isPicked ? 'text-purple-900' : 'text-gray-900'}`}>
                          {nominee.name}
                        </p>
                        {nominee.title && (
                          <p className={`text-sm ${isPicked ? 'text-purple-600' : 'text-gray-500'}`}>{nominee.title}</p>
                        )}
                        
                        {event.status === 'completed' && isPicked && (
                          <div className={`mt-1 flex items-center text-xs font-bold uppercase tracking-wide ${userWasCorrect ? 'text-green-600' : 'text-red-500'}`}>
                            {userWasCorrect ? (
                              <>
                                <Check size={12} className="mr-1" />
                                Correct!
                              </>
                            ) : (
                              <>
                                <X size={12} className="mr-1" />
                                Incorrect
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {event.status === 'open' && isPicked && (
                        <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                          <Check size={12} className="text-white" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="px-4 pb-12 flex justify-center">
        <Button 
          onClick={() => setShowBallotModal(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-full px-8 py-6 text-lg shadow-lg shadow-purple-200 flex items-center gap-2"
          data-testid="button-view-ballot"
        >
          <Info size={20} />
          View Your Ballot
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">
            {picksCount}/{totalCategories}
          </span>
        </Button>
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
              className="w-full max-w-lg bg-white rounded-t-3xl max-h-[80vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <Trophy size={24} className="mr-2 text-amber-500" />
                  My {event.year} {event.name} Ballot
                </h2>
                <button onClick={() => setShowBallotModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              
              {/* Ballot Picks List */}
              <div className="px-6 py-4 overflow-y-auto max-h-[50vh] bg-gray-50">
                {getBallotPicks().length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No picks yet. Start making your predictions!</p>
                ) : (
                  <div className="space-y-3">
                    {getBallotPicks().map(pick => (
                      <div 
                        key={pick.categoryId}
                        className="flex items-center justify-between bg-white border border-gray-200 shadow-sm rounded-xl px-4 py-3"
                      >
                        <div>
                          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">{pick.categoryName}</p>
                          <p className="text-gray-900 font-bold">{pick.nomineeName}</p>
                        </div>
                        <button 
                          onClick={() => {
                            setShowBallotModal(false);
                            switchToCategory(pick.categoryId);
                          }}
                          className="text-purple-600 text-sm font-bold hover:underline"
                        >
                          Edit
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-white px-6 pt-4 pb-8 border-t border-gray-100 space-y-4">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span className="text-gray-500">{picksCount} of {totalCategories} categories picked</span>
                  <span className="text-purple-600 font-bold">
                    Potential: +{picksCount * event.points_per_correct} pts
                  </span>
                </div>
                
                <div className="flex space-x-3">
                  <Button
                    onClick={handleShare}
                    variant="outline"
                    className="flex-1 border-gray-200 font-bold"
                    disabled={picksCount === 0}
                    data-testid="button-share-ballot"
                  >
                    <Share2 size={18} className="mr-2" />
                    Share
                  </Button>
                  <Button
                    onClick={() => setShowBallotModal(false)}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold"
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

    </div>
  );
}
