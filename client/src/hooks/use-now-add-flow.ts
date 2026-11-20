import { useLayoutEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useHistoryState } from "wouter/use-browser-location";
import { getNowAddEntry, type NowAddEntry } from "@/lib/add-media-navigation";

export function useNowAddFlow() {
  const [location] = useLocation();
  const state = useHistoryState();
  const entry = getNowAddEntry(location, state);
  const previousEntry = useRef<NowAddEntry | null>(null);
  const returningEntry = useRef<string | null>(null);

  useLayoutEffect(() => {
    const previous = previousEntry.current;
    previousEntry.current = entry;
    returningEntry.current = null;
    if (previous && !entry && location === previous.returnTo) {
      window.scrollTo({ top: previous.scrollY, behavior: "instant" });
    }
  }, [location, entry?.entryId]);

  const navigateBack = () => {
    // An old save response must not pull someone back after they navigate away.
    const current = getNowAddEntry(window.location.pathname, window.history.state);
    if (entry && current?.entryId === entry.entryId && returningEntry.current !== entry.entryId) {
      returningEntry.current = entry.entryId;
      window.history.back();
    }
  };

  return {
    // Render the original feed route behind Add, preserving its component state,
    // loaded pages and scroll range. Direct Add navigation uses normal routing.
    routeLocation: entry?.returnTo ?? location,
    entry,
    returnToNow: navigateBack,
  };
}
