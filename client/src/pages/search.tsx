import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, Sparkles, Loader2, Film, Music, BookOpen, Tv, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

interface DirectResult {
  id: string;
  title: string;
  type: string;
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

export default function Search() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMediaFilter, setSelectedMediaFilter] = useState<string>("all");
  const { session } = useAuth();
  const [, setLocation] = useLocation();

  const mediaFilters = [
    { id: "all", label: "All" },
    { id: "tv", label: "TV Shows" },
    { id: "movie", label: "Movies" },
    { id: "book", label: "Books" },
    { id: "podcast", label: "Podcasts" },
    { id: "game", label: "Gaming" },
  ];

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
          externalSource: 'tmdb'
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
          externalSource: 'tmdb'
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
          externalSource: 'tmdb'
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
          externalSource: 'spotify'
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

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-semibold text-black mb-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Ask Anything
          </h1>
          <p className="text-base text-gray-600">
            Ask for recommendations — or see what people are saying about anything you're consuming.
          </p>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
          <div className="p-6">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center text-white flex-shrink-0">
                <Sparkles size={20} />
              </div>
              <div className="flex-1">
                <Textarea
                  placeholder="Ask about anything you're consuming… what to watch next, what friends are saying, recommendations, or search for specific shows, movies, books, music"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !isSearching) {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                  disabled={isSearching}
                  className="border-none p-0 text-base resize-none focus-visible:ring-0 focus-visible:ring-offset-0 text-gray-900 bg-white placeholder:text-base placeholder:text-gray-400 min-h-[100px]"
                  data-testid="search-input"
                />
              </div>
            </div>
          </div>
          
          <div className="px-6 pb-4 border-t border-gray-100 pt-4 flex justify-end">
            <Button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium disabled:opacity-50"
              data-testid="search-submit"
            >
              {isSearching ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} />
                  Searching...
                </>
              ) : (
                <>
                  <Sparkles size={16} className="mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>
          
          {/* Try Asking Examples */}
          {!searchResults && !isSearching && (
            <div className="px-6 pb-4">
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
                      setTimeout(() => handleSearch(), 100);
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
          
          {/* Loading State Message */}
          {isSearching && (
            <div className="px-6 pb-4">
              <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-lg p-4">
                <Loader2 className="animate-spin text-purple-600" size={20} />
                <div>
                  <p className="text-purple-900 font-semibold">AI is analyzing your request...</p>
                  <p className="text-purple-700 text-sm">This may take 10-30 seconds</p>
                </div>
              </div>
            </div>
          )}

        {/* Search Results - Three Section Layout */}
        {searchResults && (
          <div className="mt-6 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">Results</h3>
                <Button
                  onClick={resetSearch}
                  variant="ghost"
                  size="sm"
                  className="text-white/90 hover:text-white"
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

              {/* SECTION 1: Conversation Results */}
              {searchResults.conversations && searchResults.conversations.length > 0 && (
                <div className="bg-white rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xl font-bold text-black flex items-center gap-2">
                      🔥 Talk About {searchQuery}
                    </h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">Top fan conversations, predictions, polls, and reviews</p>
                  <div className="space-y-3 mb-4">
                    {searchResults.conversations.slice(0, 3).map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() => setLocation('/feed')}
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
                  <Button
                    onClick={() => setLocation('/feed')}
                    variant="outline"
                    className="w-full border-purple-600 text-purple-600 hover:bg-purple-50"
                    data-testid="see-all-talk"
                  >
                    See all Talk →
                  </Button>
                </div>
              )}

              {/* SECTION 2: Recommendation Results */}
              {searchResults.recommendations && searchResults.recommendations.length > 0 && (
                <div className="bg-white rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xl font-bold text-black flex items-center gap-2">
                      🎯 Personalized Recommendations
                    </h4>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">Because you watched, based on your friends' ratings, trending with similar users</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {searchResults.recommendations.slice(0, 4).map((rec, idx) => (
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
                  <Button
                    variant="outline"
                    className="w-full border-purple-600 text-purple-600 hover:bg-purple-50"
                    data-testid="see-more-recommendations"
                  >
                    See more recommendations
                  </Button>
                </div>
              )}

              {/* SECTION 3: Media Page Previews */}
              {searchResults.mediaResults && searchResults.mediaResults.length > 0 && (
                <div className="bg-white rounded-xl p-6">
                  <h4 className="text-xl font-bold text-black mb-4">Media Results</h4>
                  <div className="space-y-3">
                    {searchResults.mediaResults.map((result) => (
                      <div
                        key={result.id}
                        className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:border-purple-400 transition-colors"
                        data-testid={`media-result-${result.id}`}
                      >
                        <div className="flex items-start gap-4">
                          {result.poster_url && (
                            <img
                              src={result.poster_url}
                              alt={result.title}
                              className="w-20 h-28 object-cover rounded-lg flex-shrink-0"
                            />
                          )}
                          <div className="flex-1">
                            <div className="flex items-start gap-2 mb-2">
                              {getMediaIcon(result.type)}
                              <h5 className="font-semibold text-black flex-1">{result.title}</h5>
                            </div>
                            {result.year && (
                              <p className="text-sm text-gray-600 mb-2">{result.year} • {result.type}</p>
                            )}
                            {result.rating && (
                              <div className="flex items-center gap-1 mb-2">
                                <span className="text-sm text-gray-600">⭐ {result.rating}</span>
                              </div>
                            )}
                            {result.description && (
                              <p className="text-sm text-gray-700 mb-3 line-clamp-2">{result.description}</p>
                            )}
                            <Button
                              onClick={() => handleResultClick(result)}
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700 text-white"
                              data-testid={`open-media-${result.id}`}
                            >
                              Open Media Page →
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Legacy support for old result formats */}
              {searchResults.type === 'direct' && searchResults.results && !searchResults.mediaResults && (
                <div className="bg-white rounded-xl p-6">
                  <h4 className="text-xl font-bold text-black mb-4">Results</h4>
                  <div className="space-y-3">
                    {searchResults.results.map((result) => (
                      <div
                        key={result.id}
                        onClick={() => handleResultClick(result)}
                        className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:border-purple-400 transition-colors cursor-pointer"
                        data-testid={`search-result-${result.id}`}
                      >
                        <div className="flex items-start gap-4">
                          {result.poster_url && (
                            <img
                              src={result.poster_url}
                              alt={result.title}
                              className="w-16 h-24 object-cover rounded-lg"
                            />
                          )}
                          <div className="flex-1">
                            <div className="flex items-start gap-2">
                              {getMediaIcon(result.type)}
                              <h4 className="font-semibold text-black flex-1">{result.title}</h4>
                            </div>
                            {result.year && (
                              <p className="text-sm text-gray-600 mt-1">{result.year}</p>
                            )}
                            {result.description && (
                              <p className="text-sm text-gray-700 mt-2 line-clamp-2">{result.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <span className="inline-block text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                                {result.type}
                              </span>
                              {result.rating && (
                                <span className="text-xs text-gray-600">⭐ {result.rating}</span>
                              )}
                            </div>
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

        {/* Media Type Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide justify-center">
          {mediaFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setSelectedMediaFilter(filter.id)}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors border ${
                selectedMediaFilter === filter.id
                  ? 'bg-white text-purple-600 border-gray-200 shadow-sm'
                  : 'bg-white text-gray-700 border-transparent hover:bg-gray-100'
              }`}
              data-testid={`filter-${filter.id}`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Trending Content Sections */}
        <div className="space-y-8">
          {/* Personalized Recommendations - First Row */}
          {recommendedContent.length > 0 && (selectedMediaFilter === "all") && (
            <MediaCarousel
              title="Recommended For You"
              mediaType="mixed"
              items={recommendedContent}
              onItemClick={handleMediaClick}
            />
          )}

          {/* Top Shows Across All Streaming Platforms - Second Row */}
          {(netflixTVShows.length > 0 || hboTVShows.length > 0) && (selectedMediaFilter === "all" || selectedMediaFilter === "tv") && (
            <MediaCarousel
              title="Top Shows Across All Streaming Platforms"
              mediaType="tv"
              items={[...netflixTVShows.slice(0, 10), ...hboTVShows.slice(0, 10)]}
              onItemClick={handleMediaClick}
            />
          )}

          {/* Netflix Top Movies */}
          {netflixMovies.length > 0 && (selectedMediaFilter === "all" || selectedMediaFilter === "movie") && (
            <MediaCarousel
              title="Top 10 Movies on Netflix"
              mediaType="movie"
              items={netflixMovies}
              onItemClick={handleMediaClick}
            />
          )}

          {/* Paramount+ Top Movies */}
          {paramountMovies.length > 0 && (selectedMediaFilter === "all" || selectedMediaFilter === "movie") && (
            <MediaCarousel
              title="Top 10 Movies on Paramount+"
              mediaType="movie"
              items={paramountMovies}
              onItemClick={handleMediaClick}
            />
          )}

          {/* Trending TV Shows */}
          {trendingTVShows.length > 0 && (selectedMediaFilter === "all" || selectedMediaFilter === "tv") && (
            <MediaCarousel
              title="Trending TV Shows"
              mediaType="tv"
              items={trendingTVShows}
              onItemClick={handleMediaClick}
            />
          )}

          {/* Trending Movies */}
          {trendingMovies.length > 0 && (selectedMediaFilter === "all" || selectedMediaFilter === "movie") && (
            <MediaCarousel
              title="Trending Movies"
              mediaType="movie"
              items={trendingMovies}
              onItemClick={handleMediaClick}
            />
          )}

          {/* Top Gaming */}
          {topGames.length > 0 && (selectedMediaFilter === "all" || selectedMediaFilter === "game") && (
            <MediaCarousel
              title="Top Gaming"
              mediaType="game"
              items={topGames}
              onItemClick={handleMediaClick}
            />
          )}

          {/* NY Times Bestsellers */}
          {bestsellerBooks.length > 0 && (selectedMediaFilter === "all" || selectedMediaFilter === "book") && (
            <MediaCarousel
              title="NY Times Bestsellers"
              mediaType="book"
              items={bestsellerBooks}
              onItemClick={handleMediaClick}
            />
          )}

          {/* Trending Podcasts */}
          {trendingPodcasts.length > 0 && (selectedMediaFilter === "all" || selectedMediaFilter === "podcast") && (
            <MediaCarousel
              title="Trending Podcasts"
              mediaType="podcast"
              items={trendingPodcasts}
              onItemClick={handleMediaClick}
            />
          )}
        </div>
      </div>
    </div>
  );
}
