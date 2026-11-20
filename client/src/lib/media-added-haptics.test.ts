import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { ImpactStyle } from "@capacitor/haptics";
import { playMediaAddedImpact } from "./media-added-haptics";

test("browsers and older native builds never attempt a haptic", async () => {
  let calls = 0;
  const impact = async () => { calls++; };
  assert.equal(await playMediaAddedImpact({
    isNativePlatform: () => false, isPluginAvailable: () => true, impact,
  }), false);
  assert.equal(await playMediaAddedImpact({
    isNativePlatform: () => true, isPluginAvailable: () => false, impact,
  }), false);
  assert.equal(calls, 0);
});

test("supported native builds receive exactly one light impact", async () => {
  const calls: unknown[] = [];
  assert.equal(await playMediaAddedImpact({
    isNativePlatform: () => true,
    isPluginAvailable: (name) => name === "Haptics",
    impact: async (options) => { calls.push(options); },
  }), true);
  assert.deepEqual(calls, [{ style: ImpactStyle.Light }]);
});

test("haptic failures are reported without rejecting successful save feedback", async () => {
  const warning = mock.method(console, "warn", () => {});
  try {
    assert.equal(await playMediaAddedImpact({
      isNativePlatform: () => true, isPluginAvailable: () => true,
      impact: async () => { throw new Error("Device unavailable"); },
    }), false);
    assert.equal(warning.mock.callCount(), 1);
  } finally {
    warning.mock.restore();
  }
});
