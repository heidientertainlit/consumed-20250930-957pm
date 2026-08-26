import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Keyboard, KeyboardResize } from "@capacitor/keyboard";

export function useKeyboardAdjust() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const root = document.documentElement;
    let reportedKeyboardHeight = 0;
    let baselineViewportHeight = window.visualViewport?.height ?? window.innerHeight;

    // Set resize mode programmatically at runtime — this works with the
    // current iOS build without requiring a native rebuild.
    Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => {
      // Silently ignore if plugin unavailable
    });

    const updateKeyboardMetrics = () => {
      const viewport = window.visualViewport;
      const measuredVisibleHeight = viewport?.height ?? window.innerHeight;
      if (reportedKeyboardHeight === 0) {
        baselineViewportHeight = Math.max(
          baselineViewportHeight,
          measuredVisibleHeight,
          window.innerHeight,
        );
      }
      const reportedVisibleHeight = reportedKeyboardHeight > 0
        ? Math.max(0, baselineViewportHeight - reportedKeyboardHeight)
        : measuredVisibleHeight;
      const visibleHeight = reportedKeyboardHeight > 0
        ? Math.min(measuredVisibleHeight, reportedVisibleHeight)
        : measuredVisibleHeight;
      const keyboardHeight = Math.max(0, baselineViewportHeight - visibleHeight);
      const layoutAlreadyResized = window.innerHeight < baselineViewportHeight - 1;
      const bottomOffset = layoutAlreadyResized ? 0 : keyboardHeight;

      root.style.setProperty("--visible-viewport-height", `${visibleHeight}px`);
      root.style.setProperty("--keyboard-height", `${keyboardHeight}px`);
      root.style.setProperty("--keyboard-bottom-offset", `${bottomOffset}px`);

      if (keyboardHeight > 0 || reportedKeyboardHeight > 0) {
        root.dataset.nativeKeyboardOpen = "true";
        root.style.setProperty("--keyboard-sheet-top", "max(env(safe-area-inset-top, 0px), 8px)");
      } else {
        root.removeAttribute("data-native-keyboard-open");
        root.style.setProperty("--keyboard-sheet-top", "12%");
      }
    };

    const refreshMetricsDuringAnimation = () => {
      updateKeyboardMetrics();
      requestAnimationFrame(updateKeyboardMetrics);
      window.setTimeout(updateKeyboardMetrics, 120);
    };

    const showListener = Keyboard.addListener("keyboardWillShow", (info) => {
      baselineViewportHeight = Math.max(
        baselineViewportHeight,
        window.visualViewport?.height ?? window.innerHeight,
      );
      reportedKeyboardHeight = info.keyboardHeight;
      refreshMetricsDuringAnimation();
    });
    const hideListener = Keyboard.addListener("keyboardDidHide", () => {
      reportedKeyboardHeight = 0;
      baselineViewportHeight = Math.max(
        baselineViewportHeight,
        window.visualViewport?.height ?? 0,
        window.innerHeight,
      );
      refreshMetricsDuringAnimation();
    });

    updateKeyboardMetrics();

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateKeyboardMetrics);
      window.visualViewport.addEventListener("scroll", updateKeyboardMetrics);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateKeyboardMetrics);
        window.visualViewport.removeEventListener("scroll", updateKeyboardMetrics);
      }
      void showListener.then((listener) => listener.remove()).catch(() => {});
      void hideListener.then((listener) => listener.remove()).catch(() => {});
      root.removeAttribute("data-native-keyboard-open");
      root.style.removeProperty("--visible-viewport-height");
      root.style.removeProperty("--keyboard-height");
      root.style.removeProperty("--keyboard-bottom-offset");
      root.style.removeProperty("--keyboard-sheet-top");
    };
  }, []);
}
