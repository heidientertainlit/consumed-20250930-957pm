import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MediaAddedDna } from "./media-added-dna";
import { playMediaAddedImpact } from "@/lib/media-added-haptics";
import "./finished-review-confirmation.css";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const getReducedMotion = () => window.matchMedia(reducedMotionQuery).matches;
const getServerReducedMotion = () => true;

function subscribeReducedMotion(listener: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

const IMPACT_DELAY_MS = 190;

export function FinishedReviewConfirmation() {
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    getServerReducedMotion,
  );
  const [entranceStarted, setEntranceStarted] = useState(false);
  const initialized = useRef(false);
  const hapticHandled = useRef(false);

  // Decide once on initial mount. A later accessibility preference change
  // must not replay the entrance or cause a delayed haptic.
  useEffect(() => {
    if (reduceMotion) setEntranceStarted(false);
    if (initialized.current) return;
    initialized.current = true;
    if (!reduceMotion) setEntranceStarted(true);
  }, [reduceMotion]);

  useEffect(() => {
    if (!entranceStarted || hapticHandled.current) return;
    if (reduceMotion) {
      hapticHandled.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      hapticHandled.current = true;
      if (!getReducedMotion()) void playMediaAddedImpact();
    }, IMPACT_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [entranceStarted, reduceMotion]);

  return (
    <div
      className={`finished-review-confirmation${entranceStarted && !reduceMotion ? " finished-review-confirmation--enter" : ""}${reduceMotion ? " finished-review-confirmation--reduced-motion" : ""}`}
      data-testid="finished-review-confirmation"
    >
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        Consumed. Added to Finished.
      </span>
      <div className="finished-review-confirmation__message" aria-hidden="true">
        <span className="finished-review-confirmation__headline">
          Consumed
          <svg
            data-testid="inline-consumed-check"
            className="finished-review-confirmation__check"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m5 12 4 4L19 6" />
          </svg>
        </span>
        <span className="finished-review-confirmation__detail">Added to Finished</span>
      </div>
      <MediaAddedDna
        reduceMotion={reduceMotion}
        impactDelayMs={entranceStarted && !reduceMotion ? IMPACT_DELAY_MS : 0}
      />
    </div>
  );
}
