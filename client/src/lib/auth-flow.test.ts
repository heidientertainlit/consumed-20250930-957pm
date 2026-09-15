import assert from "node:assert/strict";
import test from "node:test";
import {
  clearRecoveryAuthFlow,
  consumeRecoveryAuthFlow,
  isRecoveryAuthCallback,
  markRecoveryAuthFlow,
  withAuthStateRequestDeadline,
  createAuthWorkGenerationGuard,
  isSessionEstablishingAuthEvent,
  resolveInitialAuthStartup,
  shouldInvalidateAuthWorkForEvent,
  shouldApplyAuthStateEvent,
} from "./auth-flow";

test.beforeEach(() => clearRecoveryAuthFlow());

test("recovery is explicitly marked before a native callback sets its session", () => {
  markRecoveryAuthFlow();
  assert.equal(consumeRecoveryAuthFlow(), true);
  assert.equal(consumeRecoveryAuthFlow(), false);
});

test("reset-password remains a recovery callback even if the marker was consumed", () => {
  assert.equal(isRecoveryAuthCallback("/reset-password"), true);
});

test("ordinary login paths do not classify as recovery without the marker", () => {
  assert.equal(isRecoveryAuthCallback("/login"), false);
  markRecoveryAuthFlow();
  assert.equal(isRecoveryAuthCallback("/login"), true);
  assert.equal(isRecoveryAuthCallback("/login"), false);
});

test("initial auth state checks time out instead of leaving auth loading forever", async () => {
  await assert.rejects(
    withAuthStateRequestDeadline(new Promise<never>(() => {}), 5),
    /account session could not be checked/i,
  );
});

test("canonical startup classifies INITIAL_SESSION like a signed-in session", () => {
  assert.equal(isSessionEstablishingAuthEvent("INITIAL_SESSION", true), true);
  assert.equal(isSessionEstablishingAuthEvent("SIGNED_IN", true), true);
  assert.equal(isSessionEstablishingAuthEvent("SIGNED_OUT", true), false);
  assert.equal(isSessionEstablishingAuthEvent("INITIAL_SESSION", false), false);
});

test("a newer auth event invalidates deferred stale logout work", () => {
  const guard = createAuthWorkGenerationGuard();
  const signedOutWork = guard.begin();
  const laterSignInWork = guard.begin();
  assert.equal(guard.isCurrent(signedOutWork), false);
  assert.equal(guard.isCurrent(laterSignInWork), true);
});

test("startup stays blocked when a failed session lookup cannot be locally signed out", async () => {
  const result = await resolveInitialAuthStartup(
    async () => { throw new Error("session lookup failed"); },
    async () => ({ error: new Error("sign-out failed") }),
  );
  assert.deepEqual(result, { kind: "blocked" });
});

test("startup presents guest state only after local sign-out succeeds", async () => {
  const result = await resolveInitialAuthStartup(
    async () => { throw new Error("session lookup failed"); },
    async () => ({ error: null }),
  );
  assert.deepEqual(result, { kind: "cleared" });
});

test("a resolved SDK session error requires confirmed local sign-out", async () => {
  const result = await resolveInitialAuthStartup(
    async () => ({
      data: { session: { accessToken: "retained-by-sdk" } },
      error: new Error("storage decryption failed"),
    }),
    async () => ({ error: new Error("sign-out failed") }),
  );
  assert.deepEqual(result, { kind: "blocked" });
});

test("a null INITIAL_SESSION event cannot override blocked canonical startup", async () => {
  const startup = await resolveInitialAuthStartup(
    async () => ({
      data: { session: { accessToken: "retained-by-sdk" } },
      error: new Error("SDK returned an error"),
    }),
    async () => ({ error: new Error("unable to clear local SDK session") }),
  );
  assert.deepEqual(startup, { kind: "blocked" });
  assert.equal(shouldApplyAuthStateEvent("INITIAL_SESSION"), false);
});

test("TOKEN_REFRESHED preserves deferred provider setup generation", () => {
  const guard = createAuthWorkGenerationGuard();
  const deferredProviderSetup = guard.begin();
  if (shouldInvalidateAuthWorkForEvent("TOKEN_REFRESHED")) guard.begin();
  assert.equal(guard.isCurrent(deferredProviderSetup), true);
});