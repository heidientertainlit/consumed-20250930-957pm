import { useEffect, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth";
import {
  dismissFinishedReview, getFinishedReview, getServerMediaAddedNotice, subscribeMediaAdded, showMediaAdded,
} from "@/lib/media-added-confirmation";
import { QuickTrackSheet } from "./quick-track-sheet";
import { hasExistingFinishedReaction } from "@/lib/save-finished-review";
import { supabase } from "@/lib/supabase";

/** Stable authenticated host: returning from Add must not lose the saved title. */
export function FinishedMediaReview() {
  const request = useSyncExternalStore(subscribeMediaAdded, getFinishedReview, getServerMediaAddedNotice);
  const { session } = useAuth();
  const [eligibleId, setEligibleId] = useState<number | null>(null);
  useEffect(() => {
    if (!request || !session) return;
    if (session.user.id !== request.userId) {
      dismissFinishedReview(request.id);
      return;
    }
    let active = true;
    setEligibleId(null);
    const skipReview = () => {
      // Already-reviewed/uncheckable titles still get confirmation, but never
      // a second review. Settle the source-page return before showing feedback.
      dismissFinishedReview(request.id);
      showMediaAdded({ title: request.media.title, listName: "Finished" });
    };
    void (async () => {
      try {
        const alreadyReacted = await hasExistingFinishedReaction(request, supabase);
        if (!active) return;
        if (alreadyReacted) skipReview();
        else setEligibleId(request.id);
      } catch {
        if (!active) return;
        // The library save succeeded. Do not guess or re-prompt when the
        // optional read cannot establish whether they already reacted.
        console.warn("Skipped optional Finished review: existing reactions could not be checked.");
        skipReview();
      }
    })();
    return () => { active = false; };
  }, [request, session?.user?.id]);
  if (!request || session?.user?.id !== request.userId || eligibleId !== request.id) return null;
  return (
    <QuickTrackSheet
      key={request.id}
      isOpen
      initialMedia={request.media}
      finishedReview={request}
      onClose={() => dismissFinishedReview(request.id)}
    />
  );
}
