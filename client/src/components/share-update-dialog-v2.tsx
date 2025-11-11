import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Plus, Star, Target, Flame, Vote, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import MentionTextarea from "@/components/mention-textarea";

interface ShareUpdateDialogV2Props {
  isOpen: boolean;
  onClose: () => void;
}

type PostMode = "text" | "media" | "review" | "prediction" | "tribe" | "ranking" | "mood";

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

  // Reset all state when dialog closes
  const handleClose = () => {
    setContent("");
    setPostMode("text");
    setContainsSpoilers(false);
    setShowMediaSearch(false);
    setSearchQuery("");
    setSearchResults([]);
    setAttachedMedia(null);
    onClose();
  };

  const actionIcons = [
    { id: "media" as PostMode, icon: Plus, label: "Consuming", color: "text-purple-600" },
    { id: "mood" as PostMode, icon: Flame, label: "Hot Take", color: "text-orange-600" },
    { id: "prediction" as PostMode, icon: Target, label: "Prediction", color: "text-red-600" },
    { id: "tribe" as PostMode, icon: Vote, label: "Poll", color: "text-blue-600" },
    { id: "review" as PostMode, icon: Star, label: "Rate/Review", color: "text-yellow-600" },
  ];

  const handlePost = async () => {
    if (!content.trim() && postMode === "text") {
      toast({
        title: "Empty Post",
        description: "Please write something before posting.",
        variant: "destructive",
      });
      return;
    }

    setIsPosting(true);
    try {
      // For now, just text posts work - other modes are placeholders
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

      // Reset and close
      handleClose();
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

  const handleModeClick = (mode: PostMode) => {
    if (mode === "text" || mode === "mood") {
      setPostMode(mode);
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

  const getPlaceholder = () => {
    if (postMode === "mood") {
      return "What's your take? (ex: The Barbie movie is secretly a breakup film.)";
    }
    return "Post an update...";
  };

  const getButtonText = () => {
    if (postMode === "mood") {
      return isPosting ? "Posting..." : "Post Take 🔥";
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
                    <div className="ml-auto text-xs text-gray-500">
                      {content.length} / {maxChars}
                    </div>
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
                    {postMode === "mood" && <Flame className="w-4 h-4 text-orange-600" />}
                    <span className="text-xs font-medium text-gray-900">
                      {actionIcons.find(a => a.id === postMode)?.label}
                    </span>
                  </div>
                  <Button
                    onClick={() => setPostMode("text")}
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
        <div className="px-4 py-2.5 border-t border-gray-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <Checkbox
              id="spoilers"
              checked={containsSpoilers}
              onCheckedChange={(checked) => setContainsSpoilers(checked as boolean)}
              className="h-4 w-4"
            />
            <label
              htmlFor="spoilers"
              className="text-xs text-gray-600 cursor-pointer select-none"
            >
              Contains spoilers
            </label>
          </div>
          <Button
            onClick={handlePost}
            disabled={isPosting || !content.trim() || content.length > maxChars}
            className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-1.5 h-auto text-sm"
          >
            {getButtonText()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
