import assert from "node:assert/strict";
import test from "node:test";
import {
  canReuseGuestToken,
  guestTokenExpiry,
  isCaptureContextCurrent,
} from "./posthog-authorization";

const guestToken = "v1.nonce.1900000000.signature";

test("deferred A callback is invalid after the auth generation changes to B", async () => {
  let state = {
    generation: 7,
    expectedUuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    captureAllowed: true,
  };
  const context = {
    generation: state.generation,
    expectedUuid: state.expectedUuid,
    mode: "authenticated" as const,
  };
  let resolve!: () => void;
  const deferred = new Promise<void>((done) => {
    resolve = done;
  });
  const callback = deferred.then(() => isCaptureContextCurrent(context, state));

  state = {
    generation: 8,
    expectedUuid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    captureAllowed: true,
  };
  resolve();

  assert.equal(await callback, false);
});

test("guest expiry is renewed and failed cache state can be retried", () => {
  const expiry = guestTokenExpiry(guestToken);
  assert.equal(expiry, 1900000000);
  assert.equal(canReuseGuestToken(guestToken, expiry, 1899999970), false);
  assert.equal(canReuseGuestToken(guestToken, expiry, 1899999800), true);

  // A failed request has no reusable token. The next attempt must not be
  // blocked by a retained rejected promise.
  assert.equal(canReuseGuestToken(null, 0, 1900000000), false);
});