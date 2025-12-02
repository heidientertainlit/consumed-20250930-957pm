import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Star, Target, Vote, MessageCircle, Loader2, Search, ListPlus, Plus, User } from "lucide-react";
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
  const [reviewText, setReviewText] = useState("");
  const [trackListId, setTrackListId] = useState<string>("");
  const [predictionQuestion, setPredictionQuestion] = useState("");
  const [predictionOptions, setPredictionOptions] = useState<string[]>(["", ""]);
  const [selectedFriendId, setSelectedFriendId] = useState<string>("");
  const [selectedFriendName, setSelectedFriendName] = useState<string>("");
  const [creatorPrediction, setCreatorPrediction] = useState<string>("");
  const [friendSearchInput, setFriendSearchInput] = useState("");
  const [showFriendDropdown, setShowFriendDropdown] = useState(false);
  const [friendSearchResults, setFriendSearchResults] = useState<any[]>([]);
  const [isSearchingFriends, setIsSearchingFriends] = useState(false);
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

  // Search for friends (using exact same logic as profile page)
  const searchFriends = async (query: string) => {
    if (!query || query.length < 2 || !session?.access_token) {
      setFriendSearchResults([]);
      return;
    }

    setIsSearchingFriends(true);
    try {
      const response = await fetch('https://mahpgcogwpawvviapqza.supabase.co/functions/v1/manage-friendships', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'searchUsers',
          query: query
        })
      });

      if (response.ok) {
        const data = await response.json();
        setFriendSearchResults(data.users || []);
      } else {
        setFriendSearchResults([]);
      }
    } catch (error) {
      console.error('Friend search error:', error);
      setFriendSearchResults([]);
    } finally {
      setIsSearchingFriends(false);
    }
  };

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
    setReviewText("");
    setTrackListId("");
    setPredictionQuestion("");
    setPredictionOptions(["", ""]);
    setSelectedFriendId("");
    setSelectedFriendName("");
    setCreatorPrediction("");
    setFriendSearchInput("");
    setShowFriendDropdown(false);
    setFriendSearchResults([]);
    setIsSearchingFriends(false);
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
    console.log('🎯 handlePost called with actionMode:', actionMode);
    console.log('🎯 selectedMedia:', selectedMedia);
    
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

      // Handle social posting - use minimal payload like the working share-update-dialog-v2
      let payload: any = {};

      // Add action-specific data
      if (actionMode === "thought" && thoughtText.trim()) {
        // Thought posts with full media context - ensure external IDs are properly set for platform lookup
        payload = {
          content: thoughtText.trim(),
          type: "thought",
          visibility: "public",
          contains_spoilers: containsSpoilers,
          media_title: selectedMedia.title,
          media_type: selectedMedia.type,
          media_creator: selectedMedia.creator || selectedMedia.author || selectedMedia.artist,
          media_image_url: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.image || selectedMedia.thumbnail,
          media_external_id: selectedMedia.external_id || selectedMedia.id,
          media_external_source: selectedMedia.external_source || selectedMedia.source || 'tmdb',
        };
      } else if (actionMode === "rating") {
        // At least one thing must be selected (rating, review, or list)
        if (ratingValue === 0 && !reviewText.trim() && !trackListId) {
          toast({
            title: "Action Required",
            description: "Please rate, write a review, or add to a list.",
            variant: "destructive",
          });
          setIsPosting(false);
          return;
        }
        
        // If only adding to list (no rating/review), just do the list add without social post
        if (ratingValue === 0 && !reviewText.trim() && trackListId) {
          try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
            const listResponse = await fetch(
              `${supabaseUrl}/functions/v1/add-media-to-list`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${session?.access_token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  list_id: trackListId,
                  media_title: selectedMedia.title || "",
                  media_type: selectedMedia.type || "movie",
                  media_creator: selectedMedia.creator || selectedMedia.author || selectedMedia.artist || "",
                  media_image_url: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.image || selectedMedia.thumbnail || "",
                  media_external_id: selectedMedia.external_id || selectedMedia.id || "",
                  media_external_source: selectedMedia.external_source || selectedMedia.source || "tmdb",
                }),
              }
            );
            
            if (!listResponse.ok) throw new Error("Failed to add to list");
            
            toast({
              title: "Added to List!",
              description: `${selectedMedia.title} has been added to your list.`,
            });
            
            queryClient.invalidateQueries({ queryKey: ['/api/lists'] });
            queryClient.invalidateQueries({ queryKey: ['social-feed'] });
            resetComposer();
            setIsPosting(false);
            return;
          } catch (listError) {
            console.error('Error adding to list:', listError);
            toast({
              title: "Error",
              description: "Failed to add to list.",
              variant: "destructive",
            });
            setIsPosting(false);
            return;
          }
        }
        
        // Build content: start with review if present, otherwise just indicate a rating
        let content = reviewText.trim() || (ratingValue > 0 ? `Rated ${selectedMedia.title}` : `Added ${selectedMedia.title}`);
        
        payload = {
          content: content,
          type: "rate-review",
          visibility: "public",
          contains_spoilers: containsSpoilers,
          rating: ratingValue > 0 ? ratingValue : undefined,
          media_title: selectedMedia.title,
          media_type: selectedMedia.type,
          media_creator: selectedMedia.creator || selectedMedia.author || selectedMedia.artist,
          media_image_url: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.image || selectedMedia.thumbnail,
          media_external_id: selectedMedia.external_id || selectedMedia.id,
          media_external_source: selectedMedia.external_source || selectedMedia.source || 'tmdb',
        };
        
        // If a list was selected, also add to that list
        if (trackListId) {
          try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
            await fetch(
              `${supabaseUrl}/functions/v1/add-media-to-list`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${session?.access_token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  list_id: trackListId,
                  media_title: selectedMedia.title || "",
                  media_type: selectedMedia.type || "movie",
                  media_creator: selectedMedia.creator || selectedMedia.author || selectedMedia.artist || "",
                  media_image_url: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.image || selectedMedia.thumbnail || "",
                  media_external_id: selectedMedia.external_id || selectedMedia.id || "",
                  media_external_source: selectedMedia.external_source || selectedMedia.source || "tmdb",
                }),
              }
            );
            // Don't block on list add error - the main post is more important
          } catch (listError) {
            console.error('Error adding to list:', listError);
          }
        }
      } else if (actionMode === "prediction") {
        // Handle collaborative user-driven predictions - same pattern as thoughts
        if (!predictionQuestion.trim()) {
          toast({
            title: "Question Required",
            description: "Please enter your prediction question.",
            variant: "destructive",
          });
          setIsPosting(false);
          return;
        }

        const option1 = predictionOptions[0]?.trim();
        const option2 = predictionOptions[1]?.trim();

        if (!option1 || !option2) {
          toast({
            title: "Incomplete Options",
            description: "Please fill in both prediction options.",
            variant: "destructive",
          });
          setIsPosting(false);
          return;
        }

        // Use same payload pattern as thoughts - let it flow through the shared fetch
        payload = {
          content: predictionQuestion.trim(),
          type: "prediction",
          visibility: "public",
          contains_spoilers: containsSpoilers,
          prediction_question: predictionQuestion.trim(),
          prediction_options: [option1, option2],
          media_title: selectedMedia.title,
          media_type: selectedMedia.type,
          media_creator: selectedMedia.creator || selectedMedia.author || selectedMedia.artist,
          media_image_url: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.image || selectedMedia.thumbnail,
          media_external_id: selectedMedia.external_id || selectedMedia.id,
          media_external_source: selectedMedia.external_source || selectedMedia.source || 'tmdb',
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
          content: pollQuestion.trim(),
          type: "poll",
          visibility: "public",
          contains_spoilers: containsSpoilers,
          poll_question: pollQuestion.trim(),
          poll_options: filledOptions,
          media_title: selectedMedia.title,
          media_type: selectedMedia.type,
          media_external_id: selectedMedia.external_id || selectedMedia.id,
          media_external_source: selectedMedia.external_source || selectedMedia.source,
        };
      } else {
        // Just tracking media consumption
        payload = {
          content: `Added ${selectedMedia.title}`,
          type: "add-media",
          visibility: "public",
          contains_spoilers: containsSpoilers,
          media_title: selectedMedia.title,
          media_type: selectedMedia.type,
          media_external_id: selectedMedia.external_id || selectedMedia.id,
          media_external_source: selectedMedia.external_source || selectedMedia.source,
        };
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inline-post`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to post");

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
                    <span className="text-sm font-medium text-gray-900">Track & Rate</span>
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
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  data-testid="button-ask-poll"
                >
                  <div className="flex items-center gap-3">
                    <Vote className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-gray-900">Ask a poll</span>
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

          {/* Rating Mode - Track & Rate */}
          {actionMode === "rating" && (
            <div className="space-y-4">
              {/* Brief description */}
              <p className="text-xs text-gray-500">Rate it, write a review, or just add to a list — do one or all!</p>
              
              {/* Star Rating with decimal support */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">Your Rating (optional)</label>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const fillPercent = Math.min(Math.max(ratingValue - (star - 1), 0), 1) * 100;
                      return (
                        <button
                          key={star}
                          onClick={() => setRatingValue(ratingValue === star ? 0 : star)}
                          className="focus:outline-none relative"
                        >
                          <Star className="w-9 h-9 text-gray-300" />
                          <div 
                            className="absolute inset-0 overflow-hidden"
                            style={{ width: `${fillPercent}%` }}
                          >
                            <Star className="w-9 h-9 fill-yellow-400 text-yellow-400" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={ratingValue || ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (isNaN(val)) setRatingValue(0);
                      else setRatingValue(Math.min(5, Math.max(0, val)));
                    }}
                    placeholder="ex: 4.5"
                    className="w-16 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-center"
                  />
                </div>
              </div>

              {/* Optional Review */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">Review (optional)</label>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Share your thoughts..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  rows={3}
                />
              </div>

              {/* Add to List (optional) */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">Add to a list (optional)</label>
                <select
                  value={trackListId}
                  onChange={(e) => setTrackListId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="">Don't add to list</option>
                  {userLists && userLists.map((list: any) => (
                    <option key={list.id} value={list.id}>
                      {list.title || list.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <Button onClick={() => setActionMode("")} variant="ghost" size="sm">
                  Cancel
                </Button>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={containsSpoilers}
                      onCheckedChange={(checked) => setContainsSpoilers(checked as boolean)}
                    />
                    <span className="text-gray-600">Spoilers</span>
                  </label>
                  <Button
                    onClick={handlePost}
                    disabled={isPosting || (ratingValue === 0 && !reviewText.trim() && !trackListId)}
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
              

              {/* Prediction Options (exactly 2) with Creator Selection */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">Choose your prediction:</label>
                {predictionOptions.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="radio"
                      id={`option-${index}`}
                      name="creator-prediction"
                      value={option || `Option ${index + 1}`}
                      checked={creatorPrediction === (option || `Option ${index + 1}`)}
                      onChange={(e) => setCreatorPrediction(e.target.value)}
                      className="w-4 h-4 text-purple-600"
                    />
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...predictionOptions];
                        newOptions[index] = e.target.value;
                        setPredictionOptions(newOptions);
                        if (creatorPrediction === option && e.target.value) {
                          setCreatorPrediction(e.target.value);
                        }
                      }}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <button 
                  type="button"
                  onClick={() => setActionMode("")} 
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={containsSpoilers}
                      onCheckedChange={(checked) => setContainsSpoilers(checked as boolean)}
                    />
                    <span className="text-gray-600">Spoilers</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      console.log('🎯 Prediction Post button clicked!');
                      handlePost();
                    }}
                    disabled={isPosting}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPosting ? "Posting..." : "Post"}
                  </button>
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
