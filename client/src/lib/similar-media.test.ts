import assert from "node:assert/strict";
import test from "node:test";
import {
  generateSimilarMedia, recommendationRequest, recommendationType,
  resolveSimilarMedia, verifiedRecommendation,
} from "./similar-media";

const response = (results: unknown) => new Response(JSON.stringify({ results }));
const catalog = (extra: Record<string, unknown> = {}) => ({
  title: "Arrival", type: "movie", external_source: "tmdb", external_id: 329865,
  poster_url: "https://images.invalid/arrival.jpg", year: 2016, ...extra,
});

test("normalizes recommendation types without inferring them from the source title", () => {
  for (const [input, type] of [["Book", "book"], ["album", "music"], ["track", "music"], ["film", "movie"], ["TV show", "tv"], ["podcast", "podcast"], ["youtube", "youtube"]]) {
    assert.equal(recommendationType(input), type);
  }
  for (const input of ["various", "game", "", undefined]) assert.equal(recommendationType(input), null);
});

test("generation retains the exact cross-media prompt and generated order", async () => {
  const items = [{ title: "Book first", type: "book" }, { title: "Album second", type: "album" }, { title: "Movie third", type: "movie" }];
  let request: any;
  const result = await generateSimilarMedia("https://catalog.invalid", "Source TV", "tv", "synthetic", {
    fetcher: async (_url, init) => {
      request = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ recommendations: items }));
    },
  });
  assert.deepEqual(request, { query: 'Find me media similar to "Source TV" (tv). Include: other TV shows like it, soundtrack music, books it\'s based on or similar books, related podcasts, and any connected media. Mix of types please.' });
  assert.deepEqual(result, items);
});

test("keeps the six-item cap, results alias, and rejects malformed generation", async () => {
  const items = Array.from({ length: 8 }, (_, i) => ({ title: `Title ${i}`, type: "movie" }));
  const result = await generateSimilarMedia("", "Source", "movie", "synthetic", {
    fetcher: async () => response(items),
  });
  assert.deepEqual(result, items.slice(0, 6));
  await assert.rejects(generateSimilarMedia("", "Source", "movie", "synthetic", {
    fetcher: async () => new Response('{"recommendations":{}}'),
  }), /Invalid recommendation response/);
});

test("resolves each generated item with singular type and only its own metadata", async () => {
  for (const [generatedType, resolvedType, source] of [["album", "music", "itunes"], ["book", "book", "googlebooks"], ["movie", "movie", "tmdb"], ["tv", "tv", "tmdb"], ["podcast", "podcast", "spotify"]]) {
    let body: any;
    const result = await resolveSimilarMedia("https://catalog.invalid", {
      title: "Recommended title", type: generatedType, year: 2021, creator: "Recommended Creator",
    }, "synthetic", {
      fetcher: async (_url, init) => {
        body = JSON.parse(String(init?.body));
        return response([catalog({ title: "Recommended title", type: resolvedType, external_source: source, year: 2021, creator: "Recommended Creator" })]);
      },
    });
    assert.deepEqual(body, { query: "Recommended title Recommended Creator 2021", type: resolvedType });
    assert.equal(result?.type, resolvedType);
  }
});

test("ignores wrong types, misleading first hits, mismatched years and creators", () => {
  const wanted = { title: "Arrival", type: "movie", year: 2016, creator: "Denis Villeneuve" };
  const result = verifiedRecommendation(wanted, [
    catalog({ type: "book" }),
    catalog({ title: "The Arrival" }),
    catalog({ year: 1996, creator: "Denis Villeneuve" }),
    catalog({ creator: "Someone Else" }),
    catalog({ creator: "Denis Villeneuve", external_id: "correct" }),
  ]);
  assert.equal(result?.external_id, "correct");
  assert.equal(verifiedRecommendation(wanted, [catalog()]), null);
});

test("only real provider identities become verified destinations", () => {
  for (const extra of [
    { external_source: "openai" }, { external_source: "" }, { external_id: "" }, { title: "Unrelated" },
  ]) assert.equal(verifiedRecommendation({ title: "Arrival", type: "movie" }, [catalog(extra)]), null);
  assert.equal(verifiedRecommendation({ title: "Arrival", type: "movie" }, null), null);
  assert.equal(verifiedRecommendation({ title: "Unknown", type: "various" }, [catalog()]), null);
});

test("accepts catalog title/artist formatting, podcast suffixes and accents", () => {
  assert.equal(verifiedRecommendation({ title: "Sufjan Stevens - Carrie & Lowell", type: "album" }, [
    catalog({ title: "Carrie & Lowell", creator: "Sufjan Stevens", type: "music", external_source: "itunes" }),
  ])?.title, "Carrie & Lowell");
  assert.equal(verifiedRecommendation({ title: "The Moth Podcast", type: "podcast" }, [
    catalog({ title: "The Moth", type: "podcast", external_source: "spotify" }),
  ])?.title, "The Moth");
  assert.equal(verifiedRecommendation({ title: "Amélie (2001)", type: "movie" }, [
    catalog({ title: "Amelie" }),
  ])?.title, "Amelie");
});

test("preserves provider image aliases and does not invent covers or destinations", () => {
  assert.equal(verifiedRecommendation({ title: "Arrival", type: "movie" }, [
    catalog({ poster_url: "", image: "provider-image" }),
  ])?.poster_url, "provider-image");
  const result = verifiedRecommendation({ title: "Coverless Book", type: "book" }, [
    catalog({ title: "Coverless Book", type: "book", external_source: "googlebooks", poster_url: "" }),
  ]);
  assert.equal(result?.poster_url, "");
  assert.equal(result?.external_id, "329865");
});

test("unsupported recommendations make no search request", async () => {
  const result = await resolveSimilarMedia("", { title: "Game", type: "game" }, "synthetic", {
    fetcher: async () => { throw new Error("must not fetch"); },
  });
  assert.equal(result, null);
});

test("one stalled lookup times out without stopping another successful lookup", async () => {
  let aborted = false;
  const stuck = resolveSimilarMedia("", { title: "Stalled", type: "book" }, "synthetic", {
    timeoutMs: 15,
    fetcher: async (_url, init) => {
      init?.signal?.addEventListener("abort", () => { aborted = true; });
      return new Promise(() => {});
    },
  });
  const failure = assert.rejects(stuck, /timed out/);
  const good = await resolveSimilarMedia("", { title: "Arrival", type: "movie" }, "synthetic", {
    fetcher: async () => response([catalog()]),
  });
  assert.equal(good?.title, "Arrival");
  await failure;
  assert.equal(aborted, true);
});

test("deadline also covers a stalled JSON response body", async () => {
  await assert.rejects(recommendationRequest("", {}, "synthetic", {
    timeoutMs: 10,
    fetcher: async () => ({ ok: true, json: () => new Promise(() => {}) }) as any,
  }), /timed out/);
});

test("HTTP failures and invalid JSON fail explicitly", async () => {
  await assert.rejects(recommendationRequest("", {}, "synthetic", {
    fetcher: async () => new Response("Unauthorized", { status: 401 }),
  }), /401/);
  await assert.rejects(recommendationRequest("", {}, "synthetic", {
    fetcher: async () => new Response("not json"),
  }), SyntaxError);
});

test("navigation cancellation aborts pending transport and already-cancelled work never starts", async () => {
  const controller = new AbortController();
  let aborted = false;
  const pending = recommendationRequest("", {}, "synthetic", {
    signal: controller.signal,
    fetcher: async (_url, init) => {
      init?.signal?.addEventListener("abort", () => { aborted = true; });
      return new Promise(() => {});
    },
  });
  const failure = assert.rejects(pending, { name: "AbortError" });
  controller.abort();
  await failure;
  assert.equal(aborted, true);
  await assert.rejects(recommendationRequest("", {}, "synthetic", {
    signal: controller.signal,
    fetcher: async () => { throw new Error("must not fetch"); },
  }), { name: "AbortError" });
});
