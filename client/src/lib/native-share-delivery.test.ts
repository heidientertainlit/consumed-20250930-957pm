import assert from "node:assert/strict";
import { test } from "node:test";
import { createNativeShareDelivery, sharedNavigationReady } from "./native-share-delivery";
import { PENDING_SHARED_ROUTE } from "./share-deep-link";

const animals = "https://app.consumedapp.com/media/movie/tmdb/1236045";
const second = "https://app.consumedapp.com/media/book/googlebooks/Hq9PEAAAQBAJ";
const animalPath = "/media/movie/tmdb/1236045";
function fixture() {
  const values = new Map<string, string>();
  const store = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const delivery = createNativeShareDelivery(() => store);
  const visits: string[] = [];
  const navigate = (route: string) => { visits.push(route); };
  return { store, delivery, visits, navigate };
}

test("early media event survives until router and startup are ready", () => {
  const { delivery, visits, navigate, store } = fixture();
  delivery.capture(animals);
  delivery.consume(false, navigate);
  assert.equal(store.getItem(PENDING_SHARED_ROUTE), animalPath);
  delivery.consume(true, navigate);
  delivery.consume(true, navigate);
  assert.deepEqual(visits, [animalPath]);
});

test("cold launch fallback navigates exact Animals URL only once across remounts", async () => {
  const { delivery, visits, navigate } = fixture();
  let calls = 0;
  const unsubscribe = delivery.subscribe(() => delivery.consume(true, navigate));
  await delivery.recoverLaunchUrl(async () => { calls++; return { url: animals }; });
  unsubscribe();
  delivery.subscribe(() => delivery.consume(true, navigate));
  await delivery.recoverLaunchUrl(async () => { calls++; return { url: animals }; });
  assert.equal(calls, 1);
  assert.deepEqual(visits, [animalPath]);
});

test("late launch response cannot overwrite or replay after newer warm events", async () => {
  const { delivery, visits, navigate } = fixture();
  let resolve!: (value: { url: string }) => void;
  const launch = delivery.recoverLaunchUrl(() => new Promise(r => { resolve = r; }));
  delivery.subscribe(() => delivery.consume(true, navigate));
  delivery.capture(animals);
  delivery.capture(second);
  resolve({ url: animals });
  await launch;
  assert.deepEqual(visits, [animalPath, "/media/book/googlebooks/Hq9PEAAAQBAJ"]);
});

test("newest deferred link wins and resumes after startup/auth priority clears", async () => {
  const { delivery, store, visits, navigate } = fixture();
  store.setItem("pendingOAuthSession", "fixture");
  delivery.capture(animals);
  delivery.capture(second);
  delivery.consume(sharedNavigationReady(store, "/", false, true), navigate);
  store.removeItem("pendingOAuthSession");
  delivery.consume(sharedNavigationReady(store, "/login", false, true, true), navigate);
  assert.deepEqual(visits, []);
  delivery.consume(sharedNavigationReady(store, "/activity", false, true, true), navigate);
  assert.deepEqual(visits, ["/media/book/googlebooks/Hq9PEAAAQBAJ"]);
});

test("recovery stays primary after its stored token is consumed; share resumes on exit", () => {
  const { delivery, store, visits, navigate } = fixture();
  delivery.capture(animals);
  store.setItem("pendingRecovery", "fixture");
  delivery.consume(sharedNavigationReady(store, "/", false, true), navigate);
  store.removeItem("pendingRecovery");
  delivery.consume(sharedNavigationReady(store, "/reset-password", false, true), navigate);
  assert.deepEqual(visits, []);
  delivery.consume(sharedNavigationReady(store, "/activity", false, true), navigate);
  assert.deepEqual(visits, [animalPath]);
});

test("guest media delivery is allowed; loading, startup, onboarding and push routing defer", () => {
  const { store } = fixture();
  assert.equal(sharedNavigationReady(store, "/", false, true), true);
  assert.equal(sharedNavigationReady(store, "/login", false, true, false), true);
  assert.equal(sharedNavigationReady(store, "/", true, true), false);
  assert.equal(sharedNavigationReady(store, "/", false, false), false);
  for (const path of ["/onboarding", "/reset-password", "/auth/callback"]) {
    assert.equal(sharedNavigationReady(store, path, false, true), false, path);
  }
  store.setItem("pendingRoute", "/activity");
  assert.equal(sharedNavigationReady(store, "/", false, true), false);
});

test("unmounted subscribers never navigate; queued delivery survives remount", async () => {
  const { delivery, visits, navigate } = fixture();
  const unsubscribe = delivery.subscribe(() => delivery.consume(true, navigate));
  unsubscribe();
  delivery.capture(animals);
  assert.deepEqual(visits, []);
  delivery.consume(true, navigate);
  assert.deepEqual(visits, [animalPath]);
});

test("invalid external/auth URLs cannot replace queued public shares", () => {
  const { delivery, visits, navigate } = fixture();
  delivery.capture(animals);
  for (const url of [
    "https://evil.example/media/movie/tmdb/1236045",
    "https://app.consumedapp.com/reset-password#access_token=fixture",
    "com.entertainlit.consumed://auth/callback",
    "https://app.consumedapp.com/media/movie/tmdb/1236045?access_token=fixture",
  ]) assert.equal(delivery.capture(url), false);
  delivery.consume(true, navigate);
  assert.deepEqual(visits, [animalPath]);
});

test("other approved share destinations retain query parameters", () => {
  const { delivery, visits, navigate } = fixture();
  for (const route of ["/invite/friend", "/edna/profile", "/rank/list", "/leaderboard?share=signed", "/play?game=daily"]) {
    assert.equal(delivery.capture(`https://app.consumedapp.com${route}`), true);
    delivery.consume(true, navigate);
    assert.equal(visits.at(-1), route);
  }
});
