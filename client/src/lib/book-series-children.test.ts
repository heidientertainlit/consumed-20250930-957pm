import assert from "node:assert/strict";
import test from "node:test";
import { fetchBookSeriesChildren } from "./book-series-children";

test("preserves the app-bar lookup request, ordering, work IDs, covers, and deduplication", async () => {
  const signal = new AbortController().signal;
  const books = await fetchBookSeriesChildren("Harry Potter", "J. K. Rowling", {
    signal,
    fetcher: (async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.origin, "https://openlibrary.org");
      assert.equal(url.pathname, "/search.json");
      assert.equal(url.searchParams.get("q"), "Harry Potter");
      assert.equal(url.searchParams.get("author"), "J. K. Rowling");
      assert.equal(url.searchParams.get("limit"), "12");
      assert.equal(url.searchParams.get("fields"), "title,author_name,first_publish_year,cover_i,key,subject");
      assert.equal(init?.signal, signal);
      return new Response(JSON.stringify({ docs: [
        { key: "/works/OL1W", title: "First book", author_name: ["Author"], cover_i: 42, first_publish_year: 1997 },
        { key: "/works/OL1W", title: "Duplicate" },
        { key: "/works/OL2W", title: "Second book" },
        { title: "Missing identity" },
      ] }));
    }) as typeof fetch,
  });
  assert.deepEqual(books, [
    { title: "First book", type: "book", creator: "Author", poster_url: "https://covers.openlibrary.org/b/id/42-M.jpg", external_id: "OL1W", external_source: "openlibrary", year: "1997" },
    { title: "Second book", type: "book", creator: "J. K. Rowling", poster_url: "", external_id: "OL2W", external_source: "openlibrary", year: "" },
  ]);
});

test("preserves the eight-book cap and omits unknown author filters", async () => {
  const books = await fetchBookSeriesChildren("Series", "Unknown Author", {
    fetcher: (async input => {
      assert.equal(new URL(String(input)).searchParams.has("author"), false);
      return new Response(JSON.stringify({ docs: Array.from({ length: 12 }, (_, i) => ({ key: `/works/OL${i}W`, title: `Book ${i}` })) }));
    }) as typeof fetch,
  });
  assert.equal(books.length, 8);
  assert.equal(books[7].title, "Book 7");
});

test("reports failed lookups rather than claiming the series is empty", async () => {
  await assert.rejects(fetchBookSeriesChildren("Series", undefined, {
    fetcher: (async () => new Response("Unavailable", { status: 503 })) as typeof fetch,
  }), /Couldn't load books/);
});
