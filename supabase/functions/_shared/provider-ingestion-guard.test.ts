import assert from "node:assert/strict";
import test from "node:test";
import { checkLiveUser } from "./provider-ingestion-guard.ts";

const deletedUserId = "11111111-1111-4111-8111-111111111111";
const newUserId = "22222222-2222-4222-8222-222222222222";
const sharedEmail = "same-address@example.test";

test("a deleted UUID is rejected even when a new UUID has the same email", async () => {
  const currentRows = new Map([
    [newUserId, { id: newUserId, email: sharedEmail }],
  ]);

  const deleted = await checkLiveUser(deletedUserId, async () => ({
    data: currentRows.get(deletedUserId) ?? null,
    error: null,
  }));
  const replacement = await checkLiveUser(newUserId, async () => ({
    data: currentRows.get(newUserId) ?? null,
    error: null,
  }));

  assert.deepEqual(deleted, {
    allowed: false,
    reason: "account_not_found",
  });
  assert.equal(replacement.allowed, true);
  if (replacement.allowed) {
    assert.equal(replacement.user.id, newUserId);
    assert.equal(replacement.user.email, sharedEmail);
  }
});

test("an authoritative account lookup error fails closed", async () => {
  const result = await checkLiveUser(newUserId, async () => ({
    data: null,
    error: new Error("database unavailable"),
  }));

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "account_lookup_failed");
});

test("a lookup that returns another UUID cannot authorize the requested send", async () => {
  const result = await checkLiveUser(deletedUserId, async () => ({
    data: { id: newUserId, email: sharedEmail },
    error: null,
  }));

  assert.deepEqual(result, {
    allowed: false,
    reason: "account_not_found",
  });
});