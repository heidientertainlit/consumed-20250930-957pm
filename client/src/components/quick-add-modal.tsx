import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Search, 
  X, 
  Star, 
  Film, 
  Tv, 
  BookOpen, 
  Music, 
  Headphones, 
  Gamepad2,
  Loader2,
  ChevronLeft,
  List,
  Trophy,
  AlertTriangle
} from "lucide-react";

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Stage = "search" | "details";

export function QuickAddModal({ isOpen, onClose }: QuickAddModalProps) {
  const { user, session } = useAuth();
  const { toast } = useToast();
  
  const [stage, setStage] = useState<Stage>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedListId, setSelectedListId] = useState("");
  const [selectedRankId, setSelectedRankId] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [containsSpoilers, setContainsSpoilers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: listsData } = useQuery({
    queryKey: ['user-lists-metadata', user?.id],
    queryFn: async () => {
      if (!session?.access_token || !user?.id) return { lists: [] };
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-lists-metadata?user_id=${user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (response.ok) return response.json();
      return { lists: [] };
    },
    enabled: !!session?.access_token && !!user?.id,
  });

  const { data: ranksData } = useQuery({
    queryKey: ['user-ranks', user?.id],
    queryFn: async () => {
      if (!session?.access_token || !user?.id) return { ranks: [] };
      const response = await fetch(
        `https://mahpgcogwpawvviapqza.supabase.co/functions/v1/get-user-ranks?user_id=${user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (response.ok) return response.json();
      return { ranks: [] };
    },
    enabled: !!session?.access_token && !!user?.id,
  });

  const userLists = listsData?.lists || [];
  const userRanks = ranksData?.ranks || [];

  useEffect(() => {
    if (!session?.access_token) return;
    
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        handleMediaSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, session?.access_token]);

  useEffect(() => {
    if (!isOpen) {
      resetModal();
    }
  }, [isOpen]);

  const resetModal = () => {
    setStage("search");
    setSearchQuery("");
    setSearchResults([]);
    setSelectedMedia(null);
    setRating(0);
    setHoverRating(0);
    setSelectedListId("");
    setSelectedRankId("");
    setReviewText("");
    setContainsSpoilers(false);
  };

  const handleMediaSearch = async (query: string) => {
    if (!session?.access_token) return;
    
    setIsSearching(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/media-search?query=${encodeURIComponent(query)}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Media search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectMedia = (media: any) => {
    setSelectedMedia(media);
    setStage("details");
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleBack = () => {
    setStage("search");
    setSelectedMedia(null);
    setRating(0);
    setSelectedListId("");
    setSelectedRankId("");
    setReviewText("");
    setContainsSpoilers(false);
  };

  const handleSubmit = async () => {
    if (!selectedMedia || !session?.access_token) return;
    
    setIsSubmitting(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      
      const payload: any = {
        title: selectedMedia.title,
        media_type: selectedMedia.type,
        external_id: selectedMedia.external_id || selectedMedia.id,
        external_source: selectedMedia.source || 'tmdb',
        image_url: selectedMedia.image_url || selectedMedia.poster_path,
        creator: selectedMedia.creator || selectedMedia.artist,
      };
      
      if (rating > 0) {
        payload.user_rating = rating;
      }
      
      // Only add list_id if a real list is selected (not "none" or empty)
      if (selectedListId && selectedListId !== "none") {
        payload.list_id = selectedListId;
      }
      
      if (reviewText.trim()) {
        payload.review = reviewText.trim();
        payload.contains_spoilers = containsSpoilers;
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/add-media-to-list`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to add media');
      }
      
      // Only add to rank if a real rank is selected (not "none" or empty)
      if (selectedRankId && selectedRankId !== "none") {
        await fetch(
          `${supabaseUrl}/functions/v1/manage-ranks`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'add_item',
              rank_id: selectedRankId,
              item: {
                title: selectedMedia.title,
                media_type: selectedMedia.type,
                external_id: selectedMedia.external_id || selectedMedia.id,
                external_source: selectedMedia.source || 'tmdb',
                image_url: selectedMedia.image_url || selectedMedia.poster_path,
              },
            }),
          }
        );
      }
      
      toast({
        title: "Added!",
        description: `${selectedMedia.title} has been added to your collection`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['user-lists-metadata', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['user-lists', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['user-ranks', user?.id] });
      
      onClose();
    } catch (error) {
      console.error("Error adding media:", error);
      toast({
        title: "Error",
        description: "Failed to add media. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'movie': return <Film size={16} className="text-purple-600" />;
      case 'tv': return <Tv size={16} className="text-pink-600" />;
      case 'book': return <BookOpen size={16} className="text-cyan-600" />;
      case 'music': return <Music size={16} className="text-green-600" />;
      case 'podcast': return <Headphones size={16} className="text-blue-600" />;
      case 'game': return <Gamepad2 size={16} className="text-orange-600" />;
      default: return <Film size={16} className="text-gray-600" />;
    }
  };

  const renderStars = () => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star === rating ? 0 : star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-0.5 transition-transform hover:scale-110"
            data-testid={`star-${star}`}
          >
            <Star
              size={28}
              className={`transition-colors ${
                star <= (hoverRating || rating)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="ml-2 text-sm text-gray-600">{rating}/5</span>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-white max-w-md mx-auto p-0 overflow-hidden max-h-[85vh] flex flex-col">
        {stage === "search" ? (
          <>
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Quick Add</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <Input
                  type="text"
                  placeholder="Search movies, TV, books, music..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-gray-50 border-gray-200"
                  autoFocus
                  data-testid="quick-add-search"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {isSearching ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-purple-600" size={24} />
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((result, index) => (
                    <button
                      key={`${result.external_id || result.id}-${index}`}
                      onClick={() => handleSelectMedia(result)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-purple-50 transition-colors text-left"
                      data-testid={`search-result-${index}`}
                    >
                      {result.image_url || result.poster_path ? (
                        <img
                          src={result.image_url || result.poster_path}
                          alt={result.title}
                          className="w-12 h-16 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-12 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center">
                          {getMediaIcon(result.type)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{result.title}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          {getMediaIcon(result.type)}
                          <span className="capitalize">{result.type}</span>
                          {result.year && <span>• {result.year}</span>}
                        </div>
                        {result.creator && (
                          <p className="text-xs text-gray-400 truncate">{result.creator}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : searchQuery.trim() ? (
                <div className="text-center py-8 text-gray-500">
                  No results found for "{searchQuery}"
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Search size={32} className="mx-auto mb-2 opacity-50" />
                  <p>Search for movies, TV shows, books, music, and more</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <button onClick={handleBack} className="text-gray-400 hover:text-gray-600">
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-lg font-semibold text-gray-900 flex-1">Add Details</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {selectedMedia && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  {selectedMedia.image_url || selectedMedia.poster_path ? (
                    <img
                      src={selectedMedia.image_url || selectedMedia.poster_path}
                      alt={selectedMedia.title}
                      className="w-14 h-20 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-14 h-20 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center">
                      {getMediaIcon(selectedMedia.type)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{selectedMedia.title}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      {getMediaIcon(selectedMedia.type)}
                      <span className="capitalize">{selectedMedia.type}</span>
                      {selectedMedia.year && <span>• {selectedMedia.year}</span>}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
                {renderStars()}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <List size={14} className="inline mr-1" />
                  Add to List (optional)
                </label>
                <Select value={selectedListId} onValueChange={setSelectedListId}>
                  <SelectTrigger className="bg-white border-gray-200">
                    <SelectValue placeholder="Select a list..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="none">None</SelectItem>
                    {userLists.map((list: any) => (
                      <SelectItem key={list.id} value={list.id}>
                        {list.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Trophy size={14} className="inline mr-1" />
                  Add to Rank (optional)
                </label>
                <Select value={selectedRankId} onValueChange={setSelectedRankId}>
                  <SelectTrigger className="bg-white border-gray-200">
                    <SelectValue placeholder="Select a rank..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="none">None</SelectItem>
                    {userRanks.map((rank: any) => (
                      <SelectItem key={rank.id} value={rank.id}>
                        {rank.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quick Review (optional)
                </label>
                <Textarea
                  placeholder="What did you think?"
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  className="bg-white border-gray-200 resize-none"
                  rows={3}
                  data-testid="quick-add-review"
                />
              </div>

              {reviewText.trim() && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="spoilers"
                    checked={containsSpoilers}
                    onCheckedChange={(checked) => setContainsSpoilers(checked as boolean)}
                  />
                  <label htmlFor="spoilers" className="text-sm text-gray-600 flex items-center gap-1">
                    <AlertTriangle size={14} />
                    Contains spoilers
                  </label>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-200">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                data-testid="quick-add-submit"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Adding...
                  </>
                ) : (
                  'Add to Collection'
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}