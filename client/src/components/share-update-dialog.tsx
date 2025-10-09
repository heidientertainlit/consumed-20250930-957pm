import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Star, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface ShareUpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  audience?: "top-fans" | "all";
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

export default function ShareUpdateDialog({ isOpen, onClose, audience = "all" }: ShareUpdateDialogProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["all"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MediaResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaResult | null>(null);
  const [thoughts, setThoughts] = useState("");
  const [rating, setRating] = useState<string>("");
  const [starHover, setStarHover] = useState<number>(0);
  const [isPosting, setIsPosting] = useState(false);

  const mediaTypes = [
    { id: "all", label: "All Types" },
    { id: "tv", label: "TV Shows" },
    { id: "podcasts", label: "Podcasts" },
    { id: "youtube", label: "YouTube" },
    { id: "movies", label: "Movies" },
    { id: "books", label: "Books" },
    { id: "music", label: "Music" },
    { id: "sports", label: "Sports" }
  ];

  const handleTypeToggle = (typeId: string) => {
    if (typeId === "all") {
      setSelectedTypes(selectedTypes.includes("all") ? [] : ["all"]);
    } else {
      const newSelected = selectedTypes.filter(t => t !== "all");
      if (newSelected.includes(typeId)) {
        setSelectedTypes(newSelected.filter(t => t !== typeId));
      } else {
        setSelectedTypes([...newSelected, typeId]);
      }
    }
  };

  const handleRatingChange = (value: string) => {
    // Validate rating is between 0-5 and has max 1 decimal place
    const numValue = parseFloat(value);
    if (value === "" || (numValue >= 0 && numValue <= 5 && /^\d*\.?\d{0,1}$/.test(value))) {
      setRating(value);
    }
  };

  const handleStarClick = (starValue: number) => {
    setRating(starValue.toString());
  };

  const searchMedia = async (query: string, type?: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    if (!session?.access_token) {
      console.error("No session token available for search");
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/media-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
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
      
      toast({
        title: "Search Failed",
        description: "Unable to search for media. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        const idToType = {
          "movies": "movie",
          "tv": "tv", 
          "books": "book",
          "music": "music",
          "podcasts": "podcast",
          "youtube": "youtube",
          "games": "game",
          "sports": "sports"
        };

        const searchType = selectedTypes.includes("all") 
          ? undefined 
          : idToType[selectedTypes[0] as keyof typeof idToType];

        searchMedia(searchQuery, searchType);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedTypes]);

  const resetForm = () => {
    setSelectedTypes(["all"]);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedMedia(null);
    setRating("");
    setThoughts("");
  };

  const handlePost = async () => {
    if (!selectedMedia) return;

    if (!session?.access_token) {
      toast({
        title: "Authentication Error",
        description: "Please log in to share updates.",
        variant: "destructive",
      });
      return;
    }

    setIsPosting(true);
    
    const postData = {
      content: thoughts.trim() || null,
      media_title: selectedMedia.title,
      media_type: selectedMedia.type,
      media_creator: selectedMedia.creator,
      media_image_url: selectedMedia.image,
      rating: rating ? parseFloat(rating) : null,
      media_external_id: selectedMedia.external_id || null,
      media_external_source: selectedMedia.external_source || null
    };
    
    console.log('📤 Posting data:', postData);
    console.log('📋 Selected media:', selectedMedia);
    
    try {
      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/share-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(postData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Share update error response:', response.status, errorText);
        
        let errorMessage = "Failed to share update. Please try again.";
        if (response.status === 401) {
          errorMessage = "Authentication failed. Please log in again.";
        } else if (response.status === 500) {
          errorMessage = "Server error. Please try again later.";
        }
        
        toast({
          title: "Share Failed",
          description: errorMessage,
          variant: "destructive",
        });
        
        throw new Error(`Share failed: ${response.status} - ${errorText}`);
      }

      toast({
        title: "Success!",
        description: "Your update has been shared successfully.",
      });

      console.log("Update shared successfully!");
      onClose();
      resetForm();
    } catch (error) {
      console.error("Error sharing update:", error);
    } finally {
      setIsPosting(false);
    }
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
          {/* Media Types Selection */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Media Types to Search</h3>

            {/* Category Checkboxes - 2 Column Layout */}
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 mb-6">
              {mediaTypes.map((type) => {
                const isChecked = selectedTypes.includes(type.id);
                const isAllTypes = type.id === "all";

                const handleToggle = () => {
                  if (isAllTypes) {
                    // If "All Types" is clicked, select only it
                    setSelectedTypes(["all"]);
                  } else {
                    // If any specific type is clicked
                    if (isChecked) {
                      // Remove this type
                      const newSelected = selectedTypes.filter(t => t !== type.id);
                      // If no types left, default to "All Types"
                      const finalSelection = newSelected.length === 0 ? ["all"] : newSelected.filter(t => t !== "all");
                      setSelectedTypes(finalSelection);
                    } else {
                      // Add this type and remove "All Types" if it was selected
                      const newSelected = selectedTypes.filter(t => t !== "all");
                      const finalSelection = [...newSelected, type.id];
                      setSelectedTypes(finalSelection);
                    }
                  }
                };

                return (
                  <div key={type.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={type.id}
                      checked={isChecked}
                      onCheckedChange={handleToggle}
                      className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 w-5 h-5"
                    />
                    <label
                      htmlFor={type.id}
                      className="text-sm font-medium text-gray-700 cursor-pointer select-none"
                    >
                      {type.label}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Search for Media Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Search for Media</h3>

            {/* Search Input with blue border like in screenshot */}
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for movies, TV shows, books, podcasts, music..."
              className="py-3 text-base bg-white border-2 border-blue-500 text-gray-900 placeholder:text-gray-500 focus:border-blue-600 focus:ring-blue-600"
              data-testid="search-media-input"
            />

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
                    onClick={() => handleStarClick(star)}
                    className="p-1 hover:scale-110 transition-transform"
                    data-testid={`star-${star}`}
                  >
                    <Star
                      size={24}
                      className={`${
                        star <= (starHover || parseFloat(rating) || 0)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'fill-gray-200 text-gray-200'
                      } hover:fill-yellow-300 hover:text-yellow-300 transition-colors cursor-pointer`}
                    />
                  </button>
                ))}
              </div>

              {/* Rating Input */}
              <div className="flex items-center space-x-2">
                <Input
                  type="text"
                  value={rating}
                  onChange={(e) => handleRatingChange(e.target.value)}
                  className="w-16 text-center bg-white text-black border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                  placeholder="0"
                  data-testid="rating-input"
                />
                <span className="text-sm text-gray-500">(0–5)</span>
              </div>
            </div>
          </div>

          {/* Review Section - Always Visible */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Thoughts (Review)</h3>
            <div className="relative">
              <Textarea
                value={thoughts}
                onChange={(e) => setThoughts(e.target.value)}
                placeholder="Share your thoughts about this media..."
                maxLength={500}
                className="min-h-[120px] resize-none bg-white text-black border-gray-300 focus:border-purple-500 focus:ring-purple-500 placeholder:text-gray-500"
                data-testid="thoughts-textarea"
              />
              <div className="absolute bottom-3 right-3 text-sm text-gray-400 pointer-events-none">
                {thoughts.length}/500
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t mt-4 flex-shrink-0">
          <Button
            onClick={onClose}
            className="px-6 bg-purple-700 text-white hover:bg-purple-800"
            data-testid="cancel-share"
          >
            Cancel
          </Button>
          <Button
            onClick={handlePost}
            disabled={!selectedMedia || isPosting}
            className={`px-6 text-white ${
              audience === "top-fans" 
                ? "bg-purple-700 hover:bg-purple-800" 
                : "bg-blue-900 hover:bg-blue-800"
            } disabled:bg-gray-400`}
            data-testid="post-share"
          >
            {isPosting ? (
              <>
                <Search className="h-4 w-4 animate-spin mr-2" />
                Posting...
              </>
            ) : (
              "Post"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}