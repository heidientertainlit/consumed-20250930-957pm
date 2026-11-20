import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  dismissMediaAdded,
  getMediaAddedNotice,
  getServerMediaAddedNotice,
  subscribeMediaAdded,
} from "@/lib/media-added-confirmation";
import "./media-added-confirmation.css";

export function MediaAddedConfirmation() {
  const notice = useSyncExternalStore(
    subscribeMediaAdded,
    getMediaAddedNotice,
    getServerMediaAddedNotice,
  );
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => dismissMediaAdded(notice.id), 2800);
    return () => window.clearTimeout(timer);
  }, [notice?.id]);

  if (typeof document === "undefined") return null;

  const destination = notice?.listName || "your media";
  const announcement = notice
    ? `${notice.count > 1 ? `${notice.count} items logged` : "Logged"} to ${destination}${notice.title ? `: ${notice.title}` : ""}`
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
            className="consumed-added-backdrop"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.22 }}
          />
        )}
        {notice && (
          <motion.div
            key={notice.id}
            data-testid="media-added-confirmation"
            aria-hidden="true"
            className="consumed-added-celebration"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.92, rotate: -2 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.42, ease: [0.2, 0.75, 0.25, 1] }}
          >
            <span className="consumed-added-orbit" />
            <span className="consumed-added-orbit consumed-added-orbit--inner" />
            <span className="consumed-added-kicker">A new thread in your story</span>
            <span className="consumed-added-headline">Logged<span className="consumed-added-period">!</span></span>
            <span className="consumed-added-detail">
              {notice.title && <span className="consumed-added-title">{notice.title}</span>}
              <span className="consumed-added-destination">
                {notice.count > 1 ? `${notice.count} items added to ${destination}` : `Added to ${destination}`}
              </span>
            </span>
            <span className="consumed-dna-progress" aria-hidden="true">
              <span className="consumed-dna-rail">
                <svg className="consumed-dna-strand" viewBox="0 0 240 30" preserveAspectRatio="none">
                  <path className="consumed-dna-line consumed-dna-line--a" d="M0 5 C30 5 30 25 60 25 S90 5 120 5 150 25 180 25 210 5 240 5" />
                  <path className="consumed-dna-line consumed-dna-line--b" d="M0 25 C30 25 30 5 60 5 S90 25 120 25 150 5 180 5 210 25 240 25" />
                  <path className="consumed-dna-rung" d="M18 8v14M48 8v14M78 8v14M108 8v14M138 8v14M168 8v14M198 8v14M228 8v14" />
                </svg>
                <span className="consumed-dna-sheen" />
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
