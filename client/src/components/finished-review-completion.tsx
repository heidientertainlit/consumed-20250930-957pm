import { useEffect, useRef, useSyncExternalStore } from "react";
import { playMediaAddedImpact } from "@/lib/media-added-haptics";
import { LoggingSmiley } from "./logging-smiley";
import "./finished-review-completion.css";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function getReducedMotion() {
  return typeof window === "undefined" || !window.matchMedia
    ? true
    : window.matchMedia(reducedMotionQuery).matches;
}

function subscribeReducedMotion(listener: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};

  const query = window.matchMedia(reducedMotionQuery);
  if (query.addEventListener) {
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }

  query.addListener(listener);
  return () => query.removeListener(listener);
}

function getSavedMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("review")) return "Review saved.";
  if (normalized.includes("rating")) return "Rating saved.";
  return "Changes saved.";
}

export function FinishedReviewCompletion({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => true,
  );
  const dismissed = useRef(false);
  const onDismissRef = useRef(onDismiss);
  const hapticDecisionMade = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    buttonRef.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => {
      if (dismissed.current) return;
      dismissed.current = true;
      onDismissRef.current();
    }, 1500);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (hapticDecisionMade.current) return;
    hapticDecisionMade.current = true;
    if (reduceMotion) return;

    const timer = window.setTimeout(() => {
      if (!getReducedMotion()) void playMediaAddedImpact();
    }, 190);

    return () => window.clearTimeout(timer);
  }, [reduceMotion]);

  function dismiss() {
    if (dismissed.current) return;
    dismissed.current = true;
    onDismissRef.current();
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`finished-review-completion${reduceMotion ? "" : " finished-review-completion--animated"}`}
      data-testid="finished-review-completion"
      aria-label={`Dismiss completion: That’s a wrap! ${getSavedMessage(message)}`}
      onClick={dismiss}
      onKeyDown={event => { if (event.key === "Escape") dismiss(); }}
    >
      <LoggingSmiley reduceMotion={reduceMotion} testId="finished-review-completion-face" />
      <span className="finished-review-completion__copy" role="status" aria-live="polite">
        <span className="finished-review-completion__title">That’s a wrap!</span>
        <span className="finished-review-completion__message">{getSavedMessage(message)}</span>
      </span>
    </button>
  );
}
