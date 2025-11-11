import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Trophy, Wallet, Plus, Activity, BarChart3, Gamepad2, Users, Bell, User, Search, X, ChevronDown } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

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
      
      toast({
        title: isDuplicate ? "Already in list!" : "Added to list!",
        description: isDuplicate 
          ? `${variables.media.title} is already in this list.`
          : `${variables.media.title} has been added to your list.`,
      });
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
      <div className="bg-gradient-to-r from-slate-900 to-purple-900 sticky top-0 z-50">
        <div className="flex justify-between items-center h-16 px-4">
          <Link href="/" className="flex items-center space-x-2">
            <img
              src="/consumed-logo-white.png"
              alt="consumed"
              className="h-8 w-auto"
            />
          </Link>
          
          {/* Expandable Search Section */}
          <div className="flex items-center space-x-6 flex-1 justify-end">
            <div className={`flex items-center transition-all duration-300 ${isSearchExpanded ? 'flex-1 max-w-md' : 'w-auto'}`}>
              {isSearchExpanded ? (
                <div className="relative w-full">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search for friends, movies, shows, books, music..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10 py-2 rounded-full bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:bg-white/20"
                    data-testid="inline-search-input"
                  />
                  <button
                    onClick={handleSearchToggle}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                  
                  {/* Search Results Dropdown */}
                  {hasResults && searchQuery && !hasError && !isLoading && (
                    <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-xl max-h-[500px] overflow-y-auto">
                      {/* User Results */}
                      {userResults.length > 0 && (
                        <div className="border-b border-gray-200">
                          <div className="px-3 py-2 bg-gray-50 sticky top-0">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-2">
                              <User size={14} />
                              People
                            </h3>
                          </div>
                          {userResults.slice(0, 3).map((userResult) => (
                            <div
                              key={userResult.id}
                              className="flex items-center justify-between gap-3 p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                              data-testid={`inline-user-${userResult.id}`}
                            >
                              <div
                                onClick={() => handleUserClick(userResult.id)}
                                className="flex items-center gap-3 flex-1 cursor-pointer"
                              >
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                                  {userResult.display_name?.[0] || userResult.user_name[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-black text-sm truncate">
                                    {userResult.display_name || userResult.user_name}
                                  </p>
                                  <p className="text-xs text-gray-600 truncate">@{userResult.user_name}</p>
                                </div>
                              </div>
                              <Button
                                onClick={(e) => handleSendFriendRequest(userResult.id, e)}
                                size="sm"
                                variant="outline"
                                className="border-purple-300 text-purple-700 hover:bg-purple-50 text-xs px-2 py-1 h-7"
                                data-testid={`add-friend-${userResult.id}`}
                              >
                                <Plus size={12} className="mr-1" />
                                Add
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Media Results */}
                      {mediaResults.length > 0 && (
                        <div>
                          <div className="px-3 py-2 bg-gray-50 sticky top-0">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-2">
                              <Search size={14} />
                              Media
                            </h3>
                          </div>
                          {mediaResults.slice(0, 5).map((result, idx) => (
                            <div
                              key={`${result.external_id}-${idx}`}
                              className="flex items-center gap-3 p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                              data-testid={`inline-result-${result.external_id}`}
                            >
                              <div
                                onClick={() => handleMediaClick(result)}
                                className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
                              >
                                {result.image && (
                                  <img
                                    src={result.image}
                                    alt={result.title}
                                    className="w-12 h-16 object-cover rounded flex-shrink-0"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-black text-sm truncate">{result.title}</p>
                                  <p className="text-xs text-gray-600 truncate">
                                    {result.type} {result.year && `• ${result.year}`}
                                  </p>
                                  {result.creator && (
                                    <p className="text-xs text-gray-500 truncate">{result.creator}</p>
                                  )}
                                </div>
                              </div>
                              
                              {/* Add to List Dropdown */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="sm"
                                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-2 py-1 h-7 flex-shrink-0"
                                    data-testid={`add-to-list-${result.external_id}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Plus size={12} className="mr-1" />
                                    Add
                                    <ChevronDown size={12} className="ml-1" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuLabel className="text-xs">Add to List</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  
                                  {/* System Lists */}
                                  {systemLists.map((list: any) => (
                                    <DropdownMenuItem
                                      key={list.id}
                                      onClick={(e) => handleAddToList(result, list.id, false, e)}
                                      className="text-sm"
                                    >
                                      {list.title}
                                    </DropdownMenuItem>
                                  ))}
                                  
                                  {/* Custom Lists */}
                                  {customLists.length > 0 && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuLabel className="text-xs">Custom Lists</DropdownMenuLabel>
                                      {customLists.map((list: any) => (
                                        <DropdownMenuItem
                                          key={list.id}
                                          onClick={(e) => handleAddToList(result, list.id, true, e)}
                                          className="text-sm"
                                        >
                                          {list.title}
                                        </DropdownMenuItem>
                                      ))}
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Loading State */}
                  {searchQuery && isLoading && (
                    <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-xl p-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                        <p className="text-sm text-gray-600">Searching...</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Error State */}
                  {searchQuery && !isLoading && hasError && (
                    <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-xl p-4">
                      <p className="text-sm text-red-600 text-center">Search failed. Please try again.</p>
                    </div>
                  )}
                  
                  {/* No Results Message */}
                  {searchQuery && !isLoading && !hasError && !hasResults && (
                    <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-xl p-4">
                      <p className="text-sm text-gray-500 text-center">No results found for "{searchQuery}"</p>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleSearchToggle}
                  className="hover:opacity-70 transition-opacity"
                  data-testid="search-button"
                >
                  <Search className="text-white" size={20} />
                </button>
              )}
            </div>
            
            {!isSearchExpanded && (
              <>
                <Link href="/discover">
                  <button
                    className="hover:opacity-70 transition-opacity"
                    data-testid="discover-button"
                  >
                    <span className="text-white text-xl">✨</span>
                  </button>
                </Link>
                <Link href="/friendsupdates">
                  <button
                    className="hover:opacity-70 transition-opacity"
                    data-testid="friendsupdates-button"
                  >
                    <Activity className="text-white" size={20} />
                  </button>
                </Link>
                <NotificationBell />
                <Link href={user?.id ? `/user/${user.id}` : "/login"}>
                  <button
                    className="hover:opacity-70 transition-opacity"
                    data-testid="profile-button"
                  >
                    <User className="text-white" size={20} />
                  </button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-slate-900 to-purple-900 z-50 pb-safe">
        <div className="flex justify-evenly items-center h-20 pb-2">
          <Link
            href="/feed"
            className={`flex flex-col items-center space-y-1 py-2 px-2 rounded-lg transition-colors ${location === "/feed" ? "bg-white/20" : ""}`}
          >
            <Activity className="text-white" size={24} />
            <span className="text-xs font-medium text-white">Feed</span>
          </Link>

          <Link
            href="/track"
            className={`flex flex-col items-center space-y-1 py-2 px-2 rounded-lg transition-colors ${location === "/track" || location === "/" ? "bg-white/20" : ""}`}
          >
            <Plus className="text-white" size={24} />
            <span className="text-xs font-medium text-white">Track</span>
          </Link>

          <Link
            href="/play"
            className={`flex flex-col items-center space-y-1 py-2 px-2 rounded-lg transition-colors ${location === "/play" ? "bg-white/20" : ""}`}
          >
            <Gamepad2 className="text-white" size={24} />
            <span className="text-xs font-medium text-white">Play</span>
          </Link>

          <Link
            href="/leaderboard"
            className={`flex flex-col items-center space-y-1 py-2 px-2 rounded-lg transition-colors ${location === "/leaderboard" ? "bg-white/20" : ""}`}
          >
            <BarChart3 className="text-white" size={24} />
            <span className="text-xs font-medium text-white">Leaders</span>
          </Link>

          <Link
            href="/friends"
            className={`flex flex-col items-center space-y-1 py-2 px-2 rounded-lg transition-colors ${location === "/friends" ? "bg-white/20" : ""}`}
          >
            <Users className="text-white" size={24} />
            <span className="text-xs font-medium text-white">Friends</span>
          </Link>

        </div>
      </nav>

    </>
  );
}
