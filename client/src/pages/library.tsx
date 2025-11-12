import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Sparkles, Loader2, Film, Music, BookOpen, Tv, X, List as ListIcon, Library as LibraryIcon, ChevronRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MediaCarousel from "@/components/media-carousel";
import Navigation from "@/components/navigation";
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
            Discover new content or browse your collection
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="discover" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-gray-100 p-1">
            <TabsTrigger 
              value="discover" 
              className="text-sm text-gray-700 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all font-medium"
            >
              <Sparkles size={16} className="mr-2" />
              Discover
            </TabsTrigger>
            <TabsTrigger 
              value="my-media" 
              className="text-sm text-gray-700 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all font-medium"
            >
              <ListIcon size={16} className="mr-2" />
              My Media
            </TabsTrigger>
          </TabsList>

          {/* Discovery Tab */}
          <TabsContent value="discover" className="space-y-8">
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
          </TabsContent>

          {/* My Media Tab */}
          <TabsContent value="my-media" className="space-y-6">
            {isLoadingLists ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin text-purple-600" size={32} />
              </div>
            ) : (
              <>
                {/* Stats Card */}
                {userLists.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
                    <div className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                      {userLists.reduce((total: number, list: any) => total + (list.item_count || 0), 0)}
                    </div>
                    <div className="text-base text-gray-600">Media Items</div>
                  </div>
                )}

                {/* All Lists - Compact Single Column */}
                {(systemLists.length > 0 || customLists.length > 0) && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {/* System Lists */}
                    {systemLists.length > 0 && (
                      <>
                        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                          <h3 className="text-xs font-semibold text-gray-500 uppercase">Your Lists</h3>
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
