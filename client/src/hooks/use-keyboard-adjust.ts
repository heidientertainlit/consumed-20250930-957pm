import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Keyboard, KeyboardResize } from "@capacitor/keyboard";

export function useKeyboardAdjust() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const root = document.documentElement;

    // Set resize mode programmatically at runtime — this works with the
    // current iOS build without requiring a native rebuild.
    Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => {
      // Silently ignore if plugin unavailable
    });

    const showListener = Keyboard.addListener("keyboardWillShow", () => {
      root.dataset.nativeKeyboardOpen = "true";
    });
    const hideListener = Keyboard.addListener("keyboardDidHide", () => {
      root.removeAttribute("data-native-keyboard-open");
    });

    return () => {
      void showListener.then((listener) => listener.remove()).catch(() => {});
      void hideListener.then((listener) => listener.remove()).catch(() => {});
      root.removeAttribute("data-native-keyboard-open");
    };
  }, []);
}
