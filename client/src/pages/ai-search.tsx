import { useState } from "react";
import { Search, Sparkles, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface SearchResult {
  type: 'conversational' | 'direct' | 'error';
  explanation?: string;
  recommendations?: Recommendation[];
  searchSuggestions?: string[];
  results?: DirectResult[];
  message?: string;
}

export default function AISearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const { session } = useAuth();
  const [, setLocation] = useLocation();

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

  const handleMediaClick = (media: Recommendation | DirectResult) => {
    const external_id = 'searchTerm' in media ? media.external_id : media.external_id;
    const external_source = 'searchTerm' in media ? media.external_source : media.external_source;
    const type = media.type;
    
    // Navigate to media detail page using the correct route pattern
    if (type && external_source && external_id) {
      setLocation(`/media/${type}/${external_source}/${external_id}`);
    } else {
      console.error('Missing required data for media navigation:', { type, external_source, external_id });
    }
  };

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 pt-16 pb-24">
        <div className="max-w-4xl mx-auto px-4 py-8">
          
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 mb-4">
              <Sparkles className="text-white" size={32} />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              AI-Powered Search
            </h1>
            <p className="text-lg text-gray-600">
              Ask in your own words and get personalized recommendations
            </p>
          </div>

          {/* Search Box */}
          <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl p-8 shadow-xl mb-8">
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={24} />
                <Input
                  type="text"
                  placeholder="my friend just watched xyz, show me more media like that"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isSearching && handleSearch()}
                  disabled={isSearching}
                  className="pl-12 pr-4 py-6 text-lg rounded-xl border-2 border-white/30 focus:border-white bg-white text-gray-800 placeholder:text-gray-500 disabled:bg-gray-50 disabled:text-gray-500"
                  data-testid="ai-search-input"
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="px-8 py-6 rounded-xl bg-white hover:bg-white/90 text-purple-600 font-semibold disabled:opacity-50"
                data-testid="ai-search-submit"
              >
                {isSearching ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Sparkles size={20} />
                )}
              </Button>
            </div>
            
            {/* Loading State Message */}
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

            {/* Quick Examples */}
            {!searchResults && !isSearching && (
              <div className="mt-4">
                <p className="text-white/80 text-sm mb-2">Try asking:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Shows like The Bear",
                    "Books similar to Project Hail Mary",
                    "Movies for a rainy Sunday",
                    "Uplifting podcasts about creativity"
                  ].map((example) => (
                    <button
                      key={example}
                      onClick={() => setSearchQuery(example)}
                      className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-sm transition-colors"
                      data-testid={`example-${example.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Search Results */}
          {searchResults && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Results</h2>
                <Button
                  onClick={resetSearch}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  data-testid="reset-search"
                >
                  <X size={16} />
                  New Search
                </Button>
              </div>

              {/* Error State */}
              {searchResults.type === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-800">{searchResults.message}</p>
                </div>
              )}

              {/* Conversational Results */}
              {searchResults.type === 'conversational' && (
                <div>
                  {searchResults.explanation && (
                    <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                      <p className="text-gray-700">{searchResults.explanation}</p>
                    </div>
                  )}
                  
                  {searchResults.recommendations && searchResults.recommendations.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {searchResults.recommendations.map((rec, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleMediaClick(rec)}
                          className="group text-left bg-gray-50 hover:bg-gray-100 rounded-xl p-4 transition-all hover:shadow-md"
                          data-testid={`recommendation-${idx}`}
                        >
                          {rec.poster_url && (
                            <img
                              src={rec.poster_url}
                              alt={rec.title}
                              className="w-full aspect-[2/3] object-cover rounded-lg mb-3"
                            />
                          )}
                          <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-purple-600 transition-colors">
                            {rec.title}
                          </h3>
                          {rec.year && (
                            <p className="text-sm text-gray-500 mt-1">{rec.year}</p>
                          )}
                          {rec.description && (
                            <p className="text-sm text-gray-600 mt-2 line-clamp-3">{rec.description}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {searchResults.searchSuggestions && searchResults.searchSuggestions.length > 0 && (
                    <div className="mt-6">
                      <h3 className="font-semibold text-gray-900 mb-3">Try searching for:</h3>
                      <div className="flex flex-wrap gap-2">
                        {searchResults.searchSuggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSearchQuery(suggestion)}
                            className="px-4 py-2 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 text-sm transition-colors"
                            data-testid={`suggestion-${idx}`}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Direct Results */}
              {searchResults.type === 'direct' && searchResults.results && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {searchResults.results.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleMediaClick(result)}
                      className="group text-left bg-gray-50 hover:bg-gray-100 rounded-xl p-4 transition-all hover:shadow-md"
                      data-testid={`result-${idx}`}
                    >
                      {result.poster_url && (
                        <img
                          src={result.poster_url}
                          alt={result.title}
                          className="w-full aspect-[2/3] object-cover rounded-lg mb-3"
                        />
                      )}
                      <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-purple-600 transition-colors">
                        {result.title}
                      </h3>
                      {result.year && (
                        <p className="text-sm text-gray-500 mt-1">{result.year}</p>
                      )}
                      {result.description && (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-3">{result.description}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
