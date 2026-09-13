import assert from "node:assert/strict";
import test from "node:test";
import {
  clearRecoveryAuthFlow,
  consumeRecoveryAuthFlow,
  isRecoveryAuthCallback,
  markRecoveryAuthFlow,
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