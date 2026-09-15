import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { formatMediaScopeLabel } from "./media-scope";

test("formats post-level season metadata", () => {
  assert.equal(formatMediaScopeLabel({ media_season_number: 2 }), "Season 2");
});

test("formats camelCase media-item season and episode metadata", () => {
  assert.equal(
    formatMediaScopeLabel(undefined, { seasonNumber: 2, episodeNumber: 3 }),
    "Season 2 · Episode 3",
  );
});

test("includes an episode title without changing the title identity", () => {
  assert.equal(
    formatMediaScopeLabel({
      media_season_number: 2,
      media_episode_number: 3,
      media_episode_title: "The Beginning",
    }),
    "Season 2 · Episode 3 — The Beginning",
  );
});

test("supports season zero and volume labels", () => {
  assert.equal(formatMediaScopeLabel({ seasonNumber: 0 }), "Season 0");
  assert.equal(formatMediaScopeLabel({ volumeNumber: 4 }), "Volume 4");
});

test("returns no label when scope metadata is absent", () => {
  assert.equal(formatMediaScopeLabel({}), undefined);
  assert.equal(formatMediaScopeLabel({ media_episode_title: "Historical only" }), undefined);
});

test("feed mapping keeps the canonical media title separate from scope", () => {
  const feedSource = readFileSync(new URL("../pages/feed.tsx", import.meta.url), "utf8");
  assert.match(
    feedSource,
    /mediaTitle: \(media\?\.title \|\| \(p as any\)\.mediaTitle \|\| \(p as any\)\.media_title\) \|\| undefined/,
  );
  assert.match(feedSource, /mediaScopeLabel,/);
  assert.doesNotMatch(feedSource, /mediaTitle:.*media_season_number/);
});
