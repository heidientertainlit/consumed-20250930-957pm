import test from "node:test";
import assert from "node:assert/strict";
import { createProviderIdentityTransition } from "./provider-identity-transition";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

test("serializes a stale in-flight login before the replacement identity", async () => {
  let currentSubject: string | null = "A";
  let providerIdentity: string | null = null;
  const calls: string[] = [];
  const loginA = deferred();
  const loginAStarted = deferred();

  const identity = createProviderIdentityTransition({
    getCurrentUserId: () => currentSubject,
    logout: async () => {
      calls.push("logout:start");
      providerIdentity = null;
      calls.push("logout:end");
    },
    login: async (externalId) => {
      calls.push(`login:start:${externalId}`);
      if (externalId === "A") {
        loginAStarted.resolve();
        await loginA.promise;
      }
      providerIdentity = externalId;
      calls.push(`login:end:${externalId}`);
    },
  });

  await identity.transitionTo("A").completion;
  const loginAResult = identity.login("A");
  await loginAStarted.promise;

  // B arrives while OneSignal.login(A) is still in flight.
  currentSubject = "B";
  const transitionB = identity.transitionTo("B");
  const loginBResult = identity.login("B");
  loginA.resolve();

  assert.equal(await loginAResult, false);
  await transitionB.completion;
  assert.equal(await loginBResult, true);
  assert.equal(providerIdentity, "B");

  const staleCleanupIndex = calls.findIndex(
    (call, index) => call === "logout:start" && index > calls.indexOf("login:end:A"),
  );
  assert.notEqual(staleCleanupIndex, -1);
  assert.deepEqual(
    calls.slice(staleCleanupIndex).filter((call) => call.endsWith(":A")),
    [],
  );
  assert.equal(calls.at(-1), "login:end:B");
});

test("queued login rechecks the current auth subject before provider login", async () => {
  let currentSubject: string | null = "A";
  let loginCalls = 0;
  const identity = createProviderIdentityTransition({
    getCurrentUserId: () => currentSubject,
    logout: () => undefined,
    login: () => {
      loginCalls += 1;
    },
  });

  await identity.transitionTo("A").completion;
  currentSubject = "B";
  identity.transitionTo("B");
  assert.equal(await identity.login("A"), false);
  assert.equal(loginCalls, 0);
});