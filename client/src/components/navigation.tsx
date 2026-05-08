import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import { Dices, Wallet, Plus, Activity, BarChart3, Users, Bell, User, Search, X, ChevronDown, MessageCircle, Flame, Dna, Sparkles, Gamepad2, MessageSquarePlus, Home, Star, DoorOpen, Bookmark } from "lucide-react";
import { FeedbackDialog } from "./feedback-dialog";
import { NotificationBell } from "./notification-bell";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { QuickActionSheet } from "./quick-action-sheet";
import { useFeatureFlags } from "@/lib/feature-flags";
import { QuickAddListSheet } from "./quick-add-list-sheet";

interface NavigationProps {
  onTrackConsumption?: () => void;
  hideTopBar?: boolean;
}

interface MediaResult {
  title: string;
  type: string;
  creator?: string;
  image?: string;
  year?: number;
  external_id?: string;
  external_source?: string;
  description?: string;
}

interface UserResult {
  id: string;
  user_name: string;
  display_name?: string;
  email?: string;
}

export default function Navigation({ onTrackConsumption, hideTopBar }: NavigationProps) {
  const [location, setLocation] = useLocation();
  const { user, session } = useAuth();
  const { roomsEnabled } = useFeatureFlags();
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const { data: navAvatar } = useQuery<string | null>({
    queryKey: ['nav-avatar', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from('users').select('avatar_url').eq('id', user.id).single();
      return (data as any)?.avatar_url ?? null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [quickAddMedia, setQuickAddMedia] = useState<any>(null);
  const [actionSheetMedia, setActionSheetMedia] = useState<any>(null);
  const [directCapture, setDirectCapture] = useState(false);
  const [totalPoints, setTotalPoints] = useState<number | null>(null);
  const [searchFeedbackSent, setSearchFeedbackSent] = useState<string | null>(null); // stores query that was reported

  useEffect(() => {
    const handler = () => setIsQuickActionOpen(true);
    window.addEventListener('openQuickAction', handler);
    return () => window.removeEventListener('openQuickAction', handler);
  }, []);

  useEffect(() => {
    const handler = () => { setDirectCapture(true); setIsQuickActionOpen(true); };
    window.addEventListener('openAddMedia', handler);
    return () => window.removeEventListener('openAddMedia', handler);
  }, []);

  useEffect(() => {
    if (!user?.id || !session?.access_token) return;
    fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/calculate-user-points?user_id=${user.id}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => { if (data?.points?.all_time != null) setTotalPoints(data.points.all_time); })
      .catch(() => {});
  }, [user?.id, session?.access_token]);

  // Prefetch Collections data on hover/touch
  const prefetchCollections = useCallback(async () => {
    if (!session?.access_token || !user?.id) return;
    
    // Prefetch the metadata query (fast)
    queryClient.prefetchQuery({
      queryKey: ['user-lists-metadata', user.id],
      queryFn: async () => {
        const response = await fetch(
          `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-lists-metadata?user_id=${user.id}`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (response.ok) return response.json();
        return { lists: [] };
      },
      staleTime: 5 * 60 * 1000,
    });
    
    // Also prefetch the full lists data (slower but cached)
    queryClient.prefetchQuery({
      queryKey: ['user-lists', user.id],
      queryFn: async () => {
        const response = await fetch(
          `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-lists-with-media?user_id=${user.id}`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (response.ok) return response.json();
        return { lists: [] };
      },
      staleTime: 2 * 60 * 1000,
    });
  }, [session?.access_token, user?.id, queryClient]);

  // Auto-focus when search expands
  useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

  // Detect series from title pattern "X and the Y" → "X"
  const inferSeries = (title: string): string | null => {
    const m = /^(.+?)\s+and\s+the\s+/i.exec(title);
    if (m) { const c = m[1].trim(); if (c.split(/\s+/).length <= 4) return c; }
    return null;
  };

  // Expandable book series state
  const [expandedSeriesId, setExpandedSeriesId] = useState<string | null>(null);
  const [seriesBooksMap, setSeriesBooksMap] = useState<Record<string, MediaResult[]>>({});
  const [loadingSeriesId, setLoadingSeriesId] = useState<string | null>(null);

  const fetchSeriesBooks = async (seriesTitle: string, seriesId: string, author?: string) => {
    if (seriesBooksMap[seriesId] || !session?.access_token) return;
    setLoadingSeriesId(seriesId);
    try {
      // Query Open Library directly — it handles series/author searches well and has CORS enabled.
      // Using title + author gives us all books in the series (e.g. New Moon, Eclipse,
      // Breaking Dawn all come back when author=stephenie+meyer).
      const params = new URLSearchParams({
        q: seriesTitle,
        limit: '12',
        fields: 'title,author_name,first_publish_year,cover_i,key,subject',
      });
      if (author && author !== 'Unknown Author') {
        params.set('author', author);
      }
      const resp = await fetch(`https://openlibrary.org/search.json?${params.toString()}`);
      if (resp.ok) {
        const data = await resp.json();
        const seen = new Set<string>();
        const books = (data.docs || [])
          .filter((d: any) => d.key && d.title)
          .filter((d: any) => {
            const id = d.key;
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          })
          .slice(0, 8)
          .map((d: any) => ({
            title: d.title,
            type: 'book',
            creator: d.author_name?.[0] || author || '',
            poster_url: d.cover_i
              ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`
              : '',
            external_id: d.key.replace('/works/', ''),
            external_source: 'openlibrary',
            year: d.first_publish_year ? String(d.first_publish_year) : '',
          }));
        setSeriesBooksMap(prev => ({ ...prev, [seriesId]: books }));
      }
    } catch (_) {}
    finally { setLoadingSeriesId(null); }
  };

  // Per-type caps prevent any single category from flooding results.
  // Music/podcast are capped tightly unless the query is clearly music-intent.
  // Books get a higher cap so a book-heavy query still surfaces them.
  const queryLooksLikeMusic = /\b(song|album|music|soundtrack|listen|track|band|artist)\b/i.test(searchQuery);
  const queryLooksLikeBook = /\b(book|novel|read|author|written|chapter|series)\b/i.test(searchQuery);
  const MAX_PER_TYPE: Record<string, number> = {
    book_series: 1,
    movie: 4,
    tv: 4,
    tv_show: 4,
    book: queryLooksLikeBook ? 8 : 4,
    music: queryLooksLikeMusic ? 4 : 1,
    podcast: queryLooksLikeMusic ? 2 : 1,
    game: 1,
  };
  // Results arrive from the edge function already sorted by relevance score.
  // We preserve that order — just apply per-type caps so no single type floods.
  // Do NOT re-sort by type here: a highly-relevant book should beat a
  // low-relevance movie, not be pushed below it.
  const prioritizeAndDiversify = (results: MediaResult[]): MediaResult[] => {
    const counts: Record<string, number> = {};
    const output: MediaResult[] = [];
    for (const r of results) {
      const t = r.type || 'other';
      const cap = MAX_PER_TYPE[t] ?? 2;
      counts[t] = (counts[t] || 0) + 1;
      if (counts[t] <= cap) output.push(r);
    }
    const trimmed = output.slice(0, 12);

    // Safety net: if books exist in raw results but none made the cut (all slots
    // taken by movies/TV), force the best book in at position 2.
    const hasBook = trimmed.some(r => r.type === 'book' || r.type === 'book_series');
    if (!hasBook) {
      const firstBook = results.find(r => r.type === 'book' || r.type === 'book_series');
      if (firstBook) {
        const insertAt = Math.min(2, trimmed.length);
        trimmed.splice(insertAt, 0, firstBook);
        return trimmed.slice(0, 12);
      }
    }
    return trimmed;
  };

  // Debounced media search
  const mediaQuery = useQuery<MediaResult[]>({
    queryKey: ['inline-media-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim() || !session?.access_token) return [];

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/media-search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery, include_book_series: true })
      });

      if (!response.ok) {
        console.error('Media search failed:', response.status);
        throw new Error('Media search failed');
      }
      const data = await response.json();
      return data.results || [];
    },
    enabled: !!searchQuery.trim() && !!session?.access_token && isSearchExpanded,
    staleTime: 30 * 1000,
    gcTime: 60 * 1000,
    retry: 1,
  });

  // Debounced user search
  const userQuery = useQuery<UserResult[]>({
    queryKey: ['inline-user-search', searchQuery],
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

      if (!response.ok) {
        console.error('User search failed:', response.status);
        throw new Error('User search failed');
      }
      const data = await response.json();
      return data.users || [];
    },
    enabled: !!searchQuery.trim() && !!session?.access_token && isSearchExpanded,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  // Only use cached data if query is successful and search is active
  const mediaResults = (mediaQuery.status === 'success' && searchQuery.trim() && isSearchExpanded) 
    ? (mediaQuery.data || []) 
    : [];
  const userResults = (userQuery.status === 'success' && searchQuery.trim() && isSearchExpanded) 
    ? (userQuery.data || []) 
    : [];
  const isLoadingMedia = mediaQuery.isLoading;
  const isLoadingUsers = userQuery.isLoading;

  // Fetch user's lists for add to list functionality
  const { data: userListsData } = useQuery<any>({
    queryKey: ['user-lists-for-nav'],
    queryFn: async () => {
      if (!session?.access_token) return null;

      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-lists-with-media", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user lists');
      }

      return response.json();
    },
    enabled: !!session?.access_token && isSearchExpanded,
  });

  const systemLists = userListsData?.lists?.filter((list: any) => list.is_default) || [];
  const customLists = userListsData?.lists?.filter((list: any) => !list.is_default) || [];

  // Add to list mutation
  const addToListMutation = useMutation({
    mutationFn: async ({ media, listType, isCustom }: { media: MediaResult; listType: string; isCustom?: boolean }) => {
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const mediaData = {
        title: media.title,
        mediaType: media.type || 'movie',
        creator: media.creator || '',
        imageUrl: media.image || '',
        externalId: media.external_id || '',
        externalSource: media.external_source || 'tmdb'
      };

      const url = isCustom 
        ? 'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/add-to-custom-list'
        : 'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/track-media';

      const body = isCustom
        ? { media: mediaData, customListId: listType }
        : { media: mediaData, listType };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || errorData.message || 'Failed to add to list');
      }
      
      return response.json();
    },
    onSuccess: (result, variables) => {
      const isDuplicate = result?.message === 'Item already in list';
      
      if (isDuplicate) {
        toast({
          title: "Already in list!",
          description: `${variables.media.title} is already in this list.`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['user-lists-for-nav'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add item to list. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Send friend request mutation
  const sendFriendRequestMutation = useMutation({
    mutationFn: async (friendId: string) => {
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/manage-friendships', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'sendRequest', friendId: friendId })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send friend request');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Friend request sent!",
        description: "You'll be notified when they accept.",
      });
    },
    onError: (error: Error) => {
      const msg = error.message || "";
      if (msg.includes('Already friends') || msg.includes('duplicate key') || msg.includes('unique constraint')) {
        toast({
          title: "Already friends!",
          description: "You're already connected with this person.",
        });
      } else if (msg.includes('already sent') || msg.includes('Friend request already')) {
        toast({
          title: "Request already sent",
          description: "Your friend request is pending.",
        });
      } else {
        toast({
          title: "Error",
          description: msg || "Failed to send friend request.",
          variant: "destructive",
        });
      }
    },
  });

  const handleSearchToggle = () => {
    if (isSearchExpanded) {
      setIsSearchExpanded(false);
      setSearchQuery("");
    } else {
      setIsSearchExpanded(true);
    }
  };

  const handleMediaClick = (result: MediaResult) => {
    // Book series: toggle inline expansion and fetch individual books on demand
    if (result.type === 'book_series') {
      const sid = result.external_id;
      if (expandedSeriesId === sid) {
        setExpandedSeriesId(null);
      } else {
        setExpandedSeriesId(sid);
        fetchSeriesBooks(result.title, sid, result.creator);
      }
      return;
    }
    setIsSearchExpanded(false);
    setSearchQuery("");
    const type = result.type;
    const source = result.external_source || 'tmdb';
    const id = result.external_id;
    
    if (type && source && id) {
      setLocation(`/media/${type}/${source}/${id}`);
    }
  };

  const handleUserClick = (userId: string) => {
    setIsSearchExpanded(false);
    setSearchQuery("");
    setLocation(`/user/${userId}`);
  };

  const handleAddToList = (media: MediaResult, listType: string, isCustom: boolean, e?: React.MouseEvent) => {
    e?.stopPropagation();
    addToListMutation.mutate({ media, listType, isCustom });
  };

  const handleSendFriendRequest = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sendFriendRequestMutation.mutate(userId);
  };

  const hasResults = mediaResults.length > 0 || userResults.length > 0;
  const isLoading = isLoadingMedia || isLoadingUsers;
  const hasError = mediaQuery.status === 'error' || userQuery.status === 'error';

  return (
    <>
      {/* Top bar with logo and points */}
      <div
        className="sticky top-0 z-50"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)',
          display: hideTopBar ? 'none' : undefined,
          background: (location.startsWith('/room/') || location === '/rooms') ? 'transparent' : 'linear-gradient(to right, #0a0a0f, #12121f, #2d1f4e)',
        }}
      >
        <div className="flex justify-between items-center h-11 px-4">
          <Link href="/" className="flex items-center space-x-2">
            <img
              src="/consumed-logo-new.png"
              alt="consumed"
              className="h-7 w-auto"
            />
          </Link>
          
          <div className="flex items-center gap-3">
            {totalPoints !== null && (
              <Link href="/points" className="flex items-center gap-1 bg-white/10 active:bg-white/20 rounded-full px-2.5 py-1 transition-colors mr-2">
                <Star size={11} className="text-amber-400" fill="currentColor" />
                <span className="text-white text-xs font-semibold">{totalPoints.toLocaleString()}</span>
                <span className="text-white/60 text-[10px]">pts</span>
              </Link>
            )}
            <button
              onClick={handleSearchToggle}
              className="hover:opacity-70 transition-opacity"
              aria-label="Search"
              data-testid="nav-search-toggle"
            >
              {isSearchExpanded ? <X className="text-white" size={20} /> : <Search className="text-white" size={20} />}
            </button>
            <NotificationBell />
          </div>
        </div>

        {/* Expandable Search Bar */}
        {isSearchExpanded && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search to add media or find friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/10 border-white/20 text-white placeholder:text-gray-400 rounded-xl"
                data-testid="nav-search-input"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            </div>

            {/* Search Results Dropdown */}
            {searchQuery.trim() && (
              <div className="mt-2 bg-[#1a1a2e] border border-white/10 rounded-xl flex flex-col" style={{ maxHeight: '22rem' }}>
                <div className="overflow-y-auto flex-1 min-h-0">
                {isLoading && (
                  <div className="p-4 text-center text-gray-400 text-sm">Searching...</div>
                )}
                
                {hasError && !isLoading && (
                  <div className="p-4 text-center text-red-400 text-sm">Search failed. Please try again.</div>
                )}

                {!isLoading && !hasError && !hasResults && searchQuery.length > 1 && (
                  <div className="p-4 text-center text-gray-400 text-sm">No results found</div>
                )}

                {/* Users Section */}
                {userResults.length > 0 && (
                  <div>
                    <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-white/10">
                      People
                    </div>
                    {userResults.slice(0, 5).map((person) => (
                      <div
                        key={person.id}
                        onClick={() => handleUserClick(person.id)}
                        className="flex items-center justify-between px-3 py-2 hover:bg-white/5 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-medium">
                            {(person.display_name || person.user_name)?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">{person.display_name || person.user_name}</p>
                            <p className="text-gray-400 text-xs">@{person.user_name}</p>
                          </div>
                        </div>
                        {person.id !== user?.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => handleSendFriendRequest(person.id, e)}
                            className="text-xs h-7 border-purple-500 text-purple-400 hover:bg-purple-500/20"
                          >
                            Add
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Media Section */}
                {mediaResults.length > 0 && (
                  <div>
                    <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-white/10 flex items-center justify-between">
                      <span>Results</span>
                    </div>
                    {prioritizeAndDiversify(mediaResults).map((media, idx) => {
                      const posterSrc = (media as any).poster_url || (media as any).image_url || media.image || (media as any).poster_path || '';
                      const typeLabel = (media as any).series_count && media.type === 'book_series'
                        ? `${(media as any).series_count}-book series`
                        : media.type === 'tv' ? 'TV show' : media.type;
                      const seriesLabel = (media as any).series || inferSeries(media.title);
                      const mediaObj = {
                        title: media.title,
                        // book_series has no tracking type — map to 'book' for list/action compatibility
                        mediaType: media.type === 'book_series' ? 'book' : (media.type || 'movie'),
                        imageUrl: posterSrc,
                        externalId: media.external_id,
                        externalSource: media.external_source === 'openai' ? 'openlibrary' : (media.external_source || 'tmdb'),
                        creator: media.creator,
                      };
                      const isSeriesExpanded = media.type === 'book_series' && expandedSeriesId === media.external_id;
                      const seriesBooks = seriesBooksMap[media.external_id] || [];
                      const isLoadingSeries = loadingSeriesId === media.external_id;
                      return (
                        <div key={`${media.external_id}-${idx}`}>
                          <div className="flex items-start gap-2 px-3 py-2.5 hover:bg-white/5 border-b border-white/[0.04]">
                            <div
                              onClick={() => handleMediaClick(media)}
                              className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
                            >
                              {posterSrc ? (
                                <img src={posterSrc} alt={media.title} className="w-10 h-14 object-cover rounded shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                              ) : (
                                <div className="w-10 h-14 bg-gray-700 rounded flex items-center justify-center shrink-0">
                                  <Activity size={16} className="text-gray-500" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0 pt-0.5">
                                <p className="text-white text-sm font-semibold line-clamp-2 leading-snug">{media.title}</p>
                                <p className="text-gray-400 text-xs mt-0.5 capitalize">{typeLabel}{media.year ? ` • ${media.year}` : ''}</p>
                                {media.creator && media.creator !== 'Unknown Author' && (
                                  <p className="text-gray-500 text-xs truncate">{media.creator}</p>
                                )}
                                {media.type === 'book_series' && (media as any).series_count > 0 && (
                                  <span className="inline-block text-[10px] font-medium bg-purple-500/30 text-purple-200 border border-purple-400/40 px-1.5 py-0.5 rounded-full mt-1">📚 {(media as any).series_count} books {isSeriesExpanded ? '▲' : '▼'}</span>
                                )}
                                {media.type === 'book' && seriesLabel && (
                                  <span className="inline-block text-[10px] font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded-full mt-1 max-w-[130px] truncate">📚 {seriesLabel}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); setQuickAddMedia(mediaObj); setIsQuickAddOpen(true); }}
                                className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center transition-colors"
                              >
                                <Bookmark size={15} className="text-white" fill="white" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setActionSheetMedia(mediaObj); setDirectCapture(true); setIsQuickActionOpen(true); }}
                                className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 flex items-center justify-center transition-colors relative"
                              >
                                <MessageSquarePlus size={14} className="text-white" />
                                <Star size={8} className="absolute -top-0.5 -right-0.5 fill-yellow-300 text-yellow-300" />
                              </button>
                            </div>
                          </div>
                          {/* Expanded individual books */}
                          {isSeriesExpanded && (
                            <div className="ml-4 mr-2 mb-2 rounded-xl overflow-hidden border border-purple-500/20" style={{ background: 'rgba(109,40,217,0.08)' }}>
                              <div className="px-3 py-1.5 border-b border-purple-500/15 flex items-center gap-1.5">
                                <span className="text-[10px] font-semibold text-purple-300 uppercase tracking-wider">Books in this series</span>
                              </div>
                              {isLoadingSeries ? (
                                <div className="px-4 py-3 text-xs text-gray-400 flex items-center gap-2">
                                  <div className="w-3 h-3 border border-gray-500 border-t-purple-400 rounded-full animate-spin" />
                                  Loading books...
                                </div>
                              ) : seriesBooks.length === 0 ? (
                                <p className="px-4 py-3 text-xs text-gray-500">No individual books found.</p>
                              ) : (
                                seriesBooks.map((book, bIdx) => {
                                  const bPoster = (book as any).poster_url || (book as any).image_url || book.image || '';
                                  const bObj = { title: book.title, mediaType: 'book', imageUrl: bPoster, externalId: book.external_id, externalSource: book.external_source || 'googlebooks', creator: book.creator };
                                  return (
                                    <div key={`${book.external_id}-b${bIdx}`} className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 border-b border-purple-500/10 last:border-0">
                                      <div
                                        onClick={() => { setIsSearchExpanded(false); setSearchQuery(""); setLocation(`/media/book/${book.external_source || 'googlebooks'}/${book.external_id}`); }}
                                        className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                                      >
                                        {bPoster ? (
                                          <img src={bPoster} alt={book.title} className="w-8 h-11 object-cover rounded shrink-0" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                        ) : (
                                          <div className="w-8 h-11 bg-gray-700/60 rounded shrink-0 flex items-center justify-center">
                                            <span className="text-gray-500 text-[10px]">📖</span>
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <p className="text-white/90 text-xs font-medium line-clamp-2 leading-snug">{book.title}</p>
                                          <p className="text-gray-500 text-[10px] mt-0.5">{book.creator && book.creator !== 'Unknown Author' ? book.creator : ''}{book.year ? (book.creator && book.creator !== 'Unknown Author' ? ` · ${book.year}` : book.year) : ''}</p>
                                        </div>
                                      </div>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setQuickAddMedia(bObj); setIsQuickAddOpen(true); }}
                                        className="w-7 h-7 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center transition-colors flex-shrink-0"
                                      >
                                        <Bookmark size={13} className="text-white" fill="white" />
                                      </button>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                </div>{/* end scrollable results */}

                {/* Missing search feedback — pinned footer, always visible */}
                {searchQuery.trim().length >= 2 && (
                  <div className="border-t border-white/[0.06] px-3 py-2 flex-shrink-0">
                    {searchFeedbackSent === searchQuery.trim() ? (
                      <p className="text-[11px] text-green-400/80">Thanks! We'll use this to improve search.</p>
                    ) : (
                      <button
                        onClick={async () => {
                          const q = searchQuery.trim();
                          try {
                            await supabase.from('search_feedback').insert({
                              search_query: q,
                              user_id: user?.id ?? null,
                            });
                          } catch (_) { /* silent */ }
                          setSearchFeedbackSent(q);
                          toast({ title: "Got it!", description: "We'll look into improving search for this." });
                        }}
                        className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors text-left w-full"
                      >
                        Can't find what you're looking for? <span className="text-purple-400 hover:text-purple-300">Let us know →</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {createPortal(
        <nav className="fixed bottom-0 left-0 right-0 z-[9999]" style={{ background: 'linear-gradient(to right, #0a0a0f, #12121f, #2d1f4e)' }}>
          {/* Add menu backdrop */}
          {showAddMenu && (
            <div
              className="fixed inset-0 z-[-1]"
              onClick={() => setShowAddMenu(false)}
            />
          )}

          {/* Floating two-button fan-out */}
          {showAddMenu && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 flex gap-5 items-center">
              {/* Bookmark / Add to List */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={() => {
                    setShowAddMenu(false);
                    setIsSearchExpanded(true);
                  }}
                  className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                  style={{ background: '#7c3aed' }}
                  aria-label="Add to list"
                >
                  <Bookmark size={24} className="text-white" fill="white" />
                </button>
                <span className="text-white text-[10px] font-medium">Save</span>
              </div>

              {/* Chat bubble / Compose */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={() => {
                    setShowAddMenu(false);
                    setDirectCapture(true);
                    setIsQuickActionOpen(true);
                  }}
                  className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform relative"
                  style={{ background: 'linear-gradient(135deg, #f97316, #ec4899)' }}
                  aria-label="Share a take"
                >
                  <MessageSquarePlus size={24} className="text-white" />
                  <Star size={10} className="absolute top-1 right-1 fill-yellow-300 text-yellow-300" />
                </button>
                <span className="text-white text-[10px] font-medium">Post</span>
              </div>
            </div>
          )}
          <div className="flex justify-around items-center px-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 8px)', paddingTop: '8px' }}>
            <Link href="/activity" className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${location === "/activity" ? "bg-gradient-to-b from-white/12 to-transparent" : "opacity-55"}`} data-testid="nav-activity">
              <div className="h-[22px] flex items-center justify-center"><Activity className="text-white" size={22} /></div>
              <span className="text-white text-[10px] mt-0.5">Now</span>
            </Link>
            <Link href="/play" className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${location.startsWith("/play") ? "bg-gradient-to-b from-white/12 to-transparent" : "opacity-55"}`} data-testid="nav-play">
              <div className="h-[22px] flex items-center justify-center"><Dices size={23} className="text-white" strokeWidth={1.4} /></div>
              <span className="text-white text-[10px] mt-0.5">Play</span>
            </Link>
            <button
              onClick={() => setShowAddMenu(v => !v)}
              className={`flex flex-col items-center justify-center p-2 transition-all ${showAddMenu ? '' : 'opacity-55'}`}
              data-testid="nav-add"
              aria-label="Add"
            >
              <div className="h-[22px] flex items-center justify-center">
                <Plus size={22} strokeWidth={1.8} className="text-white" />
              </div>
              <span className="text-white text-[10px] mt-0.5">Add</span>
            </button>
            <Link href="/rooms" className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${location === "/rooms" || location.startsWith("/room/") ? "bg-gradient-to-b from-white/12 to-transparent" : "opacity-55"}`} data-testid="nav-rooms">
              <div className="h-[22px] flex items-center justify-center"><DoorOpen className="text-white" size={22} /></div>
              <span className="text-white text-[10px] mt-0.5">Rooms</span>
            </Link>
            <Link href="/profile" className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${location === "/profile" ? "bg-gradient-to-b from-white/12 to-transparent" : "opacity-55"}`} data-testid="nav-me" aria-label="Profile">
              <div className="h-[22px] flex items-center justify-center">
                {navAvatar ? (
                  <img src={navAvatar} alt="Me" className="w-[22px] h-[22px] rounded-full object-cover border border-white/30" />
                ) : (
                  <User className="text-white" size={22} />
                )}
              </div>
              <span className="text-white text-[10px] mt-0.5">Me</span>
            </Link>
          </div>
        </nav>,
        document.body
      )}

      {/* Quick Action Sheet */}
      <QuickActionSheet
        isOpen={isQuickActionOpen}
        onClose={() => { setIsQuickActionOpen(false); setActionSheetMedia(null); setDirectCapture(false); }}
        preselectedMedia={actionSheetMedia}
        preselectedIntent={directCapture ? "capture" : null}
      />

      {/* Quick Add to List Sheet */}
      <QuickAddListSheet
        isOpen={isQuickAddOpen}
        onClose={() => { setIsQuickAddOpen(false); setQuickAddMedia(null); }}
        media={quickAddMedia}
      />

      {/* Feedback Dialog */}
      <FeedbackDialog
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      />
    </>
  );
}
