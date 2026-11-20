import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dismissMediaAdded, getMediaAddedNotice, showMediaAdded, subscribeMediaAdded,
} from "./media-added-confirmation";

test("confirmed additions normalize destinations without exposing opaque IDs", () => {
  for (const [listName, expected] of [
    ["queue", "Want To"], ["currently", "Currently"], ["completed", "Finished"],
    ["dnf", "Did Not Finish"], ["favorites", "Favorites"], ["all", undefined],
    ["00000000-0000-0000-0000-000000000001", undefined],
  ]) {
    showMediaAdded({ title: "A title", listName });
    assert.equal(getMediaAddedNotice()?.listName, expected);
    assert.equal(getMediaAddedNotice()?.count, 1);
    dismissMediaAdded(getMediaAddedNotice()!.id);
  }
});

test("batch confirmation excludes empty or invalid batches", () => {
  for (const count of [0, -1, 1.5, Infinity, NaN]) showMediaAdded({ count });
  assert.equal(getMediaAddedNotice(), null);
  showMediaAdded({ count: 7, listName: "Finished" });
  assert.equal(getMediaAddedNotice()?.count, 7);
  dismissMediaAdded(getMediaAddedNotice()!.id);
});

test("each save restarts feedback and a stale timer cannot clear a newer save", () => {
  let changes = 0;
  const unsubscribe = subscribeMediaAdded(() => changes++);
  showMediaAdded({ title: "First" });
  const firstId = getMediaAddedNotice()!.id;
  showMediaAdded({ title: "Second" });
  const secondId = getMediaAddedNotice()!.id;
  assert.notEqual(firstId, secondId);
  dismissMediaAdded(firstId);
  assert.equal(getMediaAddedNotice()?.title, "Second");
  assert.equal(changes, 2);
  dismissMediaAdded(secondId);
  assert.equal(getMediaAddedNotice(), null);
  assert.equal(changes, 3);
  unsubscribe();
  showMediaAdded({ title: "Third" });
  assert.equal(changes, 3);
  dismissMediaAdded(getMediaAddedNotice()!.id);
});
