import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Trophy, Check, X, ChevronDown, ChevronUp, Share2, 
  Users, TrendingUp, Info, ExternalLink, ArrowLeft,
  Sparkles, Lock, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import Navigation from "@/components/navigation";

interface Nominee {
  id: string;
  name: string;
  title: string; // Movie/Show name
  posterUrl: string;
  tmdbPopularity: number;
  tmdbId: string;
}

interface Category {
  id: string;
  name: string;
  shortName: string;
  nominees: Nominee[];
  userPick?: string; // nominee id
  insight?: {
    mostPicked: string;
    percentage: number;
    trending: number;
    friendsPicked: number;
  };
  winner?: string; // nominee id (after show)
}

interface AwardsEvent {
  id: string;
  name: string;
  year: number;
  bannerUrl: string;
  status: 'open' | 'locked' | 'completed';
  deadline?: string;
  categories: Category[];
}

interface BallotPick {
  categoryId: string;
  nomineeId: string;
  nomineeName: string;
  categoryName: string;
}

export default function AwardsPredictions() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<any>(null);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [showBallotModal, setShowBallotModal] = useState(false);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [userPicks, setUserPicks] = useState<Map<string, string>>(new Map());
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
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

  // Mock data for Golden Globes 2026 - would come from API
  const mockEvent: AwardsEvent = {
    id: "golden-globes-2026",
    name: "2026 Golden Globe Predictions",
    year: 2026,
    bannerUrl: "",
    status: "open",
    deadline: "2026-01-05T20:00:00Z",
    categories: [
      {
        id: "best-picture-drama",
        name: "Best Motion Picture – Drama",
        shortName: "Picture (Drama)",
        nominees: [
          { id: "1", name: "Oppenheimer", title: "Oppenheimer", posterUrl: "https://image.tmdb.org/t/p/w300/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", tmdbPopularity: 156.2, tmdbId: "872585" },
          { id: "2", name: "Killers of the Flower Moon", title: "Killers of the Flower Moon", posterUrl: "https://image.tmdb.org/t/p/w300/dB6Krk806zeqd0YNp2ngQ9zXteH.jpg", tmdbPopularity: 89.4, tmdbId: "466420" },
          { id: "3", name: "The Holdovers", title: "The Holdovers", posterUrl: "https://image.tmdb.org/t/p/w300/VHSzNBTwxV8vh7wylo7O9CLdac.jpg", tmdbPopularity: 45.2, tmdbId: "840430" },
          { id: "4", name: "Past Lives", title: "Past Lives", posterUrl: "https://image.tmdb.org/t/p/w300/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg", tmdbPopularity: 38.1, tmdbId: "666277" },
          { id: "5", name: "Anatomy of a Fall", title: "Anatomy of a Fall", posterUrl: "https://image.tmdb.org/t/p/w300/kQs6keheMwCxJxrzV83VUwFtHkB.jpg", tmdbPopularity: 34.7, tmdbId: "915935" },
        ],
        insight: { mostPicked: "Oppenheimer", percentage: 68, trending: 12, friendsPicked: 5 }
      },
      {
        id: "best-actress-drama",
        name: "Best Actress in a Motion Picture – Drama",
        shortName: "Actress (Drama)",
        nominees: [
          { id: "6", name: "Lily Gladstone", title: "Killers of the Flower Moon", posterUrl: "https://image.tmdb.org/t/p/w300/dB6Krk806zeqd0YNp2ngQ9zXteH.jpg", tmdbPopularity: 82.3, tmdbId: "466420" },
          { id: "7", name: "Emma Stone", title: "Poor Things", posterUrl: "https://image.tmdb.org/t/p/w300/kCGlIMHnOm8JPXq3rXM6c5wMxcT.jpg", tmdbPopularity: 94.5, tmdbId: "792307" },
          { id: "8", name: "Greta Lee", title: "Past Lives", posterUrl: "https://image.tmdb.org/t/p/w300/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg", tmdbPopularity: 28.4, tmdbId: "666277" },
          { id: "9", name: "Carey Mulligan", title: "Maestro", posterUrl: "https://image.tmdb.org/t/p/w300/wJEFJ8LkSJnJDEpDzW4eWmvbMuE.jpg", tmdbPopularity: 42.1, tmdbId: "595586" },
          { id: "10", name: "Sandra Hüller", title: "Anatomy of a Fall", posterUrl: "https://image.tmdb.org/t/p/w300/kQs6keheMwCxJxrzV83VUwFtHkB.jpg", tmdbPopularity: 31.8, tmdbId: "915935" },
        ],
        insight: { mostPicked: "Lily Gladstone", percentage: 62, trending: 14, friendsPicked: 3 }
      },
      {
        id: "best-actor-drama",
        name: "Best Actor in a Motion Picture – Drama",
        shortName: "Actor (Drama)",
        nominees: [
          { id: "11", name: "Cillian Murphy", title: "Oppenheimer", posterUrl: "https://image.tmdb.org/t/p/w300/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", tmdbPopularity: 145.6, tmdbId: "872585" },
          { id: "12", name: "Bradley Cooper", title: "Maestro", posterUrl: "https://image.tmdb.org/t/p/w300/wJEFJ8LkSJnJDEpDzW4eWmvbMuE.jpg", tmdbPopularity: 78.2, tmdbId: "595586" },
          { id: "13", name: "Leonardo DiCaprio", title: "Killers of the Flower Moon", posterUrl: "https://image.tmdb.org/t/p/w300/dB6Krk806zeqd0YNp2ngQ9zXteH.jpg", tmdbPopularity: 112.4, tmdbId: "466420" },
          { id: "14", name: "Colman Domingo", title: "Rustin", posterUrl: "https://image.tmdb.org/t/p/w300/vAg7heJCvBb2fzF8ZZXL1hHOlx9.jpg", tmdbPopularity: 24.3, tmdbId: "1009372" },
          { id: "15", name: "Andrew Scott", title: "All of Us Strangers", posterUrl: "https://image.tmdb.org/t/p/w300/xrObLZqz9xNHLR3CQqhVFG6lGvo.jpg", tmdbPopularity: 35.7, tmdbId: "840326" },
        ],
        insight: { mostPicked: "Cillian Murphy", percentage: 72, trending: 8, friendsPicked: 4 }
      },
      {
        id: "best-director",
        name: "Best Director",
        shortName: "Director",
        nominees: [
          { id: "16", name: "Christopher Nolan", title: "Oppenheimer", posterUrl: "https://image.tmdb.org/t/p/w300/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg", tmdbPopularity: 156.2, tmdbId: "872585" },
          { id: "17", name: "Martin Scorsese", title: "Killers of the Flower Moon", posterUrl: "https://image.tmdb.org/t/p/w300/dB6Krk806zeqd0YNp2ngQ9zXteH.jpg", tmdbPopularity: 89.4, tmdbId: "466420" },
          { id: "18", name: "Yorgos Lanthimos", title: "Poor Things", posterUrl: "https://image.tmdb.org/t/p/w300/kCGlIMHnOm8JPXq3rXM6c5wMxcT.jpg", tmdbPopularity: 94.5, tmdbId: "792307" },
          { id: "19", name: "Greta Gerwig", title: "Barbie", posterUrl: "https://image.tmdb.org/t/p/w300/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg", tmdbPopularity: 134.8, tmdbId: "346698" },
          { id: "20", name: "Celine Song", title: "Past Lives", posterUrl: "https://image.tmdb.org/t/p/w300/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg", tmdbPopularity: 38.1, tmdbId: "666277" },
        ],
        insight: { mostPicked: "Christopher Nolan", percentage: 58, trending: 5, friendsPicked: 6 }
      },
      {
        id: "best-picture-comedy",
        name: "Best Motion Picture – Musical/Comedy",
        shortName: "Picture (Comedy)",
        nominees: [
          { id: "21", name: "Barbie", title: "Barbie", posterUrl: "https://image.tmdb.org/t/p/w300/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg", tmdbPopularity: 134.8, tmdbId: "346698" },
          { id: "22", name: "Poor Things", title: "Poor Things", posterUrl: "https://image.tmdb.org/t/p/w300/kCGlIMHnOm8JPXq3rXM6c5wMxcT.jpg", tmdbPopularity: 94.5, tmdbId: "792307" },
          { id: "23", name: "American Fiction", title: "American Fiction", posterUrl: "https://image.tmdb.org/t/p/w300/46sp1Z9b2PPTgCRAtpKUVHcX9ta.jpg", tmdbPopularity: 52.3, tmdbId: "904765" },
          { id: "24", name: "May December", title: "May December", posterUrl: "https://image.tmdb.org/t/p/w300/xxbZxLnpmPMd5bWC1nCiuV9P5Uu.jpg", tmdbPopularity: 41.2, tmdbId: "878883" },
          { id: "25", name: "The Holdovers", title: "The Holdovers", posterUrl: "https://image.tmdb.org/t/p/w300/VHSzNBTwxV8vh7wylo7O9CLdac.jpg", tmdbPopularity: 45.2, tmdbId: "840430" },
        ],
        insight: { mostPicked: "Barbie", percentage: 55, trending: 3, friendsPicked: 7 }
      },
    ]
  };

  const event = mockEvent;
  const totalCategories = event.categories.length;
  const picksCount = userPicks.size;

  // Set initial active category
  useEffect(() => {
    if (event.categories.length > 0 && !activeCategory) {
      setActiveCategory(event.categories[0].id);
    }
  }, [event.categories, activeCategory]);

  const handlePick = (categoryId: string, nomineeId: string) => {
    if (event.status === 'locked' || event.status === 'completed') return;
    
    setUserPicks(prev => {
      const newPicks = new Map(prev);
      if (newPicks.get(categoryId) === nomineeId) {
        newPicks.delete(categoryId);
      } else {
        newPicks.set(categoryId, nomineeId);
      }
      return newPicks;
    });
  };

  const scrollToCategory = (categoryId: string) => {
    setActiveCategory(categoryId);
    categoryRefs.current[categoryId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getBallotPicks = (): BallotPick[] => {
    const picks: BallotPick[] = [];
    userPicks.forEach((nomineeId, categoryId) => {
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
    const shareUrl = `${window.location.origin}/awards/${event.id}/ballot?user=${session?.user?.id}`;
    const shareText = `Check out my ${event.name} predictions! 🏆`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: event.name, text: shareText, url: shareUrl });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copied!", description: "Share your ballot with friends" });
    }
  };

  const handleSubmitBallot = () => {
    toast({ title: "Ballot submitted!", description: `${picksCount} predictions locked in` });
    setShowBallotModal(false);
  };

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
          >
            <ArrowLeft size={20} className="mr-2" />
            Back to Play
          </button>
          
          <div className="flex items-center space-x-3 mb-3">
            <Trophy className="w-10 h-10 text-amber-400" />
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-300 bg-clip-text text-transparent">
                {event.name}
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
            onClick={() => scrollToCategory(event.categories[0]?.id)}
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
              const hasPick = userPicks.has(category.id);
              const isActive = activeCategory === category.id;
              
              return (
                <button
                  key={category.id}
                  onClick={() => scrollToCategory(category.id)}
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

      {/* Categories */}
      <div className="px-4 py-6 space-y-10">
        {event.categories.map(category => {
          const userPickId = userPicks.get(category.id);
          const isInsightExpanded = expandedInsight === category.id;
          
          return (
            <div 
              key={category.id}
              ref={el => categoryRefs.current[category.id] = el}
              className="scroll-mt-20"
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
                            alt={nominee.title}
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
                        <p className="text-gray-400 text-sm truncate">{nominee.title}</p>
                        
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
                                You got this right! (+120 pts)
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
            </div>
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
                  My {event.year} Golden Globe Ballot
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
                            scrollToCategory(pick.categoryId);
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
                <Button 
                  onClick={handleShare}
                  variant="outline"
                  className="w-full border-gray-600 text-white hover:bg-gray-800"
                >
                  <Share2 size={18} className="mr-2" />
                  Share My Ballot
                </Button>
                <Button 
                  onClick={handleSubmitBallot}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold"
                  disabled={picksCount === 0}
                >
                  Submit Predictions
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Navigation />
    </div>
  );
}
