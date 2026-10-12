import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTrendingItems } from "./use-trending-content";
import { preferredBookCover } from "../../../shared/book-cover-preferences";

const book = { media_type: "book", title: "THRESHING DAY", creator: "Rebecca Yarros",
  external_id: "9781682818084", external_source: "openlibrary", image_url: "https://static01.nyt.com/old.jpg", rank: 1 };
test("existing cached charts get the approved flat cover without rewriting ranking or identity", () => {
  const item = normalizeTrendingItems([book])[0];
  assert.match(item.image_url, /api.entangledpublishing.com/);
  assert.equal(item.fallback_image_url, book.image_url);
  assert.equal(item.external_id, book.external_id);
  assert.equal(item.external_source, book.external_source);
  assert.equal(item.rank, book.rank);
});
test("no other book or media type receives the approved override", () => {
  assert.equal(preferredBookCover({ ...book, media_type: "movie" }), undefined);
  assert.equal(preferredBookCover({ ...book, external_id: "another-id" }), undefined);
  assert.equal(preferredBookCover({ ...book, title: "Different book" }), undefined);
  assert.equal(preferredBookCover({ ...book, creator: "Different author" }), undefined);
});
