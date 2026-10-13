import assert from "node:assert/strict";

export function verifyNativeShareBundle(bundle) {
  for (const marker of ["native-share-delivery-v1", "pendingSharedRoute", "getLaunchUrl"]) {
    assert.ok(bundle.includes(marker), `Missing native share delivery marker: ${marker}`);
  }
}

export function verifyNativeShareWiring({ main, app, handler }) {
  assert.match(main, /nativeShareDelivery\.capture\(url\)/, "Early listener must capture media links");
  assert.match(app, /<PendingRouteHandler onReady=\{setStartupReady\}/);
  assert.match(app, /<NativeSharedLinkHandler startupReady=\{startupReady\}/);
  assert.ok(app.indexOf("<NativeSharedLinkHandler") < app.indexOf("<TermsAcceptanceGate>"),
    "Link handling must remain outside the consent gate");
  assert.match(handler, /nativeShareDelivery\.subscribe\(consume\)/);
  assert.match(handler, /nativeShareDelivery\.recoverLaunchUrl\(\(\) => CapApp\.getLaunchUrl\(\)\)/);
  assert.match(handler, /sharedNavigationReady\(localStorage, location, loading, startupReady, !!user\)/);
}
