import { createContext, useContext, useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

// Sandbox-only adapter: avoid a second React runtime in the installed Radix
// dependency. Production sheets and their accessibility behavior are unchanged.
const SheetContext = createContext({
  open: false,
  onOpenChange: (_open: boolean) => {},
  titleId: "",
  descriptionId: "",
});

export function Sheet({ open, onOpenChange, children }: {
  open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode;
}) {
  const id = useId();
  return <SheetContext.Provider value={{ open, onOpenChange, titleId: `${id}-title`, descriptionId: `${id}-description` }}>
    {open ? children : null}
  </SheetContext.Provider>;
}

export function SheetContent({ children, className = "" }: {
  children: ReactNode; className?: string; side?: "bottom";
}) {
  const { open, onOpenChange, titleId, descriptionId } = useContext(SheetContext);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && ref.current && !ref.current.open) ref.current.showModal();
  }, [open]);
  return <dialog
    ref={ref}
    aria-labelledby={titleId}
    aria-describedby={descriptionId}
    onCancel={(event) => { event.preventDefault(); onOpenChange(false); }}
    onClick={(event) => { if (event.target === ref.current) {
      const rect = ref.current.getBoundingClientRect();
      if (event.clientY < rect.top) onOpenChange(false);
    } }}
    className={`profile-safety-dialog fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto border-0 p-6 shadow-lg ${className}`}
  >
    <button aria-label="Close" onClick={() => onOpenChange(false)} className="absolute right-4 top-4 inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-500"><X size={16} /></button>
    {children}
  </dialog>;
}

export function SheetTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { titleId } = useContext(SheetContext);
  return <h2 id={titleId} className={className}>{children}</h2>;
}

export function SheetDescription({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { descriptionId } = useContext(SheetContext);
  return <p id={descriptionId} className={className}>{children}</p>;
}
