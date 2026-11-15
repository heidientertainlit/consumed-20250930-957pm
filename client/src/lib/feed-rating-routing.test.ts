import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { canonicalMediaIdFrom } from "./canonical-media";
import { formatMediaScopeLabel } from "./media-scope";

const source = readFileSync(new URL("../pages/feed.tsx", import.meta.url), "utf8");
const start = source.indexOf("  const mergedRatingPostIds = new Set<string>();");
const end = source.indexOf("\n  const standaloneUGCPosts:", start);
assert.ok(start > 0 && end > start, "Exercise the actual feed normalization and consumed-ID code");
const normalize = new Function(
  "socialPosts", "filterByCategory", "canonicalMediaIdFrom", "formatMediaScopeLabel",
  transformSync(source.slice(start, end), { loader: "ts" }).code +
    "\nreturn { posts: ugcPosts, used: ugcUsedIds };",
);
const filterStart = source.indexOf("                const feedData =");
const filterEnd = source.indexOf("              return feedData.map", filterStart);
assert.ok(filterStart > 0 && filterEnd > filterStart);
const lowerFeed = new Function("filteredPosts", "selectedFilter", "ugcUsedIds",
  transformSync(source.slice(filterStart, filterEnd), { loader: "ts" }).code +
  "\nreturn feedData;",
);

function post(id: string, overrides: Record<string, any> = {}) {
  return {
    id, type: "rate-review", user: { id: "reviewer", username: "fixture", displayName: "Fixture R.", avatar: "" },
    content: "", rating: null, timestamp: "2026-10-19T12:00:00Z", likes: 2, comments: 1,
    mediaItems: [{ title: "A Medieval Zombie", mediaType: "youtube", externalSource: "youtube",
      externalId: "fixture-video", imageUrl: "https://fixture.invalid/poster.jpg" }],
    ...overrides,
  };
}
function run(posts: any[]) {
  return normalize(posts, (rows: any[]) => rows, canonicalMediaIdFrom, formatMediaScopeLabel);
}

test("paired YouTube ratings cannot reappear in the lower legacy feed", () => {
  const rows = [
    post("review", { content: "An interesting look at the costume design." }),
    post("stars", { rating: 4.5, timestamp: "2026-10-19T12:01:00Z" }),
  ];
  const { posts, used } = run(rows);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].id, "review");
  assert.equal(posts[0].rating, 4.5);
  assert.equal(posts[0].content, rows[0].content);
  assert.equal(posts[0].mediaType, "youtube");
  assert.equal(posts[0].externalSource, "youtube");
  assert.equal(posts[0].externalId, "fixture-video");
  assert.equal(posts[0].mediaImage, rows[0].mediaItems[0].imageUrl);
  assert.equal(posts[0].likes, 2);
  assert.equal(posts[0].comments, 1);
  assert.ok(used.has("review"));
  assert.ok(used.has("stars"));
  assert.deepEqual(lowerFeed(rows, "All", used), []);
});

test("standalone star ratings remain visible in the shared stream, not the legacy stream", () => {
  const rows = [post("stars-only", { rating: 4 })];
  const { posts, used } = run(rows);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].type, "rating");
  assert.equal(posts[0].rating, 4);
  assert.deepEqual(lowerFeed(rows, "all", used), []);
});

test("another author or a distant rating is not merged into a review", () => {
  for (const changes of [
    { user: { id: "someone-else", username: "another" } },
    { timestamp: "2026-10-20T12:00:00Z" },
    { mediaItems: [{ title: "Another video", externalId: "other-video", externalSource: "youtube" }] },
  ]) {
    const { posts } = run([
      post("review", { content: "A thoughtful look at the design." }),
      post("separate-stars", { rating: 3.5, ...changes }),
    ]);
    assert.equal(posts.length, 2);
    assert.equal(posts.find((p: any) => p.id === "review").rating, undefined);
  }
});

test("finished/completed words inside reviews do not send them to an old activity card", () => {
  for (const type of ["review", "rate-review", "rate_review", "rating"]) {
    const { posts } = run([post("review", {
      type, rating: 4.5, content: "I finished this yesterday and completed the series. Loved it.",
    })]);
    assert.equal(posts[0].type, "review", type);
    assert.equal(posts[0].rating, 4.5);
  }
});

test("already represented consolidated ratings disappear, while ordinary list updates stay", () => {
  const rows = [post("rating", { rating: 4 })];
  const { used } = run(rows);
  const list = post("list", { type: "added_to_list", content: "Added a title to Want To" });
  const finished = { id: "finished-group", type: "finished", originalPostIds: ["finished"] };
  const consolidated = { id: "rating-group", type: "ratings", originalPostIds: ["rating"] };
  assert.deepEqual(lowerFeed([consolidated, list, finished], "All", used), [list, finished]);
});

test("standalone and lower-feed rating routes both use the existing shared card", () => {
  const sharedStart = source.indexOf("    // All standalone rating/review posts share");
  const sharedEnd = source.indexOf("    // Regular single post", sharedStart);
  const shared = source.slice(sharedStart, sharedEnd);
  assert.match(shared, /'rating', 'review', 'rate-review', 'rate_review', 'thought'/);
  assert.match(shared, /<UGCGroupCard/);
  for (const capability of ["onLike", "fetchComments", "onDeletePost", "onAddToList"]) {
    assert.ok(shared.includes(capability), capability);
  }
  assert.match(source, /renderFeedItem\(sharedReviewPost, `lower-review-\$\{post.id\}`\)/);
});
