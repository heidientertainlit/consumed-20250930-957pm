import assert from "node:assert/strict";
import test from "node:test";
import { isFinishedList, saveFinishedReaction } from "./finished-media-follow-up";

const media = { title: "A Test Film", mediaType: "movie", externalId: "fixture-id", externalSource: "tmdb", imageUrl: "https://example.test/cover.jpg" };
const base = { media, accessToken: "fixture-token", supabaseUrl: "https://example.test" };
function recorder(status = 200, body: any = {}) {
  const calls: any[] = [];
  const fetchImpl = (async (url: any, init: any) => {
    calls.push({ url, method: init.method, headers: init.headers, body: JSON.parse(init.body) });
    return Response.json(body, { status });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

test("only Finished triggers the new follow-up, never DNF or Favorites", () => {
  assert.equal(isFinishedList("Finished"), true);
  assert.equal(isFinishedList(" finished "), true);
  for (const list of ["Did Not Finish", "Not Finished", "Favorites", "Currently", "Want To", "All"]) {
    assert.equal(isFinishedList(list), false);
  }
});

test("reaction-only creates a thought with exact media identity and no rating deletion", async () => {
  const r = recorder();
  await saveFinishedReaction({ ...base, ...r, rating: 0, reaction: "  The ending stayed with me.  " });
  assert.equal(r.calls.length, 1);
  assert.equal(r.calls[0].url, "https://example.test/functions/v1/share-update");
  assert.equal(r.calls[0].body.content, "The ending stayed with me.");
  assert.equal(r.calls[0].body.type, "thought");
  assert.equal(r.calls[0].body.media_external_id, media.externalId);
  assert.equal(r.calls[0].body.media_external_source, media.externalSource);
  assert.equal("rating" in r.calls[0].body, false);
});

test("rating-only and rating with reaction use the supported rating/review contract", async () => {
  for (const reaction of ["", "A thoughtful finale."]) {
    const r = recorder();
    await saveFinishedReaction({ ...base, ...r, rating: 4.5, reaction });
    assert.equal(r.calls.length, 1);
    assert.equal(r.calls[0].url, "https://example.test/functions/v1/rate-media");
    assert.equal(r.calls[0].body.rating, 4.5);
    assert.equal(r.calls[0].body.review_content, reaction || undefined);
    assert.equal(r.calls[0].body.media_title, media.title);
    assert.equal(r.calls[0].method, "POST");
  }
});

test("skipping or blank input never re-adds, moves, deletes or posts anything", async () => {
  const r = recorder();
  await saveFinishedReaction({ ...base, ...r, rating: 0, reaction: "   " });
  assert.deepEqual(r.calls, []);
});

test("season and episode completion saves independently, including when optional fields are blank", async () => {
  for (const episodeNumber of [null, 2]) {
    const r = recorder();
    await saveFinishedReaction({
      ...base, ...r, media: { ...media, mediaType: "tv" }, rating: 0, reaction: "",
      scope: { listItemId: "fixture-item", seasonNumber: 4, episodeNumber, episodeTitle: "Episode name" },
    });
    assert.equal(r.calls.length, 1);
    assert.match(r.calls[0].url, /rest\/v1\/rpc\/save_finished_tv_scope$/);
    assert.equal(r.calls[0].body.p_season, 4);
    assert.equal(r.calls[0].body.p_episode, episodeNumber);
    assert.equal(r.calls[0].body.p_rating, null);
    assert.equal(r.calls[0].body.p_reaction, null);
  }
});

test("scoped stars never overwrite the whole-show rating; server errors do not silently fall back", async () => {
  const r = recorder();
  const input = { ...base, rating: 4.5, reaction: "Excellent episode.",
    scope: { listItemId: "fixture-item", seasonNumber: 4, episodeNumber: 2 } };
  await saveFinishedReaction({ ...input, ...r });
  assert.equal(r.calls[0].body.p_rating, 4.5);
  assert.equal(r.calls[0].body.p_reaction, "Excellent episode.");
  const unavailable = recorder(404, { code: "PGRST202" });
  await assert.rejects(saveFinishedReaction({ ...input, ...unavailable }), /isn't enabled/);
  assert.equal(unavailable.calls.length, 1);
});

test("missing identity blocks ratings but still permits reaction-only without inventing a provider", async () => {
  const r = recorder();
  const incomplete = { title: "Unknown edition", mediaType: "book" };
  await assert.rejects(saveFinishedReaction({ ...base, ...r, media: incomplete, rating: 3, reaction: "" }), /missing its rating details/);
  assert.equal(r.calls.length, 0);
  await saveFinishedReaction({ ...base, ...r, media: incomplete, rating: 0, reaction: "Great read." });
  assert.equal("media_external_source" in r.calls[0].body, false);
});

test("server rejection, expired auth and invalid input fail explicitly without tracking writes", async () => {
  const r = recorder(400, { error: "Please revise your reaction." });
  await assert.rejects(saveFinishedReaction({ ...base, ...r, rating: 0, reaction: "A draft." }), /Please revise/);
  for (const rating of [NaN, -1, 0.3, 5.5]) {
    await assert.rejects(saveFinishedReaction({ ...base, ...r, rating, reaction: "Draft" }), /choose a rating/);
  }
  await assert.rejects(saveFinishedReaction({ ...base, ...r, rating: 0, reaction: "x".repeat(5001) }), /5,000/);
  await assert.rejects(saveFinishedReaction({ ...base, ...r, accessToken: "", rating: 4, reaction: "" }), /sign in/);
  assert.equal(r.calls.length, 1);
});
