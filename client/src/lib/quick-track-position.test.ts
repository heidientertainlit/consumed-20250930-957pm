import assert from "node:assert/strict";
import test from "node:test";
import { getQuickTrackPosition } from "./quick-track-position";

test("browser and Android preserve the exact existing Track position", () => {
  for (const platform of ["web", "android"]) {
    for (const height of [960, 620, 375]) {
      assert.deepEqual(getQuickTrackPosition(platform, height), {
        top: "12%",
        maxHeight: "82vh",
      });
    }
  }
});

test("iOS captures the original opening position in pixels, not a live percentage", () => {
  assert.equal(getQuickTrackPosition("ios", 960).top, "115px");
  assert.equal(getQuickTrackPosition("ios", 844).top, "101px");
});

test("iOS caps only content height against its resized container and safe area", () => {
  const position = getQuickTrackPosition("ios", 960);
  assert.equal(position.maxHeight,
    "min(82vh, calc(100% - 115px - max(16px, env(safe-area-inset-bottom, 0px))))");
  assert.ok(!position.top.includes("%"));
  assert.ok(!position.top.includes("vh"));
});
