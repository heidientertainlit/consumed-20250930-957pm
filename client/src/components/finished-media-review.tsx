import { useEffect, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth";
import {
  dismissFinishedReview, getFinishedReview, getServerMediaAddedNotice, subscribeMediaAdded,
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
    void (async () => {
      try {
        const alreadyReacted = await hasExistingFinishedReaction(request, supabase);
        if (!active) return;
        if (alreadyReacted) dismissFinishedReview(request.id);
        else setEligibleId(request.id);
      } catch {
        if (!active) return;
        // The library save succeeded. Do not guess or re-prompt when the
        // optional read cannot establish whether they already reacted.
        console.warn("Skipped optional Finished review: existing reactions could not be checked.");
        dismissFinishedReview(request.id);
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
