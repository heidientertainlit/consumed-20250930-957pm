import assert from "node:assert/strict";
import test from "node:test";
import {
  isTrustedNativeOAuthAuthorizationUrl,
  parseNativeAuthCallback,
} from "./native-oauth";

const supabaseUrl = "https://project.supabase.co";

test("only the configured HTTPS Supabase authorize endpoint opens natively", () => {
  assert.equal(
    isTrustedNativeOAuthAuthorizationUrl(
      "https://project.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fapp.consumedapp.com%2Fauth%2Fcallback%3Foauth_attempt%3Dattempt-1",
      supabaseUrl,
      "google",
      "https://app.consumedapp.com/auth/callback?oauth_attempt=attempt-1",
    ),
    true,
  );
  assert.equal(
    isTrustedNativeOAuthAuthorizationUrl(
      "https://project.supabase.co/auth/v1/authorize?provider=apple&redirect_to=https%3A%2F%2Fapp.consumedapp.com%2Fauth%2Fcallback%3Foauth_attempt%3Dattempt-1",
      supabaseUrl,
      "apple",
      "https://app.consumedapp.com/auth/callback?oauth_attempt=attempt-1",
    ),
    true,
  );
  assert.equal(
    isTrustedNativeOAuthAuthorizationUrl(
      "http://project.supabase.co/auth/v1/authorize?provider=google",
      supabaseUrl,
      "google",
      "https://app.consumedapp.com/login",
    ),
    false,
  );
  assert.equal(
    isTrustedNativeOAuthAuthorizationUrl(
      "https://attacker.example/auth/v1/authorize?provider=google",
      supabaseUrl,
      "google",
      "https://app.consumedapp.com/login",
    ),
    false,
  );
  assert.equal(
    isTrustedNativeOAuthAuthorizationUrl(
      "https://project.supabase.co/auth/v1/token",
      supabaseUrl,
      "google",
      "https://app.consumedapp.com/login",
    ),
    false,
  );
  assert.equal(
    isTrustedNativeOAuthAuthorizationUrl(
      "https://project.supabase.co/auth/v1/authorize?provider=apple&redirect_to=https%3A%2F%2Fapp.consumedapp.com%2Flogin",
      supabaseUrl,
      "google",
      "https://app.consumedapp.com/login",
    ),
    false,
  );
  assert.equal(
    isTrustedNativeOAuthAuthorizationUrl(
      "https://project.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fattacker.example%2Flogin",
      supabaseUrl,
      "google",
      "https://app.consumedapp.com/login",
    ),
    false,
  );
});

test("native callbacks require the exact app path and callback type", () => {
  assert.deepEqual(
    parseNativeAuthCallback(
      "https://app.consumedapp.com/auth/callback?oauth_attempt=attempt-1#access_token=access&refresh_token=refresh",
      "https://app.consumedapp.com",
      (attemptId) => attemptId === "attempt-1",
    ),
    {
      kind: "oauth-session",
      accessToken: "access",
      refreshToken: "refresh",
      attemptId: "attempt-1",
    },
  );
  assert.deepEqual(
    parseNativeAuthCallback(
      "https://app.consumedapp.com/login?oauth_attempt=attempt-1#access_token=access&refresh_token=refresh",
      "https://app.consumedapp.com",
      (attemptId) => attemptId === "attempt-1",
    ),
    {
      kind: "oauth-session",
      accessToken: "access",
      refreshToken: "refresh",
      attemptId: "attempt-1",
    },
  );
  assert.deepEqual(
    parseNativeAuthCallback(
      "https://app.consumedapp.com/reset-password#type=recovery&access_token=access&refresh_token=refresh",
      "https://app.consumedapp.com",
      () => false,
    ),
    { kind: "recovery-session", accessToken: "access", refreshToken: "refresh" },
  );
  assert.deepEqual(
    parseNativeAuthCallback(
      "https://app.consumedapp.com/auth/callback?oauth_attempt=attempt-1&error=access_denied",
      "https://app.consumedapp.com",
      (attemptId) => attemptId === "attempt-1",
    ),
    { kind: "oauth-error", attemptId: "attempt-1" },
  );
  assert.equal(
    parseNativeAuthCallback(
      "https://app.consumedapp.com/auth/wrong?oauth_attempt=attempt-1#access_token=access&refresh_token=refresh",
      "https://app.consumedapp.com",
      () => true,
    ),
    null,
  );
  assert.equal(
    parseNativeAuthCallback(
      "https://attacker.example/login#access_token=access&refresh_token=refresh",
      "https://app.consumedapp.com",
      () => true,
    ),
    null,
  );
  assert.equal(
    parseNativeAuthCallback(
      "https://app.consumedapp.com/login#type=recovery&access_token=access&refresh_token=refresh",
      "https://app.consumedapp.com",
      () => true,
    ),
    null,
  );
  assert.equal(
    parseNativeAuthCallback(
      "https://app.consumedapp.com/login?oauth_attempt=old#access_token=access&refresh_token=refresh",
      "https://app.consumedapp.com",
      () => false,
    ),
    null,
  );
  assert.equal(
    parseNativeAuthCallback(
      "https://app.consumedapp.com/login#access_token=access&refresh_token=refresh",
      "https://app.consumedapp.com",
      () => true,
    ),
    null,
  );
});