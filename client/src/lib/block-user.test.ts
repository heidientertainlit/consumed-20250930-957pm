import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import {
  blockedUsersSignature,
  blockedUsersQueryKey,
  filterNotificationsForBlockedUsers,
  getBlockedUserIdsForViewer,
  loadBlockedUserDisplayIdentities,
  loadBlockedUserIds,
  mergeBlockedUserIdsForViewer,
  removeBlockedUserFromCaches,
  removeBlockedUserFromQueryData,
  removeUnblockedUserFromCaches,
  unblockUserRequest,
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

test("loads only minimal public identity for authoritative blocked ids", async () => {
  const calls: string[] = [];
  const client = {
    from: (table: string) => {
      calls.push(`from:${table}`);
      const chain = {
        select: (columns: string) => {
          calls.push(`select:${columns}`);
          return chain;
        },
        in: async (column: string, ids: string[]) => {
          calls.push(`in:${column}:${ids.join(",")}`);
          return {
            data: [
              { id: blockedId, display_name: "Blocked Person", user_name: "blocked", first_name: "Blocked", last_name: "Person", email: "private@example.com" },
              { id: "not-requested", display_name: "Unexpected Person" },
            ],
            error: null,
          };
        },
      };
      return chain;
    },
  };

  assert.deepEqual(
    await loadBlockedUserDisplayIdentities(client, [blockedId, blockedId]),
    [{ id: blockedId, display_name: "Blocked Person", user_name: "blocked", first_name: "Blocked", last_name: "Person" }],
  );
  assert.deepEqual(calls, [
    "from:public_user_profiles",
    "select:id,user_name,display_name,first_name,last_name",
    `in:id:${blockedId}`,
  ]);
});

test("does not query public identities when the account has no blocks", async () => {
  let queried = false;
  const client = { from: () => { queried = true; return {}; } };

  assert.deepEqual(await loadBlockedUserDisplayIdentities(client, []), []);
  assert.equal(queried, false);
});

test("does not silently treat blocked identity lookup failure as an empty list", async () => {
  const client = {
    from: () => ({
      select: () => ({
        in: async () => ({ data: null, error: { message: "permission denied" } }),
      }),
    }),
  };

  await assert.rejects(
    () => loadBlockedUserDisplayIdentities(client, [blockedId]),
    /Blocked user identities could not be loaded: permission denied/,
  );
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

test("unblock sends the action body and surfaces endpoint failures", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ body?: string; authorization?: string }> = [];
  globalThis.fetch = (async (_input, init) => {
    requests.push({
      body: typeof init?.body === "string" ? init.body : undefined,
      authorization: new Headers(init?.headers).get("Authorization") || undefined,
    });
    return {
      ok: false,
      json: async () => ({ error: "Unblock was rejected" }),
    } as Response;
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => unblockUserRequest("token", blockedId, "viewer"),
      /Unblock was rejected/,
    );
    assert.deepEqual(JSON.parse(requests[0].body || "{}"), {
      blocked_user_id: blockedId,
      action: "unblock",
    });
    assert.equal(requests[0].authorization, "Bearer token");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("removing an unblock updates the viewer block list and display cache only", () => {
  const queryClient = new QueryClient();
  const viewerId = "unblock-viewer";
  const otherViewerId = "other-viewer";
  queryClient.setQueryData(blockedUsersQueryKey(viewerId), [blockedId, "other-user"]);
  queryClient.setQueryData(["blocked-user-profiles", viewerId, "blocked-user,other-user"], [
    { id: blockedId, user_name: "blocked" },
    { id: "other-user", user_name: "other" },
  ]);
  queryClient.setQueryData(blockedUsersQueryKey(otherViewerId), [blockedId]);

  removeUnblockedUserFromCaches(queryClient, blockedId, viewerId);

  assert.deepEqual(getBlockedUserIdsForViewer(queryClient, viewerId), ["other-user"]);
  assert.deepEqual(queryClient.getQueryData(["blocked-user-profiles", viewerId, "blocked-user,other-user"]), [
    { id: "other-user", user_name: "other" },
  ]);
  assert.deepEqual(getBlockedUserIdsForViewer(queryClient, otherViewerId), [blockedId]);
});

test("an in-flight hydration cannot re-add an unblocked id for its viewer", () => {
  const viewerId = "race-viewer";
  const result = mergeBlockedUserIdsForViewer(viewerId, [blockedId, "other-user"], [blockedId]);

  assert.deepEqual(result, [blockedId, "other-user"]);
  removeUnblockedUserFromCaches(new QueryClient(), blockedId, viewerId);
  assert.deepEqual(mergeBlockedUserIdsForViewer(viewerId, [blockedId, "other-user"], [blockedId]), ["other-user"]);
});