import assert from "node:assert/strict";
import test from "node:test";
import { isRelevantCreatorAuthor, rankCreatorSearchResults, type CreatorSearchResult } from "./creator-search-ranking";

const person = (name: string, source: string, id: string, extra = {}): CreatorSearchResult => ({
  name, role: source === "tmdb" ? "Actor" : source === "spotify" ? "Musician" : "Author",
  external_id: id, external_source: source, ...extra,
});

test("a book-derived namesake cannot erase Jennifer Lawrence the actor", () => {
  const actor = person("Jennifer Lawrence", "tmdb", "72129", { popularity: 35, image: "actor.jpg" });
  const author = person("Jennifer Lawrence", "googlebooks", "book", { work_count: 10, image: "book.jpg" });
  assert.deepEqual(rankCreatorSearchResults([actor, author], "Jennifer Lawrence"), [actor, author]);
});

test("book-cover images and work counts cannot overwrite Spotify musicians", () => {
  const musician = person("Taylor Swift", "spotify", "artist", { followers: 100000000, image: "" });
  const author = person("Taylor Swift", "googlebooks", "book", { image: "cover.jpg", work_count: 8 });
  assert.deepEqual(rankCreatorSearchResults([musician, author], "Taylor Swift"), [musician, author]);
});

test("Spielberg the director remains ahead of book credits and weak name matches", () => {
  const director = person("Steven Spielberg", "tmdb", "488", { role: "Director", popularity: 20 });
  const results = rankCreatorSearchResults([
    person("Jeff Nathanson", "googlebooks", "cowriter"),
    person("Gabxolotl", "tmdb", "other"),
    person("Steven Spielberg", "googlebooks", "book", { work_count: 5 }),
    director,
  ], "Steven Spielberg");
  assert.equal(results[0], director);
  assert.ok(!results.some(result => result.name === "Jeff Nathanson"));
});

test("catalog identities stay distinct across namesakes and overlapping provider IDs", () => {
  const a = person("Alex", "tmdb", "1", { popularity: 30 });
  const b = person("Alex", "tmdb", "2", { popularity: 1 });
  const c = person("Alex", "spotify", "1");
  const results = rankCreatorSearchResults([b, a, c, a], "Alex");
  assert.equal(results.length, 3);
  assert.equal(results[0], a);
  assert.ok(results.includes(c));
});

test("exact authors still outrank partial film matches", () => {
  const author = person("Kristin Hannah", "googlebooks", "book");
  assert.equal(rankCreatorSearchResults([
    person("Kristin Hannah Smith", "tmdb", "actor"), author,
  ], "Kristin Hannah")[0], author);
});

test("author filtering rejects unrelated coauthors and fan-club credits", () => {
  for (const name of ["Gillian Houghton Gosman", "Jennifer Hulkoko", "Jennifer Lawrence Fan club"]) {
    assert.equal(isRelevantCreatorAuthor(name, "Jennifer Lawrence"), false);
  }
  assert.equal(isRelevantCreatorAuthor("Jennifer J. Lawrence", "Jennifer Lawrence"), true);
  assert.equal(isRelevantCreatorAuthor("Gabriel García Márquez", "Gabriel Garcia"), true);
  assert.equal(isRelevantCreatorAuthor("Kristin Hannah", "Kris"), true);
});
