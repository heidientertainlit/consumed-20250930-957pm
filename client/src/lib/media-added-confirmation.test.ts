import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dismissMediaAdded, getMediaAddedNotice, showMediaAdded, subscribeMediaAdded,
  getFinishedReview, dismissFinishedReview,
  deferReturnUntilFinishedReview,
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

test("return navigation waits for the Finished review to settle exactly once", () => {
  let returns = 0;
  assert.equal(deferReturnUntilFinishedReview(() => returns++), false);
  showMediaAdded({ listName: "Finished", finishedReview: reviewRequest });
  const id = getFinishedReview()!.id;
  assert.equal(deferReturnUntilFinishedReview(() => returns++), true);
  assert.equal(getMediaAddedNotice(), null);
  assert.equal(returns, 0);
  dismissFinishedReview(id - 1);
  assert.equal(returns, 0);
  dismissFinishedReview(id);
  dismissFinishedReview(id);
  assert.equal(returns, 1);
});

test("only an opted-in single Finished save opens the combined review immediately", () => {
  for (const input of [
    { listName: "queue", finishedReview: reviewRequest },
    { listName: "Finished" },
    { listName: "Finished", count: 2, finishedReview: reviewRequest },
    { listName: "Finished", finishedReview: { ...reviewRequest, hasSavedReview: true } },
  ]) {
    showMediaAdded(input);
    dismissMediaAdded(getMediaAddedNotice()!.id);
    assert.equal(getFinishedReview(), null);
  }
  showMediaAdded({ listName: "Finished", finishedReview: reviewRequest });
  const id = getFinishedReview()!.id;
  assert.equal(getMediaAddedNotice(), null, "The combined review replaces the standalone stamp");
  dismissMediaAdded(id);
  assert.equal(getFinishedReview()?.listItemId, "saved-item");
  assert.equal(getFinishedReview()?.id, id);
  dismissFinishedReview(id - 1);
  assert.equal(getFinishedReview()?.id, id, "Stale close must not dismiss this review");
  dismissFinishedReview(id);
  assert.equal(getFinishedReview(), null, "Not now must not reopen the prompt");
});

test("a newer save supersedes the older combined review without stale navigation", () => {
  showMediaAdded({ listName: "Finished", finishedReview: reviewRequest });
  const id = getFinishedReview()!.id;
  let returns = 0;
  deferReturnUntilFinishedReview(() => returns++);
  showMediaAdded({ title: "Another title", listName: "Currently" });
  assert.equal(getFinishedReview(), null);
  dismissFinishedReview(id);
  assert.equal(returns, 0);
  dismissMediaAdded(getMediaAddedNotice()!.id);
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
