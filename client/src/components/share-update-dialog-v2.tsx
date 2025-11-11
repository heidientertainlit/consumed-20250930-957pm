import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Plus, Star, Target, Flame, Vote } from "lucide-react";
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
      setContent("");
      setPostMode("text");
      setContainsSpoilers(false);
      onClose();
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
    if (mode === "text") {
      setPostMode("text");
    } else {
      // For now, show coming soon toast for non-text modes
      toast({
        title: `${actionIcons.find(a => a.id === mode)?.label}`,
        description: "This feature is coming soon!",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
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
                placeholder="Post an update..."
                className="border-none p-0 text-sm resize-none focus-visible:ring-0 focus-visible:ring-offset-0 text-gray-900 bg-white placeholder:text-gray-400"
                minHeight="50px"
                session={session}
              />

              {/* Action Icons */}
              <div className="flex gap-4 mt-2 pt-2 border-t border-gray-200">
                {actionIcons.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleModeClick(action.id)}
                    className={`flex flex-col items-center gap-0.5 hover:opacity-70 transition-opacity ${action.color}`}
                    title={action.label}
                  >
                    <action.icon className="w-4 h-4" />
                    <span className="text-[10px] leading-tight">{action.label.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
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
            disabled={isPosting || (!content.trim() && postMode === "text")}
            className="bg-black hover:bg-gray-800 text-white px-5 py-1.5 h-auto text-sm"
          >
            {isPosting ? "Posting..." : "Post"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
