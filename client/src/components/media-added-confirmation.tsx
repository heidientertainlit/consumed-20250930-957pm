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

    const timer = window.setTimeout(() => dismissMediaAdded(notice.id), 2500);
    return () => window.clearTimeout(timer);
  }, [notice?.id]);

  if (typeof document === "undefined") return null;

  const label = notice
    ? notice.count > 1
      ? `${notice.count} items added${notice.listName ? ` to ${notice.listName}` : ""}`
      : `Added to ${notice.listName || "your media"}`
    : "";

  return createPortal(
    <div className="consumed-added-layer" aria-live="polite" aria-atomic="true" role="status">
      <span className="sr-only">{label}{notice?.title ? `: ${notice.title}` : ""}</span>
      <AnimatePresence initial={false}>
        {notice && (
          <motion.div
            key={notice.id}
            data-testid="media-added-confirmation"
            aria-hidden="true"
            className="consumed-added-toast"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.3, ease: [0.2, 0.75, 0.25, 1] }}
          >
            <span className="consumed-added-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path className="consumed-added-check" d="m6.5 12.2 3.6 3.5 7.5-7.4" />
              </svg>
            </span>
            <span className="consumed-added-copy">
              <span className="consumed-added-label">{label}</span>
              {notice.title && <span className="consumed-added-title">{notice.title}</span>}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
