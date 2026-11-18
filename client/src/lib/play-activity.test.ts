import assert from "node:assert/strict";
import { test } from "node:test";
import { isGameplayActivity, type PlayActivityItem } from "./play-activity";

test("engagement rank, rival, streak, and Trivia prompts belong in Play", () => {
  for (const link of [
    "/play/trivia", "/play/polls", "/play/ranks", "/play/seen-it",
    "/play?mode=trivia", "/play/", "/leaderboard", "/leaderboard?tab=engagement",
  ]) {
    assert.equal(isGameplayActivity({ id: "lb-your-rank", link }), true, link);
  }
});

test("consumption leaderboards remain in Now, including books read and all supported media types", () => {
  assert.equal(isGameplayActivity({
    id: "lb-books", text: "You've read 12 books this year", link: "/leaderboard?tab=consumption",
  }), false);
  for (const category of [
    "total_consumption", "books", "movies", "tv", "music", "podcasts", "games", "youtube",
  ]) {
    assert.equal(isGameplayActivity({
      id: `lb-${category}`, link: `/leaderboard?category=${category}`,
    }), false, category);
  }
});

test("media-rating conversations and non-game activity stay in Now", () => {
  for (const item of [
    { id: "rating-clash-123", link: null },
    { id: "clash", conflictData: { mediaTitle: "Movie" }, link: "/play" },
    { id: "book-completion", text: "Someone finished another book", link: "/media/book/openlibrary/OL1W" },
    { id: "consumption-milestone", text: "10 books read", link: null },
    { id: "unknown", link: "http://[" },
  ]) assert.equal(isGameplayActivity(item), false, item.id);
});

test("routing follows the destination rather than ambiguous words in the title", () => {
  assert.equal(isGameplayActivity({ id: "books-trivia", text: "Books read: Trivia challenge", link: "/play/trivia" }), true);
  assert.equal(isGameplayActivity({ id: "book-title", text: "Ready Player One reading streak", link: "/leaderboard?tab=consumption" }), false);
});

test("splitting the existing response preserves every item's identity, order, copy, and destination", () => {
  const items: PlayActivityItem[] = [
    { id: "lb-your-rank", text: "You're ranked #5 — Play Trivia to move up", link: "/play/trivia" },
    { id: "lb-books", text: "12 books read", link: "/leaderboard?tab=consumption&category=books" },
    { id: "trivia-friend", text: "A friend answered Trivia", link: "/play/trivia" },
    { id: "rating-clash-123", conflictData: { mediaTitle: "Movie" }, link: null },
  ];
  const play = items.filter(isGameplayActivity);
  const now = items.filter(item => !isGameplayActivity(item));
  assert.deepEqual(play, [items[0], items[2]]);
  assert.deepEqual(now, [items[1], items[3]]);
  assert.equal(play[0], items[0]);
  assert.equal(new Set([...play, ...now]).size, items.length);
});
