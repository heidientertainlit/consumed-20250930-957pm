import { useState } from "react";
import { Search, X, Star, MessageCircle, Target, ListPlus, Share2, Loader2, ChevronLeft, Film, Music, BookOpen, Tv, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import Navigation from "@/components/navigation";

interface MediaItem {
  id: string;
  title: string;
  type: string;
  description?: string;
  year?: number;
  rating?: number;
  poster_url?: string;
  source?: string;
}

export default function EngagePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { session } = useAuth();

  const handleSearch = async () => {
    if (!searchQuery.trim() || !session?.access_token) return;

    setIsSearching(true);
    setSearchResults([]);

    try {
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/media-search', {
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
      setSearchResults(result.results || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const resetSearch = () => {
    setSearchResults([]);
    setSearchQuery("");
    setSelectedMedia(null);
  };

  const getMediaIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'movie':
        return <Film className="text-blue-600" size={20} />;
      case 'tv':
      case 'series':
        return <Tv className="text-purple-600" size={20} />;
      case 'music':
      case 'album':
      case 'track':
        return <Music className="text-pink-600" size={20} />;
      case 'book':
        return <BookOpen className="text-green-600" size={20} />;
      case 'game':
        return <Gamepad2 className="text-orange-600" size={20} />;
      default:
        return <Film className="text-gray-600" size={20} />;
    }
  };

  const actionButtons = [
    {
      icon: Star,
      label: "Rate & Review",
      description: "Share your rating and thoughts",
      color: "from-yellow-500 to-orange-500",
      action: () => console.log("Rate & Review", selectedMedia)
    },
    {
      icon: Target,
      label: "Create Prediction",
      description: "Will it win awards? Break records?",
      color: "from-purple-500 to-blue-500",
      action: () => console.log("Create Prediction", selectedMedia)
    },
    {
      icon: MessageCircle,
      label: "Start Discussion",
      description: "Ask for recs or share hot takes",
      color: "from-green-500 to-teal-500",
      action: () => console.log("Start Discussion", selectedMedia)
    },
    {
      icon: ListPlus,
      label: "Add to List",
      description: "Save for later or track progress",
      color: "from-pink-500 to-purple-500",
      action: () => console.log("Add to List", selectedMedia)
    },
    {
      icon: Share2,
      label: "Share Update",
      description: "Tell friends what you're watching",
      color: "from-blue-500 to-indigo-500",
      action: () => console.log("Share Update", selectedMedia)
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Engage with Media</h1>
          <p className="text-sm text-gray-600 mt-1">Find what you're watching, then choose what to do</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {!selectedMedia ? (
          <div className="space-y-6">
            {/* Step 1: Search */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">
                  1
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Find Your Media</h2>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search movies, TV shows, books, music, games..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim() && !isSearching && session) {
                        handleSearch();
                      }
                    }}
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent text-black placeholder-gray-500"
                    data-testid="media-search-input"
                    autoFocus
                  />
                </div>
                <Button
                  onClick={handleSearch}
                  disabled={!searchQuery.trim() || isSearching || !session}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                  data-testid="media-search-button"
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

            {/* Search Results */}
            {isSearching && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="animate-spin text-purple-600 mx-auto mb-3" size={32} />
                  <p className="text-gray-600">Searching...</p>
                </div>
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">Select Media</h3>
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => setSelectedMedia(result)}
                    className="w-full bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-purple-300 transition-all text-left"
                    data-testid={`media-result-${result.id}`}
                  >
                    <div className="flex items-start space-x-3">
                      {result.poster_url ? (
                        <img
                          src={result.poster_url}
                          alt={result.title}
                          className="w-16 h-24 object-cover rounded"
                        />
                      ) : (
                        <div className="w-16 h-24 bg-gray-100 rounded flex items-center justify-center">
                          {getMediaIcon(result.type)}
                        </div>
                      )}
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{result.title}</h4>
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
                  </button>
                ))}
              </div>
            )}

            {!isSearching && searchResults.length === 0 && searchQuery && (
              <div className="text-center py-8">
                <p className="text-gray-600">No results found. Try a different search term.</p>
              </div>
            )}

            {/* Examples */}
            {searchResults.length === 0 && !searchQuery && (
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-100 p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Try searching for:</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "Dune Part Two",
                    "The Bear",
                    "Taylor Swift",
                    "Interstellar",
                    "The Last of Us",
                    "Tomorrow and Tomorrow"
                  ].map((example, index) => (
                    <button
                      key={index}
                      onClick={() => setSearchQuery(example)}
                      className="text-left p-3 bg-white rounded-lg hover:bg-gray-50 transition-colors text-sm text-gray-700 border border-purple-100"
                      data-testid={`example-${index}`}
                    >
                      "{example}"
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Back Button */}
            <button
              onClick={resetSearch}
              className="flex items-center space-x-2 text-purple-600 hover:text-purple-700"
              data-testid="back-to-search"
            >
              <ChevronLeft size={20} />
              <span>Search different media</span>
            </button>

            {/* Selected Media */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start space-x-4">
                {selectedMedia.poster_url ? (
                  <img
                    src={selectedMedia.poster_url}
                    alt={selectedMedia.title}
                    className="w-24 h-36 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-24 h-36 bg-gray-100 rounded-lg flex items-center justify-center">
                    {getMediaIcon(selectedMedia.type)}
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900">{selectedMedia.title}</h2>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-sm text-gray-600 capitalize">{selectedMedia.type}</span>
                    {selectedMedia.year && <span className="text-sm text-gray-500">• {selectedMedia.year}</span>}
                    {selectedMedia.rating && (
                      <div className="flex items-center space-x-1">
                        <Star className="text-yellow-400" size={14} />
                        <span className="text-sm text-gray-600">{selectedMedia.rating}</span>
                      </div>
                    )}
                  </div>
                  {selectedMedia.description && (
                    <p className="text-sm text-gray-700 mt-3 line-clamp-3">{selectedMedia.description}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Step 2: Choose Action */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center space-x-2 mb-6">
                <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">
                  2
                </div>
                <h2 className="text-lg font-semibold text-gray-900">What do you want to do?</h2>
              </div>

              <div className="space-y-3">
                {actionButtons.map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={index}
                      onClick={action.action}
                      className="w-full bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-purple-300 hover:shadow-md transition-all text-left group"
                      data-testid={`action-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <div className="flex items-start space-x-4">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center flex-shrink-0`}>
                          <Icon className="text-white" size={24} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                            {action.label}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">{action.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <Navigation />
    </div>
  );
}
