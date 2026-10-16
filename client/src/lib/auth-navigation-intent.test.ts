import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { classifyWebOAuthReturn, createAuthNavigationIntent, validInternalDestination, type WebOAuthReturn } from "./auth-navigation-intent";

function fixture() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  let clock = 1000, counter = 0;
  const create = (callback: WebOAuthReturn = "none") => createAuthNavigationIntent(
    () => storage, () => clock, () => `attempt-${++counter}`, { callback },
  );
  return { intent: create(), create, storage, advance: (minutes = 30) => { clock += minutes * 60 * 1000; } };
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

test("Google/Apple web callback resumes at exact login only after existing SDK success", () => {
  for (const provider of ["google", "apple"]) {
    const f = fixture();
    const login = f.intent.login(`/media/movie/tmdb/123?from=${provider}`);
    f.intent.beginWebOAuth(login);
    const callback = f.create("response");
    assert.equal(callback.prepareWebOAuthReturn(), true);
    callback.finishWebOAuthReturn(true);
    callback.observeAccount("oauth-user", null, "https://app.example/login");
    assert.equal(callback.takeAfterLogin("oauth-user"), `/media/movie/tmdb/123?from=${provider}`);
    assert.equal(callback.takeAfterLogin("oauth-user"), null);
  }
});

test("the actual web OAuth starter sends exact login for Google/Apple with or without a destination", async () => {
  const auth = readFileSync(new URL("./auth.tsx", import.meta.url), "utf8");
  const source = auth.slice(auth.indexOf("  const signInWithOAuth = async"), auth.indexOf("  const resetPassword = async"));
  assert.ok(source.startsWith("  const signInWithOAuth"));
  const compiled = transformSync(source, {
    loader: "ts",
    define: { "import.meta.env.VITE_APP_URL": JSON.stringify("https://app.consumedapp.com") },
  }).code;
  for (const provider of ["google", "apple"]) for (const origin of ["https://app.consumedapp.com", "https://development.example"]) {
    for (const pending of [false, true]) {
      const calls: any[] = [];
      const dependencies = {
        clearOAuthTermsConsentAttempt() {},
        Capacitor: { isNativePlatform: () => false },
        window: { location: { origin, href: `${origin}/login?navigation_intent=internal-only` } },
        authNavigationIntent: { beginWebOAuth: () => pending ? "must-not-enter-redirect-url" : null },
        supabase: { auth: { signInWithOAuth: async (options: unknown) => {
          calls.push(options);
          return { data: { url: null }, error: null };
        } } },
      };
      const start = new Function(...Object.keys(dependencies), compiled + "\nreturn signInWithOAuth;")(...Object.values(dependencies));
      assert.deepEqual(await start(provider), { error: null });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].provider, provider);
      assert.equal(calls[0].options.redirectTo, `${origin}/login`);
    }
  }
});

test("callback classification stores presence only and excludes errors, email actions and recovery", () => {
  assert.equal(classifyWebOAuthReturn("https://app.example/login#access_token=fake&refresh_token=fake"), "response");
  for (const url of [
    "https://app.example/login",
    "https://app.example/login?code=unrelated",
    "https://app.example/login#access_token=fake&refresh_token=fake&type=signup",
    "https://app.example/reset-password#access_token=fake&refresh_token=fake",
  ]) assert.equal(classifyWebOAuthReturn(url), "none");
  assert.equal(classifyWebOAuthReturn("https://app.example/login?error=access_denied"), "error");
  assert.equal(classifyWebOAuthReturn("https://app.example/login#access_token=fake&refresh_token=fake&type=recovery"), "recovery");
});

test("ordinary login, provider error and recovery cannot adopt an abandoned web destination", () => {
  for (const kind of ["none", "error", "recovery"] as const) {
    const f = fixture();
    f.intent.beginWebOAuth(f.intent.login("/play?challenge=abandoned"));
    const callback = f.create(kind);
    assert.equal(callback.prepareWebOAuthReturn(), false);
    callback.observeAccount("later-user", null, "/login");
    assert.equal(callback.takeAfterLogin("later-user"), null);
  }
});

test("a failed SDK callback cannot restore a destination using an existing session", () => {
  const f = fixture();
  f.intent.beginWebOAuth(f.intent.login("/play?challenge=exact"));
  const callback = f.create("response");
  assert.equal(callback.prepareWebOAuthReturn(), true);
  callback.finishWebOAuthReturn(false);
  callback.observeAccount("existing-user", null, "/login");
  assert.equal(callback.takeAfterLogin("existing-user"), null);
});

test("web continuation expires at ten minutes, without extending original destination expiry", () => {
  for (const minutes of [10, 11]) {
    const f = fixture();
    f.intent.beginWebOAuth(f.intent.login("/play?challenge=old"));
    f.advance(minutes);
    const callback = f.create("response");
    assert.equal(callback.prepareWebOAuthReturn(), false);
    callback.finishWebOAuthReturn(true);
    callback.observeAccount("user-a", null, "/login");
    assert.equal(callback.takeAfterLogin("user-a"), null);
  }
  const f = fixture();
  const login = f.intent.login("/play?challenge=old");
  f.advance(29);
  f.intent.beginWebOAuth(login);
  f.advance(1);
  assert.equal(f.create("response").prepareWebOAuthReturn(), false);
});

test("a valid web continuation binds to its account and is consumed once", () => {
  const f = fixture();
  f.intent.beginWebOAuth(f.intent.login("/play?challenge=current#result"));
  f.advance(9);
  const callback = f.create("response");
  callback.prepareWebOAuthReturn();
  callback.finishWebOAuthReturn(true);
  callback.observeAccount("user-a", null, "/login");
  assert.equal(callback.peek()?.userId, "user-a");
  assert.equal(callback.takeAfterLogin("user-b"), null);
  assert.equal(callback.takeAfterLogin("user-a"), null);
});

test("a previously owned destination cannot bind to another OAuth account", () => {
  const f = fixture();
  const login = f.intent.login("/play?challenge=owned");
  f.intent.observeAccount("user-a", null, login);
  f.intent.beginWebOAuth(login);
  const callback = f.create("response");
  callback.prepareWebOAuthReturn();
  callback.finishWebOAuthReturn(true);
  callback.observeAccount("user-b", null, "/login");
  assert.equal(callback.takeAfterLogin("user-b"), null);
});

test("sign-out and replacement in another context invalidate a pending return", () => {
  for (const nextUser of [null, "user-b"]) {
    const f = fixture();
    f.intent.beginWebOAuth(f.intent.login("/play?challenge=old"));
    const otherContext = f.create();
    otherContext.observeAccount(nextUser, "user-a", "/activity");
    assert.equal(f.create("response").prepareWebOAuthReturn(), false);
  }
  const f = fixture();
  f.intent.beginWebOAuth(f.intent.login("/play?challenge=old"));
  const callback = f.create("response");
  callback.prepareWebOAuthReturn();
  f.create().invalidateAccountBoundary();
  callback.finishWebOAuthReturn(true);
  callback.observeAccount("user-a", null, "/login");
  assert.equal(callback.takeAfterLogin("user-a"), null);
});

test("independent tab and reload after authorization cannot replay a web return", () => {
  const f = fixture();
  f.intent.beginWebOAuth(f.intent.login("/play?challenge=current"));
  const other = fixture().create("response");
  assert.equal(other.prepareWebOAuthReturn(), false);
  const callback = f.create("response");
  callback.prepareWebOAuthReturn();
  callback.finishWebOAuthReturn(true);
  callback.observeAccount("user-a", null, "/login");
  const reloaded = f.create();
  assert.equal(reloaded.prepareWebOAuthReturn(), false);
  assert.equal(reloaded.takeAfterLogin("user-a"), null);
});

test("blocked revision storage fails closed without preventing ordinary authentication", () => {
  const f = fixture();
  const intent = createAuthNavigationIntent(() => f.storage, Date.now, () => "fresh", {
    revisionStorage: () => { throw new Error("Storage disabled"); },
  });
  assert.equal(intent.beginWebOAuth(intent.login("/play")), null);
  intent.observeAccount("user-a", null, "/login");
  assert.equal(intent.takeAfterLogin("user-a"), null);
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
