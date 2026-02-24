import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

import { initPostHog } from "./lib/posthog";
import { Capacitor } from "@capacitor/core";
import OneSignal from "onesignal-cordova-plugin";

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

// OneSignal — only on native (iOS / Android)
if (
  Capacitor.getPlatform() === "ios" ||
  Capacitor.getPlatform() === "android"
) {
  OneSignal.initialize("f3e5ce59-cb78-4f05-8d7b-511c45dc2c76");
  // permission prompt happens after login in auth.tsx

  // ✅ Open pushes in-app using Additional Data: { route: "/path" }
  OneSignal.Notifications.addEventListener("click", (event) => {
    const route = event?.notification?.additionalData?.route as
      | string
      | undefined;

    if (route) {
      // Save route so App.tsx can handle it after router mounts
      localStorage.setItem("pendingRoute", route);

      // Try immediate in-app navigation (no full reload)
      setTimeout(() => {
        if (window.location.hash.startsWith("#")) {
          const path = route.startsWith("/") ? route : `/${route}`;
          window.location.hash = `#${path}`;
        } else {
          window.history.pushState({}, "", route);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }
      }, 300);
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);