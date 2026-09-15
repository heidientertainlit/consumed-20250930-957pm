import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

import { initPostHog } from "./lib/posthog";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { markRecoveryAuthFlow } from "./lib/auth-flow";
import {
  clearMatchingOAuthTermsConsentAttempt,
  hasMatchingOAuthTermsConsentAttempt,
  noteNativeOAuthCallbackReceived,
  notifyNativeOAuthBrowserOutcome,
} from "./lib/legal-terms-consent";
import { parseNativeAuthCallback } from "./lib/native-oauth";

// Replit's public development proxy does not accept an explicit :5000 port.
// Normalize stale preview URLs before the SPA adds them to navigation history.
if (
  !Capacitor.isNativePlatform() &&
  window.location.hostname.endsWith(".replit.dev") &&
  window.location.port === "5000"
) {
  const canonicalUrl = `${window.location.protocol}//${window.location.hostname}${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(canonicalUrl);
}

initPostHog();

// Register the appUrlOpen listener HERE — before React renders — so we never
// miss the event when the app cold-starts from a Universal Link.
// The CapacitorDeepLinkHandler component in App.tsx handles the "app already
// running in background" case. This covers the cold-start case.
if (Capacitor.isNativePlatform()) {
  console.log("[RESET-DEBUG] main.tsx: isNativePlatform = true, registering appUrlOpen listener");
  CapApp.addListener("appUrlOpen", ({ url }) => {
    console.log("[AUTH-DEBUG] appUrlOpen fired");
    const appUrl = (import.meta.env.VITE_APP_URL || "https://app.consumedapp.com").replace(/\/$/, "");
    const callback = parseNativeAuthCallback(
      url,
      appUrl,
      hasMatchingOAuthTermsConsentAttempt,
    );
    if (!callback) {
      console.log("[RESET-DEBUG] Invalid native auth callback, ignoring");
      return;
    }
    if (callback.kind === "oauth-error") {
      clearMatchingOAuthTermsConsentAttempt(callback.attemptId);
      notifyNativeOAuthBrowserOutcome("Sign-in was denied. Please try again.");
      void Browser.close().catch(() => {});
      return;
    }

    noteNativeOAuthCallbackReceived(
      callback.kind === "oauth-session" ? callback.attemptId : null,
    );
    void Browser.close().catch(() => {
      // The native browser may already be closed; the verified callback is
      // still safe to complete through the existing session handoff.
    });
    if (callback.kind === "recovery-session") {
        // This must happen before ResetPasswordPage calls setSession(). On a
        // native cold start there is no /reset-password route yet.
        markRecoveryAuthFlow();
        // Recovery callbacks never own a pre-auth OAuth consent attempt.
    }
    const isRecovery = callback.kind === "recovery-session";
    const storageKey = isRecovery ? "pendingRecovery" : "pendingOAuthSession";
    const pendingRoute = isRecovery ? "/reset-password" : "/activity";
    localStorage.setItem(storageKey, JSON.stringify({
      accessToken: callback.accessToken,
      refreshToken: callback.refreshToken,
      ...(callback.kind === "oauth-session" ? { attemptId: callback.attemptId } : {}),
    }));
    localStorage.setItem("pendingRoute", pendingRoute);
    console.log("[AUTH-DEBUG] Stored pending auth callback for app startup");
  });
} else {
  console.log("[RESET-DEBUG] main.tsx: not native platform, skipping appUrlOpen registration");
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