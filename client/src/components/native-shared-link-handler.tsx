import { useEffect } from "react";
import { useLocation } from "wouter";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { useAuth } from "@/lib/auth";
import { nativeShareDelivery, sharedNavigationReady } from "@/lib/native-share-delivery";

export function NativeSharedLinkHandler({ startupReady }: { startupReady: boolean }) {
  const [location, setLocation] = useLocation();
  const { loading, user } = useAuth();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const consume = () => nativeShareDelivery.consume(
      sharedNavigationReady(localStorage, location, loading, startupReady, !!user),
      setLocation,
      user?.id ?? null,
    );
    const unsubscribe = nativeShareDelivery.subscribe(consume);
    consume();
    void nativeShareDelivery.recoverLaunchUrl(() => CapApp.getLaunchUrl());
    return unsubscribe;
    // Re-evaluate deferred delivery after auth loading, startup routing, or
    // an identity/recovery page completes. Never bypass those existing gates.
  }, [location, setLocation, loading, startupReady, user]);
  return null;
}
