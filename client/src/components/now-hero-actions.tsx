import { useState } from "react";
import { useLocation } from "wouter";
import { Plus, MessageSquare } from "lucide-react";
import FeedComposerBar from "@/components/feed-composer-bar";
import { createNowAddState } from "@/lib/add-media-navigation";

export function HeroCTAButtons() {
  const [composerOpen, setComposerOpen] = useState(false);
  const [location, setLocation] = useLocation();

  return (
    <>
      <div className="mx-2 grid grid-cols-2 gap-3">
        <button
          onClick={() => setLocation("/add", {
            state: createNowAddState(location, window.scrollY, crypto.randomUUID()),
          })}
          className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#7c3aed_0%,#4f46e5_55%,#2563eb_100%)] px-4 py-2 text-sm font-bold text-white shadow-[0_7px_20px_rgba(50,42,180,.38)] transition active:scale-[.98] active:brightness-95"
        >
          <Plus size={16} strokeWidth={2} />
          Add media
        </button>
        <button
          onClick={() => setComposerOpen(true)}
          className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-[0_5px_16px_rgba(12,6,25,.16)] backdrop-blur-sm transition active:scale-[.98] active:bg-white/15"
        >
          <MessageSquare size={15} strokeWidth={2} />
          Share a take
        </button>
      </div>
      {composerOpen && <FeedComposerBar startExpanded onExternalClose={() => setComposerOpen(false)} />}
    </>
  );
}
