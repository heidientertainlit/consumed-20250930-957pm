import { useAuth } from "@/lib/auth";
import Navigation from "@/components/navigation";
import { Trophy, Star, Target, Brain, BookOpen, Film, Tv, Music, Gamepad2, Headphones, TrendingUp, Users, Globe, Share2, ChevronDown, ChevronUp, Award, Dices } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useSearch } from "wouter";

interface LeaderboardEntry {
  user_id: string;
  username: string;
  display_name: string;
  score: number;
  rank: number;
  detail?: string;
}

interface LeaderboardData {
  categories: {
    overall?: LeaderboardEntry[];
    trivia?: LeaderboardEntry[];
    polls?: LeaderboardEntry[];
    bets?: LeaderboardEntry[];
    predictions?: LeaderboardEntry[];
    books?: LeaderboardEntry[];
    movies?: LeaderboardEntry[];
    tv?: LeaderboardEntry[];
    music?: LeaderboardEntry[];
    podcasts?: LeaderboardEntry[];
    games?: LeaderboardEntry[];
    total_consumption?: LeaderboardEntry[];
  };
  currentUserId: string;
  scope: string;
  period: string;
}

export default function Leaderboard() {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const tabParam = urlParams.get('tab');
  const eventParam = urlParams.get('event');
  
  const [scope, setScope] = useState<'global' | 'friends'>('global');
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'all_time'>('weekly');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>(
    tabParam === 'games' || tabParam === 'consumption' || tabParam === 'predictions' ? 
      (tabParam === 'predictions' ? 'games' : tabParam) : 'engagement'
  );

  const toggleExpanded = (categoryName: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  const { data: leaderboardData, isLoading } = useQuery<LeaderboardData>({
    queryKey: ['leaderboard', scope, period],
    queryFn: async () => {
      if (!session?.access_token) return null;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-leaderboards?category=all&scope=${scope}&period=${period}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      return response.json();
    },
    enabled: !!session?.access_token,
  });

  const shareRankMutation = useMutation({
    mutationFn: async ({ rank, categoryName }: { rank: number; categoryName: string }) => {
      if (!session?.access_token) throw new Error('Not authenticated');

      const periodLabel = period === 'weekly' ? 'this week' : period === 'monthly' ? 'this month' : 'all time';
      const shareText = `🏆 I'm #${rank} in ${categoryName} ${periodLabel} on Consumed!`;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inline-post`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: shareText,
            post_type: 'update',
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to share rank');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Rank shared!",
        description: "Your leaderboard rank has been posted to your feed.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to share",
        description: "Could not share your rank. Please try again.",
        variant: "destructive",
      });
    },
  });

  const currentUserId = leaderboardData?.currentUserId;

  // Fetch awards events and their leaderboards
  interface AwardsEvent {
    id: string;
    name: string;
    year: number;
    slug: string;
    status: string;
  }

  interface AwardsLeaderEntry {
    user_id: string;
    display_name: string;
    username: string;
    picks_count: number;
    correct_count: number;
  }

  const { data: awardsEvents } = useQuery<AwardsEvent[]>({
    queryKey: ['awards-events-leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('awards_events')
        .select('id, name, year, slug, status')
        .in('status', ['open', 'locked', 'resolved'])
        .order('year', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const [expandedAwards, setExpandedAwards] = useState<Set<string>>(new Set());

  // Auto-expand the specified event from URL param
  useEffect(() => {
    if (eventParam && awardsEvents) {
      const targetEvent = awardsEvents.find(e => e.slug === eventParam);
      if (targetEvent && !expandedAwards.has(targetEvent.id)) {
        setExpandedAwards(new Set([targetEvent.id]));
      }
    }
  }, [eventParam, awardsEvents]);

  const toggleAwardsExpanded = (eventId: string) => {
    setExpandedAwards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  // Fetch leaderboard for expanded awards
  const { data: awardsLeaderboards } = useQuery<Record<string, AwardsLeaderEntry[]>>({
    queryKey: ['awards-leaderboards', Array.from(expandedAwards), scope],
    queryFn: async () => {
      if (expandedAwards.size === 0) return {};
      
      const results: Record<string, AwardsLeaderEntry[]> = {};
      
      for (const eventId of expandedAwards) {
        // Get categories for this event
        const { data: categories } = await supabase
          .from('awards_categories')
          .select('id')
          .eq('event_id', eventId);
        
        if (!categories?.length) continue;
        
        const categoryIds = categories.map(c => c.id);
        
        // Get all picks for these categories
        const { data: picks } = await supabase
          .from('awards_picks')
          .select('user_id, category_id, nominee_id')
          .in('category_id', categoryIds);
        
        if (!picks?.length) continue;
        
        // Count picks per user
        const userPickCounts: Record<string, number> = {};
        picks.forEach(p => {
          userPickCounts[p.user_id] = (userPickCounts[p.user_id] || 0) + 1;
        });
        
        const userIds = Object.keys(userPickCounts);
        
        // Get user profiles - try both profiles and users tables
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', userIds);
        
        // Also check users table for display info (user_name is the column name)
        const { data: users } = await supabase
          .from('users')
          .select('id, user_name')
          .in('id', userIds);
        
        // If friends scope, filter to friends only
        let filteredUserIds = userIds;
        if (scope === 'friends' && session?.user?.id) {
          const { data: friendships } = await supabase
            .from('friendships')
            .select('friend_id, user_id')
            .or(`user_id.eq.${session.user.id},friend_id.eq.${session.user.id}`)
            .eq('status', 'accepted');
          
          const friendIds = (friendships || []).map(f => 
            f.user_id === session.user.id ? f.friend_id : f.user_id
          );
          // Include self
          friendIds.push(session.user.id);
          filteredUserIds = userIds.filter(id => friendIds.includes(id));
        }
        
        const entries: AwardsLeaderEntry[] = filteredUserIds
          .map(userId => {
            const profile = profiles?.find(p => p.id === userId);
            const user = users?.find((u: any) => u.id === userId);
            // Use best available display name: profile > user_name from users table
            const displayName = profile?.display_name || user?.user_name || 
              profile?.username || 'Player';
            const username = profile?.username || user?.user_name || 'player';
            return {
              user_id: userId,
              display_name: displayName,
              username: username,
              picks_count: userPickCounts[userId] || 0,
              correct_count: 0, // TODO: Calculate after results
            };
          })
          .sort((a, b) => b.picks_count - a.picks_count)
          .slice(0, 10);
        
        results[eventId] = entries;
      }
      
      return results;
    },
    enabled: expandedAwards.size > 0,
  });

  const renderLeaderboardList = (
    entries: LeaderboardEntry[] | undefined,
    categoryName: string,
    emptyMessage: string,
    isExpanded: boolean,
    hideDetails: boolean = false
  ) => {
    if (!entries || entries.length === 0) {
      return (
        <div className="p-8 text-center text-gray-500">
          <p className="text-sm">{emptyMessage}</p>
        </div>
      );
    }

    const displayEntries = isExpanded ? entries.slice(0, 10) : entries.slice(0, 3);
    const hasMore = entries.length > 3;

    return (
      <div>
        <div className="divide-y divide-gray-100">
          {displayEntries.map((entry, index) => {
            const isCurrentUser = entry.user_id === currentUserId;
            const rankColors = ['bg-yellow-400', 'bg-gray-300', 'bg-amber-600'];
            
            return (
              <div
                key={entry.user_id}
                className={`flex items-center gap-4 p-4 ${isCurrentUser ? 'bg-purple-50' : 'hover:bg-gray-50'} transition-colors`}
                data-testid={`leaderboard-entry-${entry.user_id}`}
              >
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                  {index < 3 ? (
                    <div className={`w-8 h-8 rounded-full ${rankColors[index]} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                      {index + 1}
                    </div>
                  ) : (
                    <span className="text-gray-500 font-semibold text-sm">#{index + 1}</span>
                  )}
                </div>

                <Link 
                  href={`/user/${entry.user_id}`}
                  className="flex-1 min-w-0"
                >
                  <p className={`font-semibold text-sm truncate ${isCurrentUser ? 'text-purple-700' : 'text-gray-900'}`}>
                    {entry.display_name || entry.username}
                    {isCurrentUser && <span className="ml-2 text-xs text-purple-600">(You)</span>}
                  </p>
                  <p className="text-xs text-gray-500">@{entry.username}</p>
                </Link>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="font-bold text-lg text-purple-600">{entry.score}</p>
                    {!hideDetails && entry.detail && (
                      <p className="text-xs text-gray-500">{entry.detail}</p>
                    )}
                  </div>
                  
                  {isCurrentUser && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => shareRankMutation.mutate({ rank: index + 1, categoryName })}
                      disabled={shareRankMutation.isPending}
                      className="flex items-center gap-1.5"
                      data-testid={`button-share-rank-${categoryName}`}
                    >
                      <Share2 size={14} />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {hasMore && (
          <button
            onClick={() => toggleExpanded(categoryName)}
            className="w-full py-3 flex items-center justify-center gap-1 text-sm text-purple-600 hover:bg-purple-50 transition-colors border-t border-gray-100"
            data-testid={`button-show-more-${categoryName}`}
          >
            {isExpanded ? (
              <>
                Show Less <ChevronUp size={16} />
              </>
            ) : (
              <>
                Show More <ChevronDown size={16} />
              </>
            )}
          </button>
        )}
      </div>
    );
  };

  const renderCategoryCard = (
    title: string,
    Icon: any,
    entries: LeaderboardEntry[] | undefined,
    categoryName: string,
    emptyMessage: string,
    gradient: string = 'from-purple-600 to-blue-600',
    actionLink?: { label: string; href: string },
    hideDetails: boolean = false
  ) => {
    const isExpanded = expandedCategories.has(categoryName);
    
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
        <div className={`bg-gradient-to-r ${gradient} p-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="text-white" size={20} />
              <h3 className="text-base font-bold text-white">{title}</h3>
            </div>
            {actionLink && (
              <Link 
                href={actionLink.href}
                className="text-white/90 hover:text-white text-sm font-medium flex items-center gap-1"
                data-testid={`link-${categoryName.toLowerCase().replace(/\s/g, '-')}-action`}
              >
                {actionLink.label} →
              </Link>
            )}
          </div>
        </div>
        {renderLeaderboardList(entries, categoryName, emptyMessage, isExpanded, hideDetails)}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-black mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Leaderboard
          </h1>
          <p className="text-base text-gray-600">
            See how you stack up.
          </p>
        </div>

        <div className="flex justify-center gap-2 mb-4">
          <Button
            size="sm"
            variant={scope === 'global' ? 'default' : 'outline'}
            onClick={() => setScope('global')}
            className={scope === 'global' ? 'bg-purple-600 hover:bg-purple-700' : ''}
            data-testid="button-scope-global"
          >
            <Globe size={14} className="mr-1" />
            Global
          </Button>
          <Button
            size="sm"
            variant={scope === 'friends' ? 'default' : 'outline'}
            onClick={() => setScope('friends')}
            className={scope === 'friends' ? 'bg-purple-600 hover:bg-purple-700' : ''}
            data-testid="button-scope-friends"
          >
            <Users size={14} className="mr-1" />
            Friends
          </Button>
        </div>

        <div className="flex justify-center gap-2 mb-6">
          {(['weekly', 'monthly', 'all_time'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                period === p 
                  ? 'bg-purple-100 text-purple-700 font-medium' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              data-testid={`button-period-${p}`}
            >
              {p === 'weekly' ? 'This Week' : p === 'monthly' ? 'This Month' : 'All Time'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-2xl p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-1/4 mb-1"></div>
                        <div className="h-3 bg-gray-100 rounded w-1/6"></div>
                      </div>
                      <div className="h-6 bg-gray-200 rounded w-12"></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full mb-4 bg-white border border-gray-200 p-1 h-auto flex flex-wrap justify-center gap-1">
              <TabsTrigger 
                value="engagement" 
                className="data-[state=active]:bg-purple-600 data-[state=active]:text-white px-3 py-1.5 text-sm"
                data-testid="tab-engagement"
              >
                <TrendingUp size={14} className="mr-1" />
                Engagers
              </TabsTrigger>
              <TabsTrigger 
                value="games" 
                className="data-[state=active]:bg-purple-600 data-[state=active]:text-white px-3 py-1.5 text-sm"
                data-testid="tab-games"
              >
                <Target size={14} className="mr-1" />
                Games
              </TabsTrigger>
              <TabsTrigger 
                value="consumption" 
                className="data-[state=active]:bg-purple-600 data-[state=active]:text-white px-3 py-1.5 text-sm"
                data-testid="tab-consumption"
              >
                <Star size={14} className="mr-1" />
                Media
              </TabsTrigger>
            </TabsList>

            <TabsContent value="engagement">
              {renderCategoryCard(
                'Top Engagers',
                TrendingUp,
                leaderboardData?.categories?.overall,
                'Top Engagers',
                'Start posting and engaging to appear here!',
                'from-purple-600 to-pink-600'
              )}
            </TabsContent>

            <TabsContent value="games">
              {renderCategoryCard(
                'Trivia Champions',
                Brain,
                leaderboardData?.categories?.trivia,
                'Trivia',
                'No trivia results yet. Play some trivia!',
                'from-yellow-500 to-orange-500',
                { label: 'Play Trivia', href: '/play/trivia' },
                true
              )}
              
              {renderCategoryCard(
                'Poll Masters',
                Target,
                leaderboardData?.categories?.polls,
                'Polls',
                'No poll activity yet. Vote on some polls!',
                'from-blue-500 to-cyan-500',
                { label: 'Do Polls', href: '/play/polls' },
                true
              )}
              
              {/* Awards Section */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
                <div className="bg-gradient-to-r from-amber-500 to-yellow-500 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="text-white" size={20} />
                      <h3 className="text-base font-bold text-white">Awards</h3>
                    </div>
                    <Link 
                      href="/play/awards"
                      className="text-white/90 hover:text-white text-sm font-medium flex items-center gap-1"
                      data-testid="link-awards-action"
                    >
                      All Awards →
                    </Link>
                  </div>
                </div>
                
                {awardsEvents && awardsEvents.filter(e => !e.name.toLowerCase().includes('golden')).length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {awardsEvents.filter(e => !e.name.toLowerCase().includes('golden')).map(event => {
                      const isExpanded = expandedAwards.has(event.id);
                      const leaders = awardsLeaderboards?.[event.id] || [];
                      
                      return (
                        <div key={event.id}>
                          <button
                            onClick={() => toggleAwardsExpanded(event.id)}
                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                            data-testid={`button-expand-${event.slug}`}
                          >
                            <div className="flex items-center gap-3">
                              <Trophy size={18} className="text-amber-500" />
                              <span className="font-medium text-gray-900">{event.year} {event.name}{event.name.includes('Academy Awards') ? ' (Oscars)' : ''}</span>
                              {event.status === 'open' && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Open</span>
                              )}
                              {event.status === 'locked' && (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">Locked</span>
                              )}
                            </div>
                            {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                          </button>
                          
                          {isExpanded && (
                            <div className="bg-gray-50 border-t border-gray-100">
                              {leaders.length > 0 ? (
                                <div className="divide-y divide-gray-100">
                                  {leaders.map((entry, index) => {
                                    const isCurrentUser = entry.user_id === currentUserId;
                                    const rankColors = ['bg-yellow-400', 'bg-gray-300', 'bg-amber-600'];
                                    
                                    return (
                                      <div
                                        key={entry.user_id}
                                        className={`flex items-center gap-4 p-4 ${isCurrentUser ? 'bg-purple-50' : ''}`}
                                      >
                                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                                          {index < 3 ? (
                                            <div className={`w-8 h-8 rounded-full ${rankColors[index]} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                                              {index + 1}
                                            </div>
                                          ) : (
                                            <span className="text-gray-500 font-semibold text-sm">#{index + 1}</span>
                                          )}
                                        </div>
                                        
                                        <Link 
                                          href={`/user/${entry.user_id}`}
                                          className="flex-1 min-w-0"
                                        >
                                          <p className={`font-semibold text-sm truncate ${isCurrentUser ? 'text-purple-700' : 'text-gray-900'}`}>
                                            {entry.display_name}
                                            {isCurrentUser && <span className="ml-2 text-xs text-purple-600">(You)</span>}
                                          </p>
                                          <p className="text-xs text-gray-500">@{entry.username}</p>
                                        </Link>
                                        
                                        <div className="text-right">
                                          <p className="font-bold text-amber-600">{entry.picks_count} picks</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="p-6 text-center text-gray-500 text-sm">
                                  No ballots submitted yet. Be the first!
                                </div>
                              )}
                              
                              <div className="p-3 border-t border-gray-100 bg-white">
                                <Link 
                                  href={`/play/awards/${event.slug}`}
                                  className="w-full block text-center py-2 text-sm text-amber-600 hover:text-amber-700 font-medium"
                                  data-testid={`link-make-picks-${event.slug}`}
                                >
                                  Make Your Picks →
                                </Link>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    <p className="text-sm">No awards events available yet.</p>
                  </div>
                )}
              </div>
              
              {renderCategoryCard(
                'Prediction Pros',
                Trophy,
                leaderboardData?.categories?.predictions,
                'Predictions',
                'No predictions resolved yet. Make some predictions!',
                'from-green-500 to-emerald-500',
                { label: 'Do Predictions', href: '/play/predictions' },
                true
              )}
              
            </TabsContent>

            <TabsContent value="consumption">
              <div className="mb-4">
                {renderCategoryCard(
                  'Total Consumption Leaders',
                  Star,
                  leaderboardData?.categories?.total_consumption,
                  'Total Consumption',
                  'Track some media to appear here!',
                  'from-purple-600 to-blue-600'
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderCategoryCard(
                  'Bookworms',
                  BookOpen,
                  leaderboardData?.categories?.books,
                  'Books',
                  'No books tracked yet',
                  'from-amber-600 to-yellow-500'
                )}
                
                {renderCategoryCard(
                  'Movie Buffs',
                  Film,
                  leaderboardData?.categories?.movies,
                  'Movies',
                  'No movies tracked yet',
                  'from-red-500 to-pink-500'
                )}
                
                {renderCategoryCard(
                  'TV Marathoners',
                  Tv,
                  leaderboardData?.categories?.tv,
                  'TV',
                  'No TV shows tracked yet',
                  'from-indigo-500 to-purple-500'
                )}
                
                {renderCategoryCard(
                  'Music Lovers',
                  Music,
                  leaderboardData?.categories?.music,
                  'Music',
                  'No music tracked yet',
                  'from-pink-500 to-rose-500'
                )}
                
                {renderCategoryCard(
                  'Podcast Listeners',
                  Headphones,
                  leaderboardData?.categories?.podcasts,
                  'Podcasts',
                  'No podcasts tracked yet',
                  'from-violet-500 to-purple-500'
                )}
                
                {renderCategoryCard(
                  'Gamers',
                  Gamepad2,
                  leaderboardData?.categories?.games,
                  'Games',
                  'No games tracked yet',
                  'from-emerald-500 to-teal-500'
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
