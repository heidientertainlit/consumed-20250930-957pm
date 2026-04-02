import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

export function useKeyboardAdjust() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const scrollFocusedIntoView = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return;
      const tag = el.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && el.contentEditable !== "true") return;

      setTimeout(() => {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 80);
    };

    const handleVisualViewportResize = () => {
      if (!window.visualViewport) return;

      const keyboardHeight =
        window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop;

      if (keyboardHeight > 0) {
        document.documentElement.style.setProperty(
          "--keyboard-height",
          `${keyboardHeight}px`
        );
        scrollFocusedIntoView();
      } else {
        document.documentElement.style.setProperty("--keyboard-height", "0px");
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleVisualViewportResize);
      window.visualViewport.addEventListener("scroll", handleVisualViewportResize);
    }

    document.addEventListener("focusin", scrollFocusedIntoView);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleVisualViewportResize);
        window.visualViewport.removeEventListener("scroll", handleVisualViewportResize);
      }
      document.removeEventListener("focusin", scrollFocusedIntoView);
    };
  }, []);
}
