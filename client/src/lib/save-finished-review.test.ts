import assert from "node:assert/strict";
import { test } from "node:test";
import { createFinishedReviewPostId, hasExistingFinishedReaction, saveFinishedReview } from "./save-finished-review";

test("older iOS UUID fallback uses secure random bytes and valid UUID version/variant bits", () => {
  const random = {
    getRandomValues<T extends ArrayBufferView | null>(array: T): T {
      assert.ok(array instanceof Uint8Array);
      array.fill(255);
      return array;
    },
  };
  assert.equal(createFinishedReviewPostId(random), "ffffffff-ffff-4fff-bfff-ffffffffffff");
});

test("prior-reaction checks are owner-scoped, bounded, and include private ratings and text-only reviews", async () => {
  const request = {
    userId: "owner", listItemId: "saved",
    media: { title: "A title", type: "movie", external_id: "123", external_source: "tmdb" },
  };
  for (const prior of ["none", "rating", "review", "error"]) {
    const filters: string[][] = [];
    const db = {
      from(table: string) {
        const calls: string[] = [table];
        filters.push(calls);
        const chain = {
          select() { return this; },
          eq(key: string, value: string) { calls.push(`${key}=${value}`); return this; },
          gt(key: string, value: number) { assert.equal(key, "rating"); assert.equal(value, 0); return this; },
          in(key: string, values: string[]) { assert.equal(key, "post_type"); assert.ok(values.includes("thought")); return this; },
          limit(count: number) { assert.equal(count, 1); return this; },
          then(resolve: (result: unknown) => void) {
            return Promise.resolve({
              data: (prior === "rating" && table === "media_ratings") ||
                (prior === "review" && table === "social_posts") ? [{ id: "prior" }] : [],
              error: prior === "error" ? new Error("read failed") : null,
            }).then(resolve);
          },
        };
        return chain;
      },
    } as unknown as Parameters<typeof hasExistingFinishedReaction>[1];
    if (prior === "error") await assert.rejects(hasExistingFinishedReaction(request, db));
    else assert.equal(await hasExistingFinishedReaction(request, db), prior !== "none");
    assert.equal(filters.length, 2);
    for (const calls of filters) {
      assert.ok(calls.includes("user_id=owner"));
      assert.ok(calls.includes("media_external_id=123"));
      assert.ok(calls.includes("media_external_source=tmdb"));
    }
    assert.equal(await hasExistingFinishedReaction({ ...request, hasSavedReview: true }, db), true);
    assert.equal(filters.length, 2, "A saved private review must not need another query");
  }
});

test("canonical reaction checks still find legacy exact-provider ratings", async () => {
  let queries = 0;
  const db = {
    from(table: string) {
      let canonical = false;
      queries++;
      const chain = {
        select() { return this; }, gt() { return this; }, in() { return this; }, limit() { return this; },
        eq(key: string) { if (key === "canonical_media_id") canonical = true; return this; },
        then(resolve: (result: unknown) => void) {
          return Promise.resolve({ data: !canonical && table === "media_ratings" ? [{ id: "legacy" }] : [], error: null }).then(resolve);
        },
      };
      return chain;
    },
  } as unknown as Parameters<typeof hasExistingFinishedReaction>[1];
  assert.equal(await hasExistingFinishedReaction({
    userId: "owner", listItemId: "saved", media: {
      title: "A title", type: "movie", external_id: "123", external_source: "tmdb",
      canonical_media_id: "00000000-0000-0000-0000-000000000001",
    },
  }, db), true);
  assert.equal(queries, 4);
});

function fixture() {
  const state = {
    notes: "An existing note" as string | null,
    noteWrites: 0, missing: false, conflict: false, failRating: false, failShare: false,
    posts: new Map<string, Record<string, unknown>>(),
    requests: [] as { url: string; body: Record<string, unknown> }[],
  };
  const db = {
    from(table: string) {
      let update: { notes: string } | null = null;
      const builder = {
        select() { return this; }, eq() { return this; }, is() { return this; },
        update(value: { notes: string }) { update = value; return this; },
        async maybeSingle() {
          if (state.missing || (update && state.conflict)) return { data: null, error: null };
          if (update) { state.notes = update.notes; state.noteWrites++; }
          return { data: { id: "saved", notes: state.notes }, error: null };
        },
        async upsert(post: Record<string, unknown>, options: { ignoreDuplicates: boolean }) {
          assert.equal(table, "social_posts");
          assert.equal(options.ignoreDuplicates, true);
          if (!state.posts.has(post.id as string)) state.posts.set(post.id as string, post);
          return { error: state.failShare ? new Error("Ambiguous network failure") : null };
        },
      };
      return builder;
    },
  } as unknown as Parameters<typeof saveFinishedReview>[1];
  const fetcher: typeof fetch = async (url, options) => {
    state.requests.push({ url: String(url), body: JSON.parse(String(options?.body)) });
    return Response.json({ success: !state.failRating }, { status: state.failRating ? 500 : 200 });
  };
  const input = {
    supabaseUrl: "https://fixture.invalid", accessToken: "fixture-token", userId: "owner",
    listItemId: "saved", media: {
      title: "A title", type: "tv", external_id: "123", external_source: "tmdb",
    },
    content: "A review", rating: 4.5, privateMode: false, postId: "stable-post",
    containsSpoilers: true, selectedSeason: 2, selectedEpisode: 3,
    episodes: [{ episodeNumber: 3, name: "Selected episode" }],
  };
  return { state, db, fetcher, input };
}

test("public follow-up preserves notes, saves rating privately, and publishes exactly one scoped review", async () => {
  const f = fixture();
  await saveFinishedReview(f.input, f.db, f.fetcher);
  assert.equal(f.state.noteWrites, 1);
  assert.equal(f.state.notes, "An existing note\n\nReview (contains spoilers): A review");
  assert.equal(f.state.requests.length, 1);
  assert.ok(f.state.requests[0].url.endsWith("/rate-media"));
  assert.equal(f.state.requests[0].body.skip_social_post, true);
  assert.equal(f.state.requests[0].body.rating, 4.5);
  const post = f.state.posts.get("stable-post")!;
  assert.equal(post.rating, 4.5);
  assert.equal(post.post_type, "rate-review");
  assert.equal(post.contains_spoilers, true);
  assert.equal(post.media_season_number, 2);
  assert.equal(post.media_episode_title, "Selected episode");
});

for (const rating of [0, 4.5]) {
  test(`feed opt-out retains review and ${rating ? "rating" : "review-only"} without a feed post`, async () => {
    const f = fixture();
    await saveFinishedReview({ ...f.input, privateMode: true, rating }, f.db, f.fetcher);
    assert.ok(f.state.notes?.includes("A review"));
    assert.equal(f.state.posts.size, 0);
    assert.equal(f.state.requests.length, rating ? 1 : 0);
  });
}
test("review-only sharing needs no rating and does not track the title", async () => {
  const f = fixture();
  await saveFinishedReview({ ...f.input, rating: 0 }, f.db, f.fetcher);
  assert.equal(f.state.requests.length, 0);
  assert.equal(f.state.posts.get("stable-post")?.post_type, "thought");
});
test("rating-only save does not overwrite existing notes", async () => {
  const f = fixture();
  await saveFinishedReview({ ...f.input, content: "" }, f.db, f.fetcher);
  assert.equal(f.state.noteWrites, 0);
  assert.equal(f.state.notes, "An existing note");
  assert.equal(f.state.posts.size, 1);
});
test("empty reaction performs no writes", async () => {
  const f = fixture();
  await saveFinishedReview({ ...f.input, content: "", rating: 0 }, f.db, f.fetcher);
  assert.equal(f.state.noteWrites + f.state.requests.length + f.state.posts.size, 0);
});
test("rating failure keeps a retry safe without duplicated notes or posts", async () => {
  const f = fixture();
  f.state.failRating = true;
  await assert.rejects(saveFinishedReview(f.input, f.db, f.fetcher));
  assert.equal(f.state.posts.size, 0);
  f.state.failRating = false;
  await saveFinishedReview(f.input, f.db, f.fetcher);
  assert.equal(f.state.noteWrites, 1);
  assert.equal(f.state.posts.size, 1);
});
test("ambiguous posting failure retries the same ID, not a second post", async () => {
  const f = fixture();
  f.state.failShare = true;
  await assert.rejects(saveFinishedReview(f.input, f.db, f.fetcher));
  f.state.failShare = false;
  await saveFinishedReview(f.input, f.db, f.fetcher);
  assert.equal(f.state.noteWrites, 1);
  assert.equal(f.state.posts.size, 1);
});
for (const cause of ["missing", "conflict"] as const) {
  test(`${cause} library entry cannot silently lose review text or publish`, async () => {
    const f = fixture();
    f.state[cause] = true;
    await assert.rejects(saveFinishedReview(f.input, f.db, f.fetcher));
    assert.equal(f.state.posts.size + f.state.requests.length, 0);
  });
}
