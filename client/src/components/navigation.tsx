import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Trophy, Wallet, Plus, Activity, BarChart3, Users, Bell, User, Search, X, ChevronDown, MessageCircle, Flame, Dna, Sparkles, Library, Gamepad2, MessageSquarePlus, Home } from "lucide-react";
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

interface NavigationProps {
  onTrackConsumption?: () => void;
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

export default function Navigation({ onTrackConsumption }: NavigationProps) {
  const [location, setLocation] = useLocation();
  const { user, session } = useAuth();
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

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
        body: JSON.stringify({ query: searchQuery })
      });

      if (!response.ok) {
        console.error('Media search failed:', response.status);
        throw new Error('Media search failed');
      }
      const data = await response.json();
      return data.results || [];
    },
    enabled: !!searchQuery.trim() && !!session?.access_token && isSearchExpanded,
    staleTime: 1000 * 60 * 5,
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
      toast({
        title: "Error",
        description: error.message || "Failed to send friend request.",
        variant: "destructive",
      });
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
      <div className="bg-gradient-to-b from-[#0a0a0f] via-[#12121f] to-[#12121f] sticky top-0 z-50" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}>
        <div className="flex justify-between items-center h-16 px-4">
          <Link href="/" className="flex items-center space-x-2">
            <img
              src="/consumed-logo-new.png"
              alt="consumed"
              className="h-7 w-auto"
            />
          </Link>
          
          <div className="flex items-center gap-4">
            <button
              onClick={handleSearchToggle}
              className="hover:opacity-70 transition-opacity"
              aria-label="Search"
              data-testid="nav-search-toggle"
            >
              {isSearchExpanded ? <X className="text-white" size={20} /> : <Search className="text-white" size={20} />}
            </button>
            <NotificationBell />
            <Link
              href={user?.id ? `/user/${user.id}` : "/login"}
              className="hover:opacity-70 transition-opacity"
              data-testid="nav-profile-top"
            >
              <User className="text-white" size={20} />
            </Link>
          </div>
        </div>

        {/* Expandable Search Bar */}
        {isSearchExpanded && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search friends or media..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/10 border-white/20 text-white placeholder:text-gray-400 rounded-xl"
                data-testid="nav-search-input"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            </div>

            {/* Search Results Dropdown */}
            {searchQuery.trim() && (
              <div className="mt-2 bg-[#1a1a2e] border border-white/10 rounded-xl max-h-80 overflow-y-auto">
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
                    <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-white/10">
                      Media
                    </div>
                    {mediaResults.slice(0, 8).map((media, idx) => (
                      <div
                        key={`${media.external_id}-${idx}`}
                        onClick={() => handleMediaClick(media)}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 cursor-pointer"
                      >
                        {media.image ? (
                          <img src={media.image} alt={media.title} className="w-10 h-14 object-cover rounded" />
                        ) : (
                          <div className="w-10 h-14 bg-gray-700 rounded flex items-center justify-center">
                            <Activity size={16} className="text-gray-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{media.title}</p>
                          <p className="text-gray-400 text-xs">{media.type} {media.year && `• ${media.year}`}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50" style={{ background: 'linear-gradient(to right, #0a0a0f, #12121f, #2d1f4e)' }}>
        <div className="flex justify-around items-end px-2 pt-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 20px), 20px)' }}>
          {/* Home (main game feed) */}
          <Link
            href="/activity"
            className={`flex items-center justify-center p-3 rounded-xl transition-colors ${location === "/activity" || location === "/" ? "bg-white/15" : ""}`}
            data-testid="nav-home"
          >
            <Home className="text-white" size={28} />
          </Link>

          {/* Add - Library stack with plus icon */}
          <Link
            href="/add"
            className={`flex items-center justify-center p-3 rounded-xl transition-colors ${location === "/add" ? "bg-white/15" : ""}`}
            data-testid="nav-add"
          >
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
              {/* Rounded square frame - open top-right corner */}
              <path d="M18,2 L6,2 C3.8,2 2,3.8 2,6 L2,22 C2,24.2 3.8,26 6,26 L22,26 C24.2,26 26,24.2 26,22 L26,12" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              {/* Sparkle/star inside - represents all entertainment */}
              <path d="M13,10 L14,14 L18,15 L14,16 L13,20 L12,16 L8,15 L12,14 Z" stroke="white" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
              {/* Plus icon top-right */}
              <line x1="24" y1="2" x2="24" y2="9" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <line x1="20.5" y1="5.5" x2="27.5" y2="5.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </Link>

          {/* Leaderboard */}
          <Link
            href="/leaderboard"
            className={`flex items-center justify-center p-3 rounded-xl transition-colors ${location === "/leaderboard" ? "bg-white/15" : ""}`}
            data-testid="nav-leaderboard"
          >
            <Trophy className="text-white" size={28} />
          </Link>
        </div>
      </nav>

      {/* Quick Action Sheet */}
      <QuickActionSheet
        isOpen={isQuickActionOpen}
        onClose={() => setIsQuickActionOpen(false)}
      />

      {/* Feedback Dialog */}
      <FeedbackDialog
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      />
    </>
  );
}
