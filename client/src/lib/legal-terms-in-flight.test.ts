import assert from "node:assert/strict";
import test from "node:test";
import { createLegalTermsAcceptanceAttemptTracker } from "./legal-terms-in-flight";

test("terms acceptance attempts are owned and ref-counted through timeout", () => {
  const callbacks: Array<() => void> = [];
  const cleared: unknown[] = [];
  let changes = 0;
  const tracker = createLegalTermsAcceptanceAttemptTracker(
    () => { changes += 1; },
    1,
    {
      setTimeout: (callback) => {
        callbacks.push(callback);
        return callbacks.length as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimeout: (timer) => { cleared.push(timer); },
    },
  );

  const first = tracker.begin();
  const second = tracker.begin();
  tracker.finish(first);
  assert.equal(tracker.isInFlight(), true);

  callbacks[1]();
  assert.equal(tracker.isInFlight(), false);
  assert.equal(cleared.length, 2);
  assert.equal(changes, 4);
});