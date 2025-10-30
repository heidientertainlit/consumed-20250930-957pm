import { useState, useEffect } from "react";
import { Search, X, User, Film, Music, BookOpen, Tv, Loader2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DirectSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MediaResult {
  id: string;
  title: string;
  type: string;
  creator?: string;
  image?: string;
  year?: number;
  external_id?: string;
  external_source?: string;
}

interface UserResult {
  id: string;
  user_name: string;
  display_name?: string;
  avatar_url?: string;
}

export default function DirectSearchDialog({ isOpen, onClose }: DirectSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [mediaResults, setMediaResults] = useState<MediaResult[]>([]);
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { session } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!searchQuery.trim()) {
      setMediaResults([]);
      setUserResults([]);
      return;
    }

    const debounceTimer = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !session?.access_token) return;

    setIsSearching(true);

    try {
      // Search media
      const mediaResponse = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/media-search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery })
      });

      if (mediaResponse.ok) {
        const mediaData = await mediaResponse.json();
        setMediaResults(mediaData.results || []);
      }

      // Search users
      const userResponse = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/search-users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery })
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUserResults(userData.users || []);
      }

    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleMediaClick = (result: MediaResult) => {
    const type = result.type;
    const source = result.external_source || 'tmdb';
    const id = result.external_id || result.id;
    
    if (type && source && id) {
      onClose();
      setLocation(`/media/${type}/${source}/${id}`);
    }
  };

  const handleUserClick = (user: UserResult) => {
    onClose();
    setLocation(`/user/${user.id}`);
  };

  const handleAddFriend = async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/manage-friendships', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'sendRequest', friendId: userId })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send friend request');
      }
      
      toast({
        title: "Friend request sent!",
        description: "You'll be notified when they accept.",
      });
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send friend request. Please try again.",
        variant: "destructive",
      });
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search size={20} />
            Quick Search
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <Input
              type="text"
              placeholder="Search for friends, movies, shows, books, music..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 py-6 text-base"
              data-testid="direct-search-input"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Loading State */}
          {isSearching && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-purple-600" size={32} />
            </div>
          )}

          {/* Results */}
          {!isSearching && searchQuery && (
            <div className="space-y-6">
              {/* User Results */}
              {userResults.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
                    <User size={16} />
                    People
                  </h3>
                  <div className="space-y-2">
                    {userResults.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => handleUserClick(user)}
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors cursor-pointer"
                        data-testid={`user-result-${user.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white font-semibold">
                            {user.display_name?.[0] || user.user_name[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {user.display_name || user.user_name}
                            </p>
                            <p className="text-sm text-gray-500">@{user.user_name}</p>
                          </div>
                        </div>
                        <Button
                          onClick={(e) => handleAddFriend(user.id, e)}
                          size="sm"
                          variant="outline"
                          className="border-purple-300 text-purple-700 hover:bg-purple-50"
                          data-testid={`add-friend-${user.id}`}
                        >
                          <UserPlus size={16} className="mr-1" />
                          Add
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Media Results */}
              {mediaResults.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
                    <Film size={16} />
                    Entertainment
                  </h3>
                  <div className="space-y-2">
                    {mediaResults.slice(0, 10).map((result) => (
                      <div
                        key={result.id}
                        onClick={() => handleMediaClick(result)}
                        className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors cursor-pointer"
                        data-testid={`media-result-${result.id}`}
                      >
                        {result.image && (
                          <img
                            src={result.image}
                            alt={result.title}
                            className="w-12 h-16 object-cover rounded"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            {getMediaIcon(result.type)}
                            <p className="font-semibold text-gray-900 line-clamp-1">
                              {result.title}
                            </p>
                          </div>
                          {result.creator && (
                            <p className="text-sm text-gray-600 mt-1">{result.creator}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-block text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                              {result.type}
                            </span>
                            {result.year && (
                              <span className="text-xs text-gray-500">{result.year}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Results */}
              {!isSearching && searchQuery && userResults.length === 0 && mediaResults.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No results found for "{searchQuery}"</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Try searching for specific titles or usernames
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {!searchQuery && !isSearching && (
            <div className="text-center py-8">
              <Search className="mx-auto text-gray-300 mb-3" size={48} />
              <p className="text-gray-500 font-medium">Quick search for people or content</p>
              <p className="text-sm text-gray-400 mt-2">
                Search by title or username to find what you're looking for
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
