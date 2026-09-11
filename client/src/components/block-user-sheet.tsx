import { Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useBlockUser } from "@/hooks/use-block-user";
import { useAuth } from "@/lib/auth";

interface BlockUserSheetProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  targetUserName?: string;
  onBlocked?: () => void;
}

/** Shared confirmation UI for every user-facing block action. */
export function BlockUserSheet({
  isOpen,
  onClose,
  targetUserId,
  targetUserName,
  onBlocked,
}: BlockUserSheetProps) {
  const { user } = useAuth();
  const isSelf = !targetUserId || targetUserId === user?.id;
  const blockMutation = useBlockUser({
    onBlocked: () => {
      onBlocked?.();
      onClose();
    },
  });

  const handleBlock = () => {
    if (isSelf || blockMutation.isPending) return;
    blockMutation.mutate(targetUserId);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open && !blockMutation.isPending) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-safe bg-white text-gray-900">
        <SheetTitle className="mb-2 text-base font-semibold text-gray-900">
          {isSelf ? "You can't block yourself" : `Block ${targetUserName ? `@${targetUserName}` : "this user"}?`}
        </SheetTitle>
        <p className="mb-6 text-sm text-gray-500">
          {isSelf
            ? "Choose another person if you need to manage someone's content."
            : "They won't be able to see your profile and you won't see their content, friend requests, or matches."}
        </p>
        <div className="flex flex-col gap-3">
          {!isSelf && (
            <Button
              onClick={handleBlock}
              disabled={blockMutation.isPending}
              className="w-full rounded-full bg-red-600 py-3 font-semibold text-white hover:bg-red-700"
            >
              {blockMutation.isPending ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Ban size={18} className="mr-2" />}
              {blockMutation.isPending ? "Blocking..." : "Block user"}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onClose}
            disabled={blockMutation.isPending}
            className="w-full rounded-full border-gray-200 py-3 font-semibold"
          >
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}