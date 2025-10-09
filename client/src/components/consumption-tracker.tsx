import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, X, List, Star, MessageCircle } from "lucide-react";
import { InsertConsumptionLog } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AuthModal } from "./auth-modal";
import { useToast } from "@/hooks/use-toast";
import CustomListSubmenu from "./custom-list-submenu";

interface ConsumptionTrackerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultListType?: string; // Auto-select this list when provided
}

interface MediaResult {
  title: string;
  type: string;
  creator: string;
  image: string;
  external_id?: string;
  external_source?: string;
  description?: string;
  videoId?: string;
  url?: string;
}

export default function ConsumptionTracker({ isOpen, onClose, defaultListType }: ConsumptionTrackerProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["All Media"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MediaResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaResult | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [review, setReview] = useState<string>("");

  const queryClient = useQueryClient();
  const { user, session } = useAuth();
  const { toast } = useToast();

  const categories = [
    "All Media",
    "Movies",
    "TV Shows",
    "Books",
    "Music",
    "Podcasts",
    "YouTube",
    "Games",
    "Sports"
  ];

  // Helper to get display name from list type
  const getListDisplayName = (listType: string): string => {
    const nameMap: { [key: string]: string } = {
      'all': 'All',
      'currently': 'Currently',
      'queue': 'Queue',
      'finished': 'Finished',
      'dnf': 'Did Not Finish',
      'favorites': 'Favorites'
    };
    return nameMap[listType] || listType;
  };

  // Removed old Express API consumption logging - now using Supabase track-media edge function below

  const resetForm = () => {
    setSelectedCategories(["All Media"]);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedMedia(null);
    setRating(0);
    setReview("");
  };


  const searchMedia = async (query: string, type?: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    // Get the API key
    const apiKey = import.meta.env.VITE_SUPABASE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

    setIsSearching(true);
    try {

      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/media-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query: query.trim(),
          type: type
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Search failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error("Media search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        const categoryToType = {
          "Movies": "movie",
          "TV Shows": "tv",
          "Books": "book",
          "Music": "music",
          "Podcasts": "podcast",
          "YouTube": "youtube",
          "Games": "game",
          "Sports": "sports"
        };

        const searchType = selectedCategories.includes("All Media")
          ? undefined
          : categoryToType[selectedCategories[0] as keyof typeof categoryToType];

        searchMedia(searchQuery, searchType);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategories]);

  const trackMediaMutation = useMutation({
    mutationFn: async (mediaData: MediaResult & { listType?: string; isCustomList?: boolean }) => {
      if (!session?.access_token) {
        throw new Error("Authentication required");
      }

      const listType = mediaData.listType || 'all';
      const isCustomList = mediaData.isCustomList || false;
      
      // Choose endpoint based on isCustomList flag
      const endpoint = isCustomList 
        ? "https://mahpgcogwpawvviapqza.supabase.co/functions/v1/add-to-custom-list"
        : "https://mahpgcogwpawvviapqza.supabase.co/functions/v1/track-media";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          media: {
            title: mediaData.title,
            mediaType: mediaData.type,
            creator: mediaData.creator,
            imageUrl: mediaData.image,
            externalId: mediaData.external_id,
            externalSource: mediaData.external_source,
            description: mediaData.description,
          },
          rating: rating > 0 ? rating : null,
          review: review.trim() || null,
          // Send appropriate parameter based on list type
          ...(isCustomList 
            ? { customListId: listType } 
            : { listType: listType }
          ),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Track media error response:', response.status, errorText);
        throw new Error(`Failed to add media: ${response.status} - ${errorText}`);
      }

      return response.json();
    },
    onSuccess: async (data) => {
      const listTitle = data?.listTitle || "your list";
      toast({
        title: "Media added!",
        description: `Successfully added to ${listTitle}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
      
      // Sync creator stats after successfully tracking media
      try {
        const syncResponse = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/sync-creator-stats', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (syncResponse.ok) {
          const result = await syncResponse.json();
          console.log('✅ Creator stats synced:', result);
          // Invalidate leaderboard queries so Fan Points updates
          queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
        } else {
          console.error('Sync response error:', await syncResponse.text());
        }
      } catch (error) {
        console.error('Failed to sync creator stats:', error);
        // Don't fail the whole operation if stats sync fails
      }
      
      onClose();
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Failed to add media",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddMedia = (listType?: string, isCustom: boolean = false) => {
    if (!selectedMedia) return;

    // Check if user is authenticated
    if (!user || !session) {
      setShowAuthModal(true);
      return;
    }

    // Update the mutation to use the specified list type
    const mediaWithList = {
      ...selectedMedia,
      listType: listType || 'all', // Default to 'all' for Quick Add
      isCustomList: isCustom
    };

    trackMediaMutation.mutate(mediaWithList);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white border border-gray-200 max-w-4xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between pb-4 flex-shrink-0">
          <div>
            <DialogTitle className="text-2xl font-bold text-gray-900">Share Update</DialogTitle>
            <p className="text-gray-500 text-sm mt-1">
              Share your entertainment experience with your friends.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 min-h-0">
          {/* Media Type Selection */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Media Types to Search</h3>

            {/* Category Checkboxes - 2 Column Layout */}
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 mb-6">
              {categories.map((category) => {
                const isChecked = selectedCategories.includes(category);
                const isAllMedia = category === "All Media";

                const handleToggle = () => {
                  if (isAllMedia) {
                    // If "All Media" is clicked, select only it
                    setSelectedCategories(["All Media"]);
                  } else {
                    // If any specific category is clicked
                    if (isChecked) {
                      // Remove this category
                      const newSelected = selectedCategories.filter(c => c !== category);
                      // If no categories left, default to "All Media"
                      setSelectedCategories(newSelected.length === 0 ? ["All Media"] : newSelected.filter(c => c !== "All Media"));
                    } else {
                      // Add this category and remove "All Media" if it was selected
                      const newSelected = selectedCategories.filter(c => c !== "All Media");
                      setSelectedCategories([...newSelected, category]);
                    }
                  }
                };

                return (
                  <div key={category} className="flex items-center space-x-3">
                    <Checkbox
                      id={category}
                      checked={isChecked}
                      onCheckedChange={handleToggle}
                      className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 w-5 h-5"
                    />
                    <label
                      htmlFor={category}
                      className="text-sm font-medium text-gray-700 cursor-pointer select-none"
                    >
                      {category === "All Media" ? "All Types" : category}
                    </label>
                  </div>
                );
              })}
            </div>

          </div>

          {/* Search for Media Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Search for Media</h3>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for movies, TV shows, books, podcasts, music..."
                className="pl-10 py-3 text-base bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500"
              />
            </div>

            {/* Search Results */}
            {searchQuery.trim() && !selectedMedia && (
              <div className="mt-4">
                {isSearching ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-gray-500">Searching...</div>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Select a media item:</h4>
                    <div className="max-h-60 overflow-y-auto border rounded-lg">
                      {searchResults.map((result, index) => (
                        <div
                          key={index}
                          onClick={() => setSelectedMedia(result)}
                          className="flex items-center space-x-3 p-3 border-b last:border-b-0 cursor-pointer transition-all hover:bg-gray-50"
                          data-testid={`search-result-${index}`}
                        >
                          {result.image ? (
                            <img
                              src={result.image}
                              alt={result.title}
                              className="w-12 h-12 object-cover rounded flex-shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                              <Search className="text-gray-400" size={20} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{result.title}</p>
                            {result.creator && (
                              <p className="text-sm text-gray-500 truncate">by {result.creator}</p>
                            )}
                            <p className="text-xs text-purple-600 capitalize">{result.type}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : searchQuery.trim() && !isSearching ? (
                  <div className="text-center py-8 text-gray-500">
                    No results found for "{searchQuery}"
                  </div>
                ) : null}
              </div>
            )}

            {/* Selected Media Preview */}
            {selectedMedia && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="text-sm font-medium text-green-800 mb-2">Selected Media:</h4>
                <div className="flex items-center space-x-3">
                  {selectedMedia.image ? (
                    <img
                      src={selectedMedia.image}
                      alt={selectedMedia.title}
                      className="w-12 h-12 object-cover rounded flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                      <Search className="text-gray-400" size={20} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{selectedMedia.title}</p>
                    {selectedMedia.creator && (
                      <p className="text-sm text-gray-500 truncate">by {selectedMedia.creator}</p>
                    )}
                    <p className="text-xs text-purple-600 capitalize">{selectedMedia.type}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedMedia(null)}
                    className="text-gray-500 hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Rating Section - Always Visible */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rate this media (optional)</h3>
            <div className="flex items-center space-x-4">
              {/* Star Display */}
              <div className="flex items-center space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star === rating ? 0 : star)}
                    className="p-1 hover:scale-110 transition-transform"
                    data-testid={`star-${star}`}
                  >
                    <Star
                      size={24}
                      className={`${
                        star <= Math.floor(rating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : star <= rating
                          ? 'fill-yellow-200 text-yellow-200'
                          : 'fill-gray-200 text-gray-200'
                      } hover:fill-yellow-300 hover:text-yellow-300 transition-colors cursor-pointer`}
                    />
                  </button>
                ))}
              </div>

              {/* Rating Input */}
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={rating || ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (value >= 0 && value <= 5) {
                      setRating(value);
                    } else if (e.target.value === '') {
                      setRating(0);
                    }
                  }}
                  className="w-16 text-center bg-white text-black border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                  placeholder="0"
                  data-testid="rating-input"
                />
                <span className="text-sm text-gray-500">(0-5)</span>
              </div>
            </div>
          </div>

          {/* Review Section - Always Visible */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Thoughts (Review)</h3>
            <Textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Share your thoughts about this media..."
              className="min-h-[120px] resize-none bg-white text-black border-gray-300 focus:border-purple-500 focus:ring-purple-500 placeholder:text-gray-500"
              data-testid="textarea-review"
            />
          </div>

        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t mt-4 flex-shrink-0">
          <Button
            onClick={onClose}
            className="px-6 bg-purple-700 text-white hover:bg-purple-800"
          >
            Cancel
          </Button>

          {/* Conditional Button: Direct add if defaultListType provided, otherwise show dropdown */}
          {defaultListType ? (
            <Button
              onClick={() => handleAddMedia(defaultListType)}
              disabled={!selectedMedia || trackMediaMutation.isPending}
              className="px-6 bg-blue-900 text-white hover:bg-blue-800 disabled:bg-gray-400"
              data-testid="button-add-to-list"
            >
              {trackMediaMutation.isPending ? "Adding..." : `Add to ${getListDisplayName(defaultListType)}`}
            </Button>
          ) : (
            <div className="flex">
              <Button
                onClick={() => handleAddMedia('all')}
                disabled={!selectedMedia || trackMediaMutation.isPending}
                className="px-6 bg-blue-900 text-white hover:bg-blue-800 disabled:bg-gray-400 rounded-r-none border-r border-blue-700"
              >
                {trackMediaMutation.isPending ? "Adding..." : "Quick Add"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={!selectedMedia || trackMediaMutation.isPending}
                    className="px-2 bg-blue-900 text-white hover:bg-blue-800 disabled:bg-gray-400 rounded-l-none"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() => handleAddMedia('currently')}
                    className="cursor-pointer"
                  >
                    Currently
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleAddMedia('queue')}
                    className="cursor-pointer"
                  >
                    Queue
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleAddMedia('finished')}
                    className="cursor-pointer"
                  >
                    Finished
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleAddMedia('dnf')}
                    className="cursor-pointer"
                  >
                    Did Not Finish
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleAddMedia('favorites')}
                    className="cursor-pointer"
                  >
                    Favorites
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <CustomListSubmenu
                    onSelectList={(listId, listTitle, isCustom) => handleAddMedia(listId, isCustom)}
                    disabled={!selectedMedia || trackMediaMutation.isPending}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </DialogContent>

      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
      />
    </Dialog>
  );
}