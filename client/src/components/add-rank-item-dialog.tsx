import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Search, X, Plus, Loader2, Trophy, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

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
  year?: string | number;
  external_id?: string;
  external_source?: string;
  description?: string;
}

const TYPE_FILTERS = [
  { value: null, label: "All" },
  { value: "tv", label: "TV" },
  { value: "movie", label: "Movie" },
  { value: "book", label: "Book" },
  { value: "music", label: "Music" },
  { value: "podcast", label: "Podcast" },
] as const;

export default function AddRankItemDialog({ 
  open, 
  onOpenChange, 
  rankId, 
  rankTitle,
  currentItemCount,
  maxItems = 20 
}: AddRankItemDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MediaResult[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { session } = useAuth();

  const resetForm = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedMedia([]);
    setMediaTypeFilter(null);
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
        body: JSON.stringify({ query: query.trim(), ...(mediaTypeFilter ? { type: mediaTypeFilter } : {}) }),
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
  }, [searchQuery, mediaTypeFilter]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(selectedMedia);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setSelectedMedia(items);
  };

  const addItemsMutation = useMutation({
    mutationFn: async (mediaItems: MediaResult[]) => {
      const results = [];
      for (let i = 0; i < mediaItems.length; i++) {
        const media = mediaItems[i];
        const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/add-rank-item", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({
            rankId: rankId,
            position: currentItemCount + i + 1,
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
        results.push(await response.json());
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['rank-detail', rankId] });
      resetForm();
      onOpenChange(false);
      // Share to feed after items added — 24h cooldown in edge function prevents spam
      if (session?.access_token) {
        fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/share-rank', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ rankId }),
        }).catch(() => {});
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Items",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSelectMedia = (media: MediaResult) => {
    const totalAfterAdd = currentItemCount + selectedMedia.length + 1;
    if (totalAfterAdd > maxItems) {
      toast({
        title: "Limit Reached",
        description: `This rank is limited to ${maxItems} items`,
        variant: "destructive"
      });
      return;
    }
    if (!selectedMedia.find(m => m.external_id === media.external_id && m.external_source === media.external_source)) {
      setSelectedMedia([...selectedMedia, media]);
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const removeMedia = (index: number) => {
    setSelectedMedia(selectedMedia.filter((_, i) => i !== index));
  };

  const handleAddItems = () => {
    if (selectedMedia.length === 0) return;
    addItemsMutation.mutate(selectedMedia);
  };

  const remainingSlots = maxItems - currentItemCount;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) resetForm(); onOpenChange(isOpen); }}>
      <DialogContent className="rounded-2xl w-[calc(100vw-2rem)] max-w-md bg-white text-black flex flex-col gap-3 p-4 sm:p-6" style={{ maxHeight: '80vh' }} data-testid="dialog-add-rank-item">
        <DialogHeader>
          <DialogTitle className="text-black flex items-center gap-2">
            <Trophy size={20} className="text-purple-600" />
            Add to Rank
          </DialogTitle>
          <p className="text-sm text-gray-500">Adding to "{rankTitle}" ({remainingSlots} slots remaining)</p>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 mt-1 flex-1 min-h-0 overflow-y-auto">
          {/* Media Search */}
          <div className="space-y-2">
            {/* Type filter pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 flex-shrink-0">
              {TYPE_FILTERS.map(({ value, label }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setMediaTypeFilter(value)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    mediaTypeFilter === value
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  data-testid={`filter-${label.toLowerCase()}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={mediaTypeFilter ? `Search ${mediaTypeFilter}s…` : 'Search movies, shows, books…'}
                className="pl-9 pr-9 bg-white text-black border-gray-200 rounded-xl focus:border-purple-400 placeholder:text-gray-400"
                data-testid="input-add-rank-media-search"
                autoFocus
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 animate-spin text-purple-600" size={16} />
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-xl">
                {(mediaTypeFilter
                  ? searchResults.filter(r => r.type === mediaTypeFilter || (mediaTypeFilter === 'book' && r.type === 'book_series'))
                  : searchResults
                ).slice(0, 8).map((result, index) => (
                  <button
                    key={`${result.external_id}-${index}`}
                    type="button"
                    onClick={() => handleSelectMedia(result)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left border-b border-gray-50 last:border-0"
                    data-testid={`search-result-${index}`}
                  >
                    {result.image ? (
                      <img src={result.image} alt={result.title} className="w-8 h-11 object-cover rounded flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-11 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                        <Search className="text-gray-400" size={14} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm line-clamp-1">{result.title}</p>
                      <p className="text-xs text-gray-500">{result.type}{result.year ? ` • ${result.year}` : ''}</p>
                      {result.creator && result.creator !== 'Unknown Author' && <p className="text-xs text-gray-400 truncate">{result.creator}</p>}
                    </div>
                    <Plus size={16} className="text-purple-500 shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {/* Selected Media with Drag & Drop */}
            {selectedMedia.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">{selectedMedia.length} item{selectedMedia.length > 1 ? 's' : ''} selected - drag to reorder:</p>
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="add-rank-items">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1">
                        {selectedMedia.map((media, index) => (
                          <Draggable key={`${media.external_id}-${media.external_source}-${index}`} draggableId={`add-${media.external_id}-${index}`} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-2 py-2 ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                              >
                                <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing text-purple-400 hover:text-purple-600">
                                  <GripVertical size={16} />
                                </div>
                                <span className="text-purple-600 font-bold text-sm w-6">#{currentItemCount + index + 1}</span>
                                {media.image && (
                                  <img src={media.image} alt="" className="w-8 h-8 rounded object-cover" />
                                )}
                                <span className="text-sm text-purple-900 flex-1 truncate">{media.title}</span>
                                <button 
                                  type="button" 
                                  onClick={() => removeMedia(index)} 
                                  className="text-purple-600 hover:text-red-600 p-1"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
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
            onClick={handleAddItems}
            size="sm"
            disabled={addItemsMutation.isPending || selectedMedia.length === 0}
            className="bg-purple-600 hover:bg-purple-700 text-white"
            data-testid="button-add-rank-item"
          >
            {addItemsMutation.isPending ? (
              <><Loader2 className="animate-spin mr-1" size={14} /> Posting...</>
            ) : (
              <>Post{selectedMedia.length > 0 ? ` (${selectedMedia.length})` : ''}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
