import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCustomerIoDeleteUrl,
  buildOneSignalUserUrl,
  buildPostHogDeleteUrl,
  buildPostHogPersonsLookupUrl,
  buildPostHogStatusUrl,
  classifyProviderHttpStatus,
  customerIoHost,
  dispatchWithLeaseGuard,
  isRetryableProviderStatus,
  parsePostHogDeletionStatus,
  parsePostHogPersonMapping,
  parseCustomerIoDeleteResponse,
  reserveDestructiveAttempt,
  retryDelayMs,
  shouldProcessTarget,
  validateNoTargetRequest,
} from "./provider-deletion.ts";

const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";
const userC = "55555555-5555-4555-8555-555555555555";
const personA = "33333333-3333-4333-8333-333333333333";

test("provider adapters construct singular exact-ID paths only", () => {
  const posthogLookup = buildPostHogPersonsLookupUrl(
    "https://us.posthog.com/",
    "42",
    userA,
  );
  assert.equal(
    posthogLookup,
    `https://us.posthog.com/api/projects/42/persons/?distinct_id=${userA}`,
  );
  assert.match(
    buildPostHogDeleteUrl("https://us.posthog.com", "42", personA),
    /\/persons\/33333333-3333-4333-8333-333333333333\?delete_events=true&delete_recordings=true$/,
  );
  assert.match(
    buildPostHogStatusUrl("https://us.posthog.com", "42", personA, "completed"),
    /deletion_status\/\?person_uuid=33333333-3333-4333-8333-333333333333&status=completed$/,
  );
  assert.equal(
    buildOneSignalUserUrl("app", userA),
    `https://api.onesignal.com/apps/app/users/by/external_id/${userA}`,
  );
  assert.equal(
    buildCustomerIoDeleteUrl("eu", userA),
    `https://track-eu.customer.io/api/v1/customers/${userA}`,
  );
  for (const url of [posthogLookup, buildPostHogDeleteUrl("https://us.posthog.com", "42", personA)]) {
    assert.doesNotMatch(url, /bulk_delete|distinct_ids|ids=/);
  }
  assert.equal(customerIoHost("us"), "https://track.customer.io");
  assert.equal(customerIoHost("eu"), "https://track-eu.customer.io");
  assert.equal(customerIoHost(""), null);
  assert.throws(() => buildOneSignalUserUrl("app", "not-a-user-id"));
  assert.throws(() => buildCustomerIoDeleteUrl("apac", userA));
});

test("PostHog mapping requires exactly one person with exactly one expected UUID", () => {
  assert.deepEqual(
    parsePostHogPersonMapping({
      results: [{ id: personA, distinct_ids: [userA] }],
    }, userA),
    { kind: "mapped", personUuid: personA },
  );
  assert.equal(
    parsePostHogPersonMapping({
      results: [{ id: personA, distinct_ids: [userA, userB] }],
    }, userA).kind,
    "ambiguous",
  );
  assert.equal(
    parsePostHogPersonMapping({
      results: [
        { id: personA, distinct_ids: [userA] },
        { id: "44444444-4444-4444-8444-444444444444", distinct_ids: [userA] },
      ],
    }, userA).kind,
    "ambiguous",
  );
  assert.equal(
    parsePostHogPersonMapping({
      results: [{ id: personA, distinct_ids: [userB] }],
    }, userA).kind,
    "ambiguous",
  );
});

test("PostHog status cannot claim historical completion without exact proof", () => {
  assert.deepEqual(
    parsePostHogDeletionStatus({
      results: [{
        person_uuid: personA,
        status: "completed",
        delete_verified_at: "2026-09-14T00:00:00Z",
      }],
    }, personA),
    { kind: "completed" },
  );
  assert.deepEqual(
    parsePostHogDeletionStatus({
      results: [{ person_uuid: personA, status: "pending" }],
    }, personA),
    { kind: "pending" },
  );
  assert.deepEqual(
    parsePostHogDeletionStatus({
      results: [{
        person_uuid: userB,
        status: "completed",
        delete_verified_at: "2026-09-14T00:00:00Z",
      }],
    }, personA),
    { kind: "blocked" },
  );
  assert.equal(
    parsePostHogDeletionStatus({
      results: [{ status: "completed", delete_verified_at: "2026-09-14T00:00:00Z" }],
    }, personA).kind,
    "blocked",
  );
  assert.equal(parseCustomerIoDeleteResponse(200, {}), true);
  assert.equal(parseCustomerIoDeleteResponse(200, { id: "unexpected" }), false);
  assert.equal(parseCustomerIoDeleteResponse(204, {}), false);
});

test("retry policy covers timeout/408/429/5xx but not ordinary 4xx", () => {
  assert.equal(isRetryableProviderStatus(408), true);
  assert.equal(isRetryableProviderStatus(429), true);
  assert.equal(isRetryableProviderStatus(503), true);
  assert.equal(isRetryableProviderStatus(400), false);
  assert.equal(isRetryableProviderStatus(401), false);
  assert.equal(isRetryableProviderStatus(409), false);
  assert.equal(classifyProviderHttpStatus(408), "retryable_failure");
  assert.equal(classifyProviderHttpStatus(429), "retryable_failure");
  assert.equal(classifyProviderHttpStatus(500), "retryable_failure");
  assert.equal(classifyProviderHttpStatus(599), "retryable_failure");
  assert.equal(classifyProviderHttpStatus(200), "accepted");
  assert.equal(classifyProviderHttpStatus(202), "accepted");
  assert.equal(classifyProviderHttpStatus(400), "permanent_failure");
  assert.equal(classifyProviderHttpStatus(401), "permanent_failure");
  assert.equal(classifyProviderHttpStatus(409), "permanent_failure");
  assert.equal(retryDelayMs("3", 0), 3000);
  assert.equal(retryDelayMs("not-a-delay", 2), 4000);
});

test("kill switch and shared circuit reserve are fail-closed and count retries", () => {
  const base = {
    killSwitch: false,
    circuitOpen: false,
    requestsThisHour: 0,
    accountsThisHour: new Set<string>(),
    maxRequestsPerHour: 3,
    maxAccountsPerHour: 2,
  };
  const first = reserveDestructiveAttempt(base, userA);
  assert.equal(first.reserved, true);
  const retry = reserveDestructiveAttempt(first.next, userA);
  assert.equal(retry.reserved, true);
  const secondAccount = reserveDestructiveAttempt(retry.next, userB);
  assert.equal(secondAccount.reserved, true);
  const overRequests = reserveDestructiveAttempt(secondAccount.next, userB);
  assert.equal(overRequests.reserved, false);
  assert.equal(overRequests.reason, "request_limit");
  assert.equal(overRequests.next.circuitOpen, true);
  const overAccounts = reserveDestructiveAttempt({
    ...base,
    accountsThisHour: new Set([userA, userB]),
  }, userC);
  assert.equal(overAccounts.reserved, false);
  assert.equal(overAccounts.reason, "account_limit");
  const killed = reserveDestructiveAttempt(
    { ...base, killSwitch: true },
    userA,
  );
  assert.equal(killed.reserved, false);
  assert.equal(killed.reason, "kill_switch");
});

test("disposable worker mode is server-allowlist-only and requests cannot select targets", () => {
  assert.equal(shouldProcessTarget("disabled", userA, new Set([userA])), false);
  assert.equal(shouldProcessTarget("disposable", userA, new Set([userA])), true);
  assert.equal(shouldProcessTarget("disposable", userB, new Set([userA])), false);
  assert.equal(validateNoTargetRequest("https://worker.example.test", ""), true);
  assert.equal(validateNoTargetRequest("https://worker.example.test?user_id=" + userA, ""), false);
  assert.equal(validateNoTargetRequest("https://worker.example.test", JSON.stringify({ user_id: userA })), false);
  assert.equal(validateNoTargetRequest("https://worker.example.test", "[]"), false);
});

test("lease guard prevents a fetch after kill switch and serializes concurrent dispatch", async () => {
  let fetches = 0;
  let leaseAvailable = true;
  const guard = async () => {
    await Promise.resolve();
    if (!leaseAvailable) return false;
    leaseAvailable = false;
    return true;
  };
  const dispatch = () => {
    fetches += 1;
    return Promise.resolve("sent");
  };

  const [first, second] = await Promise.all([
    dispatchWithLeaseGuard(guard, dispatch),
    dispatchWithLeaseGuard(guard, dispatch),
  ]);
  assert.equal(fetches, 1);
  assert.equal([first.dispatched, second.dispatched].filter(Boolean).length, 1);

  const blocked = await dispatchWithLeaseGuard(
    async () => false,
    async () => {
      fetches += 1;
      return "must-not-send";
    },
  );
  assert.deepEqual(blocked, { dispatched: false });
  assert.equal(fetches, 1);
});