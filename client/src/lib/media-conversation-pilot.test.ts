import assert from "node:assert/strict";
import test from "node:test";
import { isTerminalListConversationPilot } from "./media-conversation-pilot";

test("the conversation pilot enables only the exact Terminal List TV route", () => {
  assert.equal(isTerminalListConversationPilot({ type: "tv", source: "tmdb", id: "120911" }), true);
  for (const route of [
    undefined,
    null,
    {},
    { type: "tv", source: "tmdb", id: "120912" },
    { type: "movie", source: "tmdb", id: "120911" },
    { type: "tv", source: "other", id: "120911" },
    { type: "book", source: "googlebooks", id: "120911" },
    { type: "tv", source: "tmdb", id: "0120911" },
    { type: "tv", source: "tmdb", id: null },
  ]) {
    assert.equal(isTerminalListConversationPilot(route), false);
  }
});
