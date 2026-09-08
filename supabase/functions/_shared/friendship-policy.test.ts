import assert from "node:assert/strict";
import test from "node:test";
import {
  canAppearInFriendshipSearch,
  isValidFriendshipUuid,
  normalizeFriendshipSearchQuery,
} from "./friendship-policy.ts";

const visibleCandidate = {
  targetExists: true,
  targetIsPersona: false,
  targetIsDiscoverable: true,
  targetHasDnaProfile: true,
  targetDnaIsPrivate: false,
  blocked: false,
  isAcceptedFriend: false,
};

test("friend search excludes blocks, personas, and private strangers", () => {
  assert.equal(canAppearInFriendshipSearch({ ...visibleCandidate, blocked: true }), false);
  assert.equal(canAppearInFriendshipSearch({ ...visibleCandidate, targetIsPersona: true }), false);
  assert.equal(canAppearInFriendshipSearch({ ...visibleCandidate, targetIsDiscoverable: false }), false);
  assert.equal(canAppearInFriendshipSearch({ ...visibleCandidate, targetDnaIsPrivate: true }), false);
  assert.equal(canAppearInFriendshipSearch({ ...visibleCandidate, targetDnaIsPrivate: null }), false);
  assert.equal(canAppearInFriendshipSearch({
    ...visibleCandidate,
    targetHasDnaProfile: false,
    targetDnaIsPrivate: null,
  }), true);
});

test("accepted friends retain access to private and non-discoverable profiles", () => {
  assert.equal(canAppearInFriendshipSearch({
    ...visibleCandidate,
    targetIsDiscoverable: false,
    targetDnaIsPrivate: true,
    isAcceptedFriend: true,
  }), true);
});

test("friend request identifiers and search terms are bounded before use", () => {
  assert.equal(isValidFriendshipUuid("64b8a37f-765a-4f28-a7ec-c2d9d56d3e42"), true);
  assert.equal(isValidFriendshipUuid("not-a-uuid"), false);
  assert.equal(normalizeFriendshipSearchQuery("  Ada  "), "Ada");
  assert.equal(normalizeFriendshipSearchQuery("a"), null);
  assert.equal(normalizeFriendshipSearchQuery("ok\nno"), null);
});