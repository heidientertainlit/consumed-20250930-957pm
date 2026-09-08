import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./rank-detail.tsx", import.meta.url), "utf8");

test("every rank-detail exit returns to Play Rank", () => {
  assert.match(source, /const RANKS_PLAY_ROUTE = '\/play\?mode=ranks'/);
  assert.match(source, /Rank Deleted" \}\);\s*setLocation\(RANKS_PLAY_ROUTE\)/);
  assert.match(source, /Back to Ranks/);

  const rankExitCalls = source.match(/setLocation\([^)]*\)/g) ?? [];
  assert.ok(rankExitCalls.length >= 3);
  assert.ok(rankExitCalls.every((call) => call === "setLocation(RANKS_PLAY_ROUTE)"));
  assert.doesNotMatch(source, /setLocation\(["']\/(?:me|profile)/);
});