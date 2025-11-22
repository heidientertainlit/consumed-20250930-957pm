import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Star, Target, Vote, MessageCircle, Loader2, Search, ListPlus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import MentionTextarea from "@/components/mention-textarea";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

type ComposerStage = "search" | "actions";
type ActionMode = "" | "thought" | "rating" | "prediction" | "poll" | "list";

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

  // Fetch user's lists
  const { data: userLists = [] } = useQuery<any[]>({
    queryKey: ['/api/lists', user?.id],
    enabled: !!user?.id && actionMode === "list",
  });

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
    setSelectedMedia(media);
    setStage("actions");
    setSearchQuery("");
    setSearchResults([]);
  };

  const handlePost = async () => {
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

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/add-media-to-list`,
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
      const payload: any = {
        media_title: selectedMedia.title || "",
        media_type: selectedMedia.type || "movie",
        media_creator: selectedMedia.creator || selectedMedia.author || selectedMedia.artist || "",
        media_image_url: selectedMedia.poster_url || selectedMedia.image_url || selectedMedia.image || selectedMedia.thumbnail || "",
        media_external_id: selectedMedia.external_id || selectedMedia.id || "",
        media_external_source: selectedMedia.external_source || selectedMedia.source || 'tmdb',
        visibility: "public",
        contains_spoilers: containsSpoilers,
      };

      // Add action-specific data
      if (actionMode === "thought" && thoughtText.trim()) {
        payload.content = thoughtText.trim();
        payload.type = "thought";
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
        payload.rating = ratingValue;
        payload.content = `Rated ${selectedMedia.title}`;
        payload.type = "rate-review";
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
        payload.content = predictionQuestion.trim();
        payload.type = "prediction";
        payload.prediction_question = predictionQuestion.trim();
        payload.prediction_options = filledOptions;
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
        payload.content = pollQuestion.trim();
        payload.type = "poll";
        payload.poll_question = pollQuestion.trim();
        payload.poll_options = filledOptions;
      } else {
        // Just tracking media consumption
        payload.content = `Added ${selectedMedia.title}`;
        payload.type = "add-media";
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/share-update`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Share update failed:", response.status, errorData);
        throw new Error(`Failed to post: ${errorData}`);
      }

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
                  onClick={handlePost}
                  disabled={isPosting}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  data-testid="button-just-track"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">✓</span>
                    <span className="text-sm font-medium text-gray-900">Just track it</span>
                  </div>
                  {isPosting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  ) : (
                    <span className="text-gray-400">→</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Thought Mode */}
          {actionMode === "thought" && (
            <div className="space-y-3">
              <MentionTextarea
                value={thoughtText}
                onChange={setThoughtText}
                placeholder="Add a quick thought..."
                className="border border-gray-200 rounded-lg p-3 text-sm resize-none focus-visible:ring-2 focus-visible:ring-purple-500 text-gray-900 bg-white placeholder:text-gray-400 w-full"
                minHeight="80px"
                session={session}
              />
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
