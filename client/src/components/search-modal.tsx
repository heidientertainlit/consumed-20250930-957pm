import { useState } from "react";
import { Search, X, Sparkles, User, Film, Music, BookOpen, Tv, Gamepad2, Loader2, Star, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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
}

interface SearchResult {
  type: 'conversational' | 'direct' | 'error';
  explanation?: string;
  recommendations?: Recommendation[];
  searchSuggestions?: string[];
  results?: DirectResult[];
  message?: string;
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const { session } = useAuth();

  if (!isOpen) return null;

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

  const searchExamples = [
    {
      category: "Personal Recommendations",
      icon: <Sparkles className="text-purple-600" size={16} />,
      examples: [
        "Movies like the book The Seven Husbands of Evelyn Hugo",
        "Something uplifting after a hard day",
        "Books similar to Harry Potter that I haven't read",
        "Dark and mysterious like True Detective"
      ]
    },
    {
      category: "Group Blends - Find What Everyone Will Love",
      icon: <Users className="text-green-600" size={16} />,
      examples: [
        "Something I can watch with my family, kids ages 8 and 12",
        "Recommendations for my book club based on our love of historical fiction",
        "Movies for me and my partner - we both love sci-fi and comedy",
        "Shows for our friend group that likes mystery and true crime"
      ]
    },
    {
      category: "Search Media & Creators",
      icon: <Film className="text-blue-600" size={16} />,
      examples: [
        "Christopher Nolan filmography",
        "Taylor Swift albums",
        "Books by Colleen Hoover",
        "Marvel movies in chronological order"
      ]
    }
  ];

  

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-16">
      <div className="bg-white rounded-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Search & Discover</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            data-testid="close-search"
          >
            <X size={18} className="text-gray-600" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-6 border-b border-gray-200">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Get personal recs, create group blends, or search media & creators..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim() && !isSearching && session) {
                    handleSearch();
                  }
                }}
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-700 focus:border-transparent text-lg text-black placeholder-gray-500"
                data-testid="search-input"
                autoFocus
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={!searchQuery.trim() || isSearching || !session}
              className="w-full bg-purple-700 hover:bg-purple-800 text-white disabled:opacity-50 px-6 py-3 text-lg"
              data-testid="search-submit-button"
            >
              {isSearching ? (
                <div className="flex items-center justify-center space-x-2">
                  <Loader2 className="animate-spin" size={16} />
                  <span>Searching...</span>
                </div>
              ) : (
                'Search'
              )}
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="animate-spin text-purple-600 mx-auto mb-3" size={32} />
                <p className="text-gray-600">Searching for recommendations...</p>
              </div>
            </div>
          ) : searchResults ? (
            <div>
              {/* Back to search */}
              <button
                onClick={resetSearch}
                className="flex items-center space-x-2 text-purple-600 hover:text-purple-700 mb-4"
                data-testid="back-to-search"
              >
                <X size={16} />
                <span className="text-sm">New Search</span>
              </button>

              {searchResults.type === 'error' ? (
                <div className="text-center py-8">
                  <p className="text-red-600 mb-2">⚠️ Search Error</p>
                  <p className="text-gray-600 text-sm">{searchResults.message}</p>
                </div>
              ) : searchResults.type === 'conversational' ? (
                <div className="space-y-6">
                  {/* AI Explanation */}
                  {searchResults.explanation && (
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <Sparkles className="text-purple-600 mt-1" size={18} />
                        <p className="text-purple-900 font-medium">{searchResults.explanation}</p>
                      </div>
                    </div>
                  )}

                  {/* AI Recommendations */}
                  {searchResults.recommendations && searchResults.recommendations.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">AI Recommendations</h4>
                      <div className="space-y-3">
                        {searchResults.recommendations.map((rec, index) => (
                          <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h5 className="font-medium text-gray-900">{rec.title}</h5>
                                <p className="text-sm text-gray-600 capitalize mb-2">{rec.type}</p>
                                <p className="text-sm text-gray-700">{rec.description}</p>
                              </div>
                              <button
                                onClick={() => setSearchQuery(rec.searchTerm)}
                                className="ml-3 px-3 py-1 text-xs bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors"
                                data-testid={`search-recommendation-${index}`}
                              >
                                Search
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Search Suggestions */}
                  {searchResults.searchSuggestions && searchResults.searchSuggestions.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Try these searches</h4>
                      <div className="flex flex-wrap gap-2">
                        {searchResults.searchSuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => setSearchQuery(suggestion)}
                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
                            data-testid={`suggestion-${index}`}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : searchResults.type === 'direct' && searchResults.results ? (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">Search Results</h4>
                  <div className="space-y-3">
                    {searchResults.results.map((result, index) => {
                      const ResultWrapper = result.detailUrl ? 'a' : 'div';
                      const wrapperProps = result.detailUrl 
                        ? { href: result.detailUrl, className: "block" }
                        : {};
                      
                      return (
                        <ResultWrapper key={result.id} {...wrapperProps}>
                          <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
                            <div className="flex items-start space-x-3">
                              {result.poster_url && (
                                <img
                                  src={result.poster_url}
                                  alt={result.title}
                                  className="w-12 h-16 object-cover rounded"
                                />
                              )}
                              <div className="flex-1">
                                <h5 className="font-medium text-gray-900 hover:text-purple-600 transition-colors">{result.title}</h5>
                                <div className="flex items-center space-x-2 mt-1">
                                  <span className="text-sm text-gray-600 capitalize">{result.type}</span>
                                  {result.year && <span className="text-sm text-gray-500">• {result.year}</span>}
                                  {result.rating && (
                                    <div className="flex items-center space-x-1">
                                      <Star className="text-yellow-400" size={14} />
                                      <span className="text-sm text-gray-600">{result.rating}</span>
                                    </div>
                                  )}
                                </div>
                                {result.description && (
                                  <p className="text-sm text-gray-700 mt-2 line-clamp-2">{result.description}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </ResultWrapper>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div>
              <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-100">
                <p className="text-sm text-gray-700 font-semibold">
                  Search titles OR get AI-powered recommendations. Here's how it works:
                </p>
              </div>
              
              <div className="space-y-6">
                {searchExamples.map((section, index) => (
                  <div key={index}>
                    <div className="flex items-center space-x-2 mb-3">
                      {section.icon}
                      <h4 className="font-medium text-gray-900">{section.category}</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {section.examples.map((example, exampleIndex) => (
                        <button
                          key={exampleIndex}
                          onClick={() => setSearchQuery(example)}
                          className="text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm text-gray-700"
                          data-testid={`example-${index}-${exampleIndex}`}
                        >
                          "{example}"
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Powered by AI recommendations and community insights
            </p>
            <Button
              onClick={handleSearch}
              disabled={!searchQuery.trim() || isSearching || !session}
              className="bg-purple-700 hover:bg-purple-800 text-white disabled:opacity-50"
              data-testid="search-button"
            >
              {isSearching ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="animate-spin" size={16} />
                  <span>Searching...</span>
                </div>
              ) : (
                'Search'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}