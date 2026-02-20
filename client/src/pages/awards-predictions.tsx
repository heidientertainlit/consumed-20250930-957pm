import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Trophy, Check, X, ChevronDown, ChevronUp, ChevronRight,
  Users, TrendingUp, Info, ArrowLeft, ChevronLeft,
  Sparkles, Lock, Clock, Loader2, Share2, LogIn, Download, Image
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";
import Navigation from "@/components/navigation";

interface Nominee {
  id: string;
  title: string;
  person_name: string | null;
  media_type: string;
  poster_url: string | null;
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
  const queryClient = useQueryClient();
  const [session, setSession] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [showBallotModal, setShowBallotModal] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showShareGraphic, setShowShareGraphic] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [localPicks, setLocalPicks] = useState<Map<string, string>>(new Map());
  const tabsRef = useRef<HTMLDivElement>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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

  // The users table uses id = auth.uid() directly (no separate auth_id column)
  const userId = session?.user?.id;
  const isAuthLoading = !session;

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
    queryKey: ['awards-picks', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('awards_picks')
        .select('category_id, nominee_id')
        .eq('user_id', userId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Fetch participants (users who have submitted ballots)
  interface Participant {
    user_id: string;
    picks_count: number;
    display_name: string | null;
    avatar_url: string | null;
    is_friend: boolean;
  }
  
  const { data: participants } = useQuery<{ players: Participant[]; friendCount: number; totalCount: number }>({
    queryKey: ['awards-participants', event?.id, userId],
    queryFn: async () => {
      if (!event?.id) return { players: [], friendCount: 0, totalCount: 0 };
      
      const categoryIds = event.categories.map(c => c.id);
      
      // Get all users who have made picks for this event's categories
      const { data: picksData, error: picksError } = await supabase
        .from('awards_picks')
        .select('user_id, category_id')
        .in('category_id', categoryIds);
      
      console.log('🎯 Awards picks query:', { 
        categoryIds, 
        picksCount: picksData?.length, 
        picksError,
        samplePicks: picksData?.slice(0, 5)
      });
      
      if (picksError) throw picksError;
      
      // Count unique users and their picks
      const userPickCounts = (picksData || []).reduce((acc, pick) => {
        acc[pick.user_id] = (acc[pick.user_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('🎯 User pick counts:', userPickCounts);
      
      // Only include users who have completed ALL categories
      const totalCategoryCount = categoryIds.length;
      const completedUserIds = Object.keys(userPickCounts).filter(
        id => id !== userId && userPickCounts[id] >= totalCategoryCount
      );
      const totalCount = completedUserIds.length;
      
      console.log('🎯 Completed users:', { totalCategoryCount, completedUserIds, currentUserId: userId });
      
      if (totalCount === 0) return { players: [], friendCount: 0, totalCount: 0 };
      
      // Get user info from users table (not profiles - awards_picks uses users table IDs)
      let usersData: any[] = [];
      let usersError: any = null;
      
      try {
        const result = await supabase
          .from('users')
          .select('id, display_name, user_name, avatar')
          .in('id', completedUserIds.slice(0, 20)); // Limit to first 20
        
        usersData = result.data || [];
        usersError = result.error;
        console.log('🎯 Users lookup:', { usersData, usersError, queriedIds: completedUserIds.slice(0, 20) });
      } catch (err) {
        console.error('🎯 Users query exception:', err);
      }
      
      // If users query failed, return basic data with just IDs
      if (usersError || usersData.length === 0) {
        console.log('🎯 Users query failed or empty, returning basic participant data');
        const basicPlayers = completedUserIds.map(id => ({
          user_id: id,
          picks_count: userPickCounts[id] || 0,
          display_name: 'Player',
          avatar_url: null,
          is_friend: false
        }));
        return { players: basicPlayers, friendCount: 0, totalCount };
      }
      
      // Map users to profiles format for consistency
      const profiles = (usersData || []).map(u => ({
        id: u.id,
        display_name: u.display_name || u.user_name,
        avatar_url: u.avatar
      }));
      
      console.log('🎯 Mapped profiles:', profiles);
      
      // Get current user's friends (using app userId, not auth ID)
      let friendIds: string[] = [];
      if (userId) {
        const { data: friendships } = await supabase
          .from('friendships')
          .select('friend_id, user_id')
          .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
          .eq('status', 'accepted');
        
        friendIds = (friendships || []).map(f => 
          f.user_id === userId ? f.friend_id : f.user_id
        );
      }
      
      // Map all players with is_friend flag
      const allPlayers: Participant[] = (profiles || [])
        .map(p => ({
          user_id: p.id,
          picks_count: userPickCounts[p.id] || 0,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          is_friend: friendIds.includes(p.id)
        }))
        // Sort friends first
        .sort((a, b) => (b.is_friend ? 1 : 0) - (a.is_friend ? 1 : 0));
      
      const friendCount = allPlayers.filter(p => p.is_friend).length;
      
      return { players: allPlayers, friendCount, totalCount };
    },
    enabled: !!event?.id,
  });

  // Fetch vote distribution per nominee (for showing percentages and friend picks)
  interface VoteData { 
    count: number; 
    total: number; 
    friends: { id: string; name: string; avatar: string | null }[];
  }
  const { data: voteDistribution } = useQuery<Record<string, VoteData>>({
    queryKey: ['awards-vote-distribution', event?.id, userId],
    queryFn: async () => {
      if (!event?.id) return {};
      
      const categoryIds = event.categories.map(c => c.id);
      
      // Get all picks for this event with user info
      const { data: picksData, error } = await supabase
        .from('awards_picks')
        .select('nominee_id, category_id, user_id')
        .in('category_id', categoryIds);
      
      if (error) throw error;
      
      // Get friend IDs if logged in
      let friendIds: string[] = [];
      if (userId) {
        const { data: friendsData } = await supabase
          .from('friends')
          .select('friend_id')
          .eq('user_id', userId)
          .eq('status', 'accepted');
        friendIds = (friendsData || []).map(f => f.friend_id);
      }
      
      // Get friend user info
      let friendUsers: Record<string, { name: string; avatar: string | null }> = {};
      if (friendIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, display_name, user_name, avatar')
          .in('id', friendIds);
        (usersData || []).forEach(u => {
          friendUsers[u.id] = { name: u.display_name || u.user_name || 'Friend', avatar: u.avatar };
        });
      }
      
      // Count votes per nominee and total per category
      const categoryTotals: Record<string, number> = {};
      const nomineeVotes: Record<string, number> = {};
      const nomineeFriends: Record<string, { id: string; name: string; avatar: string | null }[]> = {};
      
      (picksData || []).forEach(pick => {
        categoryTotals[pick.category_id] = (categoryTotals[pick.category_id] || 0) + 1;
        nomineeVotes[pick.nominee_id] = (nomineeVotes[pick.nominee_id] || 0) + 1;
        
        // Track friend picks
        if (friendIds.includes(pick.user_id) && friendUsers[pick.user_id]) {
          if (!nomineeFriends[pick.nominee_id]) nomineeFriends[pick.nominee_id] = [];
          nomineeFriends[pick.nominee_id].push({
            id: pick.user_id,
            name: friendUsers[pick.user_id].name,
            avatar: friendUsers[pick.user_id].avatar
          });
        }
      });
      
      // Build result
      const result: Record<string, VoteData> = {};
      event.categories.forEach(cat => {
        const total = categoryTotals[cat.id] || 0;
        cat.nominees.forEach(nom => {
          result[nom.id] = { 
            count: nomineeVotes[nom.id] || 0, 
            total,
            friends: nomineeFriends[nom.id] || []
          };
        });
      });
      
      return result;
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

  // Mutation for saving picks via edge function (awards points)
  const savePick = useMutation({
    mutationFn: async ({ categoryId, nomineeId }: { categoryId: string; nomineeId: string }) => {
      if (!userId) {
        throw new Error('Must be logged in to make picks');
      }
      
      const response = await supabase.functions.invoke('awards-pick', {
        body: {
          user_id: userId,
          category_id: categoryId,
          nominee_id: nomineeId
        }
      });
      
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      console.log('✅ Pick saved successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['awards-picks'] });
      queryClient.invalidateQueries({ queryKey: ['awards-vote-distribution'] });
    },
    onError: (error: Error) => {
      console.error('❌ Pick error:', error.message);
    }
  });

  const totalCategories = event?.categories?.length || 0;
  // Only count picks for categories that exist in this event
  const validCategoryIds = new Set(event?.categories?.map(c => c.id) || []);
  const picksCount = Array.from(localPicks.keys()).filter(catId => validCategoryIds.has(catId)).length;
  const isBallotComplete = picksCount >= totalCategories && totalCategories > 0;

  const handlePick = (categoryId: string, nomineeId: string) => {
    if (!event || event.status !== 'open') return;
    
    // If not logged in, show login prompt
    if (!userId) {
      setShowLoginPrompt(true);
      return;
    }
    
    const currentPick = localPicks.get(categoryId);
    console.log('🎯 handlePick called:', { categoryId, nomineeId, currentPick, isChange: currentPick !== nomineeId });
    
    // Check if same nominee is already picked (no change needed)
    if (currentPick === nomineeId) {
      console.log('🎯 Same nominee already picked, skipping');
      return;
    }
    
    // Optimistic update
    setLocalPicks(prev => {
      const newPicks = new Map(prev);
      newPicks.set(categoryId, nomineeId);
      return newPicks;
    });
    
    // Save to server (outside of state setter)
    console.log('🎯 Calling savePick.mutate for:', { categoryId, nomineeId });
    savePick.mutate({ categoryId, nomineeId });
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
          nomineeName: nominee.person_name || nominee.title,
          categoryName: category.short_name
        });
      }
    });
    return picks;
  };

  const { data: userProfile } = useQuery({
    queryKey: ['user-profile-share', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('users')
        .select('display_name, user_name')
        .eq('id', userId)
        .single();
      return data;
    },
    enabled: !!userId,
  });

  const handleShare = async () => {
    if (!event) return;
    
    const shareUrl = `${window.location.origin}/awards/${event.slug}/ballot?user=${userId}`;
    const shareText = `Check out my ${event.year} ${event.name} predictions!`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: `${event.name} ${event.year}`, text: shareText, url: shareUrl });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
    }
  };

  const handleDownloadShareGraphic = async () => {
    setShowShareGraphic(true);
    setIsGeneratingImage(true);
    await new Promise(r => setTimeout(r, 500));
    
    if (!shareCardRef.current) {
      setIsGeneratingImage(false);
      return;
    }

    try {
      const canvas = await html2canvas(shareCardRef.current, {
        scale: 3,
        backgroundColor: null,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setIsGeneratingImage(false);
          return;
        }
        const file = new File([blob], 'my-oscar-picks.png', { type: 'image/png' });

        if (navigator.share && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: `My ${event?.year} Oscar Picks`,
              text: `Check out my ${event?.year} Oscar predictions!`,
              files: [file],
            });
          } catch (err) {
            const link = document.createElement('a');
            link.download = 'my-oscar-picks.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
          }
        } else {
          const link = document.createElement('a');
          link.download = 'my-oscar-picks.png';
          link.href = canvas.toDataURL('image/png');
          link.click();
        }

        toast({ title: "Image ready!", description: "Your Oscar picks card has been saved" });
        setIsGeneratingImage(false);
        setShowShareGraphic(false);
      }, 'image/png');
    } catch (error) {
      toast({ title: "Error", description: "Could not generate image", variant: "destructive" });
      setIsGeneratingImage(false);
      setShowShareGraphic(false);
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
          <div className="relative inline-flex items-center justify-center mb-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
              <Trophy className="w-7 h-7 text-white" />
            </div>
            <button
              onClick={() => {
                const shareUrl = `${window.location.origin}/play/awards/${eventSlug}`;
                if (navigator.share) {
                  navigator.share({
                    title: `${event.year} ${event.name} Predictions`,
                    text: "Make your Oscar predictions and compete with me!",
                    url: shareUrl
                  });
                } else {
                  navigator.clipboard.writeText(shareUrl);
                }
              }}
              className="absolute -right-10 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors"
            >
              <Share2 size={16} className="text-white" />
            </button>
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-1">
            {event.year} {event.name}{event.name.includes('Academy Awards') ? ' (Oscars)' : ''}
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
        {/* Stats Row with Ballot Progress */}
        <button 
          onClick={() => setShowBallotModal(true)}
          className="w-full grid grid-cols-3 gap-3 mb-4"
          data-testid="button-view-ballot-inline"
        >
          <div className={`p-3 rounded-2xl border shadow-sm text-center hover:bg-gray-50 transition-colors ${
            isBallotComplete 
              ? 'bg-gradient-to-br from-purple-50 to-amber-50 border-purple-300' 
              : 'bg-white border-gray-200'
          }`}>
            <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">
              {isBallotComplete ? '✓ Complete!' : 'Your Ballot'}
            </p>
            <p className={`text-lg font-bold ${isBallotComplete ? 'text-green-600' : 'text-purple-600'}`}>
              {picksCount}/{totalCategories}
            </p>
            <div className="w-full h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${isBallotComplete ? 'bg-green-500' : 'bg-purple-600'}`}
                style={{ width: `${Math.min((picksCount / totalCategories) * 100, 100)}%` }}
              />
            </div>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm text-center">
            <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Potential</p>
            <p className="text-lg font-bold text-amber-500">{event.points_per_correct * totalCategories}</p>
            <p className="text-[10px] text-gray-400 mt-1">points</p>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm text-center">
            <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Status</p>
            <p className="text-lg font-bold text-green-600 capitalize">{event.status}</p>
            <p className="text-[10px] text-gray-400 mt-1">tap to view</p>
          </div>
        </button>

        {picksCount > 0 && (
          <button
            onClick={() => setShowBallotModal(true)}
            className="w-full mb-4 bg-gradient-to-r from-purple-600 to-purple-700 rounded-2xl p-3 flex items-center justify-between shadow-md active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-2">
              <Trophy size={20} className="text-amber-400" />
              <span className="text-white font-bold text-sm">View My Ballot & Share</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Image size={16} className="text-purple-200" />
              <ChevronRight size={16} className="text-purple-200" />
            </div>
          </button>
        )}

        {/* Who's Playing Section */}
        <div className="mb-3 bg-white rounded-2xl p-3 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-900 flex items-center">
              <Users size={18} className="mr-2 text-purple-600" />
              Who's Playing
            </h3>
            <button
              onClick={() => navigate('/leaderboard?tab=predictions&event=oscars-2026')}
              className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center"
              data-testid="button-see-leaderboard"
            >
              See Leaderboard
              <TrendingUp size={14} className="ml-1" />
            </button>
          </div>
          
          {participants?.players && participants.players.length > 0 ? (
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {participants.players.slice(0, 5).map((player) => (
                  <div
                    key={player.user_id}
                    className={`w-10 h-10 rounded-full border-2 overflow-hidden flex items-center justify-center ${
                      player.is_friend ? 'border-purple-300 bg-purple-100' : 'border-gray-200 bg-gray-100'
                    }`}
                    title={player.display_name || 'Player'}
                  >
                    {player.avatar_url ? (
                      <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className={`text-xs font-bold ${player.is_friend ? 'text-purple-600' : 'text-gray-500'}`}>
                        {(player.display_name || '?')[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                ))}
                {participants.totalCount > 5 && (
                  <div className="w-10 h-10 rounded-full border-2 border-gray-200 bg-gray-100 flex items-center justify-center">
                    <span className="text-xs text-gray-500 font-bold">+{participants.totalCount - 5}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 font-medium">
                {participants.friendCount > 0 
                  ? `${participants.friendCount} friend${participants.friendCount !== 1 ? 's' : ''} • ${participants.totalCount} total`
                  : `${participants.totalCount} player${participants.totalCount !== 1 ? 's' : ''}`
                }
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              Be the first to complete your ballot!
            </p>
          )}
        </div>
      </div>

      {/* Sticky Category Tabs */}
      <div 
        ref={tabsRef}
        className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm"
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
          const currentIndex = event.categories.findIndex(c => c.id === activeCategory);
          const nextCategory = event.categories[currentIndex + 1];
          
          return (
            <motion.div 
              key={category.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-normal text-gray-900">{category.name}</h2>
                <span className="text-sm text-gray-400">{currentIndex + 1} of {event.categories.length}</span>
              </div>
              
              {/* Instructions - shown when no pick made */}
              {event.status === 'open' && !userPickId && (
                <p className="text-sm text-gray-500 mb-4">
                  {userId ? 'Tap your pick to predict the winner' : 'Sign in to make predictions'}
                </p>
              )}
              
              {/* Picked confirmation - shown when pick is made */}
              {event.status === 'open' && userPickId && (
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-purple-600 font-medium flex items-center">
                    <Check size={16} className="mr-1" />
                    Prediction saved
                  </p>
                  {nextCategory && (
                    <button
                      onClick={() => setActiveCategory(nextCategory.id)}
                      className="text-sm text-purple-600 font-medium hover:underline flex items-center"
                    >
                      Next: {nextCategory.short_name || nextCategory.name.replace('Best ', '')}
                      <ChevronRight size={16} />
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3">
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
                            alt={nominee.person_name || nominee.title}
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
                          {nominee.person_name || nominee.title}
                        </p>
                        {nominee.person_name && (
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
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Friend avatars who picked this */}
                        {(() => {
                          const friendsPicked = voteDistribution?.[nominee.id]?.friends || [];
                          if (friendsPicked.length === 0) return null;
                          return (
                            <div className="flex -space-x-1" title={friendsPicked.map(f => f.name).join(', ')}>
                              {friendsPicked.slice(0, 3).map((friend, i) => (
                                <div 
                                  key={friend.id} 
                                  className="w-5 h-5 rounded-full bg-purple-100 border border-white flex items-center justify-center overflow-hidden"
                                  style={{ zIndex: 3 - i }}
                                >
                                  {friend.avatar ? (
                                    <img src={friend.avatar} alt={friend.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[8px] text-purple-600 font-medium">{friend.name.charAt(0).toUpperCase()}</span>
                                  )}
                                </div>
                              ))}
                              {friendsPicked.length > 3 && (
                                <div className="w-5 h-5 rounded-full bg-gray-200 border border-white flex items-center justify-center text-[8px] text-gray-600">
                                  +{friendsPicked.length - 3}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        
                        {/* Vote percentage badge */}
                        {voteDistribution && voteDistribution[nominee.id]?.total > 0 && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${isPicked ? 'bg-purple-200 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                            {Math.round((voteDistribution[nominee.id].count / voteDistribution[nominee.id].total) * 100)}%
                          </span>
                        )}
                        
                        {event.status === 'open' && isPicked && (
                          <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                            <Check size={12} className="text-white" />
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
                  My {event.year} {event.name}{event.name.includes('Academy Awards') ? ' (Oscars)' : ''} Ballot
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
                    onClick={handleDownloadShareGraphic}
                    variant="outline"
                    className="flex-1 border-gray-200 font-bold"
                    disabled={picksCount === 0 || isGeneratingImage}
                    data-testid="button-share-graphic"
                  >
                    {isGeneratingImage ? (
                      <Loader2 size={18} className="mr-2 animate-spin" />
                    ) : (
                      <Image size={18} className="mr-2" />
                    )}
                    Share as Image
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

      {/* Hidden Shareable Graphic Card - Instagram Story 1080x1920 */}
      {showShareGraphic && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
          <div
            ref={shareCardRef}
            style={{
              width: 1080,
              height: 1920,
              padding: '80px 60px',
              background: 'linear-gradient(160deg, #0a0a1a 0%, #1a1035 25%, #2d1f5e 50%, #1a1035 75%, #0a0a1a 100%)',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
              <img
                src="/consumed-logo-white.png"
                alt="Consumed"
                style={{
                  height: 48,
                  marginBottom: 40,
                  opacity: 0.9,
                  display: 'block',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}
              />
              <h1 style={{
                fontSize: 64, fontWeight: 800, color: '#ffffff',
                margin: '0 0 12px 0', letterSpacing: '-1px',
              }}>
                My {event.year} Oscar Picks
              </h1>
              {userProfile && (
                <p style={{ fontSize: 28, color: '#a78bfa', margin: 0, fontWeight: 600 }}>
                  @{userProfile.user_name || userProfile.display_name}
                </p>
              )}
            </div>

            {(() => {
              const topCategoryKeywords = ['picture', 'director', 'actor', 'actress', 'sup actor', 'sup actress', 'supporting actor', 'supporting actress'];
              const allPicks = getBallotPicks();
              const topPicks = allPicks.filter(pick => {
                const name = pick.categoryName.toLowerCase();
                return topCategoryKeywords.some(kw => name.includes(kw));
              }).slice(0, 6);
              const remainingCount = allPicks.length - topPicks.length;

              return (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 60 }}>
                    {topPicks.map((pick) => (
                      <div
                        key={pick.categoryId}
                        style={{
                          background: 'rgba(255,255,255,0.07)',
                          borderRadius: 24,
                          padding: '28px 36px',
                          border: '1px solid rgba(255,255,255,0.12)',
                        }}
                      >
                        <p style={{
                          fontSize: 16, fontWeight: 700, color: '#a78bfa',
                          textTransform: 'uppercase', letterSpacing: '2.5px',
                          margin: '0 0 10px 0',
                        }}>
                          {pick.categoryName}
                        </p>
                        <p style={{
                          fontSize: 32, fontWeight: 700, color: '#ffffff',
                          margin: 0, lineHeight: 1.2,
                        }}>
                          {pick.nomineeName}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    {remainingCount > 0 && (
                      <p style={{
                        fontSize: 24, color: '#a78bfa', fontWeight: 700,
                        margin: '0 0 16px 0',
                      }}>
                        + {remainingCount} more picks
                      </p>
                    )}
                    <p style={{
                      fontSize: 28, color: 'rgba(255,255,255,0.5)',
                      margin: 0, fontWeight: 700,
                    }}>
                      See my full ballot on <span style={{ color: '#a78bfa' }}>@consumedapp</span>
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Login Prompt Dialog */}
      <Dialog open={showLoginPrompt} onOpenChange={setShowLoginPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Make Your Oscar Picks!
            </DialogTitle>
            <DialogDescription>
              Sign in or create an account to save your predictions and compete with friends.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-4">
            <Button
              onClick={() => {
                sessionStorage.setItem('returnUrl', window.location.pathname);
                navigate('/login');
              }}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In / Create Account
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowLoginPrompt(false)}
              className="w-full"
            >
              Continue Browsing
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
