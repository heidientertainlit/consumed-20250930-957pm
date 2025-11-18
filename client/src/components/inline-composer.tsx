import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Plus, Star, Target, Vote, MessageCircle, Loader2, Sparkles } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import MentionTextarea from "@/components/mention-textarea";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

type ComposerMode = "" | "prediction" | "poll" | "thought" | "rate-review" | "add-media";

export default function InlineComposer() {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [composerMode, setComposerMode] = useState<ComposerMode>("");
  const [content, setContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [containsSpoilers, setContainsSpoilers] = useState(false);
  const [showMediaSearch, setShowMediaSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [attachedMedia, setAttachedMedia] = useState<any>(null);
  const [selectedList, setSelectedList] = useState<string>("");
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  
  // Prediction-specific state (now uses same format as polls)
  const [predictionOptions, setPredictionOptions] = useState<string[]>(["", ""]);
  const [challengedFriends, setChallengedFriends] = useState<string>("");

  // Poll-specific state
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  
  // Fetch user lists for add-media mode
  const { data: userLists = [] } = useQuery({
    queryKey: ['user-lists'],
    queryFn: async () => {
      if (!session?.access_token) return [];
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/get-user-lists`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!session?.access_token,
  });

  // Action chips configuration
  const actionChips = [
    { 
      id: "prediction" as ComposerMode, 
      icon: Target, 
      label: "🎯 Prediction", 
      color: "text-red-600",
      description: "Make a guess about what you think will happen next—storylines, renewals, awards, plot twists, finales.",
      example: "Who will get eliminated next on Dancing With the Stars?"
    },
    { 
      id: "poll" as ComposerMode, 
      icon: Vote, 
      label: "📦 Poll", 
      color: "text-blue-600",
      description: "Ask your friends or followers to choose between options. It's for taste, favorites, preferences—fun debates.",
      example: "Which is the best Marvel movie of all time?"
    },
    { 
      id: "rate-review" as ComposerMode, 
      icon: Star, 
      label: "⭐️ Rate/Review", 
      color: "text-yellow-600",
      description: "Give your rating, share thoughts, or recommend something you just finished.",
      example: "Just finished Lessons in Chemistry — 4.5/5. Brie Larson was PERFECT."
    },
    { 
      id: "add-media" as ComposerMode, 
      icon: Plus, 
      label: "➕ Add Media", 
      color: "text-purple-600",
      description: "Log something you're watching, reading, listening to, or playing—past or present.",
      example: 'Added: The Bear (Season 3)'
    },
  ];

  const resetComposer = () => {
    setContent("");
    setComposerMode("");
    setContainsSpoilers(false);
    setShowMediaSearch(false);
    setSearchQuery("");
    setSearchResults([]);
    setAttachedMedia(null);
    setSelectedList("");
    setPredictionOptions(["", ""]);
    setChallengedFriends("");
    setPollOptions(["", ""]);
  };

  const handlePost = async () => {
    // Validation for predictions
    if (composerMode === "prediction") {
      if (!content.trim()) {
        toast({
          title: "Missing Question",
          description: "Please enter a prediction question.",
          variant: "destructive",
        });
        return;
      }
      const filledOptions = predictionOptions.filter(opt => opt.trim());
      if (filledOptions.length < 2) {
        toast({
          title: "Missing Options",
          description: "Please provide at least 2 prediction options.",
          variant: "destructive",
        });
        return;
      }
    } else if (!content.trim() && !attachedMedia && (composerMode === "thought" || composerMode === "")) {
      toast({
        title: "Empty Post",
        description: "Please write something or add media before posting.",
        variant: "destructive",
      });
      return;
    }

    setIsPosting(true);
    try {
      // Handle predictions separately
      if (composerMode === "prediction") {
        const filledOptions = predictionOptions.filter(opt => opt.trim());
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/share-update`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: content.trim(),
            type: "prediction",
            visibility: "public",
            contains_spoilers: containsSpoilers,
            prediction_question: content.trim(),
            prediction_options: filledOptions,
            challenged_friends: challengedFriends.trim(),
          }),
        });

        if (!response.ok) throw new Error("Failed to create prediction");

        toast({
          title: "Prediction Posted!",
          description: "Your prediction has been shared with your friends.",
        });
      } else {
        // Regular posts (thoughts, media, etc.)
        const payload: any = {
          content: content.trim() || (attachedMedia ? `Added ${attachedMedia.title}` : ""),
          type: composerMode || "thought",
          visibility: "public",
          contains_spoilers: containsSpoilers,
        };

        // Add media data if available (in the format expected by share-update)
        if (attachedMedia) {
          payload.media_title = attachedMedia.title || "";
          payload.media_type = attachedMedia.type || "movie";
          payload.media_creator = attachedMedia.creator || attachedMedia.author || attachedMedia.artist || "";
          payload.media_image_url = attachedMedia.poster_url || attachedMedia.image_url || attachedMedia.image || attachedMedia.thumbnail || "";
          payload.media_external_id = attachedMedia.external_id || attachedMedia.id || "";
          payload.media_external_source = attachedMedia.external_source || attachedMedia.source || 'tmdb';
          
          // Add list_id if a list was selected in add-media mode
          if (composerMode === "add-media" && selectedList) {
            payload.list_id = selectedList;
          }
        }

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/share-update`, {
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
          description: attachedMedia ? "Your media has been shared." : "Your update has been shared.",
        });
      }

      // Invalidate feed cache
      queryClient.invalidateQueries({ queryKey: ['social-feed'] });

      // Reset composer
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

  const handleChipClick = (mode: ComposerMode) => {
    setComposerMode(mode);
    
    // Auto-open media search for add-media and rate-review modes
    if (mode === "add-media" || mode === "rate-review") {
      setShowMediaSearch(true);
    } else {
      setShowMediaSearch(false);
    }
  };

  const handleMediaSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-search`,
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
    setAttachedMedia(media);
    setShowMediaSearch(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const updatePredictionOption = (index: number, value: string) => {
    const newOptions = [...predictionOptions];
    newOptions[index] = value;
    setPredictionOptions(newOptions);
  };

  const addPredictionOption = () => {
    if (predictionOptions.length < 10) {
      setPredictionOptions([...predictionOptions, ""]);
    }
  };

  const removePredictionOption = (index: number) => {
    if (predictionOptions.length > 2) {
      setPredictionOptions(predictionOptions.filter((_, i) => i !== index));
    }
  };

  const updatePollOption = (index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  const addPollOption = () => {
    if (pollOptions.length < 4) {
      setPollOptions([...pollOptions, ""]);
    }
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  const getPlaceholder = () => {
    const chip = actionChips.find(c => c.id === composerMode);
    if (chip) {
      return `Ex: ${chip.example}`;
    }
    return "Share the entertainment you are consuming… or start a conversation.";
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
      {/* Composer Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            {user?.email?.substring(0, 2).toUpperCase() || 'HE'}
          </div>
          <div className="flex-1">
            {/* Text Input */}
            <MentionTextarea
              value={content}
              onChange={setContent}
              placeholder={getPlaceholder()}
              className="border-none p-0 text-sm resize-none focus-visible:ring-0 focus-visible:ring-offset-0 text-gray-900 bg-white placeholder:text-gray-400 w-full"
              minHeight="60px"
              session={session}
            />
          </div>
        </div>
      </div>

      {/* Simple Action Buttons */}
      <div className="px-4 pb-3 border-t border-gray-100 pt-3">
        <div className="flex gap-2">
          <button
            onClick={() => handleChipClick("add-media")}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              composerMode === "add-media"
                ? "bg-purple-600 text-white"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
            data-testid="button-add-media"
          >
            <Plus className="w-3.5 h-3.5 inline mr-1" />
            Add Media
          </button>
          <button
            onClick={() => setShowMoreOptions(!showMoreOptions)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
            data-testid="button-more-options"
          >
            <Sparkles className="w-3.5 h-3.5 inline mr-1" />
            More options
          </button>
        </div>

        {/* Expanded Options - Show when More Options is clicked */}
        {showMoreOptions && (
          <div className="mt-3">
            <div className="flex gap-1.5 flex-wrap items-center">
              <button
                onClick={() => {
                  handleChipClick("prediction");
                  setShowMoreOptions(false);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  composerMode === "prediction"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                data-testid="chip-prediction"
              >
                🎯 Prediction
              </button>
              <button
                onClick={() => {
                  handleChipClick("poll");
                  setShowMoreOptions(false);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  composerMode === "poll"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                data-testid="chip-poll"
              >
                📦 Poll
              </button>
              <button
                onClick={() => {
                  handleChipClick("rate-review");
                  setShowMoreOptions(false);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  composerMode === "rate-review"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                data-testid="chip-rate-review"
              >
                ⭐ Rate/Review
              </button>
              <button
                onClick={async () => {
                  if (!session?.access_token || !user?.id) {
                    toast({
                      title: "Authentication Required",
                      description: "Please log in to request recommendations.",
                      variant: "destructive",
                    });
                    return;
                  }

                  try {
                    const response = await fetch(
                      `${import.meta.env.VITE_SUPABASE_URL || 'https://mahpgcogwpawvviapqza.supabase.co'}/functions/v1/create-post`,
                      {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${session.access_token}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          user_id: user.id,
                          content: "Looking for recommendations! What should I watch/read/listen to next? 🎬📚🎵",
                          content_type: "thought",
                          contains_spoilers: false,
                        }),
                      }
                    );

                    if (!response.ok) throw new Error('Failed to post');

                    toast({
                      title: "Posted!",
                      description: "Your friends will see your request for recommendations.",
                    });

                    queryClient.invalidateQueries({ queryKey: ['/api/feed'] });
                    setShowMoreOptions(false);
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Failed to post. Please try again.",
                      variant: "destructive",
                    });
                  }
                }}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-gray-100 text-gray-600 hover:bg-gray-200"
                data-testid="button-recommend"
              >
                💬 Ask for Recs
              </button>
            </div>
          </div>
        )}

        {/* Quick Prompts - Only when empty */}
        {content === "" && composerMode === "" && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-2">Or tap a quick prompt:</p>
            <div className="flex gap-2 flex-wrap">
              {[
                "Recommend a movie to watch tonight",
                "What should I read next?",
                "Anyone else watching ...?",
                "I can't believe ...",
                "I just finished..."
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setContent(prompt)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 transition-all"
                  data-testid={`quick-prompt-${prompt.substring(0, 10)}`}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Contextual UI - Expands based on selected chip */}
      {composerMode === "prediction" && (
        <div className="px-4 pb-3 border-t border-gray-100 pt-3 space-y-2">
          <p className="text-xs text-gray-600 font-medium">Prediction Options</p>
          {predictionOptions.map((option, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={option}
                onChange={(e) => updatePredictionOption(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                data-testid={`input-prediction-option-${index}`}
              />
              {predictionOptions.length > 2 && (
                <Button
                  onClick={() => removePredictionOption(index)}
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 text-gray-400 hover:text-gray-900"
                  data-testid={`button-remove-prediction-option-${index}`}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          {predictionOptions.length < 10 && (
            <Button
              onClick={addPredictionOption}
              variant="outline"
              size="sm"
              className="w-full text-xs border-gray-300 text-gray-600 hover:bg-gray-50"
              data-testid="button-add-prediction-option"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Option ({predictionOptions.length}/10)
            </Button>
          )}
          
          {/* Challenge Friends */}
          <div className="pt-2 border-t border-gray-100 mt-3">
            <p className="text-xs text-gray-600 font-medium mb-2">Challenge Friends to Predict</p>
            <MentionTextarea
              value={challengedFriends}
              onChange={setChallengedFriends}
              placeholder="@mention friends to challenge..."
              className="border border-gray-200 rounded-lg p-2 text-sm resize-none focus-visible:ring-2 focus-visible:ring-purple-500 text-gray-900 bg-white placeholder:text-gray-400 w-full"
              minHeight="40px"
              session={session}
            />
          </div>
        </div>
      )}

      {composerMode === "poll" && (
        <div className="px-4 pb-3 border-t border-gray-100 pt-3 space-y-2">
          <p className="text-xs text-gray-600 font-medium">Poll Options</p>
          {pollOptions.map((option, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={option}
                onChange={(e) => updatePollOption(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              {pollOptions.length > 2 && (
                <Button
                  onClick={() => removePollOption(index)}
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
              onClick={addPollOption}
              variant="outline"
              size="sm"
              className="w-full text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Option
            </Button>
          )}
        </div>
      )}

      {(composerMode === "rate-review" || composerMode === "add-media") && (
        <div className="px-4 pb-3 border-t border-gray-100 pt-3 space-y-2">
          {/* Attached Media Display */}
          {attachedMedia && (
            <>
              <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
                {(attachedMedia.poster_url || attachedMedia.image_url || attachedMedia.image) && (
                  <img 
                    src={attachedMedia.poster_url || attachedMedia.image_url || attachedMedia.image} 
                    alt={attachedMedia.title}
                    className="w-12 h-16 object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{attachedMedia.title}</p>
                  <p className="text-xs text-gray-500">{attachedMedia.type}</p>
                </div>
                <Button
                  onClick={() => setAttachedMedia(null)}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-400 hover:text-gray-900"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              {/* List Selection for Add Media Mode */}
              {composerMode === "add-media" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700">Add to list:</label>
                  <Select value={selectedList} onValueChange={setSelectedList}>
                    <SelectTrigger className="w-full bg-white text-black border-gray-300">
                      <SelectValue placeholder="Select a list" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-300">
                      {userLists
                        .filter((list: any) => list.is_default)
                        .map((list: any) => (
                          <SelectItem key={list.id} value={list.id.toString()} className="text-black">
                            {list.title}
                          </SelectItem>
                        ))}
                      {userLists.filter((list: any) => !list.is_default).length > 0 && (
                        <>
                          <div className="h-px bg-gray-200 my-1" />
                          {userLists
                            .filter((list: any) => !list.is_default)
                            .map((list: any) => (
                              <SelectItem key={list.id} value={list.id.toString()} className="text-black">
                                {list.title}
                              </SelectItem>
                            ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {/* Media Search */}
          {showMediaSearch && !attachedMedia && (
            <div className="border border-purple-200 rounded-lg p-3 bg-purple-50">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  handleMediaSearch(e.target.value);
                }}
                placeholder="Search movies, TV shows, books, music, podcasts..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                autoFocus
              />
              {isSearching && (
                <div className="mt-2 text-center py-2">
                  <Loader2 className="animate-spin text-purple-600 mx-auto" size={20} />
                </div>
              )}
              {searchResults.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                  {searchResults.slice(0, 8).map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectMedia(result)}
                      className="w-full flex items-center gap-3 p-2 hover:bg-white rounded text-left transition-colors"
                    >
                      {(result.poster_url || result.image_url || result.image) && (
                        <img 
                          src={result.poster_url || result.image_url || result.image} 
                          alt={result.title}
                          className="w-10 h-14 object-cover rounded shadow-sm"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{result.title}</p>
                        <p className="text-xs text-gray-500">{result.type}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Post Button & Spoilers */}
      <div className="px-4 pb-4 border-t border-gray-100 pt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            id="spoilers"
            checked={containsSpoilers}
            onCheckedChange={(checked) => setContainsSpoilers(checked === true)}
          />
          <label htmlFor="spoilers" className="text-xs text-gray-600">
            Contains spoilers
          </label>
        </div>
        <Button
          onClick={handlePost}
          disabled={isPosting || (!content.trim() && !attachedMedia)}
          className="bg-purple-600 hover:bg-purple-700 text-white"
          data-testid="button-post"
        >
          {isPosting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Posting...
            </>
          ) : (
            'Post'
          )}
        </Button>
      </div>
    </div>
  );
}
