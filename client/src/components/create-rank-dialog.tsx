import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Search, Globe, Lock, X, Plus, Loader2, Users, Trophy, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import UserSearch from "@/components/user-search";

interface CreateRankDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

interface SelectedCollaborator {
  id: string;
  user_name: string;
  display_name?: string;
}

export default function CreateRankDialog({ open, onOpenChange }: CreateRankDialogProps) {
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MediaResult[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCollaborators, setSelectedCollaborators] = useState<SelectedCollaborator[]>([]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [, setLocation] = useLocation();

  const resetForm = () => {
    setTitle("");
    setIsPublic(true);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedMedia([]);
    setSelectedCollaborators([]);
  };

  const searchMedia = async (query: string, type?: string) => {
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
        body: JSON.stringify({ query: query.trim(), type }),
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

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(selectedMedia);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setSelectedMedia(items);
  };

  const createRankMutation = useMutation({
    mutationFn: async () => {
      const payload = { 
        title: title.trim(),
        visibility: isPublic ? 'public' : 'private',
      };
      console.log('Creating rank with payload:', payload);
      
      const response = await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/create-rank", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create rank');
      }

      return response.json();
    },
    onSuccess: async (data) => {
      console.log('Rank created successfully:', data);
      const rankId = data.data?.id || data.rank?.id;
      
      if (rankId && selectedMedia.length > 0) {
        for (let i = 0; i < selectedMedia.length; i++) {
          const media = selectedMedia[i];
          try {
            await fetch("https://mahpgcogwpawvviapqza.supabase.co/functions/v1/add-rank-item", {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session?.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                rankId: rankId,
                position: i + 1,
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
          } catch (err) {
            console.error('Failed to add rank item:', err);
          }
        }
      }
      
      await queryClient.refetchQueries({ queryKey: ['user-ranks'] });
      
      resetForm();
      onOpenChange(false);
      
      if (rankId) {
        setLocation(`/rank/${rankId}`);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Rank",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({ title: "Title Required", description: "Please enter a name for your rank", variant: "destructive" });
      return;
    }

    if (title.trim().length > 50) {
      toast({ title: "Title Too Long", description: "Rank name must be 50 characters or less", variant: "destructive" });
      return;
    }

    createRankMutation.mutate();
  };

  const addMedia = (media: MediaResult) => {
    if (selectedMedia.length >= 20) {
      toast({ title: "Limit Reached", description: "Ranks are limited to 20 items", variant: "destructive" });
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

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) resetForm(); onOpenChange(isOpen); }}>
      <DialogContent className="max-w-md bg-white text-black max-h-[90vh] overflow-y-auto" data-testid="dialog-create-rank">
        <DialogHeader>
          <DialogTitle className="text-black flex items-center gap-2">
            <Trophy size={20} className="text-purple-600" />
            Create New Rank
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Rank Name */}
          <div className="space-y-1">
            <Label className="text-black font-medium text-sm">Rank Name</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Top 10 90s Movies"
              maxLength={50}
              data-testid="input-rank-title"
              autoFocus
              className="bg-white text-black border-gray-300 focus:border-purple-400 placeholder:text-gray-400"
            />
            <p className="text-xs text-gray-500">{title.length}/50</p>
          </div>

          {/* Public/Private Toggle */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              {isPublic ? <Globe size={16} className="text-gray-600" /> : <Lock size={16} className="text-gray-600" />}
              <span className="text-black font-medium text-sm">Public</span>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={setIsPublic}
              data-testid="switch-rank-visibility"
            />
          </div>

          {/* Add Media Section */}
          <div className="space-y-2">
            <Label className="text-black font-medium text-sm">Add Media (Optional)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search movies, shows, books..."
                className="pl-9 bg-white text-black border-gray-300 focus:border-purple-400 placeholder:text-gray-400"
                data-testid="input-rank-media-search"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 animate-spin text-purple-600" size={16} />
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => addMedia(result)}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  >
                    {result.image ? (
                      <img src={result.image} alt={result.title} className="w-10 h-10 object-cover rounded" />
                    ) : (
                      <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                        <Search className="text-gray-400" size={16} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-black text-sm truncate">{result.title}</p>
                      <p className="text-xs text-gray-500 truncate">{result.creator} · {result.type}</p>
                    </div>
                    <Plus className="text-purple-600" size={18} />
                  </div>
                ))}
              </div>
            )}

            {selectedMedia.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">{selectedMedia.length}/20 items - drag to reorder:</p>
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="rank-items">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1">
                        {selectedMedia.map((media, index) => (
                          <Draggable key={`${media.external_id}-${media.external_source}-${index}`} draggableId={`${media.external_id}-${index}`} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-2 py-2 ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                              >
                                <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing text-purple-400 hover:text-purple-600">
                                  <GripVertical size={16} />
                                </div>
                                <span className="text-purple-600 font-bold text-sm w-6">#{index + 1}</span>
                                {media.image && (
                                  <img src={media.image} alt="" className="w-8 h-8 rounded object-cover" />
                                )}
                                <span className="text-sm text-purple-900 flex-1 truncate">{media.title}</span>
                                <button type="button" onClick={() => removeMedia(index)} className="text-purple-600 hover:text-red-600 p-1">
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

          {/* Collaborators Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-gray-500" />
              <Label className="text-black font-medium text-sm">Invite Collaborators (Optional)</Label>
            </div>
            <UserSearch
              onSelectUser={(user) => {
                if (!selectedCollaborators.find(c => c.id === user.id)) {
                  setSelectedCollaborators([...selectedCollaborators, {
                    id: user.id,
                    user_name: user.user_name,
                    display_name: user.display_name
                  }]);
                }
              }}
              excludeUserIds={[session?.user?.id || '', ...selectedCollaborators.map(c => c.id)]}
              placeholder="Search friends by name..."
            />
            {selectedCollaborators.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedCollaborators.map((collab) => (
                  <div key={collab.id} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
                    <span className="text-sm text-blue-900">@{collab.user_name}</span>
                    <button 
                      type="button" 
                      onClick={() => setSelectedCollaborators(selectedCollaborators.filter(c => c.id !== collab.id))} 
                      className="text-blue-600 hover:text-red-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        <div className="flex justify-end gap-2 pt-3 border-t mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { resetForm(); onOpenChange(false); }}
            className="border-gray-300 bg-white text-black hover:bg-gray-100"
            data-testid="button-cancel-create-rank"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            size="sm"
            disabled={createRankMutation.isPending || !title.trim()}
            className="bg-purple-600 hover:bg-purple-700 text-white"
            data-testid="button-create-rank"
          >
            {createRankMutation.isPending ? (
              <><Loader2 className="animate-spin mr-1" size={14} /> Creating...</>
            ) : (
              `Create${selectedMedia.length > 0 ? ` (${selectedMedia.length})` : ''}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
