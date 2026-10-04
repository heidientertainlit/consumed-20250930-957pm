import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { feedMediaHref, resolveFeedMediaIdentity, storedFeedMediaIdentity } from "./feed-media-navigation";

test("stored provider IDs navigate directly without searching, including embedded bot media", async () => {
  const post = { mediaTitle: "The Bear", mediaType: "tv", mediaItems: [{ externalId: 136315, externalSource: "tmdb" }] };
  const identity = await resolveFeedMediaIdentity(post, async () => { throw new Error("Should not search"); });
  assert.equal(feedMediaHref(identity!), "/media/tv/tmdb/136315");
  assert.equal(feedMediaHref(storedFeedMediaIdentity({ mediaType: "book", media_external_id: "book/id", media_external_source: "googlebooks" })!), "/media/book/googlebooks/book%2Fid");
});

test("title-only bot posts resolve to media detail routes, not an inert poster or first wrong result", async () => {
  const identity = await resolveFeedMediaIdentity({ mediaTitle: "The Bear", mediaType: "TV Show" }, async (title, type) => {
    assert.equal(title, "The Bear"); assert.equal(type, "tv");
    return [{ title: "Bear Country", type: "tv", externalId: "wrong", externalSource: "tmdb" },
      { title: "The Bear", type: "tv", externalId: 136315, externalSource: "tmdb" }];
  });
  assert.equal(feedMediaHref(identity!), "/media/tv/tmdb/136315");
});

test("books/music retain their provider and supplied creator identity; no TMDB guess", async () => {
  const identity = await resolveFeedMediaIdentity({ mediaTitle: "Blonde", mediaType: "music", mediaCreator: "Frank Ocean" }, async () => [
    { title: "Blonde", creator: "Another Artist", externalId: "wrong", externalSource: "itunes" },
    { title: "Blonde", creator: "Frank Ocean", externalId: "real", externalSource: "itunes" },
  ]);
  assert.equal(feedMediaHref(identity!), "/media/music/itunes/real");
  assert.equal(storedFeedMediaIdentity({ mediaType: "book", externalId: "42", externalSource: "tmdb" }), null);
});

test("ambiguous, incomplete and wrong-medium results fail explicitly rather than guessing", async () => {
  const post = { mediaTitle: "The Thing", mediaType: "movie" };
  const match = { title: "The Thing", type: "movie", externalSource: "tmdb", externalId: "1" };
  assert.equal(await resolveFeedMediaIdentity(post, async () => [match, { ...match, externalId: "2" }]), null);
  assert.equal(await resolveFeedMediaIdentity(post, async () => [{ ...match, type: "tv" }]), null);
  assert.equal(await resolveFeedMediaIdentity(post, async () => [{ ...match, externalSource: "" }]), null);
  assert.equal(await resolveFeedMediaIdentity({ mediaType: "movie" }, async () => { throw new Error("Should not search"); }), null);
  assert.equal(feedMediaHref((await resolveFeedMediaIdentity(post, async () => [match, match]))!), "/media/movie/tmdb/1");
});

test("feed image posters, fallback tiles and rated posters bind the same navigation handler", () => {
  const source = readFileSync("client/src/pages/feed.tsx", "utf8");
  assert.ok(source.includes("useFeedMediaNavigation(post, session?.access_token)"));
  assert.ok(source.includes('aria-label={`Open ${post.mediaTitle} media details`}'));
  assert.ok(source.includes("void posterNavigation.open()"));
});