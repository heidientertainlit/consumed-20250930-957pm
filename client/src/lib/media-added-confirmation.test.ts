import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dismissMediaAdded, getMediaAddedNotice, showMediaAdded, subscribeMediaAdded,
  getFinishedReview, dismissFinishedReview, finishMediaAddedExit,
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

const reviewRequest = {
  userId: "owner", listItemId: "saved-item",
  media: { title: "Saved title", type: "movie", external_id: "123", external_source: "tmdb" },
};

test("only an opted-in single Finished save opens a review, after animation exit", () => {
  for (const input of [
    { listName: "queue", finishedReview: reviewRequest },
    { listName: "Finished" },
    { listName: "Finished", count: 2, finishedReview: reviewRequest },
  ]) {
    showMediaAdded(input);
    dismissMediaAdded(getMediaAddedNotice()!.id);
    finishMediaAddedExit();
    assert.equal(getFinishedReview(), null);
  }
  showMediaAdded({ listName: "Finished", finishedReview: reviewRequest });
  const id = getMediaAddedNotice()!.id;
  dismissMediaAdded(id);
  assert.equal(getFinishedReview(), null, "Must not overlap the Consumed exit");
  finishMediaAddedExit();
  assert.equal(getFinishedReview()?.listItemId, "saved-item");
  assert.equal(getFinishedReview()?.id, id);
  dismissFinishedReview(id - 1);
  assert.equal(getFinishedReview()?.id, id, "Stale close must not dismiss this review");
  dismissFinishedReview(id);
  finishMediaAddedExit();
  assert.equal(getFinishedReview(), null, "Not now must not reopen the prompt");
});

test("a newer save cancels an older pending review instead of opening the wrong title", () => {
  showMediaAdded({ listName: "Finished", finishedReview: reviewRequest });
  dismissMediaAdded(getMediaAddedNotice()!.id);
  showMediaAdded({ title: "Another title", listName: "Currently" });
  finishMediaAddedExit();
  assert.equal(getFinishedReview(), null);
  dismissMediaAdded(getMediaAddedNotice()!.id);
  finishMediaAddedExit();
  assert.equal(getFinishedReview(), null);
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
