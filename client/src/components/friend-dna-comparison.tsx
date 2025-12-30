import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, Sparkles, Loader2, Lock, Film, Tv, BookOpen, Music, Heart, X, Download, Share2, Send, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";

interface ComparisonResult {
  match_score: number;
  shared_genres: string[];
  shared_creators: string[];
  shared_titles: { title: string; media_type: string }[];
  differences: {
    user_unique: string[];
    friend_unique: string[];
  };
  insights: {
    compatibilityLine?: string;
    consumeTogether?: {
      movies?: string[];
      tv?: string[];
      books?: string[];
      podcasts?: string[];
      music?: string[];
    };
    // Legacy fields for backwards compatibility
    enjoyTogether?: string[];
    theyCouldIntroduce?: string[];
    youCouldIntroduce?: string[];
  };
  friend_name: string;
  friend_dna_label?: string;
  friend_dna_tagline?: string;
  your_dna_label?: string;
  your_dna_tagline?: string;
}

interface FriendWithEligibility {
  id: string;
  user_name: string;
  avatar_url?: string;
  itemCount: number;
  isEligible: boolean;
  hasSurvey?: boolean;
}

interface FriendDNAComparisonSectionProps {
  dnaLevel: 0 | 1 | 2;
  itemCount: number;
  hasSurvey?: boolean;
}

export function FriendDNAComparison({ dnaLevel, itemCount, hasSurvey = false }: FriendDNAComparisonSectionProps) {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const [friends, setFriends] = useState<FriendWithEligibility[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);

  const canCompare = hasSurvey && dnaLevel >= 2;
  const appUrl = import.meta.env.VITE_APP_URL || 'https://consumed.app';

  // Split friends into eligible and almost eligible
  const eligibleFriends = friends.filter(f => f.isEligible);
  const almostEligibleFriends = friends.filter(f => !f.isEligible && f.itemCount > 0);

  // Helper functions for displaying comparison
  const getMatchColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-purple-600';
  };

  const getMatchEmoji = (score: number) => {
    if (score >= 90) return '🔥';
    if (score >= 80) return '⭐';
    if (score >= 70) return '✨';
    if (score >= 60) return '💫';
    return '🌟';
  };

  const getMediaIcon = (type: string) => {
    const typeL = type?.toLowerCase();
    if (typeL?.includes('movie') || typeL?.includes('film')) return <Film size={12} />;
    if (typeL?.includes('tv') || typeL?.includes('show')) return <Tv size={12} />;
    if (typeL?.includes('book')) return <BookOpen size={12} />;
    if (typeL?.includes('music') || typeL?.includes('album')) return <Music size={12} />;
    return <Heart size={12} />;
  };

  // Fetch friends with their item counts when component mounts and user is Level 2
  useEffect(() => {
    const fetchFriends = async () => {
      if (!session?.access_token || !user?.id || dnaLevel < 2) return;
      
      setIsLoadingFriends(true);
      try {
        // Fetch friendships directly
        const response = await fetch(
          `https://mahpgcogwpawvviapqza.supabase.co/rest/v1/friendships?or=(user_id.eq.${user.id},friend_id.eq.${user.id})&status=eq.accepted`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
          }
        );
        
        const friendships = await response.json();
        console.log('Friendships fetched:', friendships);
        
        if (!Array.isArray(friendships) || friendships.length === 0) {
          setFriends([]);
          return;
        }
        
        // Get unique friend IDs
        const friendIdsRaw = friendships.map((f: any) => 
          f.user_id === user.id ? f.friend_id : f.user_id
        ).filter((id: string) => id !== user.id);
        const friendIds = [...new Set(friendIdsRaw)]; // Remove duplicates
        
        console.log('Friend IDs:', friendIds);
        
        if (friendIds.length === 0) {
          setFriends([]);
          return;
        }
        
        // Fetch user details for friends (use 'avatar' not 'avatar_url')
        const usersResponse = await fetch(
          `https://mahpgcogwpawvviapqza.supabase.co/rest/v1/users?id=in.(${friendIds.join(',')})&select=id,user_name,avatar`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
          }
        );
        
        const usersData = await usersResponse.json();
        console.log('Friends data:', usersData);
        
        // Count list_items for each friend to get their tracked item count
        // We need to count items in lists owned by each friend
        const statsMap: Record<string, number> = {};
        
        // Fetch lists for all friends first
        const listsResponse = await fetch(
          `https://mahpgcogwpawvviapqza.supabase.co/rest/v1/lists?user_id=in.(${friendIds.join(',')})&select=id,user_id`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
          }
        );
        
        const listsData = await listsResponse.json();
        console.log('Friends lists:', listsData);
        
        if (Array.isArray(listsData) && listsData.length > 0) {
          // Map list IDs to user IDs
          const listToUserMap: Record<string, string> = {};
          listsData.forEach((l: any) => {
            listToUserMap[l.id] = l.user_id;
          });
          
          const listIds = listsData.map((l: any) => l.id);
          
          // Count items in those lists
          const itemsResponse = await fetch(
            `https://mahpgcogwpawvviapqza.supabase.co/rest/v1/list_items?list_id=in.(${listIds.join(',')})&select=list_id`,
            {
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              },
            }
          );
          
          const itemsData = await itemsResponse.json();
          console.log('Friends items count:', Array.isArray(itemsData) ? itemsData.length : 0);
          
          if (Array.isArray(itemsData)) {
            itemsData.forEach((item: any) => {
              const userId = listToUserMap[item.list_id];
              if (userId) {
                statsMap[userId] = (statsMap[userId] || 0) + 1;
              }
            });
          }
        }
        
        console.log('Stats map:', statsMap);
        
        // Fetch DNA profiles to check if they completed survey
        const dnaResponse = await fetch(
          `https://mahpgcogwpawvviapqza.supabase.co/rest/v1/dna_profiles?user_id=in.(${friendIds.join(',')})&select=user_id`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
          }
        );
        
        const dnaData = await dnaResponse.json();
        const hasSurveyMap: Record<string, boolean> = {};
        if (Array.isArray(dnaData)) {
          dnaData.forEach((d: any) => {
            hasSurveyMap[d.user_id] = true;
          });
        }
        
        if (Array.isArray(usersData)) {
          const friendList = usersData.map((u: any) => {
            const itemCount = statsMap[u.id] || 0;
            const friendHasSurvey = hasSurveyMap[u.id] || false;
            return {
              id: u.id,
              user_name: u.user_name || 'Unknown',
              avatar_url: u.avatar, // Map 'avatar' to 'avatar_url' for consistency
              itemCount,
              hasSurvey: friendHasSurvey,
              isEligible: itemCount >= 30 && friendHasSurvey,
            };
          });
          console.log('Friend list with eligibility:', friendList);
          setFriends(friendList);
        }
      } catch (err) {
        console.error('Error fetching friends:', err);
      } finally {
        setIsLoadingFriends(false);
      }
    };
    
    fetchFriends();
  }, [dnaLevel, session?.access_token, user?.id]);

  // Handle friend selection and comparison
  const handleSelectFriend = async (friendId: string) => {
    if (!session?.access_token || !canCompare) return;

    // If clicking the same friend, deselect
    if (selectedFriendId === friendId) {
      setSelectedFriendId(null);
      setComparison(null);
      setCompareError(null);
      return;
    }

    setSelectedFriendId(friendId);
    setIsComparing(true);
    setCompareError(null);
    setComparison(null);

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
        setComparison(data);
      } else {
        const errorData = await response.json();
        setCompareError(errorData.error || 'Failed to compare DNA');
      }
    } catch (err) {
      console.error('Error comparing DNA:', err);
      setCompareError('Failed to compare DNA');
    } finally {
      setIsComparing(false);
    }
  };

  // Download card as image
  const handleDownload = async (cardRef: React.RefObject<HTMLDivElement>, cardName: string) => {
    if (!cardRef.current) return;
    
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
        scale: 3,
      });
      
      const link = document.createElement('a');
      link.download = `dna-${cardName}-${selectedFriend?.user_name || 'friend'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      toast({
        title: "Downloaded!",
        description: `Your DNA ${cardName} card has been saved.`,
      });
    } catch (err) {
      console.error('Error downloading:', err);
      toast({
        title: "Download failed",
        description: "Could not generate the image. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Share card
  const handleShare = async (cardRef: React.RefObject<HTMLDivElement>, cardName: string) => {
    if (!cardRef.current || !comparison) return;
    
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
        scale: 3,
      });
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        
        const file = new File([blob], `dna-${cardName}.png`, { type: 'image/png' });
        
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'My Entertainment DNA Match',
            text: `I have a ${comparison.match_score}% entertainment DNA match with ${selectedFriend?.user_name}! 🧬`,
            files: [file],
          });
        } else {
          handleDownload(cardRef, cardName);
          toast({
            title: "Sharing not supported",
            description: "The image has been downloaded instead.",
          });
        }
      });
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  // Nudge a friend to complete their profile
  const handleNudgeFriend = async (friend: FriendWithEligibility) => {
    const itemsNeeded = Math.max(0, 30 - friend.itemCount);
    const message = friend.hasSurvey 
      ? `Hey ${friend.user_name}! 🧬 I want to compare our Entertainment DNA on consumed, but you need to log ${itemsNeeded} more items first. Let's see how compatible our taste is! ${appUrl}`
      : `Hey ${friend.user_name}! 🧬 I want to compare our Entertainment DNA on consumed! Complete the DNA survey and log 30 items so we can see how compatible our taste is! ${appUrl}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Compare our Entertainment DNA!',
          text: message,
        });
      } catch (err) {
        // User cancelled or error
        await navigator.clipboard.writeText(message);
        toast({
          title: "Message copied!",
          description: "Share it with your friend to nudge them.",
        });
      }
    } else {
      await navigator.clipboard.writeText(message);
      toast({
        title: "Message copied!",
        description: "Share it with your friend to nudge them.",
      });
    }
  };

  const selectedFriend = friends.find(f => f.id === selectedFriendId);

  // Locked state for Level 0-1
  if (dnaLevel < 2) {
    const itemsNeeded = Math.max(0, 30 - itemCount);
    return (
      <div className="mt-4 bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="text-blue-500" size={20} />
          <h4 className="font-semibold text-gray-900">Friend DNA Comparisons</h4>
          <Badge className="bg-blue-100 text-blue-700 text-xs ml-auto">Level 2</Badge>
        </div>
        
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <Lock size={24} className="text-gray-400" />
          </div>
          <h5 className="font-semibold text-gray-700 mb-2">Friend Comparisons Locked</h5>
          <p className="text-sm text-gray-500 mb-4 max-w-xs">
            Compare your entertainment DNA with friends and get "Watch Together" recommendations
          </p>
          {!hasSurvey ? (
            <div className="w-full max-w-xs">
              <p className="text-sm text-purple-600 font-medium">
                Complete the DNA survey to start unlocking
              </p>
            </div>
          ) : (
            <div className="w-full max-w-xs">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Progress to Level 2</span>
                <span className="font-medium text-purple-600">{itemCount} / 30</span>
              </div>
              <Progress value={(itemCount / 30) * 100} className="h-2" />
              <p className="text-xs text-gray-500 mt-2">
                Log <span className="font-semibold text-purple-600">{itemsNeeded} more items</span> to unlock
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Level 2 - Show friend pills and inline comparison
  return (
    <div className="mt-4 bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="text-blue-500" size={20} />
        <h4 className="font-semibold text-gray-900">Friend DNA Comparisons</h4>
        <Badge className="bg-green-100 text-green-700 text-xs ml-auto">Unlocked</Badge>
      </div>
      
      {isLoadingFriends ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="animate-spin text-purple-500" size={24} />
          <span className="ml-2 text-sm text-gray-500">Loading friends...</span>
        </div>
      ) : friends.length === 0 ? (
        <div className="text-center py-6">
          <Users size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-600 mb-1">No friends to compare with yet!</p>
          <p className="text-xs text-gray-500 mb-4">Add friends from the Friends tab to compare your entertainment DNA</p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              window.history.pushState({}, '', '/me?tab=friends');
              window.dispatchEvent(new PopStateEvent('popstate'));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="border-purple-200 hover:border-purple-300 hover:bg-purple-50"
            data-testid="button-go-to-friends"
          >
            <Users size={14} className="mr-2 text-purple-600" />
            Go to Friends
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Eligible Friend Pills */}
          {eligibleFriends.length > 0 && (
            <div>
              <p className="text-sm text-gray-600 mb-3">Select a friend to compare entertainment DNA:</p>
              <div className="flex flex-wrap gap-2">
                {eligibleFriends.map((friend) => (
                  <button
                    key={friend.id}
                    onClick={() => handleSelectFriend(friend.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full border-2 transition-all ${
                      selectedFriendId === friend.id
                        ? 'border-purple-500 bg-purple-100 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50'
                    }`}
                    data-testid={`pill-friend-${friend.id}`}
                  >
                    <div className="w-6 h-6 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 text-xs font-semibold overflow-hidden">
                      {friend.avatar_url ? (
                        <img src={friend.avatar_url} alt={friend.user_name} className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        friend.user_name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-800">{friend.user_name}</span>
                    {selectedFriendId === friend.id && (
                      <X size={14} className="text-gray-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Inline Comparison Results - Show immediately after friend selection */}
          {selectedFriendId && (
            <div className="border-t border-gray-200 pt-4">
              {isComparing && (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="animate-spin text-purple-600 mb-3" size={32} />
                  <p className="text-sm text-gray-600">Comparing your DNA with {selectedFriend?.user_name}...</p>
                  <p className="text-xs text-gray-400 mt-1">This may take a moment</p>
                </div>
              )}

              {compareError && (
                <div className="text-center py-6">
                  <p className="text-sm text-red-600 mb-3">{compareError}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => selectedFriendId && handleSelectFriend(selectedFriendId)}
                    data-testid="button-retry-compare"
                  >
                    Try Again
                  </Button>
                </div>
              )}

              {!isComparing && !compareError && comparison && (
                <div className="space-y-6">
                  {/* CARD 1: The Match */}
                  <div className="space-y-3">
                    <div 
                      ref={card1Ref}
                      className="bg-gradient-to-br from-purple-50 via-indigo-50 to-pink-50 rounded-xl p-5 border border-purple-200 mx-auto"
                      style={{ maxWidth: '320px' }}
                    >
                      {/* Part 1 indicator */}
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-purple-500 font-medium">🧬 consumed</p>
                        <Badge className="bg-purple-100 text-purple-700 text-xs">Part 1 of 2</Badge>
                      </div>

                      {/* Match Score */}
                      <div className="text-center mb-4">
                        <div className="text-5xl font-bold mb-1">
                          <span className={getMatchColor(comparison.match_score)}>
                            {comparison.match_score}%
                          </span>
                          <span className="ml-2">{getMatchEmoji(comparison.match_score)}</span>
                        </div>
                        <p className="text-gray-600 font-semibold text-base">Entertainment DNA Match</p>
                      </div>

                      {/* DNA Labels with Avatars */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-white/80 rounded-xl p-3 border border-purple-100 text-center">
                          <div className="w-12 h-12 rounded-full bg-purple-200 mx-auto mb-2 flex items-center justify-center text-purple-700 font-bold text-lg overflow-hidden">
                            {user?.user_metadata?.avatar_url ? (
                              <img src={user.user_metadata.avatar_url} alt="You" className="w-12 h-12 rounded-full object-cover" />
                            ) : (
                              user?.email?.charAt(0).toUpperCase() || 'Y'
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mb-0.5">You</p>
                          <p className="font-semibold text-purple-800 text-xs leading-tight">
                            {comparison.your_dna_label || 'Your DNA'}
                          </p>
                        </div>
                        <div className="bg-white/80 rounded-xl p-3 border border-indigo-100 text-center">
                          <div className="w-12 h-12 rounded-full bg-indigo-200 mx-auto mb-2 flex items-center justify-center text-indigo-700 font-bold text-lg overflow-hidden">
                            {selectedFriend?.avatar_url ? (
                              <img src={selectedFriend.avatar_url} alt={selectedFriend.user_name} className="w-12 h-12 rounded-full object-cover" />
                            ) : (
                              selectedFriend?.user_name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mb-0.5">{selectedFriend?.user_name}</p>
                          <p className="font-semibold text-indigo-800 text-xs leading-tight">
                            {comparison.friend_dna_label || 'Their DNA'}
                          </p>
                        </div>
                      </div>

                      {/* Compatibility Line */}
                      {comparison.insights?.compatibilityLine && (
                        <p className="text-sm text-purple-700 text-center italic bg-white/60 rounded-lg p-3 mb-4">
                          "{comparison.insights.compatibilityLine}"
                        </p>
                      )}

                      {/* Shared Content */}
                      {comparison.shared_titles?.length > 0 && (
                        <div className="mb-3">
                          <h5 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                            <Heart size={12} className="text-red-500" />
                            You Both Love
                          </h5>
                          <div className="flex flex-wrap gap-1">
                            {comparison.shared_titles.slice(0, 4).map((item, idx) => (
                              <Badge key={idx} className="bg-white/80 text-gray-700 text-xs border border-gray-200">
                                {item.title}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Shared Genres */}
                      {comparison.shared_genres?.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-gray-700 mb-2">Shared Genres</h5>
                          <div className="flex flex-wrap gap-1">
                            {comparison.shared_genres.slice(0, 5).map((genre, idx) => (
                              <Badge key={idx} className="bg-purple-100/80 text-purple-700 text-xs">
                                {genre}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Footer CTA */}
                      <div className="pt-4 mt-4 border-t border-purple-100 text-center">
                        <p className="text-xs text-gray-500">Find your entertainment match at</p>
                        <p className="text-sm font-semibold text-purple-600">consumed.app</p>
                      </div>
                    </div>

                    {/* Card 1 Action Buttons */}
                    <div className="flex gap-2 justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(card1Ref, 'match')}
                        className="border-purple-200 hover:border-purple-300"
                        data-testid="button-download-card1"
                      >
                        <Download size={14} className="mr-2" />
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleShare(card1Ref, 'match')}
                        className="border-purple-200 hover:border-purple-300"
                        data-testid="button-share-card1"
                      >
                        <Share2 size={14} className="mr-2" />
                        Share
                      </Button>
                    </div>
                  </div>

                  {/* CARD 2: The Exchange */}
                  <div className="space-y-3">
                    <div 
                      ref={card2Ref}
                      className="bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 rounded-xl p-5 border border-amber-200 mx-auto"
                      style={{ maxWidth: '320px' }}
                    >
                      {/* Part 2 indicator */}
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-amber-600 font-medium">🧬 consumed</p>
                        <Badge className="bg-amber-100 text-amber-700 text-xs">Part 2 of 2</Badge>
                      </div>

                      {/* Header */}
                      <div className="text-center mb-4">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Heart size={20} className="text-rose-500" />
                          <span className="text-xl font-bold text-gray-800">Consume Together</span>
                        </div>
                        <p className="text-gray-600 text-sm">Based on what you both love</p>
                      </div>

                      {/* Consume Together Recommendations */}
                      {(() => {
                        const consumeTogether = comparison.insights?.consumeTogether;
                        const hasRecommendations = consumeTogether && (
                          (consumeTogether.movies?.length || 0) > 0 ||
                          (consumeTogether.tv?.length || 0) > 0 ||
                          (consumeTogether.books?.length || 0) > 0 ||
                          (consumeTogether.podcasts?.length || 0) > 0 ||
                          (consumeTogether.music?.length || 0) > 0
                        );

                        if (!hasRecommendations) {
                          // Fallback to legacy format
                          const enjoyTogether = comparison.insights?.enjoyTogether;
                          return enjoyTogether && enjoyTogether.length > 0 && (
                            <div className="bg-white/80 rounded-xl p-4 border border-amber-100">
                              <h5 className="text-sm font-semibold text-amber-800 mb-2">Recommendations</h5>
                              <ul className="space-y-1">
                                {enjoyTogether.slice(0, 4).map((suggestion, idx) => (
                                  <li key={idx} className="text-xs text-amber-700">• {suggestion}</li>
                                ))}
                              </ul>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            {/* Movies */}
                            {consumeTogether.movies && consumeTogether.movies.length > 0 && (
                              <div className="bg-white/80 rounded-xl p-3 border border-rose-100">
                                <h5 className="text-xs font-semibold text-rose-700 mb-2 flex items-center gap-1.5">
                                  <Film size={12} /> Movies
                                </h5>
                                <div className="flex flex-wrap gap-1.5">
                                  {consumeTogether.movies.map((title, idx) => (
                                    <Badge key={idx} className="text-xs bg-rose-100 text-rose-800 border border-rose-200">
                                      {title}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* TV Shows */}
                            {consumeTogether.tv && consumeTogether.tv.length > 0 && (
                              <div className="bg-white/80 rounded-xl p-3 border border-purple-100">
                                <h5 className="text-xs font-semibold text-purple-700 mb-2 flex items-center gap-1.5">
                                  <Tv size={12} /> TV Shows
                                </h5>
                                <div className="flex flex-wrap gap-1.5">
                                  {consumeTogether.tv.map((title, idx) => (
                                    <Badge key={idx} className="text-xs bg-purple-100 text-purple-800 border border-purple-200">
                                      {title}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Books */}
                            {consumeTogether.books && consumeTogether.books.length > 0 && (
                              <div className="bg-white/80 rounded-xl p-3 border border-blue-100">
                                <h5 className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
                                  <BookOpen size={12} /> Books
                                </h5>
                                <div className="flex flex-wrap gap-1.5">
                                  {consumeTogether.books.map((title, idx) => (
                                    <Badge key={idx} className="text-xs bg-blue-100 text-blue-800 border border-blue-200">
                                      {title}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Podcasts */}
                            {consumeTogether.podcasts && consumeTogether.podcasts.length > 0 && (
                              <div className="bg-white/80 rounded-xl p-3 border border-green-100">
                                <h5 className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1.5">
                                  🎙️ Podcasts
                                </h5>
                                <div className="flex flex-wrap gap-1.5">
                                  {consumeTogether.podcasts.map((title, idx) => (
                                    <Badge key={idx} className="text-xs bg-green-100 text-green-800 border border-green-200">
                                      {title}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Music */}
                            {consumeTogether.music && consumeTogether.music.length > 0 && (
                              <div className="bg-white/80 rounded-xl p-3 border border-amber-100">
                                <h5 className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
                                  <Music size={12} /> Music
                                </h5>
                                <div className="flex flex-wrap gap-1.5">
                                  {consumeTogether.music.map((title, idx) => (
                                    <Badge key={idx} className="text-xs bg-amber-100 text-amber-800 border border-amber-200">
                                      {title}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Footer CTA */}
                      <div className="pt-4 mt-4 border-t border-amber-100 text-center">
                        <p className="text-xs text-gray-500">Find your entertainment match at</p>
                        <p className="text-sm font-semibold text-amber-600">consumed.app</p>
                      </div>
                    </div>

                    {/* Card 2 Action Buttons */}
                    <div className="flex gap-2 justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(card2Ref, 'exchange')}
                        className="border-amber-200 hover:border-amber-300"
                        data-testid="button-download-card2"
                      >
                        <Download size={14} className="mr-2" />
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleShare(card2Ref, 'exchange')}
                        className="border-amber-200 hover:border-amber-300"
                        data-testid="button-share-card2"
                      >
                        <Share2 size={14} className="mr-2" />
                        Share
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No eligible friends message */}
          {eligibleFriends.length === 0 && almostEligibleFriends.length > 0 && (
            <div className="text-center py-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600">
                None of your friends are ready for DNA comparison yet.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Nudge them below to complete their profiles! 👇
              </p>
            </div>
          )}

          {/* Almost Eligible Friends - Nudge Section (Single Column) */}
          {almostEligibleFriends.length > 0 && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-200">
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle size={16} className="text-amber-600" />
                <h5 className="text-sm font-semibold text-amber-800">
                  {almostEligibleFriends.length === 1 ? 'This friend is' : 'These friends are'} almost ready!
                </h5>
              </div>
              <div className="space-y-3">
                {almostEligibleFriends.slice(0, 6).map((friend) => {
                  const itemsNeeded = Math.max(0, 30 - friend.itemCount);
                  const needsSurvey = !friend.hasSurvey;
                  return (
                    <div 
                      key={friend.id}
                      className="bg-white/80 rounded-lg p-3 border border-amber-100 flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 text-sm font-semibold overflow-hidden">
                          {friend.avatar_url ? (
                            <img src={friend.avatar_url} alt={friend.user_name} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            friend.user_name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-800">{friend.user_name}</p>
                      </div>
                      <p className="text-xs text-amber-600">
                        {needsSurvey 
                          ? `Needs survey${itemsNeeded > 0 ? ` + ${itemsNeeded} items` : ''}`
                          : `${itemsNeeded} more items`
                        }
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleNudgeFriend(friend)}
                        className="border-amber-300 hover:bg-amber-100 text-amber-700 text-xs self-start"
                        data-testid={`button-nudge-${friend.id}`}
                      >
                        <Send size={12} className="mr-1" />
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
  );
}

// Keep the button component for use in other places if needed
export function FriendDNACompareButton({ 
  friendId, 
  friendName, 
  userDnaLevel, 
  userItemCount,
  hasSurvey = false
}: {
  friendId: string;
  friendName: string;
  friendAvatar?: string;
  userDnaLevel: 0 | 1 | 2;
  userItemCount: number;
  hasSurvey?: boolean;
}) {
  const canCompare = hasSurvey && userDnaLevel >= 2;

  if (!canCompare) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        disabled
        className="opacity-60"
        data-testid="button-compare-dna-locked"
      >
        <Lock size={14} className="mr-2" />
        Compare DNA
        <Badge className="ml-2 bg-emerald-100 text-emerald-700 text-xs">L2</Badge>
      </Button>
    );
  }

  return (
    <Button 
      variant="outline" 
      size="sm"
      onClick={() => {
        window.history.pushState({}, '', '/me?tab=dna');
        window.dispatchEvent(new PopStateEvent('popstate'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      className="border-purple-200 hover:border-purple-300 hover:bg-purple-50"
      data-testid="button-compare-dna"
    >
      <Users size={14} className="mr-2 text-purple-600" />
      Compare DNA
    </Button>
  );
}

export function FriendDNALockMessage({ itemCount }: { itemCount: number }) {
  const itemsNeeded = Math.max(0, 30 - itemCount);
  
  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 text-center">
      <Lock size={16} className="text-gray-400 flex-shrink-0" />
      <p className="text-xs text-gray-600">
        Log <span className="font-semibold text-purple-600">{itemsNeeded} more items</span> to unlock Friend DNA Comparisons
      </p>
    </div>
  );
}
