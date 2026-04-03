import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

import { initPostHog } from "./lib/posthog";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";

initPostHog();

// Register the appUrlOpen listener HERE — before React renders — so we never
// miss the event when the app cold-starts from a Universal Link.
// The CapacitorDeepLinkHandler component in App.tsx handles the "app already
// running in background" case. This covers the cold-start case.
if (Capacitor.isNativePlatform()) {
  CapApp.addListener("appUrlOpen", ({ url }) => {
    const hashIndex = url.indexOf("#");
    if (hashIndex === -1) return;

    const hash = url.substring(hashIndex + 1);
    const params = new URLSearchParams(hash);
    const type = params.get("type");
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (type === "recovery" && accessToken && refreshToken) {
      // Stash tokens so reset-password.tsx can pick them up on mount,
      // even if this event fired before the component existed.
      localStorage.setItem(
        "pendingRecovery",
        JSON.stringify({ accessToken, refreshToken })
      );
      // Also signal the router to navigate there (same pattern as push notifications)
      localStorage.setItem("pendingRoute", "/reset-password");
    }
  });
}

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