import assert from "node:assert/strict";
import { test } from "node:test";
import { createNowAddState, getNowAddEntry } from "./add-media-navigation";

test("only the explicit Now entry creates a return destination", () => {
  for (const path of ["/", "/activity"]) {
    const state = createNowAddState(path, 712, "entry-one");
    assert.deepEqual(getNowAddEntry("/add", state), {
      returnTo: path, scrollY: 712, entryId: "entry-one",
    });
  }
  assert.equal(createNowAddState("/people", 712, "entry-one"), undefined);
  assert.equal(getNowAddEntry("/add", null), null);
  assert.equal(getNowAddEntry("/add", {}), null);
});

test("a prior visit to Now or a stale state on another route never owns navigation", () => {
  const state = createNowAddState("/activity", 712, "entry-one");
  for (const path of ["/", "/activity", "/people", "/profile"]) {
    assert.equal(getNowAddEntry(path, state), null);
  }
  assert.equal(getNowAddEntry("/add", { previousPage: "/activity" }), null);
});

test("malformed return paths and scroll positions fail closed", () => {
  const valid = { returnTo: "/activity", scrollY: 712, entryId: "entry-one" };
  for (const value of [
    null, "now", { ...valid, returnTo: "https://example.com" },
    { ...valid, returnTo: "/people" }, { ...valid, scrollY: Infinity },
    { ...valid, scrollY: -1 }, { ...valid, entryId: "" },
  ]) assert.equal(getNowAddEntry("/add", { nowAddEntry: value }), null);
});
