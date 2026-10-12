export type QuickTrackPosition = {
  top: string;
  maxHeight: string;
};

/**
 * Capture this before mounting the autofocus input, once per opening.
 * Native keyboard resize must not recompute the sheet's top on each frame.
 * Browser and Android positioning deliberately retain their existing CSS.
 */
export function getQuickTrackPosition(
  platform: string,
  openingViewportHeight: number,
): QuickTrackPosition {
  if (platform !== "ios") return { top: "12%", maxHeight: "82vh" };

  const top = `${Math.round(openingViewportHeight * 0.12)}px`;
  return {
    top,
    // CSS follows the native resized container; no keyboard/viewport listeners.
    // Only the available content height changes, not the opening anchor.
    maxHeight: `min(82vh, calc(100% - ${top} - max(16px, env(safe-area-inset-bottom, 0px))))`,
  };
}
