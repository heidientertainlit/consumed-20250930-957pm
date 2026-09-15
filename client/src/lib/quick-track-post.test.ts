import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildQuickTrackThoughtPostPayload } from "./quick-track-post";

const quickTrackSource = await readFile(
  new URL("../components/quick-track-sheet.tsx", import.meta.url),
  "utf8",
);

const tvMedia = {
  title: "The Show",
  type: "tv",
  external_id: "show-1",
  external_source: "tmdb",
};

test("quick-track payload keeps a selected season and episode on the take", () => {
  assert.deepEqual(
    buildQuickTrackThoughtPostPayload({
      userId: "user-1",
      content: "The ending works.",
      media: tvMedia,
      selectedSeason: 4,
      selectedEpisode: 2,
      episodes: [{ episodeNumber: 2, name: "The Ending" }],
    }),
    {
      user_id: "user-1",
      content: "The ending works.",
      post_type: "thought",
      visibility: "public",
      media_title: "The Show",
      media_type: "tv",
      media_external_id: "show-1",
      media_external_source: "tmdb",
      image_url: "",
      fire_votes: 0,
      ice_votes: 0,
      media_season_number: 4,
      media_episode_number: 2,
      media_episode_title: "The Ending",
    },
  );
});

test("whole-series takes retain explicit null scope without a volume column", () => {
  const payload = buildQuickTrackThoughtPostPayload({
    userId: "user-1",
    content: "The whole series is fun.",
    media: tvMedia,
    selectedSeason: null,
    selectedEpisode: null,
  });

  assert.equal(payload.media_season_number, null);
  assert.equal(payload.media_episode_number, null);
  assert.equal(payload.media_episode_title, null);
  assert.equal("media_volume_number" in payload, false);
});

test("season and episode zero are preserved", () => {
  const payload = buildQuickTrackThoughtPostPayload({
    userId: "user-1",
    content: "The first special is underrated.",
    media: tvMedia,
    selectedSeason: 0,
    selectedEpisode: 0,
    episodes: [{ episode_number: 0, name: "Special Zero" }],
  });

  assert.equal(payload.media_season_number, 0);
  assert.equal(payload.media_episode_number, 0);
  assert.equal(payload.media_episode_title, "Special Zero");
});

test("a selected book volume is included, while non-book media never gets null volume metadata", () => {
  const bookPayload = buildQuickTrackThoughtPostPayload({
    userId: "user-1",
    content: "Volume four is the best one.",
    media: {
      title: "A Book Series",
      type: "book",
      volume_number: 4,
      external_id: "book-4",
      external_source: "googlebooks",
    },
  });
  const tvPayload = buildQuickTrackThoughtPostPayload({
    userId: "user-1",
    content: "A TV take.",
    media: tvMedia,
    selectedSeason: null,
    selectedEpisode: null,
  });

  assert.equal(bookPayload.media_volume_number, 4);
  assert.equal("media_volume_number" in tvPayload, false);
});

test("quick-track's real direct insert consumes the scoped helper payload", () => {
  assert.match(
    quickTrackSource,
    /buildQuickTrackThoughtPostPayload/,
  );
  assert.match(
    quickTrackSource,
    /const postPayload = buildQuickTrackThoughtPostPayload\(/,
  );
  assert.match(quickTrackSource, /\.from\("social_posts"\)\.insert\(postPayload\)/);
});

test("a new quick-track title synchronously resets the prior scope", () => {
  const pickMediaSource = quickTrackSource.slice(
    quickTrackSource.indexOf("const pickMedia"),
    quickTrackSource.indexOf("const handleSave"),
  );

  assert.match(pickMediaSource, /setSeasons\(\[\]\)/);
  assert.match(pickMediaSource, /setEpisodes\(\[\]\)/);
  assert.match(pickMediaSource, /setSelectedSeason\(null\)/);
  assert.match(pickMediaSource, /setSelectedEpisode\(null\)/);
  assert.match(pickMediaSource, /setSelectedMedia\(r\)/);
});

// Keep this test focused on the payload and the real quick-track insert.
