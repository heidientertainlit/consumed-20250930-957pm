import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search as SearchIcon, Sparkles, Loader2, Film, Music, BookOpen, Tv, X, TrendingUp, Heart, Target, User, Plus, Users, Download, RefreshCw, Share2, Dna, Mic, Gamepad2, Clock, BarChart3, Send, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MediaCarousel from "@/components/media-carousel";
import Navigation from "@/components/navigation";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { QuickAddListSheet } from "@/components/quick-add-list-sheet";
import DNAVisualization from "@/components/dna-visualization";
import { supabase } from "@/lib/supabase";
import html2canvas from "html2canvas";

interface Recommendation {
  title: string;
  type: string;
  media_subtype?: string; // album, song, series, episode
  description: string;
  searchTerm?: string;
  poster_url?: string;
  external_id?: string;
  external_source?: string;
  year?: string;
}

interface DirectResult {
  id: string;
  title: string;
  type: string;
  media_subtype?: string; // album, song, series, episode
  description?: string;
  year?: number;
  rating?: number;
  poster_url?: string;
  detailUrl?: string;
  external_id?: string;
  external_source?: string;
}

interface ConversationResult {
  id: string;
  user_name: string;
  content: string;
  content_type: string;
  created_at: string;
  engagement_count?: number;
}

interface UserResult {
  id: string;
  user_name: string;
  display_name?: string;
  email?: string;
}

interface SearchResult {
  type: 'conversational' | 'direct' | 'error';
  explanation?: string;
  recommendations?: Recommendation[];
  searchSuggestions?: string[];
  results?: DirectResult[];
  message?: string;
  conversations?: ConversationResult[];
  mediaResults?: DirectResult[];
}

// Helper function to deduplicate media items based on their unique identifier
function deduplicateMediaItems<T extends { id: string; externalId?: string; externalSource?: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.externalId && item.externalSource
      ? `${item.externalSource}-${item.externalId}`
      : item.id;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export default function Search() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAiMode, setIsAiMode] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddMedia, setQuickAddMedia] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'stats' | 'summary' | 'compare' | 'history'>('stats');
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const comparisonCardRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const summaryCardRef = useRef<HTMLDivElement>(null);
  const { session, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user stats
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

  // Fetch DNA profile
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

  // Fetch media history (items from lists)
  const { data: mediaHistory = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ['media-history-dna', user?.id],
    queryFn: async () => {
      if (!session?.access_token || !user?.id) return [];
      const { data, error } = await supabase
        .from('list_items')
        .select(`
          id,
          title,
          media_type,
          image_url,
          created_at,
          lists!inner(user_id, title)
        `)
        .eq('lists.user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) return [];
      return data || [];
    },
    enabled: !!session?.access_token && !!user?.id,
    staleTime: 60000,
  });

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

  const handleRegenerateDna = async () => {
    setIsRegenerating(true);
    try {
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/generate-dna-profile', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: user?.id }),
      });
      if (response.ok) {
        await refetchDna();
        toast({ title: "Regenerated!", description: "Your DNA profile has been updated" });
      } else {
        throw new Error('Failed to regenerate');
      }
    } catch (error) {
      toast({ title: "Error", description: "Could not regenerate DNA", variant: "destructive" });
    } finally {
      setIsRegenerating(false);
    }
  };

  const getMediaIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'movie': return <Film size={14} className="text-pink-400" />;
      case 'tv': return <Tv size={14} className="text-blue-400" />;
      case 'music': return <Music size={14} className="text-green-400" />;
      case 'book': return <BookOpen size={14} className="text-orange-400" />;
      case 'podcast': return <Mic size={14} className="text-purple-400" />;
      case 'game': return <Gamepad2 size={14} className="text-red-400" />;
      default: return <Film size={14} className="text-gray-400" />;
    }
  };

  // Get user DNA level and item count
  const itemCount = userStats?.totalItems || 0;
  const hasSurvey = !!dnaProfile;
  const dnaLevel = hasSurvey && itemCount >= 30 ? 2 : hasSurvey || itemCount >= 10 ? 1 : 0;
  const canCompare = hasSurvey && dnaLevel >= 2;

  // Fetch friends with eligibility for comparison
  const { data: friends = [], isLoading: isLoadingFriends } = useQuery({
    queryKey: ['compare-friends', user?.id],
    queryFn: async () => {
      if (!session?.access_token || !user?.id) return [];
      
      // Fetch friendships
      const { data: friendships, error: fErr } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted');
      
      if (fErr || !friendships?.length) return [];
      
      // Get unique friend IDs
      const friendIds = [...new Set(friendships.map((f: any) => 
        f.user_id === user.id ? f.friend_id : f.user_id
      ).filter((id: string) => id !== user.id))];
      
      if (!friendIds.length) return [];
      
      // Fetch user details
      const { data: usersData } = await supabase
        .from('users')
        .select('id, user_name, avatar')
        .in('id', friendIds);
      
      // Fetch DNA profiles
      const { data: dnaData } = await supabase
        .from('dna_profiles')
        .select('user_id')
        .in('user_id', friendIds);
      
      const hasSurveyMap: Record<string, boolean> = {};
      dnaData?.forEach((d: any) => { hasSurveyMap[d.user_id] = true; });
      
      // Fetch lists and item counts
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

  // Fetch Netflix Top TV Shows
  const { data: netflixTVShows = [] } = useQuery({
    queryKey: ['netflix-top-tv'],
    queryFn: async () => {
      try {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/get-flixpatrol-platform`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ platform: 'netflix', mediaType: 'tv' })
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data.map((item: any) => ({
          ...item,
          externalId: item.id,
          externalSource: 'tmdb',
          mediaSubtype: 'series'
        }));
      } catch (error) {
        console.error('Error fetching Netflix TV shows:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 60 * 6,
  });

  // Fetch HBO Max Top TV Shows
  const { data: hboTVShows = [] } = useQuery({
    queryKey: ['hbo-top-tv'],
    queryFn: async () => {
      try {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/get-flixpatrol-platform`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ platform: 'hbo', mediaType: 'tv' })
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data.map((item: any) => ({
          ...item,
          externalId: item.id,
          externalSource: 'tmdb',
          mediaSubtype: 'series'
        }));
      } catch (error) {
        console.error('Error fetching HBO TV shows:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 60 * 6,
  });

  // Fetch Netflix Top Movies
  const { data: netflixMovies = [] } = useQuery({
    queryKey: ['netflix-top-movies'],
    queryFn: async () => {
      try {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/get-flixpatrol-platform`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ platform: 'netflix', mediaType: 'movie' })
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data.map((item: any) => ({
          ...item,
          externalId: item.id,
          externalSource: 'tmdb'
        }));
      } catch (error) {
        console.error('Error fetching Netflix movies:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 60 * 6,
  });

  // Fetch Paramount+ Top Movies
  const { data: paramountMovies = [] } = useQuery({
    queryKey: ['paramount-top-movies'],
    queryFn: async () => {
      try {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/get-flixpatrol-platform`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ platform: 'paramount', mediaType: 'movie' })
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data.map((item: any) => ({
          ...item,
          externalId: item.id,
          externalSource: 'tmdb'
        }));
      } catch (error) {
        console.error('Error fetching Paramount movies:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 60 * 6,
  });

  // Fetch Top Gaming (using Twitch/IGDB via placeholder - will use trending games)
  const { data: topGames = [] } = useQuery({
    queryKey: ['top-games'],
    queryFn: async () => {
      // Placeholder - in real implementation, integrate with IGDB or Twitch API
      // For now, return some popular games
      return [
        { id: '1', title: 'Elden Ring', imageUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co4jni.jpg', mediaType: 'game' },
        { id: '2', title: 'The Last of Us Part II', imageUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co2f3r.jpg', mediaType: 'game' },
        { id: '3', title: 'Baldurs Gate 3', imageUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co5y7n.jpg', mediaType: 'game' },
        { id: '4', title: 'Zelda: Tears of the Kingdom', imageUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co5vmg.jpg', mediaType: 'game' },
        { id: '5', title: 'God of War Ragnarök', imageUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co5s5v.jpg', mediaType: 'game' },
      ];
    },
    staleTime: 1000 * 60 * 60 * 24, // Cache for 24 hours
  });

  // Fetch trending TV shows
  const { data: trendingTVShows = [] } = useQuery({
    queryKey: ['trending-tv-shows'],
    queryFn: async () => {
      try {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/get-trending-tv`, {
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data.map((item: any) => ({
          ...item,
          externalId: item.id,
          externalSource: 'tmdb',
          mediaSubtype: 'series'
        }));
      } catch (error) {
        console.error('Error fetching trending TV shows:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 60,
  });

  // Fetch trending movies
  const { data: trendingMovies = [] } = useQuery({
    queryKey: ['trending-movies'],
    queryFn: async () => {
      try {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/get-trending-movies`, {
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data.map((item: any) => ({
          ...item,
          externalId: item.id,
          externalSource: 'tmdb'
        }));
      } catch (error) {
        console.error('Error fetching trending movies:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 60,
  });

  // Fetch bestseller books
  const { data: bestsellerBooks = [] } = useQuery({
    queryKey: ['bestseller-books'],
    queryFn: async () => {
      try {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/get-bestseller-books`, {
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data.map((item: any) => ({
          ...item,
          externalId: item.id,
          externalSource: item.source || 'openlibrary'
        }));
      } catch (error) {
        console.error('Error fetching bestseller books:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 60 * 24,
  });

  // Fetch trending podcasts
  const { data: trendingPodcasts = [] } = useQuery({
    queryKey: ['trending-podcasts'],
    queryFn: async () => {
      try {
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/get-trending-podcasts`, {
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data.map((item: any) => ({
          ...item,
          externalId: item.id,
          externalSource: 'spotify',
          mediaSubtype: 'show' // podcasts are shows
        }));
      } catch (error) {
        console.error('Error fetching trending podcasts:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 60 * 12,
  });

  // Fetch personalized recommendations (same endpoint as Feed)
  const { data: recommendedContent = [] } = useQuery({
    queryKey: ['recommendations'],
    enabled: !!session?.access_token,
    queryFn: async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/get-recommendations`, {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) return [];
        const data = await response.json();
        
        // Transform to match MediaCarousel format
        const recommendations = data.recommendations || [];
        return recommendations.map((rec: any) => ({
          id: `${rec.external_source}-${rec.external_id}`,
          title: rec.title,
          imageUrl: rec.image_url,
          rating: rec.confidence,
          year: rec.year,
          mediaType: rec.media_type,
          mediaSubtype: rec.media_subtype || (rec.media_type === 'tv' ? 'series' : rec.media_type === 'music' ? 'album' : null),
          externalId: rec.external_id,
          externalSource: rec.external_source,
          type: rec.media_type
        }));
      } catch (error) {
        console.error('Error fetching recommendations:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 60 * 6,
  });

  // Quick search - media results (only when NOT in AI mode)
  const { data: quickMediaResults = [], isLoading: isLoadingMedia } = useQuery({
    queryKey: ['quick-media-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim() || !session?.access_token) return [];
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/media-search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery })
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.results || [];
    },
    enabled: !isAiMode && !!searchQuery.trim() && !!session?.access_token,
    staleTime: 1000 * 60 * 5,
  });

  // Quick search - user results (only when NOT in AI mode)
  const { data: quickUserResults = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['quick-user-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim() || !session?.access_token) return [];
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/manage-friendships`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'searchUsers', query: searchQuery })
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.users || [];
    },
    enabled: !isAiMode && !!searchQuery.trim() && !!session?.access_token,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch current friends to check status
  const { data: friendsData } = useQuery({
    queryKey: ['friends-list-search'],
    queryFn: async () => {
      if (!session?.access_token) return { friends: [], pending: [] };
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/manage-friendships`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'getFriends' })
      });
      if (!response.ok) return { friends: [], pending: [] };
      return response.json();
    },
    enabled: !!session?.access_token,
    staleTime: 1000 * 60 * 2,
  });

  // Create sets of friend IDs for quick lookup
  const friendIds = new Set((friendsData?.friends || []).map((f: any) => f.id));
  const pendingIds = new Set((friendsData?.pending || []).map((f: any) => f.id));

  // Send friend request mutation
  const sendFriendRequestMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!session?.access_token) throw new Error('Not authenticated');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/manage-friendships`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'sendRequest', friendId: targetUserId })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Friend request error:', errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to send friend request');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Friend request sent!" });
      queryClient.invalidateQueries({ queryKey: ['quick-user-search'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friends-list-search'] });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message || "Could not send friend request", variant: "destructive" });
    },
  });

  const handleSearch = async () => {
    if (!searchQuery.trim() || !session?.access_token) return;

    setIsSearching(true);
    setSearchResults(null);

    try {
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/conversational-search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery
        })
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const result = await response.json();
      setSearchResults(result);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults({
        type: 'error',
        message: 'Search is currently unavailable. Please try again later.'
      });
    } finally {
      setIsSearching(false);
    }
  };

  const resetSearch = () => {
    setSearchResults(null);
    setSearchQuery("");
  };

  const handleMediaClick = (item: any) => {
    const type = item.mediaType || item.type;
    const source = item.externalSource || 'tmdb';
    const id = item.externalId || item.id;
    
    if (type && source && id) {
      setLocation(`/media/${type}/${source}/${id}`);
    }
  };

  const handleResultClick = (result: DirectResult) => {
    if (result.detailUrl) {
      setLocation(result.detailUrl);
    } else if (result.external_id && result.external_source) {
      setLocation(`/media/${result.type}/${result.external_source}/${result.external_id}`);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navigation />
      
      {/* Dark Gradient Header Section - matches Activity page nav blend */}
      <div className="bg-gradient-to-r from-[#0a0a0f] via-[#12121f] to-[#2d1f4e] pt-8 pb-8 px-4 -mt-px">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-white mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Your Entertainment DNA
            </h1>
          </div>

          {/* Unified Search Bar with AI Mode Toggle */}
          <div className="bg-white rounded-2xl p-3 shadow-lg">
            <div className="flex items-center gap-2">
              <SearchIcon className="text-gray-400 ml-2 flex-shrink-0" size={20} />
              <Input
                type="text"
                placeholder={isAiMode ? "Ask AI for recommendations..." : "Search friends, movies, TV shows..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isAiMode && !isSearching) {
                    handleSearch();
                  }
                }}
                className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-gray-900 placeholder:text-gray-400"
                autoFocus
                data-testid="unified-search-input"
              />
              <button
                onClick={() => {
                  setIsAiMode(!isAiMode);
                  setSearchResults(null); // Clear AI results when toggling
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all flex-shrink-0 ${
                  isAiMode 
                    ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white" 
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                data-testid="toggle-ai-mode"
              >
                <Sparkles size={14} />
                AI Mode
              </button>
            </div>
          </div>

          {/* Explanatory Text - only show when AI mode is on */}
          {isAiMode && (
            <div className="text-center text-sm text-gray-400">
              <p>Ask for recommendations like "movies similar to Inception" or "uplifting podcasts"</p>
            </div>
          )}

          {/* DNA Visualization */}
          {!isAiMode && !searchQuery.trim() && (
            <div className="mt-6">
              <DNAVisualization />
            </div>
          )}

        </div>
      </div>
      
      {/* Main Content Area - Light Background */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Pill Filters - styled like the screenshot */}
        {!isAiMode && !searchQuery.trim() && (
          <div className="flex gap-2 overflow-x-auto pb-2 -mt-2">
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === 'stats'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-purple-300'
              }`}
            >
              <BarChart3 size={14} />
              Stats
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === 'summary'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-purple-300'
              }`}
            >
              <Dna size={14} />
              Summary
            </button>
            <button
              onClick={() => setActiveTab('compare')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === 'compare'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-purple-300'
              }`}
            >
              <Users size={14} />
              Compare
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === 'history'
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-purple-300'
              }`}
            >
              <Clock size={14} />
              History
            </button>
          </div>
        )}

        {/* Tab Content - only show when not searching */}
        {!isAiMode && !searchQuery.trim() && (
          <>
            {/* Stats Tab */}
            {activeTab === 'stats' && (
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
                        <p className="text-lg font-bold text-purple-600">{userStats.movies || 0}</p>
                        <p className="text-xs text-gray-500">Movies</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-blue-600">{userStats.tv_shows || 0}</p>
                        <p className="text-xs text-gray-500">TV Shows</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-green-600">{userStats.books || 0}</p>
                        <p className="text-xs text-gray-500">Books</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold text-pink-600">{userStats.music || '0h'}</p>
                        <p className="text-xs text-gray-500">Music</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-orange-600">{userStats.podcasts || '0h'}</p>
                        <p className="text-xs text-gray-500">Podcasts</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-red-600">{userStats.games || 0}</p>
                        <p className="text-xs text-gray-500">Games</p>
                      </div>
                    </div>
                    <div className="border-t pt-3 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-base font-bold text-gray-900">{userStats.total_hours || 0}h</p>
                        <p className="text-xs text-gray-500">Total Hours</p>
                      </div>
                      <div>
                        <p className="text-base font-bold text-gray-900">{userStats.avg_rating || '-'}</p>
                        <p className="text-xs text-gray-500">Avg Rating</p>
                      </div>
                      <div>
                        <p className="text-base font-bold text-gray-900">{userStats.day_streak || 0}</p>
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
            )}

            {/* Summary Tab */}
            {activeTab === 'summary' && (
              <div className="space-y-3">
                {isLoadingDna ? (
                  <div className="bg-white rounded-xl p-4 flex justify-center border border-gray-100">
                    <Loader2 className="animate-spin text-purple-600" size={24} />
                  </div>
                ) : dnaProfile ? (
                  <>
                    {/* Shareable Card */}
                    <div 
                      ref={summaryCardRef}
                      className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100"
                    >
                      <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500"></div>
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

                    {/* Action Buttons */}
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
                      <Button
                        onClick={handleRegenerateDna}
                        disabled={isRegenerating}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1.5 text-xs"
                      >
                        <RefreshCw size={14} className={isRegenerating ? 'animate-spin' : ''} />
                        {isRegenerating ? '...' : 'Regenerate'}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="bg-white rounded-xl p-4 text-center border border-gray-100">
                    <Dna className="mx-auto mb-2 text-purple-300" size={32} />
                    <h3 className="font-semibold text-gray-900 text-sm mb-1">No DNA Profile Yet</h3>
                    <p className="text-gray-500 text-xs mb-3">Take the DNA survey to generate your unique entertainment identity</p>
                    <Button
                      onClick={() => setLocation('/entertainment-dna')}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs"
                    >
                      Take DNA Survey
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Compare Tab */}
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

            {/* Media History Tab */}
            {activeTab === 'history' && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <h2 className="text-base font-semibold text-gray-900 mb-3">Media History</h2>
                {isLoadingHistory ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="animate-spin text-purple-600" size={24} />
                  </div>
                ) : mediaHistory.length > 0 ? (
                  <div className="space-y-2">
                    {mediaHistory.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-2.5 p-2 bg-gray-50 rounded-lg">
                        <div className="w-10 h-14 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {getMediaIcon(item.media_type)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            {getMediaIcon(item.media_type)}
                            <span className="capitalize">{item.media_type || 'Media'}</span>
                            <span>•</span>
                            <span>{new Date(item.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <Clock className="mx-auto mb-2 text-gray-300" size={28} />
                    <p className="text-sm">No media tracked yet</p>
                    <p className="text-xs mt-0.5">Add movies, shows, and more to see your history</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* AI Search Loading State */}
        {isAiMode && isSearching && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-100">
            <div className="flex items-center gap-3">
              <Loader2 className="animate-spin text-purple-600" size={20} />
              <div>
                <p className="font-semibold text-purple-900">AI is analyzing your request...</p>
                <p className="text-purple-700 text-sm">This may take 10-30 seconds</p>
              </div>
            </div>
          </div>
        )}

        {/* AI Search Button (only show when in AI mode and has query) */}
        {isAiMode && searchQuery.trim() && !isSearching && !searchResults && (
          <div className="flex justify-center">
            <Button
              onClick={handleSearch}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6"
              data-testid="ai-search-submit"
            >
              <Sparkles size={16} className="mr-2" />
              Get AI Recommendations
            </Button>
          </div>
        )}

        {/* Quick Search Results */}
        {!isAiMode && (
          <>
            {searchQuery.trim() && (
              <div className="space-y-6">
                {/* Loading */}
                {(isLoadingMedia || isLoadingUsers) && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-purple-600" size={24} />
                    <span className="ml-2 text-gray-600">Searching...</span>
                  </div>
                )}

                {/* User Results */}
                {!isLoadingUsers && quickUserResults.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Users size={16} className="text-purple-600" />
                        People
                      </h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {quickUserResults.slice(0, 5).map((userResult: UserResult) => (
                        <div
                          key={userResult.id}
                          className="flex items-center justify-between gap-3 p-4 hover:bg-gray-50"
                          data-testid={`user-result-${userResult.id}`}
                        >
                          <div
                            onClick={() => setLocation(`/user/${userResult.id}`)}
                            className="flex items-center gap-3 flex-1 cursor-pointer"
                          >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                              {userResult.display_name?.[0] || userResult.user_name[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 truncate">
                                {userResult.display_name || userResult.user_name}
                              </p>
                              <p className="text-sm text-gray-500 truncate">@{userResult.user_name}</p>
                            </div>
                          </div>
                          {userResult.id !== user?.id && (
                            friendIds.has(userResult.id) ? (
                              <span className="text-sm text-green-600 font-medium px-3 py-1 bg-green-50 rounded-full">
                                Friends
                              </span>
                            ) : pendingIds.has(userResult.id) ? (
                              <span className="text-sm text-gray-500 font-medium px-3 py-1 bg-gray-100 rounded-full">
                                Pending
                              </span>
                            ) : (
                              <Button
                                onClick={() => sendFriendRequestMutation.mutate(userResult.id)}
                                size="sm"
                                variant="outline"
                                className="border-purple-300 text-purple-700 hover:bg-purple-50"
                                disabled={sendFriendRequestMutation.isPending}
                                data-testid={`add-friend-${userResult.id}`}
                              >
                                <Plus size={14} className="mr-1" />
                                Add
                              </Button>
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Media Results */}
                {!isLoadingMedia && quickMediaResults.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Film size={16} className="text-purple-600" />
                        Media
                      </h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {quickMediaResults.slice(0, 8).map((result: any, idx: number) => (
                        <div
                          key={`${result.external_id || result.id}-${idx}`}
                          className="flex items-center gap-3 p-4 hover:bg-gray-50"
                          data-testid={`media-result-${idx}`}
                        >
                          <div 
                            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                            onClick={() => {
                              const type = result.type || 'movie';
                              const source = result.source || result.external_source || 'tmdb';
                              const id = result.external_id || result.id;
                              if (type && source && id) {
                                setLocation(`/media/${type}/${source}/${id}`);
                              }
                            }}
                          >
                            {(result.image_url || result.poster_path || result.image) ? (
                              <img
                                src={result.image_url || result.poster_path || result.image}
                                alt={result.title}
                                className="w-12 h-16 object-cover rounded-lg flex-shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                {getMediaIcon(result.type || 'movie')}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 truncate">{result.title}</p>
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span className="capitalize">{result.type}</span>
                                {result.year && <span>• {result.year}</span>}
                              </div>
                              {result.creator && (
                                <p className="text-xs text-gray-400 truncate">{result.creator}</p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuickAddMedia({
                                title: result.title,
                                mediaType: result.type || 'movie',
                                imageUrl: result.image_url || result.poster_path || result.image,
                                externalId: result.external_id || result.id,
                                externalSource: result.external_source || result.source || 'tmdb',
                                creator: result.creator,
                              });
                              setIsQuickAddOpen(true);
                            }}
                            className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center flex-shrink-0 transition-colors"
                            data-testid={`add-media-${idx}`}
                          >
                            <Plus size={20} className="text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Results */}
                {!isLoadingMedia && !isLoadingUsers && quickMediaResults.length === 0 && quickUserResults.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <SearchIcon size={32} className="mx-auto mb-2 opacity-50" />
                    <p>No results found for "{searchQuery}"</p>
                  </div>
                )}
              </div>
            )}

          </>
        )}

        {/* AI Search - Example Prompts (when no query/results) */}
        {isAiMode && !searchResults && !isSearching && !searchQuery.trim() && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-gray-600 text-sm font-medium mb-3">Try asking:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                "Shows like The Bear",
                "What are people saying about Bridgerton?",
                "Movies for a rainy Sunday",
                "Did my friends like Project Hail Mary?",
                "Hot takes on DWTS finale"
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => {
                    setSearchQuery(example);
                  }}
                  className="text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-700 text-sm transition-colors"
                  data-testid={`example-query-${example.substring(0, 10)}`}
                >
                  "{example}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* AI Search Results */}
        {isAiMode && searchResults && (
          <div className="space-y-6">
              {searchResults.type === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-800">{searchResults.message}</p>
                </div>
              )}

              {/* SECTION 1: Recommended for You */}
              {searchResults.recommendations && searchResults.recommendations.length > 0 && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xl font-bold text-black flex items-center gap-2">
                      🎯 Recommended for You
                    </h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">Based on what you're searching for</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {searchResults.recommendations.slice(0, 6).map((rec, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          if (rec.external_id && rec.external_source) {
                            setLocation(`/media/${rec.type}/${rec.external_source}/${rec.external_id}`);
                          }
                        }}
                        className={`bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 border border-gray-200 hover:border-purple-400 hover:shadow-md transition-all ${
                          rec.external_id ? 'cursor-pointer' : ''
                        }`}
                        data-testid={`recommendation-${idx}`}
                      >
                        <div className="flex gap-4">
                          {rec.poster_url ? (
                            <img
                              src={rec.poster_url}
                              alt={rec.title}
                              className="w-20 h-28 object-cover rounded-lg shadow-sm flex-shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-20 h-28 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              {getMediaIcon(rec.type)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h5 className="font-bold text-black text-base mb-1">{rec.title}</h5>
                            {rec.year && (
                              <p className="text-xs text-gray-600 mb-2">📅 {rec.year}</p>
                            )}
                            <p className="text-sm text-gray-700 line-clamp-2 mb-2">{rec.description}</p>
                            <span className="inline-block text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
                              {rec.type}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION 2: What People Are Saying */}
              {searchResults.conversations && searchResults.conversations.length > 0 && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xl font-bold text-black flex items-center gap-2">
                      💬 What People Are Saying About "{searchQuery}"
                    </h4>
                  </div>
                  <div className="space-y-3">
                    {searchResults.conversations.slice(0, 5).map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() => setLocation('/activity')}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-purple-400 transition-colors cursor-pointer"
                        data-testid={`conversation-${conv.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                            {conv.user_name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-black">@{conv.user_name}</p>
                            <p className="text-sm text-gray-700 mt-1 line-clamp-2">{conv.content}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                                {conv.content_type}
                              </span>
                              {conv.engagement_count && conv.engagement_count > 0 && (
                                <span className="text-xs text-gray-500">
                                  {conv.engagement_count} {conv.engagement_count === 1 ? 'reaction' : 'reactions'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Conversation Results Message - when query is conversation-focused but no results */}
              {(() => {
                const conversationKeywords = ['hot take', 'what are people saying', 'opinion', 'thoughts on', 'discussion', 'talk about', 'saying about', 'reviews on', 'reactions to'];
                const isConversationQuery = conversationKeywords.some(keyword => searchQuery.toLowerCase().includes(keyword));
                const hasNoConversations = !searchResults.conversations || searchResults.conversations.length === 0;
                
                return isConversationQuery && hasNoConversations && searchResults.type !== 'error' ? (
                  <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className="text-center py-6">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <TrendingUp className="text-gray-400" size={28} />
                      </div>
                      <h4 className="text-lg font-semibold text-black mb-2">No Conversations Yet</h4>
                      <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
                        No one has posted about "{searchQuery}" yet. Be the first to start the conversation!
                      </p>
                      <Button
                        onClick={() => setLocation('/activity')}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                        data-testid="start-conversation"
                      >
                        Start a Conversation →
                      </Button>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          )}

      </div>

      <QuickAddListSheet
        isOpen={isQuickAddOpen}
        onClose={() => {
          setIsQuickAddOpen(false);
          setQuickAddMedia(null);
        }}
        media={quickAddMedia}
      />
    </div>
  );
}
