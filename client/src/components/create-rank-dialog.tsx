import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Search, Globe, Lock, X, Plus, Loader2, Trophy, GripVertical, AlertCircle } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

interface CreateRankDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MediaResult {
  title: string;
  type: string;
  creator: string;
  image: string;
  poster_url?: string;
  image_url?: string;
  external_id?: string;
  external_source?: string;
  description?: string;
}

const MAX_RANK_ITEMS = 10;
const MIN_RANK_ITEMS = 2;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    throw new Error("The server returned an unreadable response. Please try again.");
  }
}

export default function CreateRankDialog({ open, onOpenChange }: CreateRankDialogProps) {
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MediaResult[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedItemCount, setSavedItemCount] = useState(0);
  const [createdRankId, setCreatedRankId] = useState<string | null>(null);
  const [creationBlocked, setCreationBlocked] = useState(false);
  const createdRankIdRef = useRef<string | null>(null);
  const savedItemCountRef = useRef(0);
  const submissionInFlightRef = useRef(false);
  const searchRequestRef = useRef(0);
  
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
    setSaveError("");
    setSavedItemCount(0);
    setCreatedRankId(null);
    setCreationBlocked(false);
    createdRankIdRef.current = null;
    savedItemCountRef.current = 0;
    submissionInFlightRef.current = false;
  };

  const searchMedia = async (query: string, type?: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const bearer = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
    const requestId = ++searchRequestRef.current;
    setIsSearching(true);
    
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/media-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${bearer}`,
        },
        body: JSON.stringify({ query: query.trim(), type }),
      });

      const data = await readJson(response);
      if (!response.ok) throw new Error(data?.error || "Search failed");
      if (requestId !== searchRequestRef.current) return;
      setSearchResults((data.results || []).map((result: any) => ({
        ...result,
        image: result.image || result.image_url || result.poster_url || "",
      })));
    } catch (error) {
      console.error("Media search error:", error);
      if (requestId === searchRequestRef.current) {
        setSearchResults([]);
        toast({
          title: "Media search failed",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      if (requestId === searchRequestRef.current) setIsSearching(false);
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
      if (!session?.access_token) throw new Error("Please sign in before creating a ranked list.");

      let rankId = createdRankIdRef.current;
      if (!rankId) {
        if (creationBlocked) {
          throw new Error("This creation attempt cannot be safely retried because the server did not return its ID. Close this window and check your ranks.");
        }
        const response = await fetch(`${SUPABASE_URL}/functions/v1/create-rank`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            title: title.trim(),
            visibility: isPublic ? "public" : "private",
          }),
        });
        const data = await readJson(response);
        if (!response.ok) throw new Error(data?.error || "Failed to create ranked list.");
        if (data?.success !== true) throw new Error(data?.error || "The ranked list was not created.");
        if (typeof data?.data?.id !== "string" || !data.data.id.trim()) {
          setCreationBlocked(true);
          throw new Error("The ranked list was created, but the server did not return its ID. Please close this window and check your ranks before trying again.");
        }
        rankId = data.data.id;
        createdRankIdRef.current = rankId;
        setCreatedRankId(rankId);
      }

      for (let i = savedItemCountRef.current; i < selectedMedia.length; i++) {
        const media = selectedMedia[i];
        const response = await fetch(`${SUPABASE_URL}/functions/v1/add-rank-item`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rankId,
            position: i + 1,
            media: {
              title: media.title,
              mediaType: media.type,
              creator: media.creator,
              imageUrl: media.image,
              externalId: media.external_id,
              externalSource: media.external_source,
            },
          }),
        });
        const data = await readJson(response);
        if (!response.ok) {
          throw new Error(data?.error || `Could not save item ${i + 1} (${media.title}).`);
        }
        if (data?.success !== true || !data?.data) {
          throw new Error(data?.error || `The server did not confirm item ${i + 1} (${media.title}).`);
        }
        savedItemCountRef.current = i + 1;
        setSavedItemCount(i + 1);
      }

      return rankId;
    },
    onSuccess: async (rankId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["consumed-ranks-carousel"] }),
        queryClient.invalidateQueries({ queryKey: ["user-ranks"] }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["consumed-ranks-carousel"], type: "all" }),
        queryClient.refetchQueries({ queryKey: ["user-ranks"], type: "all" }),
      ]);
      resetForm();
      onOpenChange(false);
      setLocation(`/rank/${rankId}`);
    },
    onError: (error: Error) => {
      const prefix = createdRankIdRef.current
        ? `${savedItemCountRef.current} of ${selectedMedia.length} items saved. `
        : "";
      setSaveError(`${prefix}${error.message || "Please try again."}`);
      toast({
        title: createdRankIdRef.current ? "Rank needs your attention" : "Failed to create rank",
        description: `${prefix}${error.message || "Please try again."}`,
        variant: "destructive",
      });
    },
    onSettled: () => {
      submissionInFlightRef.current = false;
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submissionInFlightRef.current || createRankMutation.isPending) return;
    
    if (!title.trim()) {
      toast({ title: "Title Required", description: "Please enter a name for your rank", variant: "destructive" });
      return;
    }

    if (title.trim().length > 50) {
      toast({ title: "Title Too Long", description: "Rank name must be 50 characters or less", variant: "destructive" });
      return;
    }

    if (selectedMedia.length < MIN_RANK_ITEMS) {
      toast({ title: "Add at least 2 items", description: "A ranked list needs at least two choices.", variant: "destructive" });
      return;
    }

    setSaveError("");
    submissionInFlightRef.current = true;
    createRankMutation.mutate();
  };

  const addMedia = (media: MediaResult) => {
    if (createdRankIdRef.current) return;
    if (selectedMedia.length >= MAX_RANK_ITEMS) {
      toast({ title: "Limit Reached", description: `Ranks are limited to ${MAX_RANK_ITEMS} items`, variant: "destructive" });
      return;
    }
    if (!selectedMedia.find(m => m.external_id === media.external_id && m.external_source === media.external_source)) {
      setSelectedMedia([...selectedMedia, media]);
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const removeMedia = (index: number) => {
    if (createdRankIdRef.current) return;
    setSelectedMedia(selectedMedia.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (createRankMutation.isPending) return; if (!isOpen) resetForm(); onOpenChange(isOpen); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto bg-white text-black" data-testid="dialog-create-rank">
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
              disabled={!!createdRankId}
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
              disabled={!!createdRankId}
              data-testid="switch-rank-visibility"
            />
          </div>

          {/* Add Media Section */}
          <div className="space-y-2">
            <Label className="text-black font-medium text-sm">Add media (2–10 items)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search movies, shows, books..."
                className="pl-9 bg-white text-black border-gray-300 focus:border-purple-400 placeholder:text-gray-400"
                data-testid="input-rank-media-search"
                disabled={!!createdRankId}
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
                <p className="text-sm text-gray-600">{selectedMedia.length}/{MAX_RANK_ITEMS} items · drag to reorder</p>
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="rank-items">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1">
                        {selectedMedia.map((media, index) => (
                          <Draggable key={`${media.external_id}-${media.external_source}-${index}`} draggableId={`${media.external_id}-${index}`} index={index} isDragDisabled={!!createdRankId}>
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
                                <button type="button" onClick={() => removeMedia(index)} disabled={!!createdRankId} aria-label={`Remove ${media.title}`} className="text-purple-600 hover:text-red-600 p-1 disabled:opacity-40">
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

          {saveError && (
            <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="mt-0.5 shrink-0" size={16} />
              <div>
                <p className="font-medium">{createdRankId ? "Your rank was created, but not every item was saved." : "We couldn't create your rank."}</p>
                <p className="mt-0.5 text-xs">{saveError}</p>
                {createdRankId && <p className="mt-1 text-xs font-medium">Retry will continue with item {savedItemCount + 1}; saved items will not be added again.</p>}
              </div>
            </div>
          )}
        </form>

        <div className="flex justify-end gap-2 pt-3 border-t mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { resetForm(); onOpenChange(false); }}
            disabled={createRankMutation.isPending}
            className="border-gray-300 bg-white text-black hover:bg-gray-100"
            data-testid="button-cancel-create-rank"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            size="sm"
            disabled={createRankMutation.isPending || creationBlocked || !title.trim() || selectedMedia.length < MIN_RANK_ITEMS}
            className="bg-purple-600 hover:bg-purple-700 text-white"
            data-testid="button-create-rank"
          >
            {createRankMutation.isPending ? (
              <><Loader2 className="animate-spin mr-1" size={14} /> Creating...</>
            ) : (
              creationBlocked ? "Check your ranks" : createdRankId ? "Retry saving items" : `Create (${selectedMedia.length})`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
