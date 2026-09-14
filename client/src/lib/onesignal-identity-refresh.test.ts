import assert from "node:assert/strict";
import test from "node:test";
import { createOneSignalJwtRefreshQueue } from "./onesignal-identity-refresh";

test("JWT refresh retries bounded failures without legacy login", async () => {
  let attempts = 0;
  let updates = 0;
  let epoch = 7;
  const calls: string[] = [];
  const queue = createOneSignalJwtRefreshQueue(
    {
      getCurrentUserId: () => "user-a",
      requestJwt: async () => {
        attempts += 1;
        calls.push(`request-${attempts}`);
        if (attempts === 1) throw new Error("transient");
        return "jwt-a";
      },
      updateUserJwt: async () => {
        updates += 1;
        calls.push("update");
      },
    },
    { getCurrentEpoch: () => epoch, maxAttempts: 2 },
  );

  assert.equal(await queue.refresh("user-a", epoch), true);
  assert.deepEqual(calls, ["request-1", "request-2", "update"]);
  assert.equal(updates, 1);
  assert.equal(attempts, 2);
  epoch = 8;
});

test("JWT refresh drops a stale result before native update", async () => {
  let epoch = 3;
  let resolveJwt!: (jwt: string) => void;
  let updates = 0;
  const jwtReady = new Promise<string>((resolve) => {
    resolveJwt = resolve;
  });
  const queue = createOneSignalJwtRefreshQueue(
    {
      getCurrentUserId: () => "user-a",
      requestJwt: async () => jwtReady,
      updateUserJwt: async () => {
        updates += 1;
      },
    },
    { getCurrentEpoch: () => epoch, maxAttempts: 2 },
  );

  const refresh = queue.refresh("user-a", epoch);
  epoch = 4;
  resolveJwt("stale-jwt-a");

  assert.equal(await refresh, false);
  assert.equal(updates, 0);
});

test("queued refreshes recheck the subject between identities", async () => {
  let currentUser: string | null = "user-a";
  let epoch = 1;
  let resolveA!: (jwt: string) => void;
  const firstJwt = new Promise<string>((resolve) => {
    resolveA = resolve;
  });
  const updates: string[] = [];
  const queue = createOneSignalJwtRefreshQueue(
    {
      getCurrentUserId: () => currentUser,
      requestJwt: async (externalId) => {
        if (externalId === "user-a") return firstJwt;
        return "jwt-b";
      },
      updateUserJwt: async (externalId) => {
        updates.push(externalId);
      },
    },
    { getCurrentEpoch: () => epoch, maxAttempts: 2 },
  );

  const refreshA = queue.refresh("user-a", epoch);
  currentUser = "user-b";
  epoch = 2;
  const refreshB = queue.refresh("user-b", epoch);
  resolveA("stale-jwt-a");

  assert.equal(await refreshA, false);
  assert.equal(await refreshB, true);
  assert.deepEqual(updates, ["user-b"]);
});

test("refresh cleanup stays serialized if auth changes after native update", async () => {
  let currentUser: string | null = "user-a";
  let epoch = 1;
  const calls: string[] = [];
  const queue = createOneSignalJwtRefreshQueue(
    {
      getCurrentUserId: () => currentUser,
      requestJwt: async () => "jwt-a",
      updateUserJwt: async () => {
        calls.push("update-a");
        currentUser = "user-b";
        epoch = 2;
      },
    },
    {
      getCurrentEpoch: () => epoch,
      cleanupStaleProviderIdentity: async () => {
        calls.push("logout-stale-a");
      },
    },
  );

  assert.equal(await queue.refresh("user-a", epoch), false);
  assert.deepEqual(calls, ["update-a", "logout-stale-a"]);
});