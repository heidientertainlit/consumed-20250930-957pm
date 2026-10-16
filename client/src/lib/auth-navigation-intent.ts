import { Capacitor } from "@capacitor/core";

/** Destination bookkeeping only. Authentication and permissions remain elsewhere. */
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const KEY = "consumed_auth_navigation_intent";
const MAX_AGE = 30 * 60 * 1000;
export const NAVIGATION_ATTEMPT_PARAM = "navigation_intent";
type Intent = {
  id: string;
  path: string;
  createdAt: number;
  phase: "navigation" | "auth" | "authenticated";
  userId: string | null;
  callbackId?: string;
};

export function validInternalDestination(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || /[\\\s\x00-\x1f]/.test(value) || value.startsWith("//")) return null;
  try {
    const url = new URL(value, "https://navigation.invalid");
    const path = decodeURIComponent(url.pathname);
    if (url.origin !== "https://navigation.invalid" || path.startsWith("//") || path.includes("\\")
      || /^\/(?:login|auth|reset-password)(?:\/|$)/.test(path)) return null;
    if ([...url.searchParams.keys()].some(key => /token|secret|password|oauth|^code$|^navigation_intent$/i.test(key))) return null;
    if (/access_token|refresh_token|id_token|password|oauth/i.test(url.hash)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return null; }
}

export function createAuthNavigationIntent(storage: () => Store, now = Date.now, randomId = () => crypto.randomUUID()) {
  let activeAttempt: string | null = null;
  let currentOwner: string | null = null;
  const read = (): Intent | null => {
    try {
      const raw = storage().getItem(KEY);
      if (!raw) return null;
      const value = JSON.parse(raw);
      if (typeof value.id !== "string" || !validInternalDestination(value.path)
        || !Number.isFinite(value.createdAt) || now() < value.createdAt || now() - value.createdAt >= MAX_AGE
        || !["navigation", "auth", "authenticated"].includes(value.phase)
        || !(value.userId === null || typeof value.userId === "string")) {
        storage().removeItem(KEY);
        return null;
      }
      return value;
    } catch { return null; }
  };
  const save = (value: Intent) => {
    try { storage().setItem(KEY, JSON.stringify(value)); } catch { /* No stored intent means NOW, not an access failure. */ }
  };
  const clear = () => {
    activeAttempt = null;
    try {
      storage().removeItem(KEY);
      storage().removeItem("returnUrl");
      storage().removeItem("identityReturnUrl");
      storage().removeItem("pendingSharedRoute");
      storage().removeItem("pendingRoute");
    } catch { /* Storage can be disabled. */ }
  };
  const idFromLogin = (location: string) => {
    try { return new URL(location, "https://navigation.invalid").searchParams.get(NAVIGATION_ATTEMPT_PARAM); }
    catch { return null; }
  };
  return {
    clear,
    peek: read,
    currentOwner: () => currentOwner,
    discardAuthentication() {
      activeAttempt = null;
      // Recovery still has priority, but must not erase a separate queued share.
      if (read()?.phase !== "navigation") clear();
    },
    capture(path: string, userId: string | null = null) {
      const destination = validInternalDestination(path);
      if (!destination) return null;
      const intent: Intent = { id: randomId(), path: destination, createdAt: now(), phase: "navigation", userId };
      save(intent);
      return intent.id;
    },
    login(path: string) {
      const id = this.capture(path);
      return id ? `/login?${NAVIGATION_ATTEMPT_PARAM}=${encodeURIComponent(id)}` : "/login";
    },
    begin(loginLocation: string, callbackId?: string) {
      const intent = read();
      if (!intent || intent.id !== idFromLogin(loginLocation) || intent.phase !== "navigation") {
        clear();
        return null;
      }
      activeAttempt = intent.id;
      save({ ...intent, phase: "auth", callbackId });
      return intent.id;
    },
    verifyNativeCallback(callbackId: string | null) {
      const intent = read();
      if (intent?.phase === "auth" && callbackId && intent.callbackId === callbackId) activeAttempt = intent.id;
    },
    observeAccount(userId: string | null, previousUserId: string | null, loginLocation: string) {
      currentOwner = userId;
      const intent = read();
      if ((!userId && previousUserId) || (previousUserId && previousUserId !== userId) || (intent?.userId && intent.userId !== userId)) {
        clear();
        return;
      }
      if (!userId) return;
      if (intent?.phase === "navigation" && !intent.userId) save({ ...intent, userId });
      if (intent?.phase === "auth") {
        if (activeAttempt === intent.id || idFromLogin(loginLocation) === intent.id) {
          save({ ...intent, phase: "authenticated", userId });
        } else {
          clear();
        }
      }
      if (intent?.phase === "authenticated" && !previousUserId
        && activeAttempt !== intent.id && idFromLogin(loginLocation) !== intent.id) clear();
    },
    /** Used only by an actual native-link delivery, not by ordinary login. */
    takeNavigation(userId: string | null) {
      const intent = read();
      if (!intent || intent.phase !== "navigation" || (intent.userId && intent.userId !== userId)) return null;
      storage().removeItem(KEY);
      return intent.path;
    },
    takeAfterLogin(userId: string) {
      const intent = read();
      const currentNativeLink = intent?.phase === "navigation"
        && (!intent.userId || intent.userId === userId)
        && (storage().getItem("pendingSharedRoute") === intent.path || storage().getItem("pendingRoute") === intent.path);
      clear();
      return intent && ((intent.phase === "authenticated" && intent.userId === userId) || currentNativeLink) ? intent.path : null;
    },
    hasAuthenticatedDestination(userId: string) {
      const intent = read();
      return intent?.phase === "authenticated" && intent.userId === userId;
    },
  };
}

// Web OAuth returns to the same tab. Native needs persistence across a cold start.
// Do not share a browser tab's login destination with other tabs.
export const authNavigationIntent = createAuthNavigationIntent(
  () => Capacitor.isNativePlatform() ? window.localStorage : window.sessionStorage,
);
