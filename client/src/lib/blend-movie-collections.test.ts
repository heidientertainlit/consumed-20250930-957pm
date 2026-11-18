import assert from "node:assert/strict";
import test from "node:test";
import { blendMovieCollections } from "./blend-movie-collections";

const office = { id: "10", title: "The Office Collection", image: "" };
const hp = { id: "1241", title: "Harry Potter Collection", image: "" };
const ids = (rows: ReturnType<typeof blendMovieCollections<{ title: string; id: string }>>) =>
  rows.map(row => row.kind === "media" ? row.media.id : `collection:${row.collection.id}`);

test("exact popular individual matches lead; a collection is inserted before weaker results", () => {
  const media = [{ id: "US", title: "The Office" }, { id: "UK", title: "The Office" }, { id: "Other", title: "Office Space" }];
  assert.deepEqual(ids(blendMovieCollections("the office", media, [office])), ["US", "UK", "collection:10", "Other"]);
  assert.deepEqual(ids(blendMovieCollections("the office", media, [])), ["US", "UK", "Other"]);
});
test("franchise collections participate alongside book series and individual films", () => {
  const media = [{ id: "series", title: "Harry Potter" }, { id: "film", title: "Harry Potter and the Philosopher's Stone" }, { id: "other", title: "A different title" }];
  assert.deepEqual(ids(blendMovieCollections("harry potter", media, [hp])), ["series", "collection:1241", "film", "other"]);
  assert.deepEqual(ids(blendMovieCollections("harry potter collection", media, [hp])), ["collection:1241", "series", "film", "other"]);
});
test("only substantially relevant collections enter the list; IDs are deduplicated", () => {
  const irrelevant = [
    hp, { id: "3", title: "Love in the Bosses Office Collection", image: "" },
    { id: "4", title: "Box Office Hits Collection", image: "" },
  ];
  assert.deepEqual(blendMovieCollections("the office", [], irrelevant), []);
  assert.deepEqual(ids(blendMovieCollections("the office", [], [office, office])), ["collection:10"]);
  assert.deepEqual(blendMovieCollections("collection", [], [office]), []);
});
test("punctuation, articles, accents and a specific installment preserve franchise discovery", () => {
  const collection = { id: "1", title: "The Amélie Collection", image: "" };
  assert.deepEqual(ids(blendMovieCollections("amelie", [], [collection])), ["collection:1"]);
  assert.deepEqual(ids(blendMovieCollections("Harry Potter and the Chamber of Secrets", [
    { id: "exact", title: "Harry Potter and the Chamber of Secrets" },
    { id: "other", title: "Other movie" },
  ], [hp])), ["exact", "collection:1241", "other"]);
});
test("ordinary order and the result cap are preserved, including exact matches late in the provider list", () => {
  const media = Array.from({ length: 12 }, (_, i) => ({ id: String(i), title: i === 11 ? "The Office" : `Other ${i}` }));
  assert.deepEqual(ids(blendMovieCollections("office", media, [office])), media.map(item => item.id));
  assert.equal(blendMovieCollections("office", media, [office], 20).length, 13);
});
test("literal individual titles ending in Collection still outrank their collection", () => {
  assert.deepEqual(ids(blendMovieCollections("The Collection", [
    { id: "film", title: "The Collection" }, { id: "other", title: "Other" },
  ], [{ id: "1", title: "The Collection Collection", image: "" }])), ["film", "collection:1", "other"]);
});
test("early and late arrival produce the same final deterministic order", () => {
  const media = [{ id: "exact", title: "The Office" }, { id: "other", title: "Unrelated" }];
  const early = blendMovieCollections("office", media, [office]);
  const late = blendMovieCollections("office", media, [office]);
  assert.deepEqual(early, late);
  assert.equal(early[0].kind, "media");
});
