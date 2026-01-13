import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Sparkles, Tv, Film, BookOpen, Music, Mic, Gamepad2, Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useLocation } from "wouter";

const CATEGORIES = [
  { id: "tv", label: "TV", icon: Tv },
  { id: "movies", label: "Movies", icon: Film },
  { id: "books", label: "Books", icon: BookOpen },
  { id: "music", label: "Music", icon: Music },
  { id: "podcasts", label: "Podcasts", icon: Mic },
  { id: "gaming", label: "Gaming", icon: Gamepad2 },
  { id: "sports", label: "Sports", icon: Trophy },
];

interface MediaItem {
  id: string;
  title: string;
  type: string;
  image_url?: string;
  external_id: string;
  external_source: string;
}

export default function OnboardingPage() {
  const { session, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [addedItems, setAddedItems] = useState<MediaItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session) {
      setLocation('/login');
    }
  }, [loading, session, setLocation]);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(c => c !== categoryId);
      }
      return [...prev, categoryId];
    });
  };

  const getMediaTypeFromCategory = (categoryId: string) => {
    switch (categoryId) {
      case 'tv': return 'tv';
      case 'movies': return 'movie';
      case 'books': return 'book';
      case 'music': return 'music';
      case 'podcasts': return 'podcast';
      case 'gaming': return 'game';
      case 'sports': return 'movie';
      default: return 'movie';
    }
  };

  const searchMedia = async (query: string) => {
    if (!query.trim() || !session?.access_token) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(
        'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/media-search',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: query.trim() }),
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const results = (data.results || []).map((r: any) => ({
          id: r.id || r.external_id,
          title: r.title,
          type: r.type || r.media_type,
          image_url: r.poster_url || r.image_url || r.poster_path,
          external_id: r.external_id || r.id?.toString(),
          external_source: r.external_source || 'tmdb',
        }));
        // Deduplicate by external_id
        const unique = results.filter((r: MediaItem, i: number, arr: MediaItem[]) => 
          arr.findIndex(x => x.external_id === r.external_id) === i
        );
        setSearchResults(unique.slice(0, 6));
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchMedia(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const addItem = (item: MediaItem) => {
    if (addedItems.length >= 3) return;
    if (addedItems.some(i => i.external_id === item.external_id)) return;
    
    setAddedItems(prev => [...prev, item]);
    setPointsEarned(prev => prev + 10);
    setSearchQuery("");
    setSearchResults([]);
  };

  const removeItem = (itemId: string) => {
    setAddedItems(prev => prev.filter(i => i.id !== itemId));
    setPointsEarned(prev => Math.max(0, prev - 10));
  };

  const completeOnboarding = async () => {
    setIsCompleting(true);
    setError(null);
    
    try {
      const failedItems: string[] = [];
      
      // Save selected categories to user's DNA profile
      try {
        const { error: updateError } = await supabase
          .from('users')
          .update({ preferred_media_types: selectedCategories })
          .eq('id', session?.user?.id);
        
        if (updateError) {
          console.error('Failed to save media preferences:', updateError);
        }
      } catch (e) {
        console.error('Failed to save media preferences:', e);
      }
      
      for (const item of addedItems) {
        try {
          const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/track-media', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              external_id: item.external_id,
              external_source: item.external_source,
              title: item.title,
              media_type: item.type,
              image_url: item.image_url,
              list_type: 'finished',
            }),
          });
          
          if (!response.ok) {
            failedItems.push(item.title);
          }
        } catch {
          failedItems.push(item.title);
        }
      }
      
      if (failedItems.length > 0) {
        if (failedItems.length === addedItems.length) {
          setError("Failed to save your items. Please try again.");
        } else {
          setError(`Failed to save: ${failedItems.join(", ")}. Please try again.`);
        }
        return;
      }
      
      setStep(3);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsCompleting(false);
    }
  };

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-950 to-black flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-white animate-spin mx-auto" />
          <p className="text-white mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-950 to-black flex flex-col px-6 pt-12 pb-8">
        <div className="mb-12">
          <img 
            src="/consumed-logo-white.png" 
            alt="consumed" 
            className="h-10"
          />
        </div>
        
        <div className="max-w-sm w-full">
          <h1 className="text-2xl font-bold text-white mb-2 text-left" style={{ lineHeight: '1.15' }}>
            What do you actually spend your time on?
          </h1>
          <p className="text-purple-200 text-sm mb-8 text-left">Select all that apply</p>

          <div className="flex flex-wrap gap-2.5 mb-10">
            {CATEGORIES.map(category => {
              const isSelected = selectedCategories.includes(category.id);
              return (
                <button
                  key={category.id}
                  onClick={() => toggleCategory(category.id)}
                  className={`px-4 py-2.5 rounded-full transition-all flex items-center gap-2 text-sm font-medium text-white ${
                    isSelected
                      ? 'bg-gradient-to-r from-cyan-400 via-purple-500 to-purple-700 shadow-lg shadow-purple-500/30 ring-2 ring-white/30'
                      : 'bg-gradient-to-r from-cyan-400/80 via-purple-500/80 to-purple-700/80 hover:shadow-lg hover:shadow-purple-500/20'
                  }`}
                >
                  <category.icon size={16} />
                  <span>{category.label}</span>
                  {isSelected && <Check size={14} />}
                </button>
              );
            })}
          </div>

          <Button
            onClick={() => setStep(2)}
            disabled={selectedCategories.length === 0}
            className="w-full bg-white hover:bg-gray-100 text-purple-900 font-semibold rounded-lg py-3"
          >
            Continue
          </Button>
        </div>
      </div>
    );
  }

  if (step === 2) {
    // Dynamic momentum text based on items added
    const getMomentumText = () => {
      if (addedItems.length === 0) return null;
      if (addedItems.length === 1) return "Nice. Add two more.";
      if (addedItems.length === 2) return "One more and you're in.";
      return "You're all set!";
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-950 to-black flex flex-col px-6 pt-12 pb-8">
        <div className="mb-8">
          <img 
            src="/consumed-logo-white.png" 
            alt="consumed" 
            className="h-10"
          />
        </div>
        
        <div className="max-w-md w-full">
          <h1 className="text-2xl font-bold text-white mb-2">
            Add a few favorites to start
          </h1>
          {getMomentumText() ? (
            <p className="text-purple-200 text-sm mb-6">{getMomentumText()}</p>
          ) : (
            <p className="text-purple-200/60 text-sm mb-6">Movies, shows, books, music...</p>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          {addedItems.length < 3 && (
            <div className="mb-6">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type a movie, show, book, artist…"
                className="w-full px-5 py-4 bg-white/10 border border-white/20 rounded-lg text-white text-lg placeholder:text-white/40 focus:border-purple-400 focus:ring-purple-400 focus:bg-white/15 transition-all"
              />
              
              {isSearching && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                </div>
              )}
              
              {searchResults.length > 0 && (
                <div className="mt-3 bg-white/10 backdrop-blur-sm rounded-lg p-2 max-h-52 overflow-y-auto border border-white/10">
                  {searchResults.map((result, index) => (
                    <button
                      key={`${result.external_id}-${index}`}
                      onClick={() => addItem(result)}
                      className="w-full flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg transition-colors text-left"
                    >
                      {result.image_url ? (
                        <img 
                          src={result.image_url} 
                          alt={result.title}
                          className="w-10 h-10 rounded object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-white/20 rounded flex items-center justify-center">
                          <span className="text-white/40 text-xs">No img</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{result.title}</p>
                        <p className="text-xs text-purple-300 capitalize">{result.type}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {addedItems.length > 0 && (
            <div className="space-y-2 mb-6">
              {addedItems.map((item) => (
                <div 
                  key={item.external_id}
                  className="flex items-center gap-3 p-3 bg-white/10 backdrop-blur-sm rounded-lg border border-white/10"
                >
                  {item.image_url ? (
                    <img 
                      src={item.image_url} 
                      alt={item.title}
                      className="w-12 h-12 rounded object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-purple-500/30 rounded flex items-center justify-center">
                      <Check className="text-purple-300" size={20} />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-white">{item.title}</p>
                    <p className="text-xs text-cyan-400">+10 points</p>
                  </div>
                  <button 
                    onClick={() => removeItem(item.id)}
                    className="text-white/40 hover:text-white/70 text-xl"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={completeOnboarding}
            disabled={addedItems.length === 0 || isCompleting}
            className="w-full bg-gradient-to-r from-cyan-400 via-purple-500 to-purple-700 hover:from-cyan-300 hover:via-purple-400 hover:to-purple-600 text-white font-semibold rounded-full py-4 text-lg shadow-lg shadow-purple-500/30 disabled:opacity-50"
          >
            {isCompleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              `Jump in ${addedItems.length > 0 ? `(+${pointsEarned} pts)` : ''}`
            )}
          </Button>
          
          <button
            onClick={() => setStep(1)}
            className="w-full text-purple-300/60 text-sm mt-4 hover:text-purple-200"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-950 to-black flex flex-col items-center justify-center p-4">
        <div className="mb-6">
          <img 
            src="/consumed-logo-white.png" 
            alt="consumed" 
            className="h-10 mx-auto"
          />
        </div>
        <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl text-center">
          <div className="text-2xl font-bold text-gray-900 mb-1">You earned</div>
          <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            {pointsEarned} points!
          </div>
          
          <p className="text-gray-600 text-sm mb-6">What would you like to do next?</p>

          <div className="space-y-3">
            <button
              onClick={() => setLocation('/play/trivia')}
              className="w-full p-4 bg-purple-50 hover:bg-purple-100 rounded-xl text-left transition-colors flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Sparkles className="text-purple-600" size={20} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Play some quick trivia</p>
                <p className="text-xs text-gray-500">Earn a badge with 1 game</p>
              </div>
            </button>
            
            <button
              onClick={() => setLocation('/activity')}
              className="w-full p-4 bg-orange-50 hover:bg-orange-100 rounded-xl text-left transition-colors flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-lg">🔥</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Check out hot takes in your feed</p>
                <p className="text-xs text-gray-500">See what others are saying</p>
              </div>
            </button>
            
            <button
              onClick={() => setLocation('/entertainment-dna')}
              className="w-full p-4 bg-blue-50 hover:bg-blue-100 rounded-xl text-left transition-colors flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-lg">🧬</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Discover your Entertainment DNA</p>
                <p className="text-xs text-gray-500">Take a quick survey</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
