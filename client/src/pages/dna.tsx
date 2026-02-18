import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Film, Tv, Users, Download, Share2, Dna, Sparkles, Clock, BarChart3, Send, Lock, Heart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/navigation";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import html2canvas from "html2canvas";
import { RecommendationsGlimpse } from "@/components/recommendations-glimpse";

export default function DnaPage() {
  const [activeTab, setActiveTab] = useState<'dna' | 'compare'>('dna');
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const summaryCardRef = useRef<HTMLDivElement>(null);
  const comparisonCardRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { session, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: userStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['user-stats-dna', user?.id],
    queryFn: async () => {
      if (!session?.access_token || !user?.id) return null;
      const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-stats?user_id=${user.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.stats;
    },
    enabled: !!session?.access_token && !!user?.id,
    staleTime: 60000,
  });

  const { data: dnaProfile, isLoading: isLoadingDna, refetch: refetchDna } = useQuery({
    queryKey: ['dna-profile-summary', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('dna_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });

  const itemCount = userStats ? 
    (userStats.moviesWatched || 0) + (userStats.tvShowsWatched || 0) + (userStats.booksRead || 0) + (userStats.gamesPlayed || 0) : 0;
  const hasSurvey = !!dnaProfile;
  const dnaLevel = hasSurvey && itemCount >= 30 ? 2 : hasSurvey || itemCount >= 10 ? 1 : 0;
  const canCompare = hasSurvey && dnaLevel >= 2;

  const { data: friends = [], isLoading: isLoadingFriends } = useQuery({
    queryKey: ['compare-friends', user?.id],
    queryFn: async () => {
      if (!session?.access_token || !user?.id) return [];
      
      const { data: friendships, error: fErr } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted');
      
      if (fErr || !friendships?.length) return [];
      
      const friendIds = [...new Set(friendships.map((f: any) => 
        f.user_id === user.id ? f.friend_id : f.user_id
      ).filter((id: string) => id !== user.id))];
      
      if (!friendIds.length) return [];
      
      const { data: usersData } = await supabase
        .from('users')
        .select('id, user_name, avatar')
        .in('id', friendIds);
      
      const { data: dnaData } = await supabase
        .from('dna_profiles')
        .select('user_id')
        .in('user_id', friendIds);
      
      const hasSurveyMap: Record<string, boolean> = {};
      dnaData?.forEach((d: any) => { hasSurveyMap[d.user_id] = true; });
      
      const { data: listsData } = await supabase
        .from('lists')
        .select('id, user_id')
        .in('user_id', friendIds);
      
      const statsMap: Record<string, number> = {};
      if (listsData?.length) {
        const listIds = listsData.map(l => l.id);
        const listToUserMap: Record<string, string> = {};
        listsData.forEach(l => { listToUserMap[l.id] = l.user_id; });
        
        const { data: itemsData } = await supabase
          .from('list_items')
          .select('list_id')
          .in('list_id', listIds);
        
        itemsData?.forEach((item: any) => {
          const userId = listToUserMap[item.list_id];
          if (userId) statsMap[userId] = (statsMap[userId] || 0) + 1;
        });
      }
      
      return (usersData || []).map((u: any) => {
        const count = statsMap[u.id] || 0;
        const friendHasSurvey = hasSurveyMap[u.id] || false;
        return {
          id: u.id,
          user_name: u.user_name || 'Unknown',
          avatar_url: u.avatar,
          itemCount: count,
          hasSurvey: friendHasSurvey,
          isEligible: count >= 30 && friendHasSurvey,
        };
      });
    },
    enabled: !!session?.access_token && !!user?.id && dnaLevel >= 2,
    staleTime: 60000,
  });

  const eligibleFriends = friends.filter((f: any) => f.isEligible);
  const almostEligibleFriends = friends.filter((f: any) => !f.isEligible && f.itemCount > 0);
  const selectedFriend = friends.find((f: any) => f.id === selectedFriendId);

  const handleSelectFriend = async (friendId: string) => {
    if (!session?.access_token || !canCompare) return;
    
    if (selectedFriendId === friendId) {
      setSelectedFriendId(null);
      setComparisonResult(null);
      setCompareError(null);
      return;
    }
    
    setSelectedFriendId(friendId);
    setIsComparing(true);
    setCompareError(null);
    setComparisonResult(null);
    
    try {
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/compare-dna-friend',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ friend_id: friendId }),
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setComparisonResult(data);
      } else {
        const errorData = await response.json();
        setCompareError(errorData.error || 'Failed to compare DNA');
      }
    } catch (err) {
      setCompareError('Failed to compare DNA');
    } finally {
      setIsComparing(false);
    }
  };

  const handleDownloadSummary = async () => {
    if (!summaryCardRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(summaryCardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
      });
      const link = document.createElement('a');
      link.download = 'my-entertainment-dna.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast({ title: "Saved!", description: "Your DNA summary is ready to share" });
    } catch (error) {
      toast({ title: "Error", description: "Could not save image", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShareSummary = async () => {
    if (navigator.share && dnaProfile) {
      try {
        await navigator.share({
          title: 'My Entertainment DNA',
          text: `I'm a "${dnaProfile.label}" - ${dnaProfile.tagline}. Check out my entertainment DNA on Consumed!`,
          url: window.location.origin,
        });
      } catch (error) {
        navigator.clipboard.writeText(`I'm a "${dnaProfile?.label}" - ${dnaProfile?.tagline}. Check out my entertainment DNA on Consumed!`);
        toast({ title: "Copied!", description: "Share text copied to clipboard" });
      }
    } else {
      navigator.clipboard.writeText(`I'm a "${dnaProfile?.label}" - ${dnaProfile?.tagline}. Check out my entertainment DNA on Consumed!`);
      toast({ title: "Copied!", description: "Share text copied to clipboard" });
    }
  };

  const handleDownloadComparison = async () => {
    if (!comparisonCardRef.current) return;
    try {
      const canvas = await html2canvas(comparisonCardRef.current, { scale: 3, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `dna-match-${selectedFriend?.user_name || 'friend'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast({ title: "Saved!", description: "Your DNA match card is ready to share" });
    } catch (error) {
      toast({ title: "Error", description: "Could not save image", variant: "destructive" });
    }
  };

  const handleShareComparison = async () => {
    if (!comparisonCardRef.current || !comparisonResult) return;
    try {
      const canvas = await html2canvas(comparisonCardRef.current, { scale: 3, backgroundColor: '#ffffff' });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'dna-match.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'My Entertainment DNA Match',
            text: `I have a ${comparisonResult.match_score}% entertainment DNA match with ${selectedFriend?.user_name}! 🧬`,
            files: [file],
          });
        } else {
          handleDownloadComparison();
        }
      });
    } catch (error) {
      navigator.clipboard.writeText(`I have a ${comparisonResult.match_score}% entertainment DNA match with ${selectedFriend?.user_name}!`);
      toast({ title: "Copied!", description: "Share text copied to clipboard" });
    }
  };

  const handleNudgeFriend = async (friend: any) => {
    const itemsNeeded = Math.max(0, 30 - friend.itemCount);
    const appUrl = window.location.origin;
    const message = friend.hasSurvey 
      ? `Hey ${friend.user_name}! 🧬 I want to compare our Entertainment DNA on Consumed, but you need to log ${itemsNeeded} more items first. Let's see how compatible our taste is! ${appUrl}`
      : `Hey ${friend.user_name}! 🧬 I want to compare our Entertainment DNA on Consumed! Complete the DNA survey and log 30 items so we can see how compatible our taste is! ${appUrl}`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Compare our Entertainment DNA!', text: message });
      } catch {
        await navigator.clipboard.writeText(message);
        toast({ title: "Copied!", description: "Share message copied to clipboard" });
      }
    } else {
      await navigator.clipboard.writeText(message);
      toast({ title: "Copied!", description: "Share message copied to clipboard" });
    }
  };

  const getMatchColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-purple-600';
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navigation />
      <div>
        <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] pt-8 pb-5 px-4 -mt-px text-center">
          <p className="text-purple-400 text-xs font-semibold tracking-[0.3em] uppercase mb-1">Your</p>
          <h2 className="text-white text-xl font-semibold tracking-tight">Entertainment DNA</h2>
          <p className="text-white/50 text-sm mt-1">Discover what your entertainment<br />says about you.</p>

          <div className="flex gap-2 justify-center pt-4 pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <button
              onClick={() => setActiveTab('dna')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === 'dna'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                  : 'bg-white/10 text-white/70 border border-white/20 hover:border-purple-400'
              }`}
            >
              <Dna size={14} />
              My DNA
            </button>
            <button
              onClick={() => setActiveTab('compare')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === 'compare'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                  : 'bg-white/10 text-white/70 border border-white/20 hover:border-purple-400'
              }`}
            >
              <Users size={14} />
              Compare
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 pt-4 pb-6 space-y-4">
          {activeTab === 'dna' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-purple-500 via-blue-500 to-teal-400 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Dna className="text-white" size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm text-white">Complete Your DNA</h3>
                    <p className="text-white/80 text-xs">Answer more questions to unlock personalized insights</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setLocation('/entertainment-dna')}
                      size="sm"
                      className="bg-white text-purple-600 hover:bg-white/90 text-xs font-semibold"
                    >
                      Take DNA Quiz
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <h2 className="text-base font-semibold text-gray-900 mb-3">Your Stats</h2>
                {isLoadingStats ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="animate-spin text-purple-600" size={24} />
                  </div>
                ) : userStats ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold text-purple-600">{userStats.moviesWatched || 0}</p>
                        <p className="text-xs text-gray-500">Movies</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-blue-600">{userStats.tvShowsWatched || 0}</p>
                        <p className="text-xs text-gray-500">TV Shows</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-green-600">{userStats.booksRead || 0}</p>
                        <p className="text-xs text-gray-500">Books</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold text-pink-600">{userStats.musicHours || 0}h</p>
                        <p className="text-xs text-gray-500">Music</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-orange-600">{userStats.podcastHours || 0}h</p>
                        <p className="text-xs text-gray-500">Podcasts</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-red-600">{userStats.gamesPlayed || 0}</p>
                        <p className="text-xs text-gray-500">Games</p>
                      </div>
                    </div>
                    <div className="border-t pt-3 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-base font-bold text-gray-900">{userStats.totalHours || 0}h</p>
                        <p className="text-xs text-gray-500">Total Hours</p>
                      </div>
                      <div>
                        <p className="text-base font-bold text-gray-900">{userStats.averageRating || '-'}</p>
                        <p className="text-xs text-gray-500">Avg Rating</p>
                      </div>
                      <div>
                        <p className="text-base font-bold text-gray-900">{userStats.dayStreak || 0}</p>
                        <p className="text-xs text-gray-500">Day Streak</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <BarChart3 className="mx-auto mb-2 text-gray-300" size={32} />
                    <p className="text-sm">Start tracking to see your stats</p>
                  </div>
                )}
              </div>

              {isLoadingDna ? (
                <div className="bg-white rounded-xl p-4 flex justify-center border border-gray-100">
                  <Loader2 className="animate-spin text-purple-600" size={24} />
                </div>
              ) : dnaProfile ? (
                <>
                  <div 
                    ref={summaryCardRef}
                    className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100"
                  >
                    <div className="p-4">
                      <div className="text-center mb-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-2">
                          <Dna className="text-white" size={20} />
                        </div>
                        <h2 className="text-base font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                          {dnaProfile.label}
                        </h2>
                        <p className="text-gray-600 text-xs mt-0.5">{dnaProfile.tagline}</p>
                      </div>
                      
                      {dnaProfile.profile_text && (
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-3 mb-3">
                          <p className="text-gray-700 text-xs leading-relaxed">{dnaProfile.profile_text}</p>
                        </div>
                      )}

                      {dnaProfile.favorite_genres && dnaProfile.favorite_genres.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-center mb-3">
                          {dnaProfile.favorite_genres.slice(0, 5).map((genre: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                              {genre}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="text-center pt-2 border-t border-gray-100">
                        <p className="text-purple-600 text-xs font-medium">@consumedapp</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={handleDownloadSummary}
                      disabled={isDownloading}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <Download size={14} />
                      {isDownloading ? 'Saving...' : 'Download'}
                    </Button>
                    <Button
                      onClick={handleShareSummary}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <Share2 size={14} />
                      Share
                    </Button>
                  </div>
                </>
              ) : null}

              <RecommendationsGlimpse />
            </div>
          )}

          {activeTab === 'compare' && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Compare DNA</h2>
              
              {!canCompare ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Lock size={20} className="text-gray-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">Comparison Locked</h3>
                  <p className="text-gray-500 text-xs mb-3">
                    {!hasSurvey 
                      ? "Complete the DNA survey to unlock comparisons" 
                      : `Log ${Math.max(0, 30 - itemCount)} more items to unlock`
                    }
                  </p>
                  {!hasSurvey && (
                    <Button
                      onClick={() => setLocation('/entertainment-dna')}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs"
                    >
                      Take DNA Survey
                    </Button>
                  )}
                </div>
              ) : isLoadingFriends ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="animate-spin text-purple-600" size={24} />
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-6">
                  <Users size={28} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-600 mb-1">No friends yet</p>
                  <p className="text-xs text-gray-500 mb-3">Add friends to compare your entertainment DNA</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation('/me?tab=friends')}
                    className="border-purple-200 hover:border-purple-300 text-xs"
                  >
                    <Users size={14} className="mr-1.5" />
                    Find Friends
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {eligibleFriends.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-600 mb-2">Select a friend to compare:</p>
                      <div className="flex flex-wrap gap-2">
                        {eligibleFriends.map((friend: any) => (
                          <button
                            key={friend.id}
                            onClick={() => handleSelectFriend(friend.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all ${
                              selectedFriendId === friend.id
                                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <div className="w-5 h-5 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 text-xs font-medium overflow-hidden">
                              {friend.avatar_url ? (
                                <img src={friend.avatar_url} alt={friend.user_name} className="w-5 h-5 rounded-full object-cover" />
                              ) : (
                                friend.user_name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <span>{friend.user_name}</span>
                            {selectedFriendId === friend.id && <X size={12} />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedFriendId && (
                    <div className="pt-3 border-t border-gray-100">
                      {isComparing && (
                        <div className="flex flex-col items-center py-6">
                          <Loader2 className="animate-spin text-purple-600 mb-2" size={28} />
                          <p className="text-xs text-gray-600">Comparing with {selectedFriend?.user_name}...</p>
                        </div>
                      )}

                      {compareError && (
                        <div className="text-center py-4">
                          <p className="text-xs text-red-600 mb-2">{compareError}</p>
                          <Button variant="outline" size="sm" onClick={() => handleSelectFriend(selectedFriendId)} className="text-xs">
                            Try Again
                          </Button>
                        </div>
                      )}

                      {!isComparing && !compareError && comparisonResult && (
                        <div className="space-y-3">
                          <div 
                            ref={comparisonCardRef}
                            className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4"
                          >
                            <div className="text-center mb-4">
                              <div className={`text-4xl font-bold ${getMatchColor(comparisonResult.match_score)}`}>
                                {comparisonResult.match_score}%
                              </div>
                              <p className="text-gray-600 text-xs mt-1">Entertainment DNA Match</p>
                            </div>

                            <div className="flex items-center justify-center gap-4 mb-4">
                              <div className="text-center">
                                <div className="w-10 h-10 rounded-full bg-purple-200 mx-auto mb-1 flex items-center justify-center text-purple-700 font-semibold text-sm overflow-hidden ring-2 ring-purple-300">
                                  {user?.user_metadata?.avatar_url ? (
                                    <img src={user.user_metadata.avatar_url} alt="You" className="w-10 h-10 rounded-full object-cover" />
                                  ) : (
                                    user?.email?.charAt(0).toUpperCase() || 'Y'
                                  )}
                                </div>
                                <p className="text-xs text-gray-600">You</p>
                              </div>
                              <div className="text-purple-400 text-sm">×</div>
                              <div className="text-center">
                                <div className="w-10 h-10 rounded-full bg-indigo-200 mx-auto mb-1 flex items-center justify-center text-indigo-700 font-semibold text-sm overflow-hidden ring-2 ring-indigo-300">
                                  {selectedFriend?.avatar_url ? (
                                    <img src={selectedFriend.avatar_url} alt={selectedFriend.user_name} className="w-10 h-10 rounded-full object-cover" />
                                  ) : (
                                    selectedFriend?.user_name.charAt(0).toUpperCase()
                                  )}
                                </div>
                                <p className="text-xs text-gray-600">{selectedFriend?.user_name}</p>
                              </div>
                            </div>

                            {comparisonResult.insights?.compatibilityLine && (
                              <p className="text-xs text-purple-700 text-center italic mb-3">
                                "{comparisonResult.insights.compatibilityLine}"
                              </p>
                            )}

                            {comparisonResult.shared_titles?.length > 0 && (
                              <div className="mb-3">
                                <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1">
                                  <Heart size={10} className="text-red-400" /> You both love
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {comparisonResult.shared_titles.slice(0, 4).map((item: any, idx: number) => (
                                    <span key={idx} className="text-xs text-gray-700 bg-white/70 px-2 py-0.5 rounded-full">
                                      {item.title}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {comparisonResult.shared_genres?.length > 0 && (
                              <div className="mb-3">
                                <p className="text-xs text-gray-500 mb-1.5">Shared genres</p>
                                <div className="flex flex-wrap gap-1">
                                  {comparisonResult.shared_genres.slice(0, 5).map((genre: string, idx: number) => (
                                    <span key={idx} className="text-xs text-purple-600 bg-purple-100/60 px-2 py-0.5 rounded-full">
                                      {genre}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {comparisonResult.insights?.consumeTogether && (
                              <div className="pt-2 border-t border-purple-100">
                                <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1">
                                  <Sparkles size={10} className="text-amber-500" /> Watch together
                                </p>
                                <div className="space-y-1">
                                  {comparisonResult.insights.consumeTogether.movies?.slice(0, 2).map((item: string, idx: number) => (
                                    <p key={idx} className="text-xs text-gray-700 flex items-center gap-1">
                                      <Film size={10} className="text-gray-400" /> {item}
                                    </p>
                                  ))}
                                  {comparisonResult.insights.consumeTogether.tv?.slice(0, 2).map((item: string, idx: number) => (
                                    <p key={idx} className="text-xs text-gray-700 flex items-center gap-1">
                                      <Tv size={10} className="text-gray-400" /> {item}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="pt-2 mt-2 border-t border-purple-100 text-center">
                              <p className="text-xs text-gray-400">consumed.app</p>
                            </div>
                          </div>

                          <div className="flex gap-2 justify-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleDownloadComparison}
                              className="border-purple-200 text-purple-600 text-xs"
                            >
                              <Download size={12} className="mr-1" />
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleShareComparison}
                              className="border-purple-200 text-purple-600 text-xs"
                            >
                              <Share2 size={12} className="mr-1" />
                              Share
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {eligibleFriends.length === 0 && almostEligibleFriends.length > 0 && (
                    <div className="text-center py-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600">
                        None of your friends are ready for comparison yet.
                      </p>
                    </div>
                  )}

                  {almostEligibleFriends.length > 0 && (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-3 border border-amber-200">
                      <p className="text-xs font-medium text-amber-800 mb-2">Almost ready to compare:</p>
                      <div className="space-y-2">
                        {almostEligibleFriends.slice(0, 3).map((friend: any) => {
                          const itemsNeeded = Math.max(0, 30 - friend.itemCount);
                          return (
                            <div key={friend.id} className="flex items-center justify-between bg-white/80 rounded-lg p-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 text-xs font-medium overflow-hidden">
                                  {friend.avatar_url ? (
                                    <img src={friend.avatar_url} alt={friend.user_name} className="w-7 h-7 rounded-full object-cover" />
                                  ) : (
                                    friend.user_name.charAt(0).toUpperCase()
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-gray-800">{friend.user_name}</p>
                                  <p className="text-xs text-amber-600">
                                    {!friend.hasSurvey ? 'Needs survey' : `${itemsNeeded} more items`}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleNudgeFriend(friend)}
                                className="border-amber-300 hover:bg-amber-100 text-amber-700 text-xs h-7 px-2"
                              >
                                <Send size={10} className="mr-1" />
                                Nudge
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}