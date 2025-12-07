import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Search, X, Plus, Loader2, Trophy } from "lucide-react";

interface AddRankItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rankId: string;
  rankTitle: string;
  currentItemCount: number;
  maxItems?: number;
}

interface MediaResult {
  title: string;
  type: string;
  creator: string;
  image: string;
  external_id?: string;
  external_source?: string;
  description?: string;
}

export default function AddRankItemDialog({ 
  open, 
  onOpenChange, 
  rankId, 
  rankTitle,
  currentItemCount,
  maxItems = 10 
}: AddRankItemDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MediaResult[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { session } = useAuth();

  const resetForm = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedMedia(null);
  };

  const searchMedia = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    setIsSearching(true);
    
    try {
      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/media-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!response.ok) throw new Error("Search failed");
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error("Media search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery.trim()) {
        searchMedia(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const addItemMutation = useMutation({
    mutationFn: async (media: MediaResult) => {
      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/add-rank-item", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          rankId: rankId,
          position: currentItemCount + 1,
          media: {
            title: media.title,
            mediaType: media.type,
            creator: media.creator,
            imageUrl: media.image,
            externalId: media.external_id,
            externalSource: media.external_source,
          }
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add item');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Item Added!",
        description: `Added to "${rankTitle}"`,
      });
      queryClient.invalidateQueries({ queryKey: ['rank-detail', rankId] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Item",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSelectMedia = (media: MediaResult) => {
    if (currentItemCount >= maxItems) {
      toast({
        title: "Limit Reached",
        description: `This rank is limited to ${maxItems} items`,
        variant: "destructive"
      });
      return;
    }
    setSelectedMedia(media);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleAddItem = () => {
    if (!selectedMedia) return;
    addItemMutation.mutate(selectedMedia);
  };

  const remainingSlots = maxItems - currentItemCount;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) resetForm(); onOpenChange(isOpen); }}>
      <DialogContent className="max-w-md bg-white text-black max-h-[85vh] overflow-y-auto" data-testid="dialog-add-rank-item">
        <DialogHeader>
          <DialogTitle className="text-black flex items-center gap-2">
            <Trophy size={20} className="text-purple-600" />
            Add to Rank
          </DialogTitle>
          <p className="text-sm text-gray-500">Adding to "{rankTitle}" ({remainingSlots} slots remaining)</p>
        </DialogHeader>
        
        <div className="space-y-4 mt-2">
          {/* Media Search */}
          <div className="space-y-2">
            <Label className="text-black font-medium text-sm">Search for Media</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search movies, shows, books..."
                className="pl-9 bg-white text-black border-gray-300 focus:border-purple-400 placeholder:text-gray-400"
                data-testid="input-add-rank-media-search"
                autoFocus
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 animate-spin text-purple-600" size={16} />
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => handleSelectMedia(result)}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors"
                    data-testid={`search-result-${index}`}
                  >
                    {result.image ? (
                      <img src={result.image} alt={result.title} className="w-12 h-12 object-cover rounded" />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                        <Search className="text-gray-400" size={16} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-black text-sm truncate">{result.title}</p>
                      <p className="text-xs text-gray-500 truncate">{result.creator} · {result.type}</p>
                    </div>
                    <Plus className="text-purple-600 flex-shrink-0" size={18} />
                  </div>
                ))}
              </div>
            )}

            {/* Selected Media */}
            {selectedMedia && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <span className="text-purple-600 font-bold text-lg">#{currentItemCount + 1}</span>
                  {selectedMedia.image && (
                    <img src={selectedMedia.image} alt="" className="w-12 h-12 rounded object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-purple-900 text-sm truncate">{selectedMedia.title}</p>
                    <p className="text-xs text-purple-700 truncate">{selectedMedia.creator} · {selectedMedia.type}</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setSelectedMedia(null)} 
                    className="text-purple-600 hover:text-red-600 p-1"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { resetForm(); onOpenChange(false); }}
            className="border-gray-300 bg-white text-black hover:bg-gray-100"
            data-testid="button-cancel-add-rank-item"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddItem}
            size="sm"
            disabled={addItemMutation.isPending || !selectedMedia}
            className="bg-purple-600 hover:bg-purple-700 text-white"
            data-testid="button-add-rank-item"
          >
            {addItemMutation.isPending ? (
              <><Loader2 className="animate-spin mr-1" size={14} /> Adding...</>
            ) : (
              <>Add to Rank</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
