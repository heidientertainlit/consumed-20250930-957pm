import { useState, useCallback, createContext, useContext } from "react";
import { useLocation } from "wouter";
import { Dna, X } from "lucide-react";

/**
 * Guest signup gate — reusable across guest-accessible pages.
 *
 * Wrap guest-visible content in <GuestGate>. Any click on an interactive
 * element (button, link, input) inside the wrapper is intercepted and the
 * signup sheet is shown instead. Elements marked with data-guest-allowed
 * (or inside such an element) are let through.
 *
 * The current path is saved as returnUrl so after signup/login the user
 * lands right back where they were.
 */

const GuestGateContext = createContext<{ openSheet: () => void } | null>(null);

export function useGuestGate() {
  return useContext(GuestGateContext);
}

export function GuestSignupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, setLocation] = useLocation();

  const go = (tab: 'signup' | 'signin') => {
    const fullPath = window.location.pathname + window.location.search + window.location.hash;
    sessionStorage.setItem('returnUrl', fullPath === '/login' ? '/' : fullPath);
    onClose();
    setLocation(tab === 'signup' ? '/login?tab=signup' : '/login');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-end justify-center" data-testid="guest-signup-sheet">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-auto bg-white border-t border-gray-200 rounded-t-3xl p-6 pb-10 shadow-[0_-16px_48px_rgba(15,23,42,.18)] animate-in slide-in-from-bottom duration-300">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 p-1"
          data-testid="button-close-guest-sheet"
          aria-label="Close"
        >
          <X size={20} />
        </button>
        <div className="mb-1.5 flex items-center gap-3 pr-10">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7c3aed_0%,#4f46e5_55%,#2563eb_100%)] shadow-[0_5px_16px_rgba(79,70,229,.28)]">
            <Dna size={22} strokeWidth={2.25} className="text-white" />
          </div>
          <h2 className="text-gray-950 text-xl font-bold leading-tight">Join the conversation</h2>
        </div>
        <p className="ml-14 max-w-[18rem] text-gray-600 text-sm mb-6 leading-relaxed">
          Create a free account to react, comment, play trivia, and build your Entertainment DNA.
        </p>
        <button
          onClick={() => go('signup')}
          className="w-full bg-[linear-gradient(135deg,#7c3aed_0%,#4f46e5_55%,#2563eb_100%)] text-white font-bold rounded-full py-3.5 text-sm mb-3 shadow-[0_7px_20px_rgba(50,42,180,.38)] transition active:scale-[.98] active:brightness-95"
          data-testid="button-guest-signup"
        >
          Create free account
        </button>
        <button
          onClick={() => go('signin')}
          className="w-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-full py-3.5 text-sm transition-colors"
          data-testid="button-guest-login"
        >
          I already have an account
        </button>
      </div>
    </div>
  );
}

export function GuestGate({ children, enabled = true }: { children: React.ReactNode; enabled?: boolean }) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleClickCapture = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Explicitly allowed elements pass through (e.g. spoiler reveal, expanders)
    if (target.closest('[data-guest-allowed]')) return;
    const interactive = target.closest('button, a[href], input, textarea, select, [role="button"]');
    if (interactive) {
      e.preventDefault();
      e.stopPropagation();
      setSheetOpen(true);
    }
  }, []);

  const openSheet = useCallback(() => setSheetOpen(true), []);

  if (!enabled) return <>{children}</>;

  return (
    <GuestGateContext.Provider value={{ openSheet }}>
      <div onClickCapture={handleClickCapture}>
        {children}
      </div>
      <GuestSignupSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </GuestGateContext.Provider>
  );
}
