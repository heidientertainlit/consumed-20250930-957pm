import { Capacitor } from "@capacitor/core";

/** Destination bookkeeping only. Authentication and permissions remain elsewhere. */
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const KEY = "consumed_auth_navigation_intent";
const MAX_AGE = 30 * 60 * 1000;
const WEB_OAUTH_MAX_AGE = 10 * 60 * 1000;
const INVALIDATION_KEY = "consumed_navigation_invalidation";
export const NAVIGATION_ATTEMPT_PARAM = "navigation_intent";
export type WebOAuthReturn = "none" | "response" | "error" | "recovery";
/** Capture presence only, before the existing SDK consumes callback fields. */
export function classifyWebOAuthReturn(location: string): WebOAuthReturn {
  try {
    const url = new URL(location);
    if (url.pathname !== "/login") return "none";
    const hash = new URLSearchParams(url.hash.slice(1));
    if (hash.get("type") === "recovery" || url.searchParams.get("type") === "recovery") return "recovery";
    if ([hash, url.searchParams].some(params => params.has("error") || params.has("error_description"))) return "error";
    // Email action links are not OAuth continuation.
    if (hash.has("type") || url.searchParams.has("type")) return "none";
    return hash.has("access_token") && hash.has("refresh_token") ? "response" : "none";
  } catch { return "none"; }
}
const initialWebOAuthReturn = typeof window !== "undefined" && !Capacitor.isNativePlatform()
  ? classifyWebOAuthReturn(window.location.href) : "none";
type Intent = {
  id: string;
  path: string;
  createdAt: number;
  phase: "navigation" | "auth" | "authenticated";
  userId: string | null;
  callbackId?: string;
  webOAuthStartedAt?: number;
  webOAuthRevision?: string;
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

export function createAuthNavigationIntent(
  storage: () => Store,
  now = Date.now,
  randomId = () => crypto.randomUUID(),
  web: { callback?: WebOAuthReturn; revisionStorage?: () => Store; enabled?: boolean } = {},
) {
  let activeAttempt: string | null = null;
  let currentOwner: string | null = null;
  let webReturnAllowed = false;
  const revisionStorage = web.revisionStorage || storage;
  const revision = (create = false): string | null => {
    try {
      let value = revisionStorage().getItem(INVALIDATION_KEY);
      if (!value && create) {
        value = randomId();
        revisionStorage().setItem(INVALIDATION_KEY, value);
      }
      return value;
    } catch { return null; }
  };
  const read = (): Intent | null => {
    try {
      const raw = storage().getItem(KEY);
      if (!raw) return null;
      const value = JSON.parse(raw);
      if (typeof value.id !== "string" || !validInternalDestination(value.path)
        || !Number.isFinite(value.createdAt) || now() < value.createdAt || now() - value.createdAt >= MAX_AGE
        || !["navigation", "auth", "authenticated"].includes(value.phase)
        || !(value.userId === null || typeof value.userId === "string")
        || (value.webOAuthStartedAt !== undefined && (
          !Number.isFinite(value.webOAuthStartedAt) || now() < value.webOAuthStartedAt
          || now() - value.webOAuthStartedAt >= WEB_OAUTH_MAX_AGE
          || typeof value.webOAuthRevision !== "string" || value.webOAuthRevision !== revision()
        ))) {
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
    webReturnAllowed = false;
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
    invalidateAccountBoundary() {
      if (web.enabled !== false) {
        try { revisionStorage().setItem(INVALIDATION_KEY, randomId()); } catch { /* Local cleanup still applies. */ }
      }
      clear();
    },
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
    beginWebOAuth(loginLocation: string) {
      const id = this.begin(loginLocation);
      const intent = read();
      const currentRevision = revision(true);
      if (!id || !intent || !currentRevision) {
        clear();
        return null;
      }
      save({ ...intent, webOAuthStartedAt: now(), webOAuthRevision: currentRevision });
      return id;
    },
    /** Ordinary session restoration must never authorize a pending web return. */
    prepareWebOAuthReturn() {
      const intent = read();
      if (intent?.webOAuthStartedAt === undefined) return false;
      if (intent.phase !== "auth" || web.callback !== "response") {
        clear();
        return false;
      }
      return true;
    },
    finishWebOAuthReturn(sdkSucceeded: boolean) {
      const intent = read();
      webReturnAllowed = sdkSucceeded && web.callback === "response"
        && intent?.phase === "auth" && intent.webOAuthStartedAt !== undefined;
      if (!webReturnAllowed) clear();
    },
    verifyNativeCallback(callbackId: string | null) {
      const intent = read();
      if (intent?.phase === "auth" && callbackId && intent.callbackId === callbackId) activeAttempt = intent.id;
    },
    observeAccount(userId: string | null, previousUserId: string | null, loginLocation: string) {
      currentOwner = userId;
      const intent = read();
      if (previousUserId && previousUserId !== userId) {
        this.invalidateAccountBoundary();
        return;
      }
      if (intent?.userId && intent.userId !== userId) {
        clear();
        return;
      }
      if (!userId) return;
      if (intent?.phase === "navigation" && !intent.userId) save({ ...intent, userId });
      if (intent?.phase === "auth") {
        const correlated = intent.webOAuthStartedAt !== undefined
          ? webReturnAllowed
          : activeAttempt === intent.id || idFromLogin(loginLocation) === intent.id;
        if (correlated) {
          save({ ...intent, phase: "authenticated", userId });
        } else {
          clear();
        }
      }
      if (intent?.phase === "authenticated" && !previousUserId
        && !webReturnAllowed && activeAttempt !== intent.id && idFromLogin(loginLocation) !== intent.id) clear();
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
  Date.now, () => crypto.randomUUID(),
  { callback: initialWebOAuthReturn, revisionStorage: () => window.localStorage, enabled: !Capacitor.isNativePlatform() },
);
