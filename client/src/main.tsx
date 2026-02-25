import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

import { initPostHog } from "./lib/posthog";
import { Capacitor } from "@capacitor/core";

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

// OneSignal — only on native (iOS / Android), loaded dynamically so web builds aren't affected
if (
  Capacitor.getPlatform() === "ios" ||
  Capacitor.getPlatform() === "android"
) {
  import("onesignal-cordova-plugin").then((mod) => {
    const OneSignal = mod.default;
    OneSignal.initialize("f3e5ce59-cb78-4f05-8d7b-511c45dc2c76");

    OneSignal.Notifications.addEventListener("click", (event: any) => {
      const route = event?.notification?.additionalData?.route as string | undefined;
      if (route) {
        localStorage.setItem("pendingRoute", route);
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
  }).catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);