import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Film, MessageSquare, Gamepad2, Users, BarChart3, Sparkles } from "lucide-react";
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

  const actionIcons = [
    { id: "media" as PostMode, icon: Film, label: "Add Media", color: "text-purple-600" },
    { id: "review" as PostMode, icon: MessageSquare, label: "Review or React", color: "text-blue-600" },
    { id: "prediction" as PostMode, icon: Gamepad2, label: "Prediction / Play", color: "text-red-600" },
    { id: "tribe" as PostMode, icon: Users, label: "Tribe Talk", color: "text-green-600" },
    { id: "ranking" as PostMode, icon: BarChart3, label: "Rate / Rank", color: "text-orange-600" },
    { id: "mood" as PostMode, icon: Sparkles, label: "Mood / Emotion", color: "text-pink-600" },
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
      <DialogContent className="max-w-2xl p-0 gap-0 bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <button onClick={onClose} className="text-gray-600 hover:text-gray-900 text-sm">
            Cancel
          </button>
          <h2 className="text-base font-semibold text-gray-900">New thread</h2>
          <div className="w-14" /> {/* Spacer for alignment */}
        </div>

        {/* Content */}
        <div className="px-4 py-4 bg-white">
          {/* User Info */}
          <div className="flex gap-3 mb-4">
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
                placeholder="What's new?"
                className="border-none p-0 min-h-[100px] text-base resize-none focus-visible:ring-0 focus-visible:ring-offset-0 text-gray-900 bg-white placeholder:text-gray-400"
                session={session}
              />

              {/* Action Icons */}
              <div className="flex gap-4 mt-4 pt-4 border-t border-gray-200">
                {actionIcons.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleModeClick(action.id)}
                    className={`flex flex-col items-center gap-1 hover:opacity-70 transition-opacity ${action.color}`}
                    title={action.label}
                  >
                    <action.icon className="w-5 h-5" />
                    <span className="text-xs">{action.label.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between bg-white">
          <div className="text-sm text-gray-500">
            Reply options
          </div>
          <Button
            onClick={handlePost}
            disabled={isPosting || (!content.trim() && postMode === "text")}
            className="bg-black hover:bg-gray-800 text-white px-6"
          >
            {isPosting ? "Posting..." : "Post"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
