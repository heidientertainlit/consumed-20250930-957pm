import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Sparkles, Loader2, Film, Music, BookOpen, Tv, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MediaCarousel from "@/components/media-carousel";
import Navigation from "@/components/navigation";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";

interface Recommendation {
  title: string;
  type: string;
  description: string;
  searchTerm: string;
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

interface SearchResult {
  type: 'conversational' | 'direct' | 'error';
  explanation?: string;
  recommendations?: Recommendation[];
  searchSuggestions?: string[];
  results?: DirectResult[];
  message?: string;
}

export default function Discover() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const { session } = useAuth();
  const [, setLocation] = useLocation();

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

  // Fetch personalized recommendations
  const { data: recommendedContent = [] } = useQuery({
    queryKey: ['user-recommendations'],
    enabled: !!session?.access_token,
    queryFn: async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/get-user-recommendations`, {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data;
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
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black pb-24">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-white mb-3 flex items-center gap-2">
            <span>✨</span> Discover
          </h1>
          <p className="text-base text-gray-300">
            Get AI-powered recommendations or explore trending content across all platforms
          </p>
        </div>

        {/* AI Recommendation Engine Section */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="text-purple-400" size={20} />
              AI Recommendation Engine
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Describe what you're in the mood for and get personalized suggestions
            </p>
          </div>
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
                <Input
                  type="text"
                  placeholder="Try 'uplifting movies' or 'sci-fi like Blade Runner'..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-12 pr-4 py-6 text-lg rounded-xl border-2 border-gray-700 focus:border-purple-500 bg-gray-800 text-white placeholder:text-gray-500"
                  data-testid="search-input"
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="px-8 py-6 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold"
                data-testid="search-submit"
              >
                {isSearching ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Sparkles size={20} />
                )}
              </Button>
            </div>
          </div>

          {/* Search Results */}
          {searchResults && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Results</h3>
                <Button
                  onClick={resetSearch}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white"
                  data-testid="clear-search"
                >
                  <X size={16} className="mr-1" />
                  Clear
                </Button>
              </div>

              {searchResults.type === 'error' && (
                <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4">
                  <p className="text-red-300">{searchResults.message}</p>
                </div>
              )}

              {searchResults.type === 'conversational' && searchResults.recommendations && (
                <div className="space-y-3">
                  {searchResults.explanation && (
                    <p className="text-gray-300 mb-4">{searchResults.explanation}</p>
                  )}
                  {searchResults.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:border-purple-500/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {getMediaIcon(rec.type)}
                        <div className="flex-1">
                          <h4 className="font-semibold text-white">{rec.title}</h4>
                          <p className="text-sm text-gray-400 mt-1">{rec.description}</p>
                          <span className="inline-block mt-2 text-xs px-2 py-1 bg-purple-600/30 text-purple-300 rounded-full">
                            {rec.type}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchResults.type === 'direct' && searchResults.results && (
                <div className="space-y-3">
                  {searchResults.results.map((result) => (
                    <div
                      key={result.id}
                      onClick={() => handleResultClick(result)}
                      className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:border-purple-500/50 transition-colors cursor-pointer"
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
                            <h4 className="font-semibold text-white flex-1">{result.title}</h4>
                          </div>
                          {result.year && (
                            <p className="text-sm text-gray-400 mt-1">{result.year}</p>
                          )}
                          {result.description && (
                            <p className="text-sm text-gray-300 mt-2 line-clamp-2">{result.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="inline-block text-xs px-2 py-1 bg-purple-600/30 text-purple-300 rounded-full">
                              {result.type}
                            </span>
                            {result.rating && (
                              <span className="text-xs text-gray-400">⭐ {result.rating}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Trending Content Sections */}
        <div className="space-y-8">
          {/* Personalized Recommendations */}
          {recommendedContent.length > 0 && (
            <MediaCarousel
              title="Recommended For You"
              mediaType="mixed"
              items={recommendedContent}
              onItemClick={handleMediaClick}
            />
          )}

          {/* Netflix Top TV Shows */}
          {netflixTVShows.length > 0 && (
            <MediaCarousel
              title="Top 10 on Netflix"
              mediaType="tv"
              items={netflixTVShows}
              onItemClick={handleMediaClick}
            />
          )}

          {/* HBO Max Top TV Shows */}
          {hboTVShows.length > 0 && (
            <MediaCarousel
              title="Top 10 on HBO Max"
              mediaType="tv"
              items={hboTVShows}
              onItemClick={handleMediaClick}
            />
          )}

          {/* Paramount+ Top Movies */}
          {paramountMovies.length > 0 && (
            <MediaCarousel
              title="Top 10 on Paramount+"
              mediaType="movie"
              items={paramountMovies}
              onItemClick={handleMediaClick}
            />
          )}

          {/* Trending TV Shows */}
          {trendingTVShows.length > 0 && (
            <MediaCarousel
              title="Trending TV Shows"
              mediaType="tv"
              items={trendingTVShows}
              onItemClick={handleMediaClick}
            />
          )}

          {/* Trending Movies */}
          {trendingMovies.length > 0 && (
            <MediaCarousel
              title="Trending Movies"
              mediaType="movie"
              items={trendingMovies}
              onItemClick={handleMediaClick}
            />
          )}

          {/* NY Times Bestsellers */}
          {bestsellerBooks.length > 0 && (
            <MediaCarousel
              title="NY Times Bestsellers"
              mediaType="book"
              items={bestsellerBooks}
              onItemClick={handleMediaClick}
            />
          )}

          {/* Trending Podcasts */}
          {trendingPodcasts.length > 0 && (
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
