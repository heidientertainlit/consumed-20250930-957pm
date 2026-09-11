import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import {
  blockedUsersSignature,
  filterNotificationsForBlockedUsers,
  getBlockedUserIdsForViewer,
  loadBlockedUserIds,
  removeBlockedUserFromCaches,
  removeBlockedUserFromQueryData,
} from "./block-user";

const blockedId = "blocked-user";

test("removes a blocked author's posts from every cached feed page", () => {
  const feed = {
    pages: [
      [{ id: "post-1", user: { id: blockedId } }, { id: "post-2", user: { id: "other-user" } }],
      [{ id: "post-3", author: { id: blockedId } }],
    ],
    pageParams: [0, 1],
  };

  const result = removeBlockedUserFromQueryData(["social-feed", "auth"], feed, blockedId);

  assert.equal(result.changed, true);
  assert.deepEqual(result.data, {
    pages: [[{ id: "post-2", user: { id: "other-user" } }], []],
    pageParams: [0, 1],
  });
});

test("removes a blocked person from friendships even when the row id is the friendship id", () => {
  const friendships = {
    friends: [
      { id: "friendship-1", friend_id: blockedId, friend: { id: blockedId } },
      { id: "friendship-2", friend_id: "other-user", friend: { id: "other-user" } },
    ],
  };

  const result = removeBlockedUserFromQueryData(["friends"], friendships, blockedId);

  assert.equal(result.changed, true);
  assert.deepEqual(result.data, {
    friends: [{ id: "friendship-2", friend_id: "other-user", friend: { id: "other-user" } }],
  });
});

test("removes blocked people from match bands without mutating unrelated cache shapes", () => {
  const affinity = {
    bands: [
      { id: "your-people", people: [{ id: blockedId }, { id: "other-user" }] },
      { id: "wildcards", people: [{ id: blockedId }] },
    ],
  };
  const affinityResult = removeBlockedUserFromQueryData(["people-affinity-v9", "me"], affinity, blockedId);
  const unrelated = removeBlockedUserFromQueryData(["user-lists-with-media"], { items: [{ id: blockedId }] }, blockedId);

  assert.deepEqual(affinityResult.data, {
    bands: [
      { id: "your-people", people: [{ id: "other-user" }] },
      { id: "wildcards", people: [] },
    ],
  });
  assert.equal(unrelated.changed, false);
});

test("removes blocked commenters from cached replies as well as top-level comments", () => {
  const comments = [
    {
      id: "comment-1",
      user: { id: "other-user" },
      replies: [{ id: "reply-1", user: { id: blockedId } }, { id: "reply-2", user: { id: "other-user" } }],
    },
    { id: "comment-2", user: { id: blockedId }, replies: [] },
  ];

  const result = removeBlockedUserFromQueryData(["post-comments", "post-1"], comments, blockedId);

  assert.deepEqual(result.data, [{
    id: "comment-1",
    user: { id: "other-user" },
    replies: [{ id: "reply-2", user: { id: "other-user" } }],
  }]);
});

test("filters a blocked notification actor instead of the notification recipient", () => {
  const result = removeBlockedUserFromQueryData(
    ["/api/notifications", "viewer"],
    [
      { id: "notification-1", user_id: "viewer", triggered_by_user_id: blockedId },
      { id: "notification-2", user_id: "viewer", triggered_by_user_id: "other-user" },
    ],
    blockedId,
  );

  assert.deepEqual(result.data, [
    { id: "notification-2", user_id: "viewer", triggered_by_user_id: "other-user" },
  ]);
});

test("persists blocked ids under the active viewer cache only", () => {
  const queryClient = new QueryClient();
  removeBlockedUserFromCaches(queryClient, blockedId, "viewer-a");

  assert.deepEqual(getBlockedUserIdsForViewer(queryClient, "viewer-a"), [blockedId]);
  assert.deepEqual(getBlockedUserIdsForViewer(queryClient, "viewer-b"), []);
});

test("hydrates account-authoritative blocks for a fresh viewer context", async () => {
  const calls: string[] = [];
  const client = {
    from: (table: string) => {
      calls.push(`from:${table}`);
      return {
        select: (columns: string) => {
          calls.push(`select:${columns}`);
          return {
            eq: async (column: string, value: string) => {
              calls.push(`eq:${column}:${value}`);
              return { data: [{ blocked_id: blockedId }, { blocked_id: blockedId }, { blocked_id: null }], error: null };
            },
          };
        },
      };
    },
  };

  assert.deepEqual(await loadBlockedUserIds(client, "fresh-viewer"), [blockedId]);
  assert.deepEqual(calls, ["from:user_blocks", "select:blocked_id", "eq:blocker_id:fresh-viewer"]);
});

test("does not silently treat a blocked-user query failure as an empty list", async () => {
  const client = {
    from: () => ({
      select: () => ({
        eq: async () => ({ data: null, error: { message: "permission denied" } }),
      }),
    }),
  };

  await assert.rejects(() => loadBlockedUserIds(client, "viewer"), /Blocked users could not be verified: permission denied/);
});

test("filters newly refetched notifications by their blocked actor", () => {
  const refetched = [
    { id: "notification-1", user_id: "viewer", triggered_by_user_id: blockedId },
    { id: "notification-2", user_id: "viewer", triggered_by_user_id: "other-user" },
  ];

  assert.deepEqual(filterNotificationsForBlockedUsers(refetched, [blockedId]), [refetched[1]]);
});

test("changes the notification cache signature immediately when a block is remembered", () => {
  assert.notEqual(blockedUsersSignature([]), blockedUsersSignature([blockedId]));
  assert.equal(blockedUsersSignature(["z-user", "a-user", "z-user"]), "a-user,z-user");
});