import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Plus, Star, Target, Vote, Flame, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import MentionTextarea from "@/components/mention-textarea";
import { queryClient } from "@/lib/queryClient";

type ComposerMode = "" | "prediction" | "poll" | "hot-take" | "rate-review" | "add-media";
type PredictionType = "yes-no" | "head-to-head" | "multi-choice";

export default function InlineComposer() {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const [composerMode, setComposerMode] = useState<ComposerMode>("hot-take");
  const [content, setContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [containsSpoilers, setContainsSpoilers] = useState(false);
  const [showMediaSearch, setShowMediaSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [attachedMedia, setAttachedMedia] = useState<any>(null);
  
  // Prediction-specific state
  const [predictionType, setPredictionType] = useState<PredictionType>("yes-no");
  const [predictionOptions, setPredictionOptions] = useState<string[]>(["Yes", "No"]);

  // Poll-specific state
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  // Action chips configuration
  const actionChips = [
    { id: "prediction" as ComposerMode, icon: Target, label: "🎯 Prediction", color: "text-red-600" },
    { id: "poll" as ComposerMode, icon: Vote, label: "🗳️ Poll", color: "text-blue-600" },
    { id: "hot-take" as ComposerMode, icon: Flame, label: "🔥 Hot Take", color: "text-orange-600" },
    { id: "rate-review" as ComposerMode, icon: Star, label: "⭐ Rate/Review", color: "text-yellow-600" },
    { id: "add-media" as ComposerMode, icon: Plus, label: "➕ Add Media", color: "text-purple-600" },
  ];

  const resetComposer = () => {
    setContent("");
    setComposerMode("hot-take");
    setContainsSpoilers(false);
    setShowMediaSearch(false);
    setSearchQuery("");
    setSearchResults([]);
    setAttachedMedia(null);
    setPredictionType("yes-no");
    setPredictionOptions(["Yes", "No"]);
    setPollOptions(["", ""]);
  };

  const handlePost = async () => {
    if (!content.trim() && composerMode === "hot-take") {
      toast({
        title: "Empty Post",
        description: "Please write something before posting.",
        variant: "destructive",
      });
      return;
    }

    setIsPosting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/share-update`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: content.trim(),
          type: "text",
          visibility: "public",
          contains_spoilers: containsSpoilers,
        }),
      });

      if (!response.ok) throw new Error("Failed to post");

      toast({
        title: "Posted!",
        description: "Your update has been shared.",
      });

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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-search?query=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
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

  const handlePredictionTypeChange = (type: PredictionType) => {
    setPredictionType(type);
    if (type === "yes-no") {
      setPredictionOptions(["Yes", "No"]);
    } else {
      setPredictionOptions(["", "", "", "", ""]);
    }
  };

  const updatePredictionOption = (index: number, value: string) => {
    const newOptions = [...predictionOptions];
    newOptions[index] = value;
    setPredictionOptions(newOptions);
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
    if (composerMode === "hot-take") {
      return "What's your take?";
    }
    if (composerMode === "rate-review" || composerMode === "add-media") {
      return "What are you watching, reading, or listening to?";
    }
    if (composerMode === "prediction") {
      return "Ask a prediction question (ex: Will Dune Part 3 get greenlit?)";
    }
    if (composerMode === "poll") {
      return "Ask a poll question...";
    }
    return "Share your thoughts...";
  };

  const maxChars = 1000;
  const charsRemaining = maxChars - content.length;

  return (
    <div className="rounded-2xl shadow-lg relative p-[4px] bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600">
      <div className="bg-white rounded-[12px]">
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
              maxLength={maxChars}
              session={session}
            />
          </div>
        </div>
      </div>

      {/* Action Chips - Always Visible */}
      <div className="px-4 pb-3 border-t border-gray-100 pt-3">
        <div className="flex gap-1.5 flex-wrap">
          {actionChips.map((chip) => {
            const isActive = composerMode === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => handleChipClick(chip.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                data-testid={`chip-${chip.id}`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contextual UI - Expands based on selected chip */}
      {composerMode === "prediction" && (
        <div className="px-4 pb-3 border-t border-gray-100 pt-3 space-y-3">
          <p className="text-xs text-gray-600 font-medium">Prediction Type</p>
          <div className="flex gap-2">
            <button
              onClick={() => handlePredictionTypeChange("yes-no")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                predictionType === "yes-no"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Yes/No
            </button>
            <button
              onClick={() => handlePredictionTypeChange("multi-choice")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                predictionType === "multi-choice"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Multi-Choice
            </button>
          </div>
          
          {predictionType === "multi-choice" && (
            <div className="space-y-2">
              <p className="text-xs text-gray-600 font-medium">Options</p>
              {predictionOptions.map((option, index) => (
                <input
                  key={index}
                  type="text"
                  value={option}
                  onChange={(e) => updatePredictionOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              ))}
            </div>
          )}
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
            <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
              {attachedMedia.poster_url && (
                <img 
                  src={attachedMedia.poster_url} 
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
                      {result.poster_url && (
                        <img 
                          src={result.poster_url} 
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
    </div>
  );
}
