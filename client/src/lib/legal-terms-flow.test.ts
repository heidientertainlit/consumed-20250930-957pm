import assert from "node:assert/strict";
import test from "node:test";
import { LEGAL_TERMS_VERSION } from "./legal-terms";
import {
  isCurrentLegalTermsVersion,
  isFreshOAuthConsentAttempt,
  matchesOAuthConsentAttempt,
  saveLegalTermsAcceptance,
} from "./legal-terms-flow";

const baseAttempt = {
  provider: "google" as const,
  termsVersion: LEGAL_TERMS_VERSION,
  issuedAt: 1_000,
};

test("OAuth consent attempts are bound to the callback account and provider", () => {
  assert.equal(
    matchesOAuthConsentAttempt({
      attempt: baseAttempt,
      userId: "account-a",
      authSignInUserId: "account-a",
      provider: "google",
      now: 2_000,
    }),
    true,
  );
  assert.equal(
    matchesOAuthConsentAttempt({
      attempt: baseAttempt,
      userId: "account-b",
      authSignInUserId: "account-a",
      provider: "google",
      now: 2_000,
    }),
    false,
  );
  assert.equal(
    matchesOAuthConsentAttempt({
      attempt: baseAttempt,
      userId: "account-a",
      authSignInUserId: "account-a",
      provider: "apple",
      now: 2_000,
    }),
    false,
  );
});

test("OAuth consent attempts expire and future-dated attempts are rejected", () => {
  assert.equal(isFreshOAuthConsentAttempt(baseAttempt, 1_000 + 10 * 60 * 1000), true);
  assert.equal(isFreshOAuthConsentAttempt(baseAttempt, 1_000 + 10 * 60 * 1000 + 1), false);
  assert.equal(isFreshOAuthConsentAttempt(baseAttempt, 999), false);
});

test("the durable version check accepts only the shared current version", () => {
  assert.equal(LEGAL_TERMS_VERSION, "2026-09-13");
  assert.equal(isCurrentLegalTermsVersion("2026-09-13"), true);
  assert.equal(isCurrentLegalTermsVersion("2026-09-12"), false);
  assert.equal(isCurrentLegalTermsVersion(""), false);
});

test("unchecked consent never calls the durable save RPC", async () => {
  let calls = 0;
  const result = await saveLegalTermsAcceptance({
    checked: false,
    rpc: async () => {
      calls += 1;
      return { error: null };
    },
  });

  assert.equal(calls, 0);
  assert.match(result.error?.message ?? "", /agree to the Terms/i);
});

test("stale version and failed RPC errors remain explicit", async () => {
  let calls = 0;
  const stale = await saveLegalTermsAcceptance({
    checked: true,
    version: "2026-09-12",
    rpc: async () => {
      calls += 1;
      return { error: null };
    },
  });
  assert.equal(calls, 0);
  assert.match(stale.error?.message ?? "", /not current/i);

  const rpcFailure = new Error("network unavailable");
  const failed = await saveLegalTermsAcceptance({
    checked: true,
    rpc: async () => {
      throw rpcFailure;
    },
  });
  assert.equal(failed.error, rpcFailure);
});