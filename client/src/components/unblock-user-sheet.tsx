import { Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useUnblockUser } from "@/hooks/use-block-user";

interface UnblockUserSheetProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  targetUserName?: string;
  onUnblocked?: () => void;
}

/** Shared confirmation UI for removing a viewer's block. */
export function UnblockUserSheet({
  isOpen,
  onClose,
  targetUserId,
  targetUserName,
  onUnblocked,
}: UnblockUserSheetProps) {
  const unblockMutation = useUnblockUser({
    notifyError: false,
    onUnblocked: () => {
      onUnblocked?.();
      onClose();
    },
  });
  const targetLabel = targetUserName ? `@${targetUserName}` : "this user";

  const handleUnblock = () => {
    if (!targetUserId || unblockMutation.isPending) return;
    unblockMutation.mutate(targetUserId);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open && !unblockMutation.isPending) onClose(); }}>
      <SheetContent
        side="bottom"
        overlayClassName="z-[100000]"
        className="z-[100001] rounded-t-2xl max-h-[85dvh] overflow-y-auto bg-white pb-[max(1.5rem,env(safe-area-inset-bottom))] text-gray-900"
        aria-describedby="unblock-user-description"
      >
        <SheetTitle className="mb-2 text-base font-semibold text-gray-900">
          Unblock {targetLabel}?
        </SheetTitle>
        <SheetDescription id="unblock-user-description" className="mb-3 text-sm text-gray-500">
          They may appear in your feed, people lists, and notifications again. Unblocking does not restore your friendship or send a new friend request.
        </SheetDescription>
        {unblockMutation.error && (
          <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" data-testid="text-unblock-error">
            {unblockMutation.error.message || "Unable to unblock this user. Please try again."}
          </p>
        )}
        <div className="flex flex-col gap-3">
          <Button
            onClick={handleUnblock}
            disabled={unblockMutation.isPending || !targetUserId}
            aria-busy={unblockMutation.isPending}
            className="w-full rounded-full bg-[#5b387f] py-3 font-semibold text-white hover:bg-[#4b2f70]"
            data-testid="button-confirm-unblock"
          >
            {unblockMutation.isPending ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Undo2 size={18} className="mr-2" />}
            {unblockMutation.isPending ? "Unblocking..." : "Unblock user"}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={unblockMutation.isPending}
            className="w-full rounded-full border-gray-200 py-3 font-semibold"
          >
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}