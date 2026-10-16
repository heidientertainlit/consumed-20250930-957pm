import { PENDING_SHARED_ROUTE, sharedRouteFromPath, sharedRouteFromUrl } from "./share-deep-link";
import { authNavigationIntent, createAuthNavigationIntent } from "./auth-navigation-intent";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** One coordinator per webview, shared by the early listener and mounted router. */
export function createNativeShareDelivery(storage: () => Store, currentOwner: () => string | null = () => null) {
  const navigation = createAuthNavigationIntent(storage);
  let receivedEvents = 0;
  let launchRequested = false;
  const subscribers = new Set<() => void>();
  const notify = () => subscribers.forEach((subscriber) => subscriber());

  return {
    // Kept in the shipped coordinator so packaging can identify this implementation.
    version: "native-share-delivery-v1",
    capture(url: string, userId: string | null = null) {
      const route = sharedRouteFromUrl(url);
      if (!route) return false;
      receivedEvents++;
      navigation.capture(route, userId ?? currentOwner());
      storage().setItem(PENDING_SHARED_ROUTE, route);
      notify();
      return true;
    },
    subscribe(listener: () => void) {
      subscribers.add(listener);
      return () => { subscribers.delete(listener); };
    },
    async recoverLaunchUrl(getLaunchUrl: () => Promise<{ url: string } | undefined>) {
      if (launchRequested) return;
      launchRequested = true;
      try {
        const launch = await getLaunchUrl();
        // Any delivered event is newer/more authoritative than the launch fallback.
        // Never replay the launch URL after it has already been consumed by an event.
        if (!receivedEvents && !storage().getItem(PENDING_SHARED_ROUTE)) {
          const route = launch?.url ? sharedRouteFromUrl(launch.url) : null;
          if (route) {
            navigation.capture(route, currentOwner());
            storage().setItem(PENDING_SHARED_ROUTE, route);
          }
        }
      } catch (error) {
        console.warn("[share-link] Cold-launch URL unavailable", error);
      }
      notify();
    },
    consume(ready: boolean, navigate: (route: string) => void, userId: string | null = null) {
      if (!ready) return;
      const raw = storage().getItem(PENDING_SHARED_ROUTE);
      const route = sharedRouteFromPath(raw);
      const intent = navigation.peek();
      if (!route || !intent || intent.path !== route || (intent.userId && intent.userId !== userId)) {
        if (raw) storage().removeItem(PENDING_SHARED_ROUTE);
        return;
      }
      if (intent.phase !== "navigation" || !navigation.takeNavigation(userId)) return;
      // Consume before navigation; a re-entrant delivery cannot replay this link.
      storage().removeItem(PENDING_SHARED_ROUTE);
      navigate(route);
    },
  };
}

export function sharedNavigationReady(
  storage: Store,
  location: string,
  loading: boolean,
  startupReady: boolean,
  signedIn = false,
) {
  const path = location.split(/[?#]/)[0];
  return startupReady && !loading
    && !["/onboarding", "/reset-password", "/auth/callback"].includes(path)
    && !(path === "/login" && signedIn)
    && !storage.getItem("pendingOAuthSession")
    && !storage.getItem("pendingRecovery")
    && !storage.getItem("pendingRoute");
}

export const nativeShareDelivery = createNativeShareDelivery(() => window.localStorage, authNavigationIntent.currentOwner);
