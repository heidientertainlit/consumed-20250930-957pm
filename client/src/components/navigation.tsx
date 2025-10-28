import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Trophy, Wallet, Plus, Activity, BarChart3, Gamepad2, Users, Bell, User, Search, X } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";

interface NavigationProps {
  onTrackConsumption?: () => void;
}

export default function Navigation({ onTrackConsumption }: NavigationProps) {
  const [location, setLocation] = useLocation();
  const { user, session } = useAuth();
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus when search expands
  useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

  // Debounced search
  const { data: searchResults } = useQuery({
    queryKey: ['inline-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim() || !session?.access_token) return null;

      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/media-search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery })
      });

      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!searchQuery.trim() && !!session?.access_token && isSearchExpanded,
    staleTime: 1000 * 60 * 5,
  });

  const handleSearchToggle = () => {
    if (isSearchExpanded) {
      setIsSearchExpanded(false);
      setSearchQuery("");
    } else {
      setIsSearchExpanded(true);
    }
  };

  const handleResultClick = (result: any) => {
    setIsSearchExpanded(false);
    setSearchQuery("");
    setLocation(`/media/${result.type}/${result.id}`);
  };

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
                  {searchResults && searchResults.length > 0 && (
                    <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-xl max-h-96 overflow-y-auto">
                      {searchResults.slice(0, 5).map((result: any) => (
                        <div
                          key={result.id}
                          onClick={() => handleResultClick(result)}
                          className="flex items-center gap-3 p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                          data-testid={`inline-result-${result.id}`}
                        >
                          {result.poster_url && (
                            <img
                              src={result.poster_url}
                              alt={result.title}
                              className="w-12 h-16 object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <p className="font-semibold text-black text-sm">{result.title}</p>
                            <p className="text-xs text-gray-600">{result.type} {result.year && `• ${result.year}`}</p>
                          </div>
                        </div>
                      ))}
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