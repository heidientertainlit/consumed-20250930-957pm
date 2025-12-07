import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Star, Target, Vote, MessageCircle, Loader2, Search, ListPlus, Plus, User, ChevronDown } from "lucide-react";
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

type ComposerStage = "closed" | "open" | "media-search";
type PostType = "thought" | "rating" | "prediction" | "poll";

export default function InlineComposer() {
  const { session, user } = useAuth();
  const { toast } = useToast();
  
  // Stage management - new unified approach
  const [stage, setStage] = useState<ComposerStage>("closed");
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [postType, setPostType] = useState<PostType>("thought");
  
  // Media search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Content state - unified text field
  const [contentText, setContentText] = useState("");
  
  // Rating-specific state
  const [ratingValue, setRatingValue] = useState(0);
  
  // Prediction-specific state  
  const [predictionOptions, setPredictionOptions] = useState<string[]>(["", ""]);
  const [creatorPrediction, setCreatorPrediction] = useState<string>("");
  
  // Poll-specific state
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  
  // Optional actions - Add to list / Add to rank
  const [addToList, setAddToList] = useState(false);
  const [addToRank, setAddToRank] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [selectedRankId, setSelectedRankId] = useState<string>("");
  
  // Common state
  const [containsSpoilers, setContainsSpoilers] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  // Fetch user's lists (for optional add to list)
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
    enabled: !!session?.access_token && stage === "open",
  });

  const userLists = userListsData?.lists || [];

  // Fetch user's ranks (for optional add to rank)
  const { data: userRanksData } = useQuery<any>({
    queryKey: ['user-ranks'],
    queryFn: async () => {
      if (!session?.access_token) return null;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/get-user-ranks`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user ranks');
      }

      return response.json();
    },
    enabled: !!session?.access_token && stage === "open",
  });

  const userRanks = userRanksData?.ranks || [];

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
    setStage("closed");
    setSelectedMedia(null);
    setPostType("thought");
    setSearchQuery("");
    setSearchResults([]);
    setContentText("");
    setRatingValue(0);
    setPredictionOptions(["", ""]);
    setCreatorPrediction("");
    setPollOptions(["", ""]);
    setAddToList(false);
    setAddToRank(false);
    setSelectedListId("");
    setSelectedRankId("");
    setContainsSpoilers(false);
  };

  // PRESERVED: handleMediaSearch - calls media-search edge function
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

  // PRESERVED: handleSelectMedia - selects media and returns to composer
  const handleSelectMedia = (media: any) => {
    setSelectedMedia(media);
    setStage("open");
    setSearchQuery("");
    setSearchResults([]);
  };

  // PRESERVED: handleTrackToList - calls track-media or add-to-custom-list edge functions
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

      // Extract list type from list object
      let listType = list.type;
      if (!listType) {
        const title = (list.title || list.name || '').toLowerCase();
        if (title.includes('queue')) listType = 'queue';
        else if (title.includes('currently')) listType = 'currently';
        else if (title.includes('finished')) listType = 'finished';
        else if (title.includes('did not')) listType = 'dnf';
        else if (title.includes('favorite')) listType = 'favorites';
        else listType = 'queue';
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

  // Add to rank helper
  const handleAddToRank = async (media: any, rankId: string) => {
    if (!session?.access_token || !rankId) return;

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
      const response = await fetch(`${supabaseUrl}/functions/v1/add-rank-item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          rank_id: rankId,
          title: media.title || "",
          media_type: media.type || "movie",
          creator: media.creator || media.author || media.artist || "",
          image_url: media.poster_url || media.image_url || media.image || media.thumbnail || "",
          external_id: media.external_id || media.id || "",
          external_source: media.external_source || media.source || "tmdb",
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add to rank');
      }

      const rank = userRanks.find((r: any) => r.id === rankId);
      toast({
        title: "Added to Rank!",
        description: `${media.title} added to ${rank?.title || 'rank'}`,
      });

      queryClient.invalidateQueries({ queryKey: ['user-ranks'] });
    } catch (error) {
      console.error("Add to rank error:", error);
      toast({
        title: "Failed to add to rank",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  // PRESERVED: handlePost - calls inline-post edge function with action-specific payload
  const handlePost = async () => {
    console.log('🎯 handlePost called with postType:', postType);
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
        description: "Please add what you're consuming first.",
        variant: "destructive",
      });
      return;
    }

    setIsPosting(true);
    try {
      let payload: any = {};

      // Build payload based on post type - SAME LOGIC AS BEFORE
      if (postType === "thought") {
        if (!contentText.trim()) {
          toast({
            title: "Text Required",
            description: "Please write something to share.",
            variant: "destructive",
          });
          setIsPosting(false);
          return;
        }
        payload = {
          content: contentText.trim(),
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
      } else if (postType === "rating") {
        // At least rating or review required
        if (ratingValue === 0 && !contentText.trim()) {
          toast({
            title: "Rating or Review Required",
            description: "Please rate or write a review.",
            variant: "destructive",
          });
          setIsPosting(false);
          return;
        }
        
        let content = contentText.trim() || (ratingValue > 0 ? `Rated ${selectedMedia.title}` : `Added ${selectedMedia.title}`);
        
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
      } else if (postType === "prediction") {
        if (!contentText.trim()) {
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

        payload = {
          content: contentText.trim(),
          type: "prediction",
          visibility: "public",
          contains_spoilers: containsSpoilers,
          prediction_question: contentText.trim(),
          prediction_options: [option1, option2],
          media_title: selectedMedia.title,
          media_type: selectedMedia.type,
          media_creator: selectedMedia.creator || selectedMedia.author || selectedMedia.artist,
          media_image_url: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.image || selectedMedia.thumbnail,
          media_external_id: selectedMedia.external_id || selectedMedia.id,
          media_external_source: selectedMedia.external_source || selectedMedia.source || 'tmdb',
        };
      } else if (postType === "poll") {
        const filledOptions = pollOptions.filter(opt => opt.trim()).filter(opt => opt.length > 0);
        if (!contentText.trim() || filledOptions.length < 2) {
          toast({
            title: "Incomplete Poll",
            description: "Please add a question and at least 2 options.",
            variant: "destructive",
          });
          setIsPosting(false);
          return;
        }
        payload = {
          content: contentText.trim(),
          type: "poll",
          visibility: "public",
          contains_spoilers: containsSpoilers,
          poll_question: contentText.trim(),
          poll_options: filledOptions,
          media_title: selectedMedia.title,
          media_type: selectedMedia.type,
          media_external_id: selectedMedia.external_id || selectedMedia.id,
          media_external_source: selectedMedia.external_source || selectedMedia.source,
        };
      }

      // Post to feed
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/inline-post`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to post");

      // Handle optional add to list
      if (addToList && selectedListId) {
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co';
          await fetch(`${supabaseUrl}/functions/v1/add-media-to-list`, {
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
          });
        } catch (listError) {
          console.error('Error adding to list:', listError);
        }
      }

      // Handle optional add to rank
      if (addToRank && selectedRankId) {
        await handleAddToRank(selectedMedia, selectedRankId);
      }

      toast({
        title: "Posted!",
        description: "Your update has been shared.",
      });

      queryClient.invalidateQueries({ queryKey: ['social-feed'] });
      queryClient.invalidateQueries({ queryKey: ['user-lists-with-media'] });
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

  // Get placeholder text based on post type
  const getPlaceholder = () => {
    switch (postType) {
      case "thought": return "What are you watching, reading, or listening to?";
      case "rating": return "Share your thoughts (optional)...";
      case "prediction": return "What do you predict will happen?";
      case "poll": return "Ask your friends a question...";
      default: return "Share what you're consuming...";
    }
  };

  // Check if can post
  const canPost = () => {
    if (!selectedMedia) return false;
    
    switch (postType) {
      case "thought":
        return contentText.trim().length > 0;
      case "rating":
        return ratingValue > 0 || contentText.trim().length > 0;
      case "prediction":
        return contentText.trim().length > 0 && predictionOptions[0]?.trim() && predictionOptions[1]?.trim();
      case "poll":
        const filledOptions = pollOptions.filter(opt => opt.trim());
        return contentText.trim().length > 0 && filledOptions.length >= 2;
      default:
        return false;
    }
  };

  return (
    <div>
      {/* Entry Point - Pill that looks like text field */}
      {stage === "closed" && (
        <button
          onClick={() => setStage("open")}
          className="w-full bg-white rounded-2xl shadow-lg px-5 py-4 text-left text-gray-400 hover:shadow-xl transition-shadow"
          data-testid="button-open-composer"
        >
          Share what you're consuming...
        </button>
      )}

      {/* Main Composer - Open State */}
      {stage === "open" && (
        <div className="bg-white rounded-2xl shadow-lg p-4">
          {/* Close button */}
          <div className="flex justify-end mb-2">
            <Button
              onClick={resetComposer}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-400 hover:text-gray-900"
              data-testid="button-close-composer"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Main Text Input - Always visible at top */}
          <div className="mb-4">
            <MentionTextarea
              value={contentText}
              onChange={setContentText}
              placeholder={getPlaceholder()}
              className="border border-gray-200 rounded-lg p-3 text-sm resize-none focus-visible:ring-2 focus-visible:ring-purple-500 text-gray-900 bg-white placeholder:text-gray-400 w-full min-h-[80px]"
              minHeight="80px"
              session={session}
            />
          </div>

          {/* Add Media Row */}
          <div className="mb-4">
            {!selectedMedia ? (
              <button
                onClick={() => setStage("media-search")}
                className="flex items-center gap-2 px-4 py-3 w-full border border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-purple-400 hover:text-purple-600 transition-colors"
                data-testid="button-add-media"
              >
                <Plus className="w-5 h-5" />
                <span className="text-sm font-medium">Add a movie, show, book, etc.</span>
              </button>
            ) : (
              /* Selected Media Card */
              <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
                {(selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.image) && (
                  <img
                    src={selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.image}
                    alt={selectedMedia.title}
                    className="w-12 h-16 object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{selectedMedia.title}</p>
                  <p className="text-sm text-gray-600 capitalize">{selectedMedia.type}</p>
                </div>
                <Button
                  onClick={() => setSelectedMedia(null)}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-400 hover:text-gray-900"
                  data-testid="button-remove-media"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Post Type Selector - Only show when media is attached */}
          {selectedMedia && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">How do you want to post this?</p>
              <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                <button
                  onClick={() => setPostType("thought")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    postType === "thought" 
                      ? "bg-white text-gray-900 shadow-sm" 
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  data-testid="button-type-thought"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Thought</span>
                </button>
                <button
                  onClick={() => setPostType("rating")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    postType === "rating" 
                      ? "bg-white text-gray-900 shadow-sm" 
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  data-testid="button-type-rating"
                >
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span>Track & Rate</span>
                </button>
                <button
                  onClick={() => setPostType("prediction")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    postType === "prediction" 
                      ? "bg-white text-gray-900 shadow-sm" 
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  data-testid="button-type-prediction"
                >
                  <Target className="w-4 h-4 text-purple-600" />
                  <span>Prediction</span>
                </button>
                <button
                  onClick={() => setPostType("poll")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    postType === "poll" 
                      ? "bg-white text-gray-900 shadow-sm" 
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  data-testid="button-type-poll"
                >
                  <Vote className="w-4 h-4 text-blue-600" />
                  <span>Poll</span>
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Fields Based on Post Type */}
          {selectedMedia && (
            <div className="mb-4">
              {/* Rating Fields */}
              {postType === "rating" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-2 block">Your Rating</label>
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
                              <Star className="w-8 h-8 text-gray-300" />
                              <div 
                                className="absolute inset-0 overflow-hidden"
                                style={{ width: `${fillPercent}%` }}
                              >
                                <Star className="w-8 h-8 fill-yellow-400 text-yellow-400" />
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
                        placeholder="0.0"
                        className="w-16 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-center"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Prediction Fields */}
              {postType === "prediction" && (
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
              )}

              {/* Poll Fields */}
              {postType === "poll" && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-600">Poll Options:</label>
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
              )}
            </div>
          )}

          {/* Optional Actions - Add to List / Add to Rank */}
          {selectedMedia && (
            <div className="mb-4 flex flex-wrap gap-4">
              {/* Add to List */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="add-to-list"
                  checked={addToList}
                  onCheckedChange={(checked) => {
                    setAddToList(checked as boolean);
                    if (!checked) setSelectedListId("");
                  }}
                />
                <label htmlFor="add-to-list" className="text-sm text-gray-700">Add to list</label>
                {addToList && (
                  <select
                    value={selectedListId}
                    onChange={(e) => setSelectedListId(e.target.value)}
                    className="ml-2 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    <option value="">Select list...</option>
                    {userLists.map((list: any) => (
                      <option key={list.id} value={list.id}>
                        {list.title || list.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Add to Rank */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="add-to-rank"
                  checked={addToRank}
                  onCheckedChange={(checked) => {
                    setAddToRank(checked as boolean);
                    if (!checked) setSelectedRankId("");
                  }}
                />
                <label htmlFor="add-to-rank" className="text-sm text-gray-700">Add to rank</label>
                {addToRank && (
                  <select
                    value={selectedRankId}
                    onChange={(e) => setSelectedRankId(e.target.value)}
                    className="ml-2 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    <option value="">Select rank...</option>
                    {userRanks.map((rank: any) => (
                      <option key={rank.id} value={rank.id}>
                        {rank.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* Footer - Spoilers + Post Button */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={containsSpoilers}
                onCheckedChange={(checked) => setContainsSpoilers(checked as boolean)}
              />
              <span className="text-gray-600">Contains spoilers</span>
            </label>
            <Button
              onClick={handlePost}
              disabled={isPosting || !canPost()}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6"
              data-testid="button-post"
            >
              {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post"}
            </Button>
          </div>
        </div>
      )}

      {/* Media Search Modal */}
      {stage === "media-search" && (
        <div className="bg-white rounded-2xl shadow-lg p-4">
          {/* Header with back button */}
          <div className="flex items-center gap-3 mb-4">
            <Button
              onClick={() => setStage("open")}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-400 hover:text-gray-900"
              data-testid="button-back-from-search"
            >
              <X className="w-4 h-4" />
            </Button>
            <h3 className="font-semibold text-gray-900">Add Media</h3>
          </div>

          {/* Search Input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a movie, show, book, podcast, music..."
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-300 text-gray-900 placeholder:text-gray-400"
              autoFocus
              data-testid="input-media-search"
            />
          </div>

          {/* Search Results */}
          {isSearching && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            </div>
          )}

          {!isSearching && searchResults.length > 0 && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {searchResults.map((media, index) => (
                <button
                  key={index}
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
              ))}
            </div>
          )}

          {!isSearching && searchQuery && searchResults.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No results found for "{searchQuery}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
