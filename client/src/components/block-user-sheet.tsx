import { Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useBlockUser } from "@/hooks/use-block-user";
import { useAuth } from "@/lib/auth";

interface BlockUserSheetProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  targetUserName?: string;
  onBlocked?: () => void;
  presentation?: "sheet" | "dialog";
}

/** Shared confirmation UI for every user-facing block action. */
export function BlockUserSheet({
  isOpen,
  onClose,
  targetUserId,
  targetUserName,
  onBlocked,
  presentation = "sheet",
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

  const title = isSelf ? "You can't block yourself" : `Block ${targetUserName ? `@${targetUserName}` : "this user"}?`;
  const description = isSelf
    ? "Choose another person if you need to manage someone's content."
    : "They won't be able to see your profile and you won't see their content, friend requests, or matches.";
  const actions = (
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
  );
  const handleOpenChange = (open: boolean) => { if (!open && !blockMutation.isPending) onClose(); };

  if (presentation === "dialog") {
    return (
      <Dialog layered open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl gap-0 bg-white text-gray-900">
          <DialogTitle className="mb-2 pr-6 text-base font-semibold text-gray-900">{title}</DialogTitle>
          <DialogDescription className="mb-6 text-sm text-gray-500">{description}</DialogDescription>
          {actions}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open && !blockMutation.isPending) onClose(); }}>
      <SheetContent side="bottom" overlayClassName="z-[100000]" className="z-[100001] rounded-t-2xl max-h-[85dvh] overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))] bg-white text-gray-900">
        <SheetTitle className="mb-2 text-base font-semibold text-gray-900">
          {title}
        </SheetTitle>
        <p className="mb-6 text-sm text-gray-500">
          {description}
        </p>
        {actions}
      </SheetContent>
    </Sheet>
  );
}