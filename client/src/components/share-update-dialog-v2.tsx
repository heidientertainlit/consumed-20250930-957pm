import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Plus, Star, Target, MessageCircle, Vote, Search, UserPlus, HelpCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import MentionTextarea from "@/components/mention-textarea";

interface ShareUpdateDialogV2Props {
  isOpen: boolean;
  onClose: () => void;
}

type PostMode = "text" | "media" | "review" | "prediction" | "tribe" | "ranking" | "mood" | "trivia";
type PredictionType = "yes-no" | "head-to-head" | "multi-choice";

export default function ShareUpdateDialogV2({ isOpen, onClose }: ShareUpdateDialogV2Props) {
  const { session, user } = useAuth();
  const { toast } = useToast();
  const [postMode, setPostMode] = useState<PostMode>("text");
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
  const [invitedFriends, setInvitedFriends] = useState<any[]>([]);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [friendSearchResults, setFriendSearchResults] = useState<any[]>([]);
  const [showFriendSearch, setShowFriendSearch] = useState(false);

  // Conversation-specific state
  const [conversationTopic, setConversationTopic] = useState<any>(null);
  const [topicSelectorTab, setTopicSelectorTab] = useState<"media" | "hashtag">("media");
  const [hashtagInput, setHashtagInput] = useState("");

  // Reset all state when dialog closes
  const handleClose = () => {
    setContent("");
    setPostMode("text");
    setContainsSpoilers(false);
    setShowMediaSearch(false);
    setSearchQuery("");
    setSearchResults([]);
    setAttachedMedia(null);
    setPredictionType("yes-no");
    setPredictionOptions(["Yes", "No"]);
    setInvitedFriends([]);
    setFriendSearchQuery("");
    setFriendSearchResults([]);
    setShowFriendSearch(false);
    setConversationTopic(null);
    setTopicSelectorTab("media");
    setHashtagInput("");
    onClose();
  };

  const actionIcons = [
    { id: "media" as PostMode, icon: Plus, label: "Consuming", color: "text-purple-600" },
    { id: "mood" as PostMode, icon: MessageCircle, label: "Conversation", color: "text-orange-600" },
    { id: "prediction" as PostMode, icon: Target, label: "Prediction", color: "text-red-600" },
    { id: "tribe" as PostMode, icon: Vote, label: "Poll", color: "text-blue-600" },
    { id: "review" as PostMode, icon: Star, label: "Rate/Review", color: "text-yellow-600" },
    { id: "trivia" as PostMode, icon: HelpCircle, label: "Trivia", color: "text-green-600" },
  ];

  const handlePost = async () => {
    // Validate based on post mode
    if (postMode === "text" && !content.trim()) {
      toast({
        title: "Empty Post",
        description: "Please write something before posting.",
        variant: "destructive",
      });
      return;
    }

    if (postMode === "tribe" && predictionOptions.filter(o => o.trim()).length < 2) {
      toast({
        title: "Invalid Poll",
        description: "Please provide at least 2 options for your poll.",
        variant: "destructive",
      });
      return;
    }

    setIsPosting(true);
    try {
      let endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/share-update`;
      let body: any = {};

      if (postMode === "tribe") {
        // Poll creation
        endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-prediction`;
        const filledOptions = predictionOptions.filter(o => o.trim());
        body = {
          question: content.trim() || "What do you think?",
          options: filledOptions,
          poll_type: predictionType,
          type: "vote",
        };
      } else if (postMode === "prediction") {
        // Prediction creation
        endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-prediction`;
        const filledOptions = predictionOptions.filter(o => o.trim());
        body = {
          question: content.trim(),
          options: filledOptions,
          poll_type: predictionType,
          type: "predict",
        };
      } else {
        // Text/other posts
        body = {
          content: content.trim(),
          type: "text",
          visibility: "public",
          contains_spoilers: containsSpoilers,
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to post");
      }

      toast({
        title: "Posted!",
        description: postMode === "tribe" ? "Your poll has been created!" : "Your update has been shared.",
      });

      // Reset and close
      handleClose();
    } catch (error) {
      console.error("Post error:", error);
      toast({
        title: "Post Failed",
        description: error instanceof Error ? error.message : "Unable to share your update. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handleModeClick = (mode: PostMode) => {
    if (mode === "text" || mode === "mood" || mode === "media" || mode === "prediction" || mode === "tribe") {
      setPostMode(mode);
      // Auto-open media search when entering consuming mode
      if (mode === "media") {
        setShowMediaSearch(true);
      }
      // Initialize poll options when entering tribe (poll) mode
      if (mode === "tribe") {
        setPredictionType("yes-no");
        setPredictionOptions(["Yes", "No"]);
      }
    } else {
      // For now, show coming soon toast for other modes
      toast({
        title: `${actionIcons.find(a => a.id === mode)?.label}`,
        description: "This feature is coming soon!",
      });
    }
  };

  const handleAttachMedia = async () => {
    setShowMediaSearch(!showMediaSearch);
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

  const handleFriendSearch = async (query: string) => {
    if (!query.trim()) {
      setFriendSearchResults([]);
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-users?query=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Filter out already invited friends
        const filteredResults = (data.results || []).filter(
          (friend: any) => !invitedFriends.some(invited => invited.id === friend.id)
        );
        setFriendSearchResults(filteredResults);
      }
    } catch (error) {
      console.error("Friend search error:", error);
    }
  };

  const handleInviteFriend = (friend: any) => {
    setInvitedFriends([...invitedFriends, friend]);
    setFriendSearchQuery("");
    setFriendSearchResults([]);
    setShowFriendSearch(false);
  };

  const handleRemoveInvitedFriend = (friendId: string) => {
    setInvitedFriends(invitedFriends.filter(f => f.id !== friendId));
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

  const getPlaceholder = () => {
    if (postMode === "mood") {
      return "Start a conversation... (ex: Let's discuss the Selling Sunset finale!)";
    }
    if (postMode === "media") {
      return "What are you watching, reading, or listening to?";
    }
    if (postMode === "prediction") {
      return "Ask a prediction question (ex: Will Dune Part 3 get greenlit?)";
    }
    if (postMode === "tribe") {
      return "Ask your poll question (ex: Who do you save most?)";
    }
    return "Share your thoughts or pick a specific way to engage about your entertainment";
  };

  const getButtonText = () => {
    if (postMode === "mood") {
      return isPosting ? "Posting..." : "Start Conversation";
    }
    if (postMode === "media") {
      return isPosting ? "Posting..." : "Share Update";
    }
    if (postMode === "prediction") {
      return isPosting ? "Posting..." : "Create Prediction";
    }
    if (postMode === "tribe") {
      return isPosting ? "Creating..." : "Create Poll";
    }
    return isPosting ? "Posting..." : "Post";
  };

  const maxChars = postMode === "mood" ? 280 : 1000;
  const charsRemaining = maxChars - content.length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl p-0 gap-0 bg-white">
        {/* Content */}
        <div className="px-4 pt-6 pb-3 bg-white">
          {/* User Info */}
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
              {user?.email?.substring(0, 2).toUpperCase() || 'ME'}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm mb-1 text-gray-900">
                {user?.email?.split('@')[0] || 'consumedapp'}
              </p>
              
              {/* Text Input */}
              <MentionTextarea
                value={content}
                onChange={setContent}
                placeholder={getPlaceholder()}
                className="border-none p-0 text-sm resize-none focus-visible:ring-0 focus-visible:ring-offset-0 text-gray-900 bg-white placeholder:text-gray-400"
                minHeight={postMode === "mood" ? "100px" : "50px"}
                maxLength={postMode === "mood" ? undefined : maxChars}
                session={session}
              />

              {/* Consuming Mode - Track Media */}
              {postMode === "media" && (
                <div className="space-y-2 mt-2">
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

                  {/* Media Search - Always visible in consuming mode */}
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
                                <p className="text-sm font-medium text-gray-900 truncate">{result.title}</p>
                                <p className="text-xs text-gray-600 capitalize">{result.type}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {isSearching && (
                        <p className="text-xs text-purple-600 mt-2 flex items-center gap-2">
                          <span className="inline-block w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></span>
                          Searching across movies, TV, books, music...
                        </p>
                      )}
                      {searchQuery && !isSearching && searchResults.length === 0 && (
                        <p className="text-xs text-gray-500 mt-2">No results found. Try a different search.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Prediction Mode */}
              {postMode === "prediction" && (
                <div className="space-y-3 mt-2">
                  {/* Prediction Type Selector - Always visible */}
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">Prediction Type</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePredictionTypeChange("yes-no")}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          predictionType === "yes-no"
                            ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        Yes/No ✅
                      </button>
                      <button
                        onClick={() => handlePredictionTypeChange("multi-choice")}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          predictionType === "multi-choice"
                            ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        Multi-Choice 🆎
                      </button>
                    </div>
                  </div>

                  {/* Suggested Predictions - Only show when no content */}
                  {!content && (
                    <div>
                      <p className="text-xs text-gray-600 mb-2">
                        Or choose a pre-written prediction to post
                      </p>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {(predictionType === "yes-no" ? [
                          "Will Dune Part 3 get greenlit?",
                          "Will Taylor Swift win Album of the Year at the Grammys?",
                          "Will Stranger Things S5 be the final season?",
                          "Will the Barbie sequel happen?",
                          "Will Avatar 3 make $2 billion at the box office?"
                        ] : [
                          "Which Marvel movie will gross the most in 2025?",
                          "Which streaming service will win the most Emmys?",
                          "Which book will top the NYT Bestseller list in January?",
                          "Which artist will headline the Super Bowl halftime show?",
                          "Which Netflix show will get renewed first?"
                        ]).map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => setContent(suggestion)}
                            className="w-full text-left px-3 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg text-xs text-gray-900 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Prediction Configuration - Show when content exists */}
                  {content && (
                    <>
                      {/* Prediction Options */}
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-2">
                          {predictionType === "yes-no" ? "Options (Auto-set)" : "Add Options"}
                        </p>
                        <div className="space-y-2">
                          {predictionOptions.map((option, idx) => (
                            <input
                              key={idx}
                              type="text"
                              value={option}
                              onChange={(e) => updatePredictionOption(idx, e.target.value)}
                              placeholder={
                                predictionType === "yes-no"
                                  ? option
                                  : `Option ${idx + 1}`
                              }
                              disabled={predictionType === "yes-no"}
                              className={`w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                                predictionType === "yes-no" ? "bg-gray-100 cursor-not-allowed text-black font-medium" : "bg-white text-black"
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Add Related Media */}
                      <Button
                        onClick={handleAttachMedia}
                        size="sm"
                        variant="outline"
                        className="w-full h-10 text-xs text-purple-600 border-purple-300 hover:bg-purple-50"
                      >
                        <Search className="w-4 h-4 mr-2" />
                        {attachedMedia ? "Change Related Media" : "Add Related Media"}
                      </Button>

                      {/* Attached Media Display */}
                      {attachedMedia && (
                        <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg p-2">
                          {attachedMedia.poster_url && (
                            <img 
                              src={attachedMedia.poster_url} 
                              alt={attachedMedia.title}
                              className="w-10 h-14 object-cover rounded"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">{attachedMedia.title}</p>
                            <p className="text-xs text-gray-500">{attachedMedia.type}</p>
                          </div>
                          <Button
                            onClick={() => setAttachedMedia(null)}
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-900"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      )}

                      {/* Media Search */}
                      {showMediaSearch && (
                        <div className="border border-purple-200 rounded-lg p-2 bg-purple-50">
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                              setSearchQuery(e.target.value);
                              handleMediaSearch(e.target.value);
                            }}
                            placeholder="Search for related media..."
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                          {searchResults.length > 0 && (
                            <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                              {searchResults.slice(0, 5).map((result, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => handleSelectMedia(result)}
                                  className="w-full flex items-center gap-2 p-1.5 hover:bg-white rounded text-left"
                                >
                                  {result.poster_url && (
                                    <img 
                                      src={result.poster_url} 
                                      alt={result.title}
                                      className="w-6 h-9 object-cover rounded"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-gray-900 truncate">{result.title}</p>
                                    <p className="text-xs text-gray-500">{result.type}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                          {isSearching && (
                            <p className="text-xs text-purple-600 mt-2">Searching...</p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Poll Mode */}
              {postMode === "tribe" && (
                <div className="space-y-3 mt-2">
                  {/* Poll Type Selector */}
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">Poll Type</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePredictionTypeChange("yes-no")}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          predictionType === "yes-no"
                            ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        Yes/No 🗳️
                      </button>
                      <button
                        onClick={() => handlePredictionTypeChange("multi-choice")}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          predictionType === "multi-choice"
                            ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        Custom Options 📋
                      </button>
                    </div>
                  </div>

                  {/* Poll Options */}
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">
                      {predictionType === "yes-no" ? "Options (Auto-set)" : `Options (${predictionOptions.filter(o => o.trim()).length}/4)`}
                    </p>
                    <div className="space-y-2">
                      {predictionOptions.slice(0, predictionType === "yes-no" ? 2 : 4).map((option, idx) => (
                        <input
                          key={idx}
                          type="text"
                          value={option}
                          onChange={(e) => updatePredictionOption(idx, e.target.value)}
                          placeholder={
                            predictionType === "yes-no"
                              ? option
                              : `Option ${idx + 1}`
                          }
                          disabled={predictionType === "yes-no"}
                          className={`w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            predictionType === "yes-no" ? "bg-gray-100 cursor-not-allowed text-black font-medium" : "bg-white text-black"
                          }`}
                        />
                      ))}
                    </div>
                    {predictionType === "multi-choice" && predictionOptions.filter(o => o.trim()).length < 4 && (
                      <button
                        onClick={() => setPredictionOptions([...predictionOptions.slice(0, 4)])}
                        className="mt-2 w-full py-2 text-xs text-blue-600 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        + Add Option ({predictionOptions.filter(o => o.trim()).length}/4)
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Hot Take Tools */}
              {postMode === "mood" && (
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleAttachMedia}
                      size="sm"
                      className="h-8 px-3 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Search className="w-3.5 h-3.5 mr-1" />
                      {attachedMedia ? "Change Media" : "Attach Media"}
                    </Button>
                  </div>

                  {/* Attached Media Display */}
                  {attachedMedia && (
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                      {attachedMedia.poster_url && (
                        <img 
                          src={attachedMedia.poster_url} 
                          alt={attachedMedia.title}
                          className="w-10 h-14 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{attachedMedia.title}</p>
                        <p className="text-xs text-gray-500">{attachedMedia.type}</p>
                      </div>
                      <Button
                        onClick={() => setAttachedMedia(null)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-gray-400 hover:text-gray-900"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}

                  {/* Media Search */}
                  {showMediaSearch && (
                    <div className="border border-gray-200 rounded-lg p-2">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          handleMediaSearch(e.target.value);
                        }}
                        placeholder="Search movies, TV, books, music..."
                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                      {searchResults.length > 0 && (
                        <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                          {searchResults.slice(0, 5).map((result, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSelectMedia(result)}
                              className="w-full flex items-center gap-2 p-1.5 hover:bg-gray-100 rounded text-left"
                            >
                              {result.poster_url && (
                                <img 
                                  src={result.poster_url} 
                                  alt={result.title}
                                  className="w-6 h-9 object-cover rounded"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-900 truncate">{result.title}</p>
                                <p className="text-xs text-gray-500">{result.type}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {isSearching && (
                        <p className="text-xs text-gray-500 mt-2">Searching...</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Conversation Mode - Topic Selector */}
              {postMode === "mood" && (
                <div className="space-y-3 mt-2">
                  {/* Topic pill if selected */}
                  {conversationTopic && (
                    <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg p-3">
                      {conversationTopic.poster_url && (
                        <img 
                          src={conversationTopic.poster_url} 
                          alt={conversationTopic.title}
                          className="w-10 h-14 object-cover rounded shadow-sm"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 mb-0.5">Conversation about</p>
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {conversationTopic.type === "theme" ? `${conversationTopic.icon} ${conversationTopic.title}` : conversationTopic.title}
                        </p>
                      </div>
                      <Button
                        onClick={() => setConversationTopic(null)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-400 hover:text-gray-900"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {/* Topic Selector - Show when no topic selected */}
                  {!conversationTopic && (
                    <div className="border border-orange-200 rounded-lg p-3 bg-orange-50">
                      <p className="text-xs font-semibold text-gray-700 mb-2">What's this conversation about?</p>
                      
                      {/* Single Search Box */}
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          handleMediaSearch(e.target.value);
                        }}
                        placeholder="Search for a show, movie, book, podcast..."
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white mb-3"
                        autoFocus
                      />

                      {/* Search Results */}
                      {searchResults.length > 0 && (
                        <div className="mb-3 max-h-48 overflow-y-auto space-y-1">
                          {searchResults.slice(0, 8).map((result, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setConversationTopic({ ...result, type: "media" });
                                setSearchQuery("");
                                setSearchResults([]);
                              }}
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
                                <p className="text-sm font-medium text-gray-900 truncate">{result.title}</p>
                                <p className="text-xs text-gray-600 capitalize">{result.type}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {isSearching && (
                        <p className="text-xs text-orange-600 mb-3 flex items-center gap-2">
                          <span className="inline-block w-3 h-3 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></span>
                          Searching...
                        </p>
                      )}

                      {/* Curated Theme Chips */}
                      {!searchQuery && searchResults.length === 0 && (
                        <div>
                          <p className="text-xs text-gray-600 mb-2">Or pick a general topic:</p>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { icon: "🏆", title: "Awards Season", slug: "awards-season" },
                              { icon: "🎭", title: "Reality TV Drama", slug: "reality-tv-drama" },
                              { icon: "📺", title: "Streaming Wars", slug: "streaming-wars" },
                              { icon: "🎬", title: "2025 Predictions", slug: "2025-predictions" },
                            ].map((theme) => (
                              <button
                                key={theme.slug}
                                onClick={() => {
                                  setConversationTopic({ 
                                    title: theme.title,
                                    slug: theme.slug,
                                    icon: theme.icon,
                                    type: "theme" 
                                  });
                                }}
                                className="px-3 py-1.5 bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-orange-600 border border-orange-200 hover:border-orange-600 rounded-full text-xs font-medium text-gray-700 hover:text-white transition-all"
                              >
                                {theme.icon} {theme.title}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Action Icons - Only show if not in a specific mode */}
              {postMode === "text" && (
                <div className="flex gap-4 mt-2 pt-2 border-t border-gray-200">
                  {actionIcons.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleModeClick(action.id)}
                      className={`flex flex-col items-center gap-0.5 hover:opacity-70 transition-opacity ${action.color}`}
                      title={action.label}
                    >
                      <action.icon className="w-4 h-4" />
                      <span className="text-[10px] leading-tight whitespace-nowrap">{action.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Mode Indicator - Show when in specific mode */}
              {postMode !== "text" && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200">
                  <div className="flex items-center gap-1.5">
                    {postMode === "mood" && <MessageCircle className="w-4 h-4 text-orange-600" />}
                    {postMode === "media" && <Plus className="w-4 h-4 text-purple-600" />}
                    {postMode === "prediction" && <Target className="w-4 h-4 text-red-600" />}
                    <span className="text-xs font-medium text-gray-900">
                      {actionIcons.find(a => a.id === postMode)?.label}
                    </span>
                  </div>
                  <Button
                    onClick={() => {
                      setPostMode("text");
                      setShowMediaSearch(false);
                      setSearchQuery("");
                      setSearchResults([]);
                      setAttachedMedia(null);
                    }}
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs ml-auto"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="spoilers"
                checked={containsSpoilers}
                onCheckedChange={(checked) => setContainsSpoilers(!!checked)}
                className="h-4 w-4"
              />
              <label
                htmlFor="spoilers"
                className="text-xs text-gray-600 cursor-pointer select-none"
              >
                Contains spoilers
              </label>
            </div>
            <div className="flex items-center gap-2">
              {/* Invite Friends Button - Only show in prediction mode with content */}
              {postMode === "prediction" && content && (
                <Button
                  onClick={() => setShowFriendSearch(!showFriendSearch)}
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 text-xs text-purple-600 border-purple-300 hover:bg-purple-50"
                >
                  <UserPlus className="w-4 h-4 mr-1" />
                  Invite Friends
                </Button>
              )}
              <Button
                onClick={handlePost}
                disabled={Boolean(
                  isPosting || 
                  (postMode !== "tribe" && !content.trim()) || 
                  content.length > maxChars ||
                  (postMode === "mood" && !conversationTopic) ||
                  (postMode === "prediction" && content && predictionType !== "yes-no" && predictionOptions.some(opt => !opt.trim())) ||
                  (postMode === "tribe" && predictionType !== "yes-no" && predictionOptions.filter(opt => opt.trim()).length < 2)
                )}
                className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-1.5 h-auto text-sm"
              >
                {getButtonText()}
              </Button>
            </div>
          </div>

          {/* Friend Search Dropdown - Only show when active in prediction mode */}
          {postMode === "prediction" && showFriendSearch && (
            <div className="border border-purple-200 rounded-lg p-3 bg-purple-50 mb-2">
              <input
                type="text"
                value={friendSearchQuery}
                onChange={(e) => {
                  setFriendSearchQuery(e.target.value);
                  handleFriendSearch(e.target.value);
                }}
                placeholder="Invite friends to predict with you"
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white mb-2"
                autoFocus
              />

              {/* Invited Friends List */}
              {invitedFriends.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {invitedFriends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center gap-1 bg-purple-100 border border-purple-300 rounded-full px-2 py-1"
                    >
                      <span className="text-xs text-gray-900">@{friend.user_name}</span>
                      <button
                        onClick={() => handleRemoveInvitedFriend(friend.id)}
                        className="text-gray-400 hover:text-gray-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Friend Search Results */}
              {friendSearchResults.length > 0 && (
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {friendSearchResults.slice(0, 5).map((friend) => (
                    <button
                      key={friend.id}
                      onClick={() => handleInviteFriend(friend)}
                      className="w-full flex items-center gap-2 p-2 hover:bg-white rounded text-left transition-colors"
                    >
                      <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                        {friend.user_name?.substring(0, 2).toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">@{friend.user_name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {invitedFriends.length === 0 && !friendSearchQuery && (
                <p className="text-xs text-gray-500 italic">
                  💬 Others will chime in after you post
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
