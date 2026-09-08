import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { X, Loader2, Trophy, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import MediaSearchPanel from "@/components/media-search-panel";

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
  creator?: string;
  image: string;
  year?: string | number;
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
  maxItems = 20 
}: AddRankItemDialogProps) {
  const [selectedMedia, setSelectedMedia] = useState<MediaResult[]>([]);
  const [searchPanelKey, setSearchPanelKey] = useState(0);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { session } = useAuth();

  const resetForm = () => {
    setSelectedMedia([]);
    setSearchPanelKey((key) => key + 1);
  };

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
    // The shared panel owns its input/results state; remount it after a pick
    // to retain this dialog's established multi-select flow.
    setSearchPanelKey((key) => key + 1);
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
      <DialogContent
        className="flex h-[80vh] max-h-[760px] w-[calc(100vw-2rem)] max-w-md flex-col gap-3 overflow-hidden rounded-2xl bg-white p-4 text-black sm:p-6"
        data-testid="dialog-add-rank-item"
      >
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
            <MediaSearchPanel
              key={searchPanelKey}
              onSelect={(result) => handleSelectMedia(result as MediaResult)}
              autoFocus
            />

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
