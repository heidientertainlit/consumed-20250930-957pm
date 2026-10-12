import assert from "node:assert/strict";
import test from "node:test";
import { improveBookCovers, resolveBookCover, inspectBookCover, type CoverCache, type CoverOptions } from "./book-cover-quality";

const book = {
  media_type: "book", external_id: "9780000000001", title: "An Exact Book", creator: "An Author",
  image_url: "https://static01.nyt.com/source.jpg", rank: 1, external_source: "openlibrary", chart_country: "US",
};
function cache(): CoverCache {
  const data = new Map();
  return { async get(key) { return data.get(key); }, async set(key, value) { data.set(key, value); } };
}
function options(source: "flat" | "angled" | "unknown", candidate: "flat" | "angled" = "flat") {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input); calls.push(url);
    if (url.includes("openai.com")) {
      const request = JSON.parse(init?.body as string);
      assert.ok(request.messages[0].content[0].text.includes("JSON"));
      const image = request.messages[0].content[1].image_url.url;
      return Response.json({ choices: [{ message: { content: JSON.stringify({
        orientation: image === book.image_url ? source : candidate, confidence: 0.95, matches_book: true,
      }) } }] });
    }
    if (url.includes("openlibrary.org/isbn")) {
      return Response.json({ isbn_13: [book.external_id], covers: [123, -1] });
    }
    if (url.includes("googleapis.com")) return Response.json({ items: [] });
    return new Response(new Uint8Array(5000), { headers: { "Content-Type": "image/jpeg" } });
  };
  return { calls, config: { fetcher, openaiKey: "fixture", cache: cache() } satisfies CoverOptions };
}
test("approved publisher cover changes only imagery, and mismatched metadata cannot trigger it", async () => {
  const approved = { ...book, title: "THRESHING DAY", creator: "Rebecca Yarros", external_id: "9781682818084" };
  const result = await improveBookCovers([approved]);
  assert.match(result[0].image_url, /api\.entangledpublishing\.com/);
  for (const key of ["title", "creator", "external_id", "external_source", "rank", "chart_country"]) {
    assert.equal(result[0][key as keyof typeof approved], approved[key as keyof typeof approved]);
  }
  const mismatch = await resolveBookCover({ ...approved, creator: "Different author" });
  assert.equal(mismatch.image_url, approved.image_url);
});
test("flat covers remain untouched and incur no catalog lookup", async () => {
  const { config, calls } = options("flat");
  assert.equal((await resolveBookCover(book, config)).image_url, book.image_url);
  assert.equal(calls.length, 1);
});
test("angled cover gets a visually verified flat cover from an exact ISBN", async () => {
  const { config } = options("angled", "flat");
  const result = await resolveBookCover(book, config);
  assert.equal(result.cover_status, "replaced");
  assert.equal(result.image_url, "https://covers.openlibrary.org/b/id/123-L.jpg?default=false");
  assert.equal(result.fallback_image_url, book.image_url);
});
test("another angled catalog image cannot replace the original", async () => {
  const { config } = options("angled", "angled");
  const result = await resolveBookCover(book, config);
  assert.equal(result.cover_status, "no-flat-alternative");
  assert.equal(result.image_url, book.image_url);
});
test("a flat cover with the wrong visible book title cannot replace the original", async () => {
  const { config } = options("angled", "flat");
  const originalFetcher = config.fetcher;
  config.fetcher = async (input, init) => {
    if (String(input).includes("openai.com") && JSON.parse(init?.body as string).messages[0].content[1].image_url.url !== book.image_url) {
      return Response.json({ choices: [{ message: { content: '{"orientation":"flat","confidence":0.99,"matches_book":false}' } }] });
    }
    return originalFetcher(input, init);
  };
  assert.equal((await resolveBookCover(book, config)).image_url, book.image_url);
});
test("uncertain detection and service failure preserve the original", async () => {
  const { config, calls } = options("unknown");
  assert.equal((await resolveBookCover(book, config)).image_url, book.image_url);
  assert.equal(calls.length, 1);
  const failed = await resolveBookCover(book, {
    cache: cache(), openaiKey: "fixture", fetcher: async () => Response.json({}, { status: 503 }),
  });
  assert.equal(failed.cover_status, "check-unavailable");
  assert.equal(failed.image_url, book.image_url);
});
test("cached results prevent repeated vision or lookup calls", async () => {
  const { config, calls } = options("angled");
  const first = await resolveBookCover(book, config);
  const count = calls.length;
  assert.deepEqual(await resolveBookCover(book, config), first);
  assert.equal(calls.length, count);
});
test("wrong ISBN results and missing Google imageLinks never get accepted", async () => {
  const { config } = options("angled");
  const originalFetcher = config.fetcher;
  config.fetcher = async (input, init) => {
    if (String(input).includes("openlibrary.org/isbn")) return Response.json({ isbn_13: ["9789999999999"], covers: [456] });
    if (String(input).includes("googleapis.com")) return Response.json({ items: [
      { id: "no-cover", volumeInfo: { industryIdentifiers: [{ identifier: book.external_id }] } },
      { id: "wrong-book", volumeInfo: { industryIdentifiers: [{ identifier: "9789999999999" }], imageLinks: { thumbnail: "https://books.google.com/wrong.jpg" } } },
    ] });
    return originalFetcher(input, init);
  };
  assert.equal((await resolveBookCover(book, config)).image_url, book.image_url);
});
test("malformed inspection output fails explicitly instead of selecting an image", async () => {
  await assert.rejects(inspectBookCover(book.image_url, {
    openaiKey: "fixture", fetcher: async () => Response.json({ choices: [{ message: { content: '{"orientation":"flat","confidence":1.2}' } }] }),
  }), /Invalid/);
});
test("image enrichment leaves non-book categories alone", async () => {
  const { config, calls } = options("angled");
  const album = { ...book, media_type: "music" };
  assert.deepEqual(await improveBookCovers([album], config), [album]);
  assert.equal(calls.length, 0);
});
