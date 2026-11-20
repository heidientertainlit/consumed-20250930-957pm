import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  dismissMediaAdded,
  getMediaAddedNotice,
  getServerMediaAddedNotice,
  subscribeMediaAdded,
} from "@/lib/media-added-confirmation";
import "./media-added-confirmation.css";
import { playMediaAddedImpact } from "@/lib/media-added-haptics";

export const MEDIA_ADDED_IMPACT_MS = 190;

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const getReducedMotion = () => window.matchMedia(reducedMotionQuery).matches;
const getServerReducedMotion = () => true;
function subscribeReducedMotion(listener: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

export function MediaAddedConfirmation() {
  const notice = useSyncExternalStore(
    subscribeMediaAdded,
    getMediaAddedNotice,
    getServerMediaAddedNotice,
  );
  // The animation library snapshots this preference at mount; this global
  // component must also respond when the OS setting changes while it is open.
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion, getReducedMotion, getServerReducedMotion,
  );
  const isFinished = notice?.listName?.toLowerCase() === "finished";
  const displayDuration = isFinished ? 2300 : 1400;

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => dismissMediaAdded(notice.id), displayDuration);
    return () => window.clearTimeout(timer);
  }, [notice?.id, displayDuration]);

  useEffect(() => {
    if (!notice || reduceMotion) return;
    const timer = window.setTimeout(() => {
      if (!getReducedMotion() && getMediaAddedNotice()?.id === notice.id) void playMediaAddedImpact();
    }, MEDIA_ADDED_IMPACT_MS);
    return () => window.clearTimeout(timer);
  }, [notice?.id, reduceMotion]);

  if (typeof document === "undefined") return null;

  const destination = notice?.listName || "your media";
  const action = isFinished ? "Consumed" : "Logged";
  const announcement = notice
    ? `${notice.count > 1 ? `${notice.count} items ${action.toLowerCase()}` : action}${isFinished ? "" : ` to ${destination}`}${notice.title ? `: ${notice.title}` : ""}`
    : "";

  return createPortal(
    <div className="consumed-added-layer">
      <span className="sr-only" aria-live="polite" aria-atomic="true" role="status">
        {announcement}
      </span>
      <AnimatePresence initial={false}>
        {notice && (
          <motion.div
            key="media-added-backdrop"
            data-testid="media-added-backdrop"
            className={`consumed-added-backdrop${isFinished ? "" : " consumed-added-backdrop--logged"}`}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.22 }}
          />
        )}
        {notice && (
          <motion.div
            key={notice.id}
            data-testid="media-added-confirmation"
            aria-hidden="true"
            className="consumed-added-celebration"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -5 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.2, 0.75, 0.25, 1] }}
          >
            <motion.span
              className={`consumed-added-headline${isFinished ? " consumed-added-headline--finished" : ""}`}
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 22, scaleX: 0.72, scaleY: 0.72, rotate: -5 }}
              animate={reduceMotion
                ? { opacity: 1 }
                : {
                    opacity: [0, 1, 1, 1, 1],
                    y: [22, 0, 0, -3, 0],
                    scaleX: [0.72, 1.04, 1.09, 0.98, 1],
                    scaleY: [0.72, 1.06, 0.88, 1.04, 1],
                    rotate: [-5, 1, 0, -0.5, 0],
                  }}
              transition={reduceMotion
                ? { duration: 0 }
                : { duration: 0.46, times: [0, 0.33, MEDIA_ADDED_IMPACT_MS / 460, 0.66, 1], ease: "easeOut" }}
            >
              {isFinished ? (
                <>
                  Consumed
                  <svg
                    data-testid="media-added-finished-check"
                    className="consumed-added-finished-check"
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
                </>
              ) : <>Logged<span className="consumed-added-period">!</span></>}
            </motion.span>
            <span className="consumed-added-detail">
              {notice.title && <span className="consumed-added-title">{notice.title}</span>}
              <span className="consumed-added-destination">
                {notice.count > 1 ? `${notice.count} items added to ${destination}` : `Added to ${destination}`}
              </span>
            </span>
            <span className="consumed-dna-progress" aria-hidden="true">
              <span
                className="consumed-dna-rail"
                style={{ animationDelay: `${MEDIA_ADDED_IMPACT_MS}ms` }}
              >
                <svg className="consumed-dna-strand" viewBox="0 0 240 30" preserveAspectRatio="none">
                  <path className="consumed-dna-line consumed-dna-line--a" d="M0 5 C30 5 30 25 60 25 S90 5 120 5 150 25 180 25 210 5 240 5" />
                  <path className="consumed-dna-line consumed-dna-line--b" d="M0 25 C30 25 30 5 60 5 S90 25 120 25 150 5 180 5 210 25 240 25" />
                  <path className="consumed-dna-rung" d="M18 8v14M48 8v14M78 8v14M108 8v14M138 8v14M168 8v14M198 8v14M228 8v14" />
                </svg>
                <span className="consumed-dna-pulse" style={{ animationDelay: `${MEDIA_ADDED_IMPACT_MS}ms` }} />
              </span>
              <span className="consumed-dna-caption">Entertainment DNA</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
