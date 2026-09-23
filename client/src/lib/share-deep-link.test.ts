import assert from "node:assert/strict";
import { test } from "node:test";
import { sharedRouteFromPath, sharedRouteFromUrl } from "./share-deep-link";

test("routes different media providers and preserves share query parameters", () => {
  assert.equal(
    sharedRouteFromUrl("https://app.consumedapp.com/media/book/googlebooks/Hq9PEAAAQBAJ"),
    "/media/book/googlebooks/Hq9PEAAAQBAJ",
  );
  assert.equal(
    sharedRouteFromUrl("https://app.consumedapp.com/media/book/openlibrary/works/OL123?ref=friend"),
    "/media/book/openlibrary/works/OL123?ref=friend",
  );
  assert.equal(sharedRouteFromPath("/media/movie/tmdb/951"), "/media/movie/tmdb/951");
  assert.equal(sharedRouteFromUrl("https://app.consumedapp.com/invite/user-123"), "/invite/user-123");
});

test("rejects other origins, callbacks, encoded path tricks and token-bearing URLs", () => {
  for (const url of [
    "https://evil.example/media/book/googlebooks/Hq9PEAAAQBAJ",
    "http://app.consumedapp.com/media/book/googlebooks/Hq9PEAAAQBAJ",
    "https://app.consumedapp.com.evil.example/media/book/googlebooks/Hq9PEAAAQBAJ",
    "https://app.consumedapp.com/auth/callback?oauth_attempt=attempt",
    "https://app.consumedapp.com/reset-password#access_token=secret",
    "https://app.consumedapp.com/media/book/googlebooks/%2fprivate",
    "https://app.consumedapp.com/media/book/googlebooks/Hq9PEAAAQBAJ?access_token=secret",
    "https://app.consumedapp.com/admin",
    "com.entertainlit.consumed://auth/callback",
  ]) assert.equal(sharedRouteFromUrl(url), null, url);
  assert.equal(sharedRouteFromPath("//evil.example/media/book/googlebooks/id"), null);
  assert.equal(sharedRouteFromPath("/login"), null);
});