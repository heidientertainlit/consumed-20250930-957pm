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
  requestId?: string;
}

const MAX_RANK_ITEMS = 10;
const MIN_RANK_ITEMS = 2;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";
const MEDIA_TYPES = [
  { label: "All", value: undefined },
  { label: "Movies", value: "movie" },
  { label: "TV", value: "tv" },
  { label: "Books", value: "book" },
  { label: "Music", value: "music" },
  { label: "Podcasts", value: "podcast" },
  { label: "YouTube", value: "youtube" },
  { label: "Games", value: "game" },
] as const;

type MediaTypeFilter = Exclude<(typeof MEDIA_TYPES)[number]["value"], undefined>;

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    throw new Error("The server returned an unreadable response. Please try again.");
  }
}

class FlowError extends Error {
  constructor(message: string, readonly flowToken: number, readonly aborted = false) {
    super(message);
    this.name = "FlowError";
  }
}

export default function CreateRankDialog({ open, onOpenChange }: CreateRankDialogProps) {
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [mediaType, setMediaType] = useState<MediaTypeFilter | undefined>(undefined);
  const [searchResults, setSearchResults] = useState<MediaResult[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedItemCount, setSavedItemCount] = useState(0);
  const [createdRankId, setCreatedRankId] = useState<string | null>(null);
  const [flowStarted, setFlowStarted] = useState(false);
  const createdRankIdRef = useRef<string | null>(null);
  const savedItemCountRef = useRef(0);
  const submissionInFlightRef = useRef(false);
  const searchRequestRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const previousMediaTypeRef = useRef<MediaTypeFilter | undefined>(undefined);
  const rankRequestIdRef = useRef<string | null>(null);
  const flowAbortRef = useRef<AbortController | null>(null);
  const flowGenerationRef = useRef(0);
  const flowTokenRef = useRef(0);
  const flowOwnerIdRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const previousUserIdRef = useRef<string | null | undefined>(undefined);
  const mountedRef = useRef(true);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [, setLocation] = useLocation();
  currentUserIdRef.current = session?.user.id || null;

  const resetForm = () => {
    searchAbortRef.current?.abort();
    searchAbortRef.current = null;
    flowAbortRef.current?.abort();
    flowAbortRef.current = null;
    flowGenerationRef.current += 1;
    flowTokenRef.current = flowGenerationRef.current;
    setTitle("");
    setIsPublic(true);
    setSearchQuery("");
    setMediaType(undefined);
    setSearchResults([]);
    setIsSearching(false);
    setSelectedMedia([]);
    setSaveError("");
    setSavedItemCount(0);
    setCreatedRankId(null);
    setFlowStarted(false);
    createdRankIdRef.current = null;
    savedItemCountRef.current = 0;
    submissionInFlightRef.current = false;
    rankRequestIdRef.current = null;
    flowOwnerIdRef.current = null;
    searchRequestRef.current += 1;
  };

  const isFlowActive = (token: number) => (
    mountedRef.current
    && flowGenerationRef.current === token
    && !flowAbortRef.current?.signal.aborted
    && !!flowOwnerIdRef.current
    && flowOwnerIdRef.current === currentUserIdRef.current
  );

  useEffect(() => {
    const userId = session?.user.id || null;
    if (previousUserIdRef.current === undefined) {
      previousUserIdRef.current = userId;
      return;
    }
    if (previousUserIdRef.current !== userId) {
      previousUserIdRef.current = userId;
      resetForm();
      onOpenChange(false);
    }
  }, [session?.user.id]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      flowGenerationRef.current += 1;
      flowAbortRef.current?.abort();
      searchAbortRef.current?.abort();
      searchRequestRef.current += 1;
    };
  }, []);

  const searchMedia = async (query: string, type?: string) => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      if (!trimmedQuery) setSearchResults([]);
      return;
    }

    const bearer = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const requestId = ++searchRequestRef.current;
    setIsSearching(true);
    
    try {
      const body: { query: string; type?: string } = { query: trimmedQuery };
      if (type) body.type = type;
      const response = await fetch(`${SUPABASE_URL}/functions/v1/media-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${bearer}`,
        },
        signal: controller.signal,
        body: JSON.stringify(body),
      });

      const data = await readJson(response);
      if (!response.ok) throw new Error(data?.error || "Search failed");
      if (requestId !== searchRequestRef.current) return;
      setSearchResults((data.results || []).map((result: any) => ({
        ...result,
        image: result.image || result.image_url || result.poster_url || "",
      })));
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) return;
      console.error("Media search error:", error);
      if (requestId === searchRequestRef.current) {
        toast({
          title: "Media search failed",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      if (requestId === searchRequestRef.current) {
        setIsSearching(false);
        if (searchAbortRef.current === controller) searchAbortRef.current = null;
      }
    }
  };

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();
    const mediaTypeChanged = previousMediaTypeRef.current !== mediaType;
    previousMediaTypeRef.current = mediaType;
    searchAbortRef.current?.abort();
    searchAbortRef.current = null;
    searchRequestRef.current += 1;
    setIsSearching(false);

    if (!trimmedQuery) {
      setSearchResults([]);
      return;
    }
    if (trimmedQuery.length < 2) {
      return;
    }

    if (mediaTypeChanged) {
      void searchMedia(searchQuery, mediaType);
      return;
    }

    const debounce = setTimeout(() => void searchMedia(searchQuery, mediaType), 200);

    return () => clearTimeout(debounce);
  }, [searchQuery, mediaType]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || flowStarted) return;
    
    const items = Array.from(selectedMedia);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setSelectedMedia(items);
  };

  const createRankMutation = useMutation({
    mutationFn: async () => {
      const token = flowTokenRef.current;
      try {
        if (!session?.access_token || !session.user.id) {
          throw new Error("Please sign in before creating a ranked list.");
        }
        if (!isFlowActive(token)) {
          throw new FlowError("Rank creation was cancelled.", token, true);
        }

        let rankId = createdRankIdRef.current;
        if (!rankId) {
          const response = await fetch(`${SUPABASE_URL}/functions/v1/create-rank`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session.access_token}`,
            },
            signal: flowAbortRef.current!.signal,
            body: JSON.stringify({
              requestId: rankRequestIdRef.current,
              title: title.trim(),
              visibility: isPublic ? "public" : "private",
            }),
          });
          const data = await readJson(response);
          if (!isFlowActive(token)) throw new FlowError("Rank creation was cancelled.", token, true);
          if (!response.ok) throw new Error(data?.error || "Failed to create ranked list.");
          if (data?.success !== true) throw new Error(data?.error || "The ranked list was not created.");
          if (typeof data?.data?.id !== "string" || !data.data.id.trim()) {
            throw new Error("The server did not return the ranked list ID. Retrying will safely check the same creation request.");
          }
          rankId = data.data.id;
          createdRankIdRef.current = rankId;
          setCreatedRankId(rankId);
        }

        for (let i = savedItemCountRef.current; i < selectedMedia.length; i++) {
          if (!isFlowActive(token)) throw new FlowError("Rank creation was cancelled.", token, true);
          const media = selectedMedia[i];
          const response = await fetch(`${SUPABASE_URL}/functions/v1/add-rank-item`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            signal: flowAbortRef.current!.signal,
            body: JSON.stringify({
              requestId: media.requestId,
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
          if (!isFlowActive(token)) throw new FlowError("Rank creation was cancelled.", token, true);
          if (!response.ok) {
            throw new Error(data?.error || `Could not save item ${i + 1} (${media.title}).`);
          }
          if (data?.success !== true || !data?.data) {
            throw new Error(data?.error || `The server did not confirm item ${i + 1} (${media.title}).`);
          }
          savedItemCountRef.current = i + 1;
          setSavedItemCount(i + 1);
        }

        return { rankId, flowToken: token };
      } catch (error) {
        if (error instanceof FlowError) throw error;
        const aborted = error instanceof DOMException && error.name === "AbortError";
        throw new FlowError(
          error instanceof Error ? error.message : "Please try again.",
          token,
          aborted,
        );
      }
    },
    onSuccess: async ({ rankId, flowToken }) => {
      if (!isFlowActive(flowToken)) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["consumed-ranks-carousel"] }),
        queryClient.invalidateQueries({ queryKey: ["user-ranks"] }),
      ]);
      if (!isFlowActive(flowToken)) return;
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["consumed-ranks-carousel"], type: "all" }),
        queryClient.refetchQueries({ queryKey: ["user-ranks"], type: "all" }),
      ]);
      if (!isFlowActive(flowToken)) return;
      onOpenChange(false);
      setLocation(`/rank/${rankId}`);
      resetForm();
    },
    onError: (error: FlowError) => {
      if (error.aborted || !isFlowActive(error.flowToken)) return;
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
    onSettled: (data, error) => {
      const token = data?.flowToken ?? (error instanceof FlowError ? error.flowToken : -1);
      if (token !== flowGenerationRef.current) return;
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

    if (!session?.access_token || !session.user.id) {
      toast({ title: "Sign in required", description: "Please sign in before creating a ranked list.", variant: "destructive" });
      return;
    }

    setSaveError("");
    if (!flowStarted) {
      const controller = new AbortController();
      flowAbortRef.current = controller;
      flowGenerationRef.current += 1;
      flowTokenRef.current = flowGenerationRef.current;
      flowOwnerIdRef.current = session?.user.id || null;
      rankRequestIdRef.current = crypto.randomUUID();
      setFlowStarted(true);
    }
    submissionInFlightRef.current = true;
    createRankMutation.mutate();
  };

  const addMedia = (media: MediaResult) => {
    if (flowStarted) return;
    if (selectedMedia.length >= MAX_RANK_ITEMS) {
      toast({ title: "Limit Reached", description: `Ranks are limited to ${MAX_RANK_ITEMS} items`, variant: "destructive" });
      return;
    }
    if (!selectedMedia.find(m => m.external_id === media.external_id && m.external_source === media.external_source)) {
      setSelectedMedia([...selectedMedia, { ...media, requestId: crypto.randomUUID() }]);
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const removeMedia = (index: number) => {
    if (flowStarted) return;
    setSelectedMedia(selectedMedia.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (createRankMutation.isPending) return; if (!isOpen) resetForm(); onOpenChange(isOpen); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-md min-w-0 overflow-x-hidden overflow-y-auto rounded-3xl bg-white text-black sm:rounded-3xl" data-testid="dialog-create-rank">
        <DialogHeader>
          <DialogTitle className="text-black flex items-center gap-2">
            <Trophy size={20} className="text-purple-600" />
            Create New Rank
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="min-w-0 space-y-4">
          {/* Rank Name */}
          <div className="space-y-1">
            <Label className="text-black font-medium text-sm">Rank Name</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Top 10 90s Movies"
              maxLength={50}
              disabled={flowStarted}
              data-testid="input-rank-title"
              autoFocus
              className="rounded-xl bg-white text-black border-gray-300 focus:border-purple-400 placeholder:text-gray-400"
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
              disabled={flowStarted}
              data-testid="switch-rank-visibility"
            />
          </div>

          {/* Add Media Section */}
          <div className="min-w-0 space-y-2">
            <Label className="text-black font-medium text-sm">Add media (2–10 items)</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search movies, shows, books..."
                className="rounded-xl pl-9 bg-white text-black border-gray-300 focus:border-purple-400 placeholder:text-gray-400"
                data-testid="input-rank-media-search"
                disabled={flowStarted}
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 animate-spin text-purple-600" size={16} />
              )}
            </div>

            <div
              className="scrollbar-hide flex w-full min-w-0 max-w-full gap-1.5 overflow-x-auto pb-1"
              style={{ scrollbarWidth: "none" }}
              aria-label="Filter media type"
              data-testid="rank-media-type-filters"
            >
              {MEDIA_TYPES.map((option) => {
                const selected = mediaType === option.value;
                const testValue = option.value || "all";
                return (
                  <button
                    key={testValue}
                    type="button"
                    aria-pressed={selected}
                    data-testid={`filter-rank-media-${testValue}`}
                    disabled={flowStarted}
                    onClick={() => setMediaType(option.value)}
                    className={`shrink-0 rounded-xl border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                      selected
                        ? "border-purple-600 bg-purple-600 text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:border-purple-300 hover:bg-purple-50"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {searchResults.length > 0 && (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-gray-200 p-1" data-testid="rank-media-search-results">
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    onClick={() => addMedia(result)}
                    className="flex cursor-pointer items-center gap-3 rounded-xl p-2 hover:bg-gray-50"
                  >
                    {result.image ? (
                      <img src={result.image} alt={result.title} className="w-10 h-10 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-200">
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
                          <Draggable key={media.requestId} draggableId={media.requestId!} index={index} isDragDisabled={flowStarted}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-2 py-2 ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                              >
                                <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing text-purple-400 hover:text-purple-600">
                                  <GripVertical size={16} />
                                </div>
                                <span className="text-purple-600 font-bold text-sm w-6">#{index + 1}</span>
                                {media.image && (
                                  <img src={media.image} alt="" className="h-8 w-8 rounded-xl object-cover" />
                                )}
                                <span className="text-sm text-purple-900 flex-1 truncate">{media.title}</span>
                                <button type="button" onClick={() => removeMedia(index)} disabled={flowStarted} aria-label={`Remove ${media.title}`} className="text-purple-600 hover:text-red-600 p-1 disabled:opacity-40">
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
            <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="mt-0.5 shrink-0" size={16} />
              <div>
                <p className="font-medium">{createdRankId ? "Your rank was created, but not every item was saved." : "We couldn't create your rank."}</p>
                <p className="mt-0.5 text-xs">{saveError}</p>
                {createdRankId && <p className="mt-1 text-xs font-medium">Retry will continue with item {savedItemCount + 1}; saved items will not be added again.</p>}
                {createdRankId && (
                  <button type="button" onClick={() => setLocation(`/rank/${createdRankId}`)} className="mt-2 font-semibold underline">
                    View saved rank
                  </button>
                )}
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
            className="rounded-xl border-gray-300 bg-white text-black hover:bg-gray-100"
            data-testid="button-cancel-create-rank"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            size="sm"
            disabled={createRankMutation.isPending || !title.trim() || selectedMedia.length < MIN_RANK_ITEMS}
            className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white"
            data-testid="button-create-rank"
          >
            {createRankMutation.isPending ? (
              <><Loader2 className="animate-spin mr-1" size={14} /> Creating...</>
            ) : (
              flowStarted ? "Retry saving" : `Create (${selectedMedia.length})`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
