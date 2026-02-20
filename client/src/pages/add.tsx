import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search as SearchIcon, Sparkles, Loader2, Film, Music, BookOpen, Tv, TrendingUp, Plus, Users, Mic, Gamepad2, MessageSquarePlus, Star, ArrowLeft, X } from "lucide-react";
import InlineComposer from "@/components/inline-composer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MediaCarousel from "@/components/media-carousel";
import Navigation from "@/components/navigation";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { QuickAddListSheet } from "@/components/quick-add-list-sheet";
import { QuickAddModal } from "@/components/quick-add-modal";
import CreateListDialog from "@/components/create-list-dialog";
import { supabase } from "@/lib/supabase";
import { CurrentlyConsumingCard } from "@/components/currently-consuming-card";
import { RecommendationsGlimpse } from "@/components/recommendations-glimpse";

function AnimatedWord() {
  const words = [
    { text: "watching", color: "text-violet-400" },
    { text: "reading", color: "text-violet-400" },
    { text: "playing", color: "text-violet-400" },
    { text: "listening to", color: "text-violet-400" },
    { text: "consuming", color: "text-violet-400" },
  ];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsScrolling(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % words.length);
        setIsScrolling(false);
      }, 400);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-block overflow-hidden align-baseline text-sm" style={{ height: '1.4em' }}>
      <span 
        className={`inline-block font-medium ${words[currentIndex].color} transition-transform ease-out ${
          isScrolling ? 'translate-y-full' : 'translate-y-0'
        }`}
        style={{ transitionDuration: '400ms' }}
      >
        {words[currentIndex].text}
      </span>
    </span>
  );
}

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
  const [showComposerModal, setShowComposerModal] = useState(false);
  const [composerDefaultType, setComposerDefaultType] = useState<"thought" | "review" | "prediction" | "hot_take">("thought");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAiMode, setIsAiMode] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddMedia, setQuickAddMedia] = useState<any>(null);
  const [isFullAddModalOpen, setIsFullAddModalOpen] = useState(false);
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [fullAddMedia, setFullAddMedia] = useState<any>(null);
  const { session, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch friends list
  const { data: friendsList = [] } = useQuery({
    queryKey: ['user-friends-home'],
    queryFn: async () => {
      if (!session?.access_token) return [];
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/manage-friendships`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'getFriends' })
      });
      if (!response.ok) return [];
      const data = await response.json();
      return (data.friends || []).map((f: any) => ({
        id: f.friend?.id || f.id,
        display_name: f.friend?.display_name || f.display_name,
        user_name: f.friend?.user_name || f.user_name,
        avatar: f.friend?.avatar || f.avatar,
      }));
    },
    enabled: !!session?.access_token,
    staleTime: 60000,
  });

  const friendIds = new Set((friendsList || []).map((f: any) => f.id).filter(Boolean));

  const { data: friendsConsuming = [] } = useQuery({
    queryKey: ['friends-consuming-add', Array.from(friendIds).sort().join(',')],
    queryFn: async () => {
      if (!session?.access_token) return [];
      const targetIds = friendIds.size > 0 ? Array.from(friendIds) : [];
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/get-friends-consuming`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({ friendIds: targetIds }),
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data.items || [];
      } catch {
        return [];
      }
    },
    enabled: !!session?.access_token,
    staleTime: 60000,
  });

  // Fetch user lists with media for Currently Consuming
  const [currentlyItems, setCurrentlyItems] = useState<any[]>([]);
  const [isLoadingCurrently, setIsLoadingCurrently] = useState(false);

  const fetchCurrentlyItems = async () => {
    if (!session?.access_token || !user?.id) return;
    setIsLoadingCurrently(true);
    try {
      const url = `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-lists-with-media?user_id=${user.id}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        console.log('📺 Currently Consuming - All lists:', data.lists?.map((l: any) => ({ title: l.title, itemCount: l.items?.length })));
        const currentlyList = (data.lists || []).find((list: any) => list.title === 'Currently');
        console.log('📺 Currently list found:', currentlyList?.title, 'Items:', currentlyList?.items?.length);
        if (currentlyList?.items?.length > 0) {
          console.log('📺 First item fields:', JSON.stringify({ 
            id: currentlyList.items[0].id,
            title: currentlyList.items[0].title,
            progress: currentlyList.items[0].progress,
            progress_total: currentlyList.items[0].progress_total,
            progress_mode: currentlyList.items[0].progress_mode,
            image_url: currentlyList.items[0].image_url?.substring(0, 50),
          }));
        }
        setCurrentlyItems(currentlyList?.items?.slice(0, 10) || []);
      } else {
        console.error('📺 Failed to fetch lists:', response.status);
      }
    } catch (error) {
      console.error('Error fetching currently items:', error);
    } finally {
      setIsLoadingCurrently(false);
    }
  };

  useEffect(() => {
    if (session?.access_token && user?.id) {
      fetchCurrentlyItems();
    }
  }, [session?.access_token, user?.id]);

  // Update progress mutation for Currently Consuming items
  const updateProgressMutation = useMutation({
    mutationFn: async ({ itemId, progress, total, mode, progressDisplay }: { itemId: string; progress: number; total?: number; mode: string; progressDisplay: string }) => {
      if (!session?.access_token) throw new Error('Not authenticated');
      const payload = {
        item_id: itemId,
        progress,
        progress_total: total,
        progress_mode: mode,
      };
      console.log('📝 Updating progress:', payload);
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/update-item-progress',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );
      const responseData = await response.json();
      console.log('📝 Progress update response:', response.status, responseData);
      if (!response.ok) throw new Error(responseData?.error || 'Failed to update progress');
      return { ...responseData, progressDisplay };
    },
    onSuccess: (data) => {
      toast({ title: `Progress updated to ${data.progressDisplay}` });
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      fetchCurrentlyItems();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update progress", variant: "destructive" });
    },
  });

  // Move item to different list mutation
  const moveToListMutation = useMutation({
    mutationFn: async ({ itemId, targetList, listName }: { itemId: string; targetList: string; listName: string }) => {
      if (!session?.access_token) throw new Error('Not authenticated');
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/move-item-to-list',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            item_id: itemId,
            target_list: targetList,
          }),
        }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to move item');
      }
      return { ...await response.json(), listName };
    },
    onSuccess: (data) => {
      toast({ title: `Moved to ${data.listName}` });
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      fetchCurrentlyItems();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to move item", variant: "destructive" });
    },
  });

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
      return (data.results || []).map((r: any) => ({
        ...r,
        image_url: r.image_url || r.poster_url || r.image || r.poster_path || '',
      }));
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

  // Create sets of friend IDs for quick lookup (reuse friendIds from above)
  const friendIdsFromData = new Set((friendsData?.friends || []).map((f: any) => f.id));
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
    <div className="min-h-screen bg-gradient-to-b from-[#08080d] via-[#0f0f1a] via-[#1a1530] to-[#2d1f4e] pb-24">
      <Navigation />
      
      {/* Hero - Purple Gradient with search */}
      <div className="pt-12 pb-12 px-4 -mt-px">
        <div className="text-center mb-8" style={{ fontFamily: 'Poppins, sans-serif' }}>
          <h1 className="text-white text-2xl font-bold tracking-tight mb-4">All your entertainment.<br />All in one place.</h1>
          <p className="text-purple-400 text-xs font-semibold tracking-[0.25em] uppercase">ADD MEDIA. BUILD YOUR DNA.</p>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-2xl p-3 shadow-lg max-w-xl mx-auto">
          <div className="flex items-center gap-2">
            <SearchIcon className="text-gray-400 ml-2 flex-shrink-0" size={20} />
            <Input
              type="text"
              placeholder={isAiMode ? "Ask AI for recommendations..." : "add a movie, book, game..."}
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
                setSearchResults(null);
              }}
              className="flex-shrink-0 p-1 transition-all"
              data-testid="toggle-ai-mode"
            >
              <Sparkles size={18} className={isAiMode ? "text-purple-600" : "text-gray-300"} />
            </button>
          </div>
        </div>
        
        {/* AI Mode hint */}
        {isAiMode && (
          <div className="text-center text-sm text-purple-300/60 mt-2">
            <p>Ask for recommendations like "movies similar to Inception"</p>
          </div>
        )}

      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 pt-4 pb-6 space-y-4">

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
                            {(result.poster_url || result.image_url || result.poster_path || result.image) ? (
                              <img
                                src={result.poster_url || result.image_url || result.poster_path || result.image}
                                alt={result.title}
                                className="w-12 h-16 object-cover rounded-lg flex-shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                {getMediaIcon(result.type || 'movie')}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 line-clamp-2">{result.title}</p>
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span className="capitalize">{result.type}</span>
                                {result.year && <span>• {result.year}</span>}
                              </div>
                              {result.creator && (
                                <p className="text-xs text-gray-400 truncate">{result.creator}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Quick add to list button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuickAddMedia({
                                  title: result.title,
                                  mediaType: result.type || 'movie',
                                  imageUrl: result.poster_url || result.image_url || result.poster_path || result.image,
                                  externalId: result.external_id || result.id,
                                  externalSource: result.external_source || result.source || 'tmdb',
                                  creator: result.creator,
                                });
                                setIsQuickAddOpen(true);
                              }}
                              className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center transition-colors"
                              data-testid={`add-media-${idx}`}
                            >
                              <Plus size={20} className="text-white" />
                            </button>
                            {/* Rate/Review/Hot Take button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setFullAddMedia({
                                  title: result.title,
                                  mediaType: result.type || 'movie',
                                  imageUrl: result.poster_url || result.image_url || result.poster_path || result.image,
                                  externalId: result.external_id || result.id,
                                  externalSource: result.external_source || result.source || 'tmdb',
                                  creator: result.creator,
                                });
                                setIsFullAddModalOpen(true);
                              }}
                              className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 flex items-center justify-center transition-colors relative"
                              data-testid={`full-add-media-${idx}`}
                            >
                              <MessageSquarePlus size={16} className="text-white" />
                              <Star size={10} className="absolute -top-0.5 -right-0.5 fill-yellow-300 text-yellow-300" />
                            </button>
                          </div>
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

      <CreateListDialog
        open={isCreateListOpen}
        onOpenChange={setIsCreateListOpen}
      />

      <QuickAddModal
        isOpen={isFullAddModalOpen}
        onClose={() => {
          setIsFullAddModalOpen(false);
          setFullAddMedia(null);
        }}
        preSelectedMedia={fullAddMedia}
      />
    </div>
  );
}
