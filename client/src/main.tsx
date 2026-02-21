import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

import { initPostHog } from "./lib/posthog";

initPostHog();

// Register service worker for PWA — TEMPORARILY DISABLED FOR DEBUGGING
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
      console.log("SW unregistered");
    });
  });
}

// OneSignal — only on native (iOS / Android) via Capacitor
(async () => {
  try {
    const { Capacitor } = await import("@capacitor/core");
    const platform = Capacitor.getPlatform();
    if (platform === "ios" || platform === "android") {
      const { default: OneSignal } = await import("onesignal-cordova-plugin");
      OneSignal.initialize("f3e5ce59-cb78-4f05-8d7b-511c45dc2c76");
      OneSignal.Notifications.requestPermission(true);
    }
  } catch (_) {}
})();

createRoot(document.getElementById("root")!).render(<App />);
