import assert from "node:assert/strict";
import test from "node:test";
import { parseNativeAuthCallback } from "./native-oauth";
import { restoreNativeAuthCallbackSession } from "./native-oauth-session";

const callback = {
  kind: "oauth-session" as const,
  accessToken: "access",
  refreshToken: "refresh",
  attemptId: "attempt-1",
};

test("native callback session orchestration accepts only a successful handoff", async () => {
  let clearedAttemptId: string | null = null;
  const result = await restoreNativeAuthCallbackSession(
    callback,
    async (tokens) => {
      assert.deepEqual(tokens, { access_token: "access", refresh_token: "refresh" });
      return { error: null };
    },
    (attemptId) => { clearedAttemptId = attemptId; },
  );
  assert.equal(result, true);
  assert.equal(clearedAttemptId, null);
});

test("native callback session orchestration releases the exact OAuth attempt on SDK error", async () => {
  let clearedAttemptId: string | null = null;
  const result = await restoreNativeAuthCallbackSession(
    callback,
    async () => ({ error: new Error("invalid session") }),
    (attemptId) => { clearedAttemptId = attemptId; },
  );
  assert.equal(result, false);
  assert.equal(clearedAttemptId, "attempt-1");
});

test("native callback session orchestration releases the exact OAuth attempt on thrown failure", async () => {
  let clearedAttemptId: string | null = null;
  const result = await restoreNativeAuthCallbackSession(
    callback,
    async () => { throw new Error("network unavailable"); },
    (attemptId) => { clearedAttemptId = attemptId; },
  );
  assert.equal(result, false);
  assert.equal(clearedAttemptId, "attempt-1");
});

test("an old or missing callback attempt never reaches the session handoff", async () => {
  const oldCallback = parseNativeAuthCallback(
    "com.entertainlit.consumed://auth/callback?oauth_attempt=old#access_token=access&refresh_token=refresh",
    "https://app.consumedapp.com",
    (attemptId) => attemptId === "current",
  );
  const missingCallback = parseNativeAuthCallback(
    "com.entertainlit.consumed://auth/callback#access_token=access&refresh_token=refresh",
    "https://app.consumedapp.com",
    () => true,
  );
  assert.equal(oldCallback, null);
  assert.equal(missingCallback, null);
});