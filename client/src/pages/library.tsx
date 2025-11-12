import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Sparkles, Loader2, Film, Music, BookOpen, Tv, X, List as ListIcon, Library as LibraryIcon, ChevronRight, ChevronDown, Lock, Users, Plus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import MediaCarousel from "@/components/media-carousel";
import Navigation from "@/components/navigation";
import CreateListDialog from "@/components/create-list-dialog";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";

interface Recommendation {
  title: string;
  type: string;
  description: string;
  searchTerm?: string;
  poster_url?: string;
  external_id?: string;
  external_source?: string;
  year?: string;
}

interface SearchResult {
  type: 'conversational' | 'direct' | 'error';
  explanation?: string;
  recommendations?: Recommendation[];
  searchSuggestions?: string[];
  message?: string;
}

export default function Library() {
  const { user, session } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [activeView, setActiveView] = useState<'discover' | 'lists' | 'media-history'>('discover');
  const [isCreateListDialogOpen, setIsCreateListDialogOpen] = useState(false);
  
  // Media History filters
  const [mediaHistorySearch, setMediaHistorySearch] = useState("");
  const [mediaHistoryYear, setMediaHistoryYear] = useState("all");
  const [mediaHistoryMonth, setMediaHistoryMonth] = useState("all");
  const [mediaHistoryType, setMediaHistoryType] = useState("all");
  const [openFilterDropdown, setOpenFilterDropdown] = useState<'year' | 'month' | 'type' | null>(null);

  // Fetch trending content
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
          externalSource: 'tmdb'
        }));
      } catch (error) {
        console.error('Error fetching Netflix TV shows:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 60 * 6,
  });

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

  // Fetch user's lists
  const { data: userListsData, isLoading: isLoadingLists } = useQuery({
    queryKey: ['user-lists', user?.id],
    queryFn: async () => {
      if (!session?.access_token || !user?.id) return { lists: [] };

      const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-lists-with-media?user_id=${user.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch lists');
      }

      return response.json();
    },
    enabled: !!session?.access_token && !!user?.id,
    staleTime: 1000 * 60 * 5,
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

  const getMediaIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'movie': return <Film size={16} className="text-purple-400" />;
      case 'tv': return <Tv size={16} className="text-blue-400" />;
      case 'music': return <Music size={16} className="text-pink-400" />;
      case 'podcast': return <Music size={16} className="text-green-400" />;
      case 'book': return <BookOpen size={16} className="text-orange-400" />;
      default: return <Film size={16} className="text-gray-400" />;
    }
  };

  const userLists = userListsData?.lists || [];
  const systemLists = userLists.filter((list: any) => list.is_default);
  const customLists = userLists.filter((list: any) => !list.is_default);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-black mb-2 flex items-center gap-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
            <LibraryIcon className="text-purple-600" size={32} />
            Library
          </h1>
          <p className="text-base text-gray-600">
            Discover new content by browsing your friends lists, personalized recommendations or trending content
          </p>
        </div>

        {/* Button Toggle Navigation */}
        <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl w-full">
          <button
            onClick={() => setActiveView('discover')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
              activeView === 'discover'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
            data-testid="button-discover"
          >
            <Sparkles size={16} />
            <span className="hidden sm:inline">Discover</span>
          </button>
          <button
            onClick={() => setActiveView('lists')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
              activeView === 'lists'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
            data-testid="button-lists"
          >
            <ListIcon size={16} />
            <span className="hidden sm:inline">Lists</span>
          </button>
          <button
            onClick={() => setActiveView('media-history')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
              activeView === 'media-history'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
            data-testid="button-media-history"
          >
            <TrendingUp size={16} />
            <span className="hidden sm:inline">Media History</span>
          </button>
        </div>

        {/* Content Views */}
        <div className="w-full">
          {/* Discovery View */}
          {activeView === 'discover' && (
            <div className="space-y-8">
            
            {/* AI Recommendation Engine */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 shadow-lg">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="text-white" size={20} />
                  AI Recommendation Engine
                </h2>
                <p className="text-sm text-white/90 mt-1">
                  Describe what you're in the mood for and get personalized suggestions
                </p>
              </div>
              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <Input
                      type="text"
                      placeholder="Try 'uplifting movies' or 'sci-fi like Blade Runner'..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !isSearching && handleSearch()}
                      disabled={isSearching}
                      className="pl-12 pr-4 py-6 text-lg rounded-xl border-2 border-white/30 focus:border-white bg-white text-gray-800 placeholder:text-gray-500 disabled:bg-gray-50 disabled:text-gray-500"
                      data-testid="search-input"
                    />
                  </div>
                  <Button
                    onClick={handleSearch}
                    disabled={isSearching || !searchQuery.trim()}
                    className="px-8 py-6 rounded-xl bg-white hover:bg-white/90 text-purple-600 font-semibold disabled:opacity-50"
                    data-testid="search-submit"
                  >
                    {isSearching ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <Sparkles size={20} />
                    )}
                  </Button>
                </div>
                
                {/* Loading State */}
                {isSearching && (
                  <div className="mt-4 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <Loader2 className="animate-spin text-white" size={20} />
                      <div>
                        <p className="text-white font-semibold">AI is analyzing your request...</p>
                        <p className="text-white/80 text-sm">This may take 10-30 seconds</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Search Results */}
              {searchResults && (
                <div className="mt-6 bg-white rounded-xl p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-black">Results</h3>
                    <Button
                      onClick={resetSearch}
                      variant="ghost"
                      size="sm"
                      className="text-gray-600 hover:text-black"
                      data-testid="clear-search"
                    >
                      <X size={16} className="mr-1" />
                      Clear
                    </Button>
                  </div>

                  {searchResults.type === 'error' && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <p className="text-red-800">{searchResults.message}</p>
                    </div>
                  )}

                  {searchResults.type === 'conversational' && searchResults.recommendations && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {searchResults.recommendations.map((rec, idx) => (
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
                            data-testid={`ai-result-${idx}`}
                          >
                            <div className="flex gap-4">
                              {rec.poster_url && (
                                <img
                                  src={rec.poster_url}
                                  alt={rec.title}
                                  className="w-20 h-28 object-cover rounded-lg shadow-sm flex-shrink-0"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {getMediaIcon(rec.type)}
                                  <span className="text-xs font-medium text-gray-500 uppercase">{rec.type}</span>
                                </div>
                                <h4 className="font-semibold text-black mb-2 line-clamp-2">{rec.title}</h4>
                                <p className="text-sm text-gray-600 line-clamp-3">{rec.description}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Friends Lists */}
            <div>
              <MediaCarousel
                title="Sarah's Currently Reading You Might Like"
                mediaType="book"
                items={[
                  { id: '1', title: 'The Midnight Library', author: 'Matt Haig', imageUrl: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1602190253i/52578297.jpg', mediaType: 'book', externalId: '52578297', externalSource: 'goodreads' },
                  { id: '2', title: 'Project Hail Mary', author: 'Andy Weir', imageUrl: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1597695864i/54493401.jpg', mediaType: 'book', externalId: '54493401', externalSource: 'goodreads' },
                  { id: '3', title: 'Atomic Habits', author: 'James Clear', imageUrl: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1655988385i/40121378.jpg', mediaType: 'book', externalId: '40121378', externalSource: 'goodreads' },
                  { id: '4', title: 'The Silent Patient', author: 'Alex Michaelides', imageUrl: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1582759969i/40097951.jpg', mediaType: 'book', externalId: '40097951', externalSource: 'goodreads' },
                  { id: '5', title: 'The Seven Husbands of Evelyn Hugo', author: 'Taylor Jenkins Reid', imageUrl: 'https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1618329605i/32620332.jpg', mediaType: 'book', externalId: '32620332', externalSource: 'goodreads' }
                ]}
                onItemClick={handleMediaClick}
              />
            </div>

            <div>
              <MediaCarousel
                title="Mike's Queue You Might Like"
                mediaType="movie"
                items={[
                  { id: '1', title: 'Oppenheimer', imageUrl: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', mediaType: 'movie', externalId: '872585', externalSource: 'tmdb' },
                  { id: '2', title: 'The Killer', imageUrl: 'https://image.tmdb.org/t/p/w500/e7Jvsry47JJQruuezjU2X1Z6J77.jpg', mediaType: 'movie', externalId: '359724', externalSource: 'tmdb' },
                  { id: '3', title: 'Poor Things', imageUrl: 'https://image.tmdb.org/t/p/w500/kCGlIMHnOm8JPXq3rXM6c5wMxcT.jpg', mediaType: 'movie', externalId: '792307', externalSource: 'tmdb' },
                  { id: '4', title: 'Killers of the Flower Moon', imageUrl: 'https://image.tmdb.org/t/p/w500/dB6Krk806zeqd0YNp2ngQ9zXteH.jpg', mediaType: 'movie', externalId: '466420', externalSource: 'tmdb' },
                  { id: '5', title: 'The Zone of Interest', imageUrl: 'https://image.tmdb.org/t/p/w500/hUu9zyZmDd8VZegKi1iK1Vk0RYS.jpg', mediaType: 'movie', externalId: '762430', externalSource: 'tmdb' }
                ]}
                onItemClick={handleMediaClick}
              />
            </div>

            {/* Trending Content Carousels */}
            {netflixTVShows.length > 0 && (
              <div>
                <MediaCarousel 
                  title="Trending on Netflix" 
                  mediaType="tv" 
                  items={netflixTVShows} 
                  onItemClick={handleMediaClick} 
                />
              </div>
            )}

            {netflixMovies.length > 0 && (
              <div>
                <MediaCarousel 
                  title="Trending Movies" 
                  mediaType="movie" 
                  items={netflixMovies} 
                  onItemClick={handleMediaClick} 
                />
              </div>
            )}
            </div>
          )}

          {/* Lists View */}
          {activeView === 'lists' && (
            <div className="space-y-6">
            {isLoadingLists ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-purple-600" size={32} />
              </div>
            ) : (
              <>
                {/* Create Button */}
                <div className="flex justify-center">
                  <Button
                    onClick={() => setIsCreateListDialogOpen(true)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-md"
                    data-testid="button-create-custom-list"
                  >
                    <Plus size={18} className="mr-2" />
                    Create Custom List
                  </Button>
                </div>

                {/* All Lists - Compact Single Column */}
                {(systemLists.length > 0 || customLists.length > 0) && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {/* System Lists */}
                    {systemLists.length > 0 && (
                      <>
                        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                          <h3 className="text-xs font-semibold text-gray-500 uppercase">Your Lists</h3>
                          <span className="text-xs text-gray-600">
                            {userLists.reduce((total: number, list: any) => total + (list.item_count || 0), 0)} items total
                          </span>
                        </div>
                        {systemLists.map((list: any, idx: number) => (
                          <div
                            key={list.id}
                            onClick={() => setLocation(`/list/${list.id}`)}
                            className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                              idx < systemLists.length - 1 || customLists.length > 0 ? 'border-b border-gray-100' : ''
                            }`}
                            data-testid={`list-${list.id}`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                                <ListIcon className="text-purple-600" size={18} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-black truncate">{list.title}</h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-gray-500">{list.item_count || 0} items</span>
                                  {list.is_private && (
                                    <div className="flex items-center gap-1">
                                      <Lock size={10} className="text-purple-600" />
                                      <span className="text-xs text-purple-600">Private</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <ChevronRight className="text-gray-400 flex-shrink-0" size={18} />
                          </div>
                        ))}
                      </>
                    )}

                    {/* Custom Lists */}
                    {customLists.length > 0 && (
                      <>
                        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                          <h3 className="text-xs font-semibold text-gray-500 uppercase">Custom Lists</h3>
                        </div>
                        {customLists.map((list: any, idx: number) => (
                          <div
                            key={list.id}
                            onClick={() => setLocation(`/list/${list.id}`)}
                            className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                              idx < customLists.length - 1 ? 'border-b border-gray-100' : ''
                            }`}
                            data-testid={`custom-list-${list.id}`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <ListIcon className="text-blue-600" size={18} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-black truncate">{list.title}</h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-gray-500">{list.item_count || 0} items</span>
                                  {list.is_private && (
                                    <div className="flex items-center gap-1">
                                      <Lock size={10} className="text-purple-600" />
                                      <span className="text-xs text-purple-600">Private</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <ChevronRight className="text-gray-400 flex-shrink-0" size={18} />
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {/* Empty State */}
                {systemLists.length === 0 && customLists.length === 0 && (
                  <div className="text-center py-12">
                    <ListIcon className="mx-auto text-gray-300 mb-4" size={48} />
                    <p className="text-gray-500 text-lg">No lists yet</p>
                    <p className="text-gray-400 text-sm mt-2">Start tracking media to build your collection</p>
                  </div>
                )}
              </>
            )}
            </div>
          )}

          {/* Media History View */}
          {activeView === 'media-history' && (
            <div className="space-y-4">
              {isLoadingLists ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-purple-600" size={32} />
                </div>
              ) : (() => {
                // Flatten all items from all lists and sort by date
                const allItems = userLists
                  .filter((list: any) => list.id !== 'all')
                  .flatMap((list: any) => 
                    (list.items || []).map((item: any) => ({
                      ...item,
                      listName: list.title
                    }))
                  )
                  .sort((a: any, b: any) => 
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  );

                // Apply filters
                const filteredItems = allItems.filter((item: any) => {
                  const itemDate = new Date(item.created_at);
                  const yearMatch = mediaHistoryYear === "all" || itemDate.getFullYear().toString() === mediaHistoryYear;
                  const monthMatch = mediaHistoryMonth === "all" || (itemDate.getMonth() + 1).toString() === mediaHistoryMonth;
                  
                  let typeMatch = true;
                  if (mediaHistoryType !== "all") {
                    if (mediaHistoryType === "movies") typeMatch = item.media_type === "movie";
                    else if (mediaHistoryType === "tv") typeMatch = item.media_type === "tv";
                    else if (mediaHistoryType === "books") typeMatch = item.media_type === "book";
                    else if (mediaHistoryType === "music") typeMatch = item.media_type === "music";
                    else if (mediaHistoryType === "podcasts") typeMatch = item.media_type === "podcast";
                    else if (mediaHistoryType === "games") typeMatch = item.media_type === "game";
                  }
                  
                  const searchMatch = !mediaHistorySearch.trim() || 
                    item.title?.toLowerCase().includes(mediaHistorySearch.toLowerCase()) ||
                    item.creator?.toLowerCase().includes(mediaHistorySearch.toLowerCase());
                  
                  return yearMatch && monthMatch && typeMatch && searchMatch;
                });

                // Calculate media type counts
                const mediaTypeCounts = allItems.reduce((acc: any, item: any) => {
                  const type = item.media_type;
                  acc[type] = (acc[type] || 0) + 1;
                  return acc;
                }, {});

                // Get unique years
                const years = [...new Set(allItems.map((item: any) => new Date(item.created_at).getFullYear()))].sort((a, b) => b - a);

                return (
                  <>
                    {/* Search Bar */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="text"
                        value={mediaHistorySearch}
                        onChange={(e) => setMediaHistorySearch(e.target.value)}
                        placeholder="Search your media history..."
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        data-testid="input-media-history-search"
                      />
                    </div>

                    {/* Filter Buttons */}
                    <div className="flex gap-2 flex-wrap items-center">
                      {/* Year Filter */}
                      <div className="relative">
                        <button
                          onClick={() => setOpenFilterDropdown(openFilterDropdown === 'year' ? null : 'year')}
                          className={`px-4 py-2 rounded-full border ${
                            mediaHistoryYear !== "all" 
                              ? 'border-purple-600 bg-purple-50 text-purple-700' 
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          } text-sm font-medium flex items-center gap-2`}
                          data-testid="button-filter-year"
                        >
                          Year
                          <ChevronDown size={14} />
                        </button>
                        {openFilterDropdown === 'year' && (
                          <div className="absolute top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]">
                            <button
                              onClick={() => {
                                setMediaHistoryYear("all");
                                setOpenFilterDropdown(null);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                            >
                              All Years
                            </button>
                            {years.map((year) => (
                              <button
                                key={year}
                                onClick={() => {
                                  setMediaHistoryYear(year.toString());
                                  setOpenFilterDropdown(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                              >
                                {year}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Month Filter */}
                      <div className="relative">
                        <button
                          onClick={() => setOpenFilterDropdown(openFilterDropdown === 'month' ? null : 'month')}
                          className={`px-4 py-2 rounded-full border ${
                            mediaHistoryMonth !== "all" 
                              ? 'border-purple-600 bg-purple-50 text-purple-700' 
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          } text-sm font-medium flex items-center gap-2`}
                          data-testid="button-filter-month"
                        >
                          Month
                          <ChevronDown size={14} />
                        </button>
                        {openFilterDropdown === 'month' && (
                          <div className="absolute top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px] max-h-64 overflow-y-auto">
                            <button
                              onClick={() => {
                                setMediaHistoryMonth("all");
                                setOpenFilterDropdown(null);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                            >
                              All Months
                            </button>
                            {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((month, idx) => (
                              <button
                                key={month}
                                onClick={() => {
                                  setMediaHistoryMonth((idx + 1).toString());
                                  setOpenFilterDropdown(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                              >
                                {month}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Type Filter */}
                      <div className="relative">
                        <button
                          onClick={() => setOpenFilterDropdown(openFilterDropdown === 'type' ? null : 'type')}
                          className={`px-4 py-2 rounded-full border ${
                            mediaHistoryType !== "all" 
                              ? 'border-purple-600 bg-purple-50 text-purple-700' 
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          } text-sm font-medium flex items-center gap-2`}
                          data-testid="button-filter-type"
                        >
                          Type
                          <ChevronDown size={14} />
                        </button>
                        {openFilterDropdown === 'type' && (
                          <div className="absolute top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]">
                            <button
                              onClick={() => {
                                setMediaHistoryType("all");
                                setOpenFilterDropdown(null);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                            >
                              All Types
                            </button>
                            <button
                              onClick={() => {
                                setMediaHistoryType("movies");
                                setOpenFilterDropdown(null);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                            >
                              Movies
                            </button>
                            <button
                              onClick={() => {
                                setMediaHistoryType("tv");
                                setOpenFilterDropdown(null);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                            >
                              TV Shows
                            </button>
                            <button
                              onClick={() => {
                                setMediaHistoryType("books");
                                setOpenFilterDropdown(null);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                            >
                              Books
                            </button>
                            <button
                              onClick={() => {
                                setMediaHistoryType("music");
                                setOpenFilterDropdown(null);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                            >
                              Music
                            </button>
                            <button
                              onClick={() => {
                                setMediaHistoryType("podcasts");
                                setOpenFilterDropdown(null);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                            >
                              Podcasts
                            </button>
                            <button
                              onClick={() => {
                                setMediaHistoryType("games");
                                setOpenFilterDropdown(null);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                            >
                              Games
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Clear All Filters */}
                      {(mediaHistoryYear !== "all" || mediaHistoryMonth !== "all" || mediaHistoryType !== "all") && (
                        <button
                          onClick={() => {
                            setMediaHistoryYear("all");
                            setMediaHistoryMonth("all");
                            setMediaHistoryType("all");
                          }}
                          className="px-4 py-2 rounded-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium"
                          data-testid="button-clear-filters"
                        >
                          Clear all
                        </button>
                      )}
                    </div>

                    {/* Overview Stats */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">Overview</h3>
                      <div className="flex flex-wrap gap-2">
                        {mediaTypeCounts.music > 0 && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 rounded-full border border-purple-100">
                            <span className="text-sm">🎵</span>
                            <span className="text-sm font-medium text-gray-900">{mediaTypeCounts.music}</span>
                            <span className="text-xs text-gray-600">songs</span>
                          </div>
                        )}
                        {mediaTypeCounts.movie > 0 && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 rounded-full border border-teal-100">
                            <span className="text-sm">🎬</span>
                            <span className="text-sm font-medium text-gray-900">{mediaTypeCounts.movie}</span>
                            <span className="text-xs text-gray-600">watched</span>
                          </div>
                        )}
                        {mediaTypeCounts.tv > 0 && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 rounded-full border border-indigo-100">
                            <span className="text-sm">📺</span>
                            <span className="text-sm font-medium text-gray-900">{mediaTypeCounts.tv}</span>
                            <span className="text-xs text-gray-600">series</span>
                          </div>
                        )}
                        {mediaTypeCounts.book > 0 && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-full border border-amber-100">
                            <span className="text-sm">📚</span>
                            <span className="text-sm font-medium text-gray-900">{mediaTypeCounts.book}</span>
                            <span className="text-xs text-gray-600">completed</span>
                          </div>
                        )}
                        {mediaTypeCounts.podcast > 0 && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 rounded-full border border-rose-100">
                            <span className="text-sm">🎙️</span>
                            <span className="text-sm font-medium text-gray-900">{mediaTypeCounts.podcast}</span>
                            <span className="text-xs text-gray-600">podcasts</span>
                          </div>
                        )}
                        {mediaTypeCounts.game > 0 && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-full border border-green-100">
                            <span className="text-sm">🎮</span>
                            <span className="text-sm font-medium text-gray-900">{mediaTypeCounts.game}</span>
                            <span className="text-xs text-gray-600">games</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Media History List */}
                    {filteredItems.length > 0 ? (
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        {filteredItems.map((item: any, idx: number) => (
                          <div
                            key={`${item.id}-${idx}`}
                            onClick={() => {
                              const mediaType = item.media_type || 'movie';
                              const source = item.external_source || 'tmdb';
                              const id = item.external_id;
                              if (id) setLocation(`/media/${mediaType}/${source}/${id}`);
                            }}
                            className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                              idx < filteredItems.length - 1 ? 'border-b border-gray-100' : ''
                            }`}
                          >
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.title}
                                className="w-12 h-16 object-cover rounded flex-shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-16 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                                <Film className="text-gray-400" size={20} />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-black truncate text-sm">{item.title}</h4>
                              <p className="text-xs text-gray-500 truncate">
                                {item.media_type === 'tv' ? 'TV Show' : 
                                 item.media_type === 'movie' ? 'Movie' : 
                                 item.media_type === 'book' ? 'Book' : 
                                 item.media_type === 'music' ? 'Music' : 
                                 item.media_type === 'podcast' ? 'Podcast' : 
                                 item.media_type === 'game' ? 'Game' : item.type}
                                {item.creator && ` • ${item.creator}`}
                              </p>
                              <p className="text-xs text-purple-600">{item.listName}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs text-gray-400">
                                {new Date(item.created_at).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric'
                                })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                        <TrendingUp className="mx-auto text-gray-300 mb-4" size={48} />
                        <p className="text-gray-500 text-lg">
                          {allItems.length === 0 ? "No media tracked yet" : "No results found"}
                        </p>
                        <p className="text-gray-400 text-sm mt-2">
                          {allItems.length === 0 
                            ? "Start adding media to your lists to see your history"
                            : "Try adjusting your filters or search"}
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Create Custom List Dialog */}
      <CreateListDialog
        open={isCreateListDialogOpen}
        onOpenChange={setIsCreateListDialogOpen}
      />
    </div>
  );
}
