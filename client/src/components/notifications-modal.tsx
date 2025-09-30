import { useState, useEffect } from "react";
import { X, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { copyLink } from "@/lib/share";

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Nudge = { 
  id: string; 
  title: string; 
  body: string; 
  actionLabel: string; 
  onAction: () => Promise<void> | void 
};

export default function NotificationsModal({ isOpen, onClose }: NotificationsModalProps) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const s = localStorage.getItem("nudges.dismissed");
    if (s) setDismissed(JSON.parse(s));
  }, []);

  function dismiss(id: string) {
    const next = Array.from(new Set([...dismissed, id]));
    setDismissed(next);
    localStorage.setItem("nudges.dismissed", JSON.stringify(next));
  }

  const nudges: Nudge[] = [
    {
      id: "invite-friends",
      title: "Invite friends, earn points",
      body: "Share Consumed with a friend and rack up points toward perks.",
      actionLabel: "Invite friends",
      onAction: async () => {
        try {
          // Use the proper share link system for invite
          await copyLink({ kind: 'list', obj: { id: 'invite' } });
          toast({
            title: "Link copied!",
            description: "Share this link with your friends to invite them.",
          });
        } catch (error) {
          console.error('Error copying invite link:', error);
          toast({
            title: "Copy failed",
            description: "Unable to copy link",
            variant: "destructive"
          });
        }
      },
    },
    {
      id: "share-dna",
      title: "Share your Entertainment DNA",
      body: "Post your DNA and tag a friend to compare tastes.",
      actionLabel: "Share my DNA",
      onAction: async () => {
        try {
          if (!user?.id) {
            toast({
              title: "Not logged in",
              description: "Please log in to share your DNA",
              variant: "destructive"
            });
            return;
          }
          await copyLink({ kind: 'edna', id: user.id });
          toast({
            title: "DNA link copied!",
            description: "Share this link to show your Entertainment DNA.",
          });
        } catch (error) {
          console.error('Error sharing DNA:', error);
          toast({
            title: "Share failed",
            description: "Unable to create share link",
            variant: "destructive"
          });
        }
      },
    },
  ];

  const visible = nudges.filter(n => !dismissed.includes(n.id));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-16">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Notifications</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            data-testid="close-notifications"
          >
            <X size={18} className="text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="text-gray-400 mx-auto mb-3" size={32} />
              <p className="text-gray-600 font-medium">All caught up!</p>
              <p className="text-gray-500 text-sm mt-1">
                You've seen all your notifications
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {visible.map((nudge) => (
                <div 
                  key={nudge.id} 
                  className="rounded-xl border border-gray-200 p-4 bg-gray-50"
                  data-testid={`notification-${nudge.id}`}
                >
                  <div className="font-medium text-gray-900 mb-1">
                    {nudge.title}
                  </div>
                  <div className="text-sm text-gray-600 mb-3">
                    {nudge.body}
                  </div>
                  <div className="flex items-center justify-between">
                    <Button
                      onClick={() => nudge.onAction()}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 text-sm rounded-lg"
                      data-testid={`action-${nudge.id}`}
                    >
                      {nudge.actionLabel}
                    </Button>
                    <button
                      className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
                      onClick={() => dismiss(nudge.id)}
                      data-testid={`dismiss-${nudge.id}`}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}