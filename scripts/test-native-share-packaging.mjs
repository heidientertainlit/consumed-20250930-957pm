import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { verifyNativeShareBundle, verifyNativeShareWiring } from "./lib/verify-native-share-bundle.mjs";

const source = {
  main: await readFile(new URL("../client/src/main.tsx", import.meta.url), "utf8"),
  app: await readFile(new URL("../client/src/App.tsx", import.meta.url), "utf8"),
  handler: await readFile(new URL("../client/src/components/native-shared-link-handler.tsx", import.meta.url), "utf8"),
};
test("current startup wiring connects the tested early listener and mounted delivery", () => {
  verifyNativeShareWiring(source);
});
test("missing early capture or mounted handler fails packaging", () => {
  assert.throws(() => verifyNativeShareWiring({ ...source, main: "" }));
  assert.throws(() => verifyNativeShareWiring({ ...source, app: "" }));
  assert.throws(() => verifyNativeShareWiring({ ...source, handler: "" }));
});
test("old or incomplete bundles cannot pass the shared-link packaging gate", () => {
  const markers = ["native-share-delivery-v1", "pendingSharedRoute", "getLaunchUrl"];
  verifyNativeShareBundle(markers.join(" "));
  for (const missing of markers) {
    assert.throws(() => verifyNativeShareBundle(markers.filter(x => x !== missing).join(" ")));
  }
});
