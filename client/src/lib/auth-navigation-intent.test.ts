import assert from "node:assert/strict";
import { test } from "node:test";
import { createAuthNavigationIntent, validInternalDestination } from "./auth-navigation-intent";

function fixture() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  let clock = 1000, counter = 0;
  const create = () => createAuthNavigationIntent(() => storage, () => clock, () => `attempt-${++counter}`);
  return { intent: create(), create, storage, advance: () => { clock += 30 * 60 * 1000; } };
}

test("valid internal destinations retain challenge parameters and anchors", () => {
  for (const path of ["/play?challenge=game-1&sender=friend", "/leaderboard?share=snapshot&category=books", "/user/person#ratings", "/onboarding?resume=dna"]) {
    assert.equal(validInternalDestination(path), path);
  }
  for (const path of ["//evil.example", "/\\evil.example", "https://evil.example", "/%2f%2fevil.example", "/login?tab=signup", "/%6cogin", "/auth/callback", "/reset-password", "/activity?access_token=private", "/activity#refresh_token=private", "/bad\npath"]) {
    assert.equal(validInternalDestination(path), null, path);
  }
});

test("explicit guest destination belongs to one successful authentication attempt and is consumed once", () => {
  const { intent } = fixture();
  const login = intent.login("/play?challenge=exact&sender=friend");
  assert.equal(intent.begin(login), "attempt-1");
  intent.observeAccount("user-a", null, login);
  assert.equal(intent.takeAfterLogin("user-a"), "/play?challenge=exact&sender=friend");
  assert.equal(intent.takeAfterLogin("user-a"), null);
});

test("ordinary login cannot restore a legacy, abandoned or already authenticated destination", () => {
  const { intent, storage } = fixture();
  storage.setItem("returnUrl", "/profile");
  intent.login("/people?tab=friends");
  assert.equal(intent.begin("/login"), null);
  intent.observeAccount("user-a", null, "/login");
  assert.equal(intent.takeAfterLogin("user-a"), null);
});

test("destination expires instead of surviving into a later session", () => {
  const { intent, advance } = fixture();
  const login = intent.login("/play?challenge=old");
  intent.begin(login);
  advance();
  intent.observeAccount("user-a", null, login);
  assert.equal(intent.takeAfterLogin("user-a"), null);
});

test("signup awaiting verification retains the current attempt, but not another browser context", () => {
  const f = fixture();
  const login = f.intent.login("/people?tab=friends");
  f.intent.begin(login);
  f.intent.observeAccount(null, null, login);
  // Verification resumes in this initiating login context.
  const resumed = f.create();
  resumed.observeAccount("verified-user", null, login);
  assert.equal(resumed.takeAfterLogin("verified-user"), "/people?tab=friends");
  const other = fixture();
  const original = other.intent.login("/play?challenge=old");
  other.intent.begin(original);
  const unrelated = other.create();
  unrelated.observeAccount("different-user", null, "/activity");
  assert.equal(unrelated.takeAfterLogin("different-user"), null);
});

test("Google/Apple web callback restores only the correlated attempt", () => {
  for (const provider of ["google", "apple"]) {
    const f = fixture();
    const login = f.intent.login(`/media/movie/tmdb/123?from=${provider}`);
    f.intent.begin(login);
    const callback = f.create();
    callback.observeAccount("oauth-user", null, `https://app.example${login}`);
    assert.equal(callback.takeAfterLogin("oauth-user"), `/media/movie/tmdb/123?from=${provider}`);
  }
});

test("native cold callback requires its verified initiating OAuth attempt", () => {
  const f = fixture();
  const login = f.intent.login("/leaderboard?share=exact&category=books");
  f.intent.begin(login, "native-oauth-attempt");
  const cold = f.create();
  cold.verifyNativeCallback("native-oauth-attempt");
  cold.observeAccount("native-user", null, "capacitor://localhost/");
  assert.equal(cold.takeAfterLogin("native-user"), "/leaderboard?share=exact&category=books");
  const bad = fixture();
  bad.intent.begin(bad.intent.login("/play?challenge=other"), "correct");
  const mismatch = bad.create();
  mismatch.verifyNativeCallback("wrong");
  mismatch.observeAccount("native-user", null, "/");
  assert.equal(mismatch.takeAfterLogin("native-user"), null);
});

test("sign-out, cancellation and failed authentication discard pending destinations", () => {
  for (const reason of ["signout", "cancelled", "failed"]) {
    const { intent, storage } = fixture();
    const login = intent.login(`/play?challenge=${reason}`);
    intent.begin(login);
    // Notification startup routes must not outlive their owning attempt either.
    storage.setItem("pendingRoute", "/play?challenge=notification");
    intent.clear();
    assert.equal(storage.getItem("pendingRoute"), null);
    intent.observeAccount("next-user", null, login);
    assert.equal(intent.takeAfterLogin("next-user"), null);
  }
});

test("direct account replacement cannot inherit the first user's pending destination", () => {
  const { intent } = fixture();
  const login = intent.login("/people?tab=friends");
  intent.begin(login);
  intent.observeAccount("user-a", null, login);
  intent.observeAccount("user-b", "user-a", login);
  assert.equal(intent.takeAfterLogin("user-b"), null);
  assert.equal(intent.takeAfterLogin("user-a"), null);
});

test("current native navigation can deliver to its owner, not a different account", () => {
  const f = fixture();
  f.intent.capture("/play?challenge=exact", "user-a");
  assert.equal(f.intent.takeNavigation("user-b"), null);
  assert.equal(f.intent.takeNavigation("user-a"), "/play?challenge=exact");
  assert.equal(f.intent.takeNavigation("user-a"), null);
});

test("recovery discards old authentication intent but preserves a separate deferred native share", () => {
  const f = fixture();
  f.intent.begin(f.intent.login("/play?challenge=old"), "oauth");
  f.intent.discardAuthentication();
  assert.equal(f.intent.peek(), null);
  f.intent.capture("/media/book/googlebooks/exact", "user-a");
  f.storage.setItem("pendingSharedRoute", "/media/book/googlebooks/exact");
  f.intent.discardAuthentication();
  assert.equal(f.intent.takeNavigation("user-a"), "/media/book/googlebooks/exact");
});

test("a newer native link received during login wins once without crossing accounts", () => {
  const f = fixture();
  f.intent.capture("/play?challenge=new", "user-a");
  f.storage.setItem("pendingSharedRoute", "/play?challenge=new");
  assert.equal(f.intent.takeAfterLogin("user-a"), "/play?challenge=new");
  assert.equal(f.intent.takeAfterLogin("user-a"), null);
  f.intent.capture("/play?challenge=private", "user-a");
  f.storage.setItem("pendingSharedRoute", "/play?challenge=private");
  assert.equal(f.intent.takeAfterLogin("user-b"), null);
});
