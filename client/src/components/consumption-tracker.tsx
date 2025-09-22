
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, X, List, Star } from "lucide-react";
import { InsertConsumptionLog } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AuthModal } from "./auth-modal";
import { useToast } from "@/hooks/use-toast";

interface ConsumptionTrackerProps {
  isOpen: boolean;
  onClose: () => void;
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

export default function ConsumptionTracker({ isOpen, onClose }: ConsumptionTrackerProps) {
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
          "Games": "game"
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
    mutationFn: async (mediaData: MediaResult & { listType?: string }) => {
      if (!session?.access_token) {
        throw new Error("Authentication required");
      }

      // For now, send the list type as a string - we'll map to real list IDs in the edge function
      // The edge function will need to look up the actual list ID based on the list type and user

      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/track-media", {
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
          listType: mediaData.listType || 'all', // Send the type, let edge function map to real list ID
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Track media error response:', response.status, errorText);
        throw new Error(`Track media failed: ${response.status} - ${errorText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Media added!",
        description: "Successfully added to your tracking list.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
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

  const handleAddMedia = (listType?: string) => {
    if (!selectedMedia) return;
    
    // Check if user is authenticated
    if (!user || !session) {
      setShowAuthModal(true);
      return;
    }
    
    // Update the mutation to use the specified list type
    const mediaWithList = {
      ...selectedMedia,
      listType: listType || 'all' // Default to 'all' for Quick Add
    };
    
    trackMediaMutation.mutate(mediaWithList);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white border border-gray-200 max-w-4xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between pb-4 flex-shrink-0">
          <div>
            <DialogTitle className="text-2xl font-bold text-gray-900">Add Media</DialogTitle>
            <p className="text-gray-500 text-sm mt-1">
              Search for media to add to your lists. List selection is optional.
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
          {/* Search Media Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Media</h3>
            
            {/* Category Checkboxes */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
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
                      className="data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900"
                    />
                    <label
                      htmlFor={category}
                      className="text-sm font-medium text-gray-700 cursor-pointer select-none"
                    >
                      {category}
                    </label>
                  </div>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for movies, TV shows, books, music, podcasts, YouTube videos..."
                className="pl-10 py-3 text-base bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500"
              />
            </div>

            {/* Search Results */}
            {searchQuery.trim() && (
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
                          className={`flex items-center space-x-3 p-3 border-b last:border-b-0 cursor-pointer transition-all ${
                            selectedMedia?.title === result.title && selectedMedia?.creator === result.creator
                              ? 'border-purple-500 bg-purple-50'
                              : 'hover:bg-gray-50'
                          }`}
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

          {/* Rating and Review Section */}
          {selectedMedia && (
            <div className="space-y-6">
              {/* Clear All Button */}
              <div className="flex justify-center">
                <Button
                  onClick={resetForm}
                  variant="outline"
                  className="px-8 py-2 border-gray-300 text-gray-700 hover:bg-gray-50"
                  data-testid="button-clear-all"
                >
                  Clear All
                </Button>
              </div>

              {/* Rating Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Rating (Optional)</h3>
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star === rating ? 0 : star)}
                      className="p-1 hover:scale-110 transition-transform"
                      data-testid={`star-${star}`}
                    >
                      <Star
                        size={32}
                        className={`${
                          star <= rating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'fill-gray-200 text-gray-200'
                        } hover:fill-yellow-300 hover:text-yellow-300 transition-colors`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Review Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Review (Optional)</h3>
                <Textarea
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder="Share your thoughts about this media..."
                  className="min-h-[120px] resize-none border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                  data-testid="textarea-review"
                />
              </div>

              {/* Add to Lists Section Header */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Add to Lists (Optional)</h3>
              </div>
            </div>
          )}

        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t mt-4 flex-shrink-0">
          <Button
            onClick={onClose}
            className="px-6 bg-purple-700 text-white hover:bg-purple-800"
          >
            Cancel
          </Button>
          
          {/* Split Button - Quick Add with Dropdown */}
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
                  Add to Currently
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleAddMedia('queue')}
                  className="cursor-pointer"
                >
                  Add to Queue
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleAddMedia('finished')}
                  className="cursor-pointer"
                >
                  Add to Finished
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleAddMedia('dnf')}
                  className="cursor-pointer"
                >
                  Add to DNF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </DialogContent>
      
      <AuthModal 
        open={showAuthModal} 
        onOpenChange={setShowAuthModal}
      />
    </Dialog>
  );
}
