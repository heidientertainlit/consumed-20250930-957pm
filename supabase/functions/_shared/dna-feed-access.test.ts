import assert from "node:assert/strict";
import test from "node:test";
import {
  blockedPeerIdsForViewer,
  filterDnaFeedRelationships,
} from "./dna-feed-access.ts";

const viewerId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const friendId = "33333333-3333-4333-8333-333333333333";
const blockedFriendId = "44444444-4444-4444-8444-444444444444";
const strangerId = "55555555-5555-4555-8555-555555555555";

function relationshipInput(blockedPeerIds: ReadonlySet<string>) {
  return {
    viewerId,
    targetUserId: targetId,
    friendIds: [friendId, blockedFriendId, targetId],
    blockedPeerIds,
    friendDnas: [
      { user_id: friendId, label: "Allowed" },
      { user_id: blockedFriendId, label: "Blocked" },
    ],
    friendUsers: [
      { id: friendId, display_name: "Allowed" },
      { id: blockedFriendId, display_name: "Blocked" },
    ],
    cmp1: [
      { user_id_1: targetId, user_id_2: friendId, match_score: 80 },
      { user_id_1: targetId, user_id_2: blockedFriendId, match_score: 90 },
    ],
    cmp2: [
      { user_id_2: targetId, user_id_1: friendId, match_score: 81 },
      { user_id_2: targetId, user_id_1: blockedFriendId, match_score: 91 },
    ],
  };
}

function relationships(blockedPeerIds: ReadonlySet<string>) {
  return filterDnaFeedRelationships(relationshipInput(blockedPeerIds));
}

test("block rows are interpreted in either direction", () => {
  const blocked = blockedPeerIdsForViewer(viewerId, [
    { blocker_id: viewerId, blocked_id: targetId },
    { blocker_id: blockedFriendId, blocked_id: viewerId },
  ]);

  assert.equal(blocked.has(targetId), true);
  assert.equal(blocked.has(blockedFriendId), true);
  assert.equal(blocked.has(strangerId), false);
});

test("blocked target is denied while unblocked relationships remain eligible", () => {
  const filtered = relationships(new Set([targetId]));

  assert.equal(filtered.targetBlocked, true);
  assert.deepEqual(filtered.friendIds, [friendId, blockedFriendId]);
  assert.equal(filtered.friendDnas.length, 2);
});

test("blocked additional friend and both comparison directions are removed", () => {
  const filtered = relationships(new Set([blockedFriendId]));

  assert.equal(filtered.targetBlocked, false);
  assert.deepEqual(filtered.friendIds, [friendId]);
  assert.deepEqual(filtered.friendDnas, [{ user_id: friendId, label: "Allowed" }]);
  assert.deepEqual(filtered.friendUsers, [{ id: friendId, display_name: "Allowed" }]);
  assert.deepEqual(filtered.cmp1, [
    { user_id_1: targetId, user_id_2: friendId, match_score: 80 },
  ]);
  assert.deepEqual(filtered.cmp2, [
    { user_id_2: targetId, user_id_1: friendId, match_score: 81 },
  ]);
});

test("unblocked feed keeps existing target relationships and drops malformed rows", () => {
  const filtered = filterDnaFeedRelationships({
    viewerId,
    targetUserId: targetId,
    friendIds: [friendId, targetId],
    blockedPeerIds: new Set(),
    friendDnas: [{ user_id: friendId }, { label: "missing id" }],
    friendUsers: [{ id: friendId }, { display_name: "missing id" }],
    cmp1: [
      { user_id_1: targetId, user_id_2: friendId, match_score: 75 },
      { user_id_1: targetId, match_score: 100 },
    ],
    cmp2: [
      { user_id_2: targetId, user_id_1: friendId, match_score: 76 },
      { user_id_2: strangerId, user_id_1: friendId, match_score: 99 },
    ],
  });

  assert.equal(filtered.targetBlocked, false);
  assert.deepEqual(filtered.friendIds, [friendId]);
  assert.equal(filtered.friendDnas.length, 1);
  assert.equal(filtered.friendUsers.length, 1);
  assert.equal(filtered.cmp1.length, 1);
  assert.equal(filtered.cmp2.length, 1);
});