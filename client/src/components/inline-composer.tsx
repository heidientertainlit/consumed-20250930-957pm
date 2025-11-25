import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Star, Target, Vote, MessageCircle, Loader2, Search, ListPlus, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import MentionTextarea from "@/components/mention-textarea";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

type ComposerStage = "search" | "actions";
type ActionMode = "" | "thought" | "rating" | "prediction" | "poll" | "list" | "track";

export default function InlineComposer() {
  const { session, user } = useAuth();
  const { toast } = useToast();
  
  // Stage management
  const [stage, setStage] = useState<ComposerStage>("search");
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [actionMode, setActionMode] = useState<ActionMode>("");
  
  // Media search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Action-specific state
  const [thoughtText, setThoughtText] = useState("");
  const [ratingValue, setRatingValue] = useState(0);
  const [predictionQuestion, setPredictionQuestion] = useState("");
  const [predictionOptions, setPredictionOptions] = useState<string[]>(["", ""]);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [selectedListId, setSelectedListId] = useState<string>("");
  
  // Common state
  const [containsSpoilers, setContainsSpoilers] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  // Fetch user's lists (enabled for quick tracking)
  const { data: userListsData } = useQuery<any>({
    queryKey: ['user-lists-with-media'],
    queryFn: async () => {
      if (!session?.access_token) return null;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/get-user-lists-with-media`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user lists');
      }

      return response.json();
    },
    enabled: !!session?.access_token && (actionMode === "list" || stage === "search"),
  });

  const userLists = userListsData?.lists || [];

  // Track to specific list
  const handleTrackToList = async (media: any, listIdOrType: number | string) => {
    if (!session?.access_token) {
      toast({
        title: "Unable to Track",
        description: "Please try again.",
        variant: "destructive",
      });
      return;
    }

    try {
      const list = userLists.find((l: any) => l.id === listIdOrType);
      if (!list) throw new Error("List not found");

      const isCustom = list.isCustom === true;

      // Determine external source/ID
      let externalSource = media.external_source || media.source || 'tmdb';
      let externalId = media.external_id || media.id || '';

      // Infer from media type if needed
      if (!media.external_source) {
        if (media.type === 'book') {
          externalSource = 'openlibrary';
        } else if (media.type === 'podcast') {
          externalSource = 'spotify';
        }
      }

      const mediaData = {
        title: media.title || "",
        mediaType: media.type || "movie",
        creator: media.creator || media.author || media.artist || "",
        imageUrl: media.poster_url || media.image_url || media.image || media.thumbnail || "",
        externalId,
        externalSource
      };

      // Use different endpoints for custom vs default lists
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const url = isCustom 
        ? `${supabaseUrl}/functions/v1/add-to-custom-list`
        : `${supabaseUrl}/functions/v1/track-media`;

      // Extract list type from list object - could be 'queue', 'currently', 'finished', etc.
      let listType = list.type;
      if (!listType) {
        // Try to infer from title/name
        const title = (list.title || list.name || '').toLowerCase();
        if (title.includes('queue')) listType = 'queue';
        else if (title.includes('currently')) listType = 'currently';
        else if (title.includes('finished')) listType = 'finished';
        else if (title.includes('did not')) listType = 'dnf';
        else if (title.includes('favorite')) listType = 'favorites';
        else listType = 'queue'; // fallback
      }

      const body = isCustom
        ? { media: mediaData, customListId: listIdOrType }
        : { media: mediaData, listType };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || errorData.message || 'Failed to add to list');
      }

      const result = await response.json();
      const isDuplicate = result?.message === 'Item already in list';

      toast({
        title: isDuplicate ? "Already in list!" : "Tracked!",
        description: isDuplicate 
          ? `${media.title} is already in this list.`
          : `${media.title} added to ${list.title}`,
      });

      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
    } catch (error) {
      console.error("Track error:", error);
      toast({
        title: "Track Failed",
        description: "Unable to track item. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Auto-search when query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        handleMediaSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const resetComposer = () => {
    setStage("search");
    setSelectedMedia(null);
    setActionMode("");
    setSearchQuery("");
    setSearchResults([]);
    setThoughtText("");
    setRatingValue(0);
    setPredictionQuestion("");
    setPredictionOptions(["", ""]);
    setPollQuestion("");
    setPollOptions(["", ""]);
    setSelectedListId("");
    setContainsSpoilers(false);
  };

  const handleMediaSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/media-search`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch (error) {
      console.error("Media search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectMedia = (media: any) => {
    setSelectedMedia(media);
    setStage("actions");
    setSearchQuery("");
    setSearchResults([]);
  };

  const handlePost = async () => {
    if (!session?.access_token) {
      toast({
        title: "Not Authenticated",
        description: "Please log in first.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedMedia) {
      toast({
        title: "Media Required",
        description: "Please select what you're consuming first.",
        variant: "destructive",
      });
      return;
    }

    setIsPosting(true);
    try {
      // Handle adding to list separately
      if (actionMode === "list") {
        if (!selectedListId) {
          toast({
            title: "List Required",
            description: "Please select a list.",
            variant: "destructive",
          });
          setIsPosting(false);
          return;
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
        const response = await fetch(
          `${supabaseUrl}/functions/v1/add-media-to-list`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              list_id: selectedListId,
              media_title: selectedMedia.title || "",
              media_type: selectedMedia.type || "movie",
              media_creator: selectedMedia.creator || selectedMedia.author || selectedMedia.artist || "",
              media_image_url: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.image || selectedMedia.thumbnail || "",
              media_external_id: selectedMedia.external_id || selectedMedia.id || "",
              media_external_source: selectedMedia.external_source || selectedMedia.source || "tmdb",
            }),
          }
        );

        if (!response.ok) throw new Error("Failed to add to list");

        toast({
          title: "Added to List!",
          description: `${selectedMedia.title} has been added to your list.`,
        });

        queryClient.invalidateQueries({ queryKey: ['/api/lists'] });
        resetComposer();
        setIsPosting(false);
        return;
      }

      // Handle social posting
      let payload: any = {};

      // Add action-specific data
      if (actionMode === "thought" && thoughtText.trim()) {
        // Minimal payload for thought posts (like share-update-dialog-v2)
        payload = {
          content: thoughtText.trim(),
          type: "thought",
          visibility: "public",
          contains_spoilers: containsSpoilers,
          media_title: selectedMedia?.title || "",
          media_type: selectedMedia?.type || "movie",
          media_creator: selectedMedia?.creator || selectedMedia?.author || selectedMedia?.artist || "",
          media_image_url: selectedMedia?.poster_url || selectedMedia?.image_url || selectedMedia?.image || selectedMedia?.thumbnail || "",
          media_external_id: selectedMedia?.external_id || selectedMedia?.id || "",
          media_external_source: selectedMedia?.external_source || selectedMedia?.source || 'tmdb',
        };
      } else if (actionMode === "rating") {
        if (ratingValue === 0) {
          toast({
            title: "Rating Required",
            description: "Please select a star rating.",
            variant: "destructive",
          });
          setIsPosting(false);
          return;
        }
        payload = {
          media_title: selectedMedia.title || "",
          media_type: selectedMedia.type || "movie",
          media_creator: selectedMedia.creator || selectedMedia.author || selectedMedia.artist || "",
          media_image_url: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.image || selectedMedia.thumbnail || "",
          media_external_id: selectedMedia.external_id || selectedMedia.id || "",
          media_external_source: selectedMedia.external_source || selectedMedia.source || 'tmdb',
          visibility: "public",
          contains_spoilers: containsSpoilers,
          rating: ratingValue,
          content: `Rated ${selectedMedia.title}`,
          type: "rate-review",
        };
      } else if (actionMode === "prediction") {
        const filledOptions = predictionOptions.filter(opt => opt.trim()).filter(opt => opt.length > 0);
        if (!predictionQuestion.trim() || filledOptions.length < 2) {
          toast({
            title: "Incomplete Prediction",
            description: "Please add a question and at least 2 non-empty options.",
            variant: "destructive",
          });
          setIsPosting(false);
          return;
        }
        payload = {
          media_title: selectedMedia.title || "",
          media_type: selectedMedia.type || "movie",
          media_creator: selectedMedia.creator || selectedMedia.author || selectedMedia.artist || "",
          media_image_url: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.image || selectedMedia.thumbnail || "",
          media_external_id: selectedMedia.external_id || selectedMedia.id || "",
          media_external_source: selectedMedia.external_source || selectedMedia.source || 'tmdb',
          visibility: "public",
          contains_spoilers: containsSpoilers,
          content: predictionQuestion.trim(),
          type: "prediction",
          prediction_question: predictionQuestion.trim(),
          prediction_options: filledOptions,
        };
      } else if (actionMode === "poll") {
        const filledOptions = pollOptions.filter(opt => opt.trim()).filter(opt => opt.length > 0);
        if (!pollQuestion.trim() || filledOptions.length < 2) {
          toast({
            title: "Incomplete Poll",
            description: "Please add a question and at least 2 non-empty options.",
            variant: "destructive",
          });
          setIsPosting(false);
          return;
        }
        payload = {
          media_title: selectedMedia.title || "",
          media_type: selectedMedia.type || "movie",
          media_creator: selectedMedia.creator || selectedMedia.author || selectedMedia.artist || "",
          media_image_url: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.image || selectedMedia.thumbnail || "",
          media_external_id: selectedMedia.external_id || selectedMedia.id || "",
          media_external_source: selectedMedia.external_source || selectedMedia.source || 'tmdb',
          visibility: "public",
          contains_spoilers: containsSpoilers,
          content: pollQuestion.trim(),
          type: "poll",
          poll_question: pollQuestion.trim(),
          poll_options: filledOptions,
        };
      } else {
        // Just tracking media consumption
        payload = {
          media_title: selectedMedia.title || "",
          media_type: selectedMedia.type || "movie",
          media_creator: selectedMedia.creator || selectedMedia.author || selectedMedia.artist || "",
          media_image_url: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.image || selectedMedia.thumbnail || "",
          media_external_id: selectedMedia.external_id || selectedMedia.id || "",
          media_external_source: selectedMedia.external_source || selectedMedia.source || 'tmdb',
          visibility: "public",
          contains_spoilers: containsSpoilers,
          content: `Added ${selectedMedia.title}`,
          type: "add-media",
        };
      }

      console.log("📤 Sending post payload:", payload);
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/share-update`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log("📥 Response status:", response.status);

      if (!response.ok) {
        let errorData = '';
        try {
          errorData = await response.text();
        } catch (e) {
          errorData = 'Unknown error';
        }
        console.error("❌ Share update failed:", response.status, errorData);
        console.error("📋 Full response:", { status: response.status, headers: response.headers, body: errorData });
        throw new Error(`Failed to post (${response.status}): ${errorData}`);
      }

      const result = await response.json();
      console.log("✅ Post created successfully:", result);

      toast({
        title: "Posted!",
        description: "Your update has been shared.",
      });

      queryClient.invalidateQueries({ queryKey: ['social-feed'] });
      resetComposer();
    } catch (error) {
      console.error("Post error:", error);
      toast({
        title: "Post Failed",
        description: "Unable to share your update. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div>
      {/* Step 1: Media Search */}
      {stage === "search" && (
        <div>
          <div className="text-center mb-6">
            <h1 className="text-3xl font-semibold text-white mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
              What's everyone consuming?
            </h1>
            <p className="text-white/80 text-sm">
              See their picks. Share yours.
            </p>
          </div>
          
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a movie, show, book, podcast, music..."
              className="w-full pl-12 pr-4 py-4 bg-white border-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-300 text-gray-900 placeholder:text-gray-400 shadow-lg"
              data-testid="input-media-search"
            />
          </div>

          {/* Search Results */}
          {isSearching && (
            <div className="mt-4 flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-white" />
            </div>
          )}

          {!isSearching && searchResults.length > 0 && (
            <div className="mt-4 max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-4 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {searchResults.map((media, index) => (
                  <div
                    key={index}
                    className="relative"
                  >
                    <div className="relative group">
                      <button
                        onClick={() => handleSelectMedia(media)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all text-left"
                        data-testid={`button-select-media-${index}`}
                      >
                        {(media.poster_url || media.image_url || media.image) && (
                          <img
                            src={media.poster_url || media.image_url || media.image}
                            alt={media.title}
                            className="w-12 h-16 object-cover rounded"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{media.title}</p>
                          <p className="text-sm text-gray-600">
                            {media.type} {media.creator || media.author || media.artist ? `• ${media.creator || media.author || media.artist}` : ''}
                          </p>
                        </div>
                      </button>

                      {/* Icon buttons overlay */}
                      <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm px-3 py-2 rounded-full z-50">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-5 w-5 rounded-full bg-transparent hover:text-purple-400 text-white p-0 border-0"
                              data-testid={`button-add-media-${index}`}
                            >
                              <Plus className="w-5 h-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent 
                            align="end" 
                            side="top"
                            sideOffset={8}
                            alignOffset={-16}
                            className="w-56 bg-gray-900 border border-gray-700 max-h-[70vh] overflow-y-auto"
                          >
                            {userLists.filter((list: any) => !list.isCustom).map((list: any) => (
                              <DropdownMenuItem
                                key={list.id}
                                onClick={() => handleTrackToList(media, list.id)}
                                className="cursor-pointer text-white hover:bg-gray-800"
                              >
                                Add to {list.title || list.name}
                              </DropdownMenuItem>
                            ))}
                            
                            {/* Custom Lists */}
                            {userLists.filter((list: any) => list.isCustom).length > 0 && (
                              <>
                                <div className="px-2 py-1.5 text-xs text-gray-400 font-semibold border-t border-gray-700 mt-1 pt-2">
                                  MY CUSTOM LISTS
                                </div>
                                {userLists
                                  .filter((list: any) => list.isCustom)
                                  .map((list: any) => (
                                    <DropdownMenuItem
                                      key={list.id}
                                      onClick={() => handleTrackToList(media, list.id)}
                                      className="cursor-pointer text-white hover:bg-gray-800"
                                    >
                                      Add to {list.title}
                                    </DropdownMenuItem>
                                  ))}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-5 w-5 rounded-full bg-transparent hover:text-yellow-400 text-white p-0 border-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Add to favorites functionality
                          }}
                          data-testid={`button-star-media-${index}`}
                          title="Add to favorites"
                        >
                          <Star className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Actions (after media selected) */}
      {stage === "actions" && selectedMedia && (
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-4">
          {/* Selected Media Card */}
          <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
            {(selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.image) && (
              <img
                src={selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.image}
                alt={selectedMedia.title}
                className="w-12 h-16 object-cover rounded"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{selectedMedia.title}</p>
              <p className="text-sm text-gray-600">{selectedMedia.type}</p>
            </div>
            <Button
              onClick={() => setStage("search")}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-400 hover:text-gray-900"
              data-testid="button-change-media"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Action List - Minimal UI */}
          {actionMode === "" && (
            <div>
              <p className="text-sm text-gray-600 mb-3">How do you want to share it?</p>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setActionMode("thought")}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-200"
                  data-testid="button-add-thought"
                >
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-5 h-5 text-gray-600" />
                    <span className="text-sm font-medium text-gray-900">Add a thought</span>
                  </div>
                  <span className="text-gray-400">→</span>
                </button>
                <button
                  onClick={() => setActionMode("rating")}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-200"
                  data-testid="button-rate-it"
                >
                  <div className="flex items-center gap-3">
                    <Star className="w-5 h-5 text-yellow-500" />
                    <span className="text-sm font-medium text-gray-900">Rate it</span>
                  </div>
                  <span className="text-gray-400">→</span>
                </button>
                <button
                  onClick={() => setActionMode("prediction")}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-200"
                  data-testid="button-make-prediction"
                >
                  <div className="flex items-center gap-3">
                    <Target className="w-5 h-5 text-purple-600" />
                    <span className="text-sm font-medium text-gray-900">Make a prediction</span>
                  </div>
                  <span className="text-gray-400">→</span>
                </button>
                <button
                  onClick={() => setActionMode("poll")}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-200"
                  data-testid="button-ask-poll"
                >
                  <div className="flex items-center gap-3">
                    <Vote className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-gray-900">Ask a poll</span>
                  </div>
                  <span className="text-gray-400">→</span>
                </button>
                <button
                  onClick={() => setActionMode("list")}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-200"
                  data-testid="button-add-to-list"
                >
                  <div className="flex items-center gap-3">
                    <ListPlus className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-gray-900">Add to a list</span>
                  </div>
                  <span className="text-gray-400">→</span>
                </button>
                <button
                  onClick={() => setActionMode("track")}
                  disabled={isPosting}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  data-testid="button-just-track"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">✓</span>
                    <span className="text-sm font-medium text-gray-900">Just track it</span>
                  </div>
                  <span className="text-gray-400">→</span>
                </button>
              </div>
            </div>
          )}

          {/* Thought Mode - Exact feed dialog experience */}
          {actionMode === "thought" && (
            <div className="space-y-4">
              {/* Selected Media Card */}
              {selectedMedia && (
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  {selectedMedia.poster_url && (
                    <img 
                      src={selectedMedia.poster_url} 
                      alt={selectedMedia.title}
                      className="w-12 h-16 object-cover rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{selectedMedia.title}</p>
                    <p className="text-xs text-gray-500 capitalize">{selectedMedia.type || 'media'}</p>
                  </div>
                  <Button
                    onClick={() => {
                      setSelectedMedia(null);
                      setActionMode("");
                      setStage("search");
                    }}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-gray-400 hover:text-gray-900"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Thought Textarea */}
              <MentionTextarea
                value={thoughtText}
                onChange={setThoughtText}
                placeholder="Share what you're thinking..."
                className="border border-gray-200 rounded-lg p-3 text-sm resize-none focus-visible:ring-2 focus-visible:ring-purple-500 text-gray-900 bg-white placeholder:text-gray-400 w-full"
                minHeight="100px"
                session={session}
              />

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <Button 
                  onClick={() => setActionMode("")} 
                  variant="ghost" 
                  size="sm"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </Button>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={containsSpoilers}
                      onCheckedChange={(checked) => setContainsSpoilers(checked as boolean)}
                    />
                    <span className="text-gray-600">Spoilers</span>
                  </label>
                  <Button
                    onClick={handlePost}
                    disabled={isPosting || !thoughtText.trim()}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-6"
                  >
                    {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Rating Mode */}
          {actionMode === "rating" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRatingValue(star)}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= ratingValue
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <Button onClick={() => setActionMode("")} variant="ghost" size="sm">
                  Cancel
                </Button>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={containsSpoilers}
                      onCheckedChange={(checked) => setContainsSpoilers(checked as boolean)}
                    />
                    <span className="text-gray-600">Spoilers</span>
                  </label>
                  <Button
                    onClick={handlePost}
                    disabled={isPosting || ratingValue === 0}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Prediction Mode */}
          {actionMode === "prediction" && (
            <div className="space-y-3">
              <input
                type="text"
                value={predictionQuestion}
                onChange={(e) => setPredictionQuestion(e.target.value)}
                placeholder="What do you predict will happen?"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <div className="space-y-2">
                {predictionOptions.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...predictionOptions];
                        newOptions[index] = e.target.value;
                        setPredictionOptions(newOptions);
                      }}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {predictionOptions.length > 2 && (
                      <Button
                        onClick={() => {
                          if (predictionOptions.length > 2) {
                            setPredictionOptions(predictionOptions.filter((_, i) => i !== index));
                          }
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 text-gray-400 hover:text-gray-900"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {predictionOptions.length < 10 && (
                  <Button
                    onClick={() => setPredictionOptions([...predictionOptions, ""])}
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                  >
                    + Add Option ({predictionOptions.length}/10)
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-between">
                <Button onClick={() => setActionMode("")} variant="ghost" size="sm">
                  Cancel
                </Button>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={containsSpoilers}
                      onCheckedChange={(checked) => setContainsSpoilers(checked as boolean)}
                    />
                    <span className="text-gray-600">Spoilers</span>
                  </label>
                  <Button
                    onClick={handlePost}
                    disabled={isPosting}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Poll Mode */}
          {actionMode === "poll" && (
            <div className="space-y-3">
              <input
                type="text"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="Ask your friends a question..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <div className="space-y-2">
                {pollOptions.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...pollOptions];
                        newOptions[index] = e.target.value;
                        setPollOptions(newOptions);
                      }}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {pollOptions.length > 2 && (
                      <Button
                        onClick={() => {
                          if (pollOptions.length > 2) {
                            setPollOptions(pollOptions.filter((_, i) => i !== index));
                          }
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 text-gray-400 hover:text-gray-900"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 4 && (
                  <Button
                    onClick={() => setPollOptions([...pollOptions, ""])}
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                  >
                    + Add Option ({pollOptions.length}/4)
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-between">
                <Button onClick={() => setActionMode("")} variant="ghost" size="sm">
                  Cancel
                </Button>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={containsSpoilers}
                      onCheckedChange={(checked) => setContainsSpoilers(checked as boolean)}
                    />
                    <span className="text-gray-600">Spoilers</span>
                  </label>
                  <Button
                    onClick={handlePost}
                    disabled={isPosting}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Track Mode - Just track without posting */}
          {actionMode === "track" && (
            <div className="space-y-3">
              <p className="text-sm text-gray-700 mb-2">Select a list to track to:</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {userLists && userLists.length > 0 ? (
                  userLists.map((list: any) => (
                    <button
                      key={list.id}
                      onClick={() => {
                        handleTrackToList(selectedMedia, list.id);
                        resetComposer();
                      }}
                      className="w-full p-3 rounded-lg border text-left transition-all border-gray-200 hover:border-purple-300 hover:bg-purple-50"
                      data-testid={`button-track-to-list-${list.id}`}
                    >
                      <p className="font-medium text-gray-900">{list.title || list.name}</p>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No lists found. Create one first!</p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <Button onClick={() => setActionMode("")} variant="ghost" size="sm">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* List Mode */}
          {actionMode === "list" && (
            <div className="space-y-3">
              <p className="text-sm text-gray-700 mb-2">Select a list:</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {userLists && userLists.length > 0 ? (
                  userLists.map((list: any) => (
                    <button
                      key={list.id}
                      onClick={() => setSelectedListId(list.id)}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        selectedListId === list.id
                          ? "border-purple-500 bg-purple-50"
                          : "border-gray-200 hover:border-purple-300 hover:bg-purple-50"
                      }`}
                      data-testid={`button-select-list-${list.id}`}
                    >
                      <p className="font-medium text-gray-900">{list.name}</p>
                      {list.description && (
                        <p className="text-xs text-gray-600 mt-1">{list.description}</p>
                      )}
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No lists found. Create one first!</p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <Button onClick={() => setActionMode("")} variant="ghost" size="sm">
                  Cancel
                </Button>
                <Button
                  onClick={handlePost}
                  disabled={isPosting || !selectedListId}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add to List"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
