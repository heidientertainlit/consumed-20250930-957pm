import assert from "node:assert/strict";
import test from "node:test";
import { mediaTypeLabel } from "./media-type-label";

test("media detail clearly names each supported type", () => {
  for (const [type, expected] of [
    ["book", "Book"], ["book_series", "Book Series"], ["tv", "TV Show"],
    ["movie", "Movie"], ["music", "Music"], ["podcast", "Podcast"],
    ["youtube", "YouTube"], ["game", "Game"],
  ]) {
    assert.equal(mediaTypeLabel(type), expected);
  }
  assert.equal(mediaTypeLabel("Podcast"), "Podcast");
  assert.equal(mediaTypeLabel(""), "Media");
  assert.equal(mediaTypeLabel("audio_drama"), "Audio Drama");
});
