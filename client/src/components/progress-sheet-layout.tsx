import type { PropsWithChildren } from "react";
import { SheetContent } from "@/components/ui/sheet";
import { AlertDialogContent } from "@/components/ui/alert-dialog";

/** Opt-in layering: ordinary navigation is 9999; the Add composer is 99999. */
export function ProgressSheetContent({
  elevated = false,
  children,
}: PropsWithChildren<{ elevated?: boolean }>) {
  const layer = elevated ? "z-[100000]" : "z-[10000]";
  return (
    <SheetContent
      side="bottom"
      aria-describedby={undefined}
      data-progress-sheet=""
      className={`flex max-h-[90dvh] min-h-0 flex-col gap-0 overflow-hidden rounded-t-2xl bg-white p-0 ${layer}`}
      overlayClassName={layer}
    >
      {children}
    </SheetContent>
  );
}

export function ProgressSheetBody({ children }: PropsWithChildren) {
  return (
    <div data-progress-scroll="" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
      {children}
    </div>
  );
}

export function ProgressSheetActions({ children }: PropsWithChildren) {
  return (
    <div data-progress-actions="" className="shrink-0 space-y-2 border-t border-gray-100 bg-white px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      {children}
    </div>
  );
}

/** A removal confirmation must also clear the elevated progress sheet. */
export function ProgressSheetConfirmation({ children }: PropsWithChildren) {
  return (
    <AlertDialogContent className="z-[100002]" overlayClassName="z-[100001]">
      {children}
    </AlertDialogContent>
  );
}
