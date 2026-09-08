import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { formatFeedName } from "../lib/feed-name";

const source = readFileSync(new URL("./ranks-carousel.tsx", import.meta.url), "utf8");

test("rank creator labels use the public feed-name format", () => {
  assert.equal(formatFeedName("Ignored Name", "ignored", "Ada", "Lovelace"), "Ada L.");
  assert.match(source, /rank\.origin_type === 'consumed'\s*\?\s*'Consumed'/);
  assert.match(
    source,
    /formatFeedName\(\s*creatorProfile\?\.display_name,\s*creatorProfile\?\.user_name,\s*creatorProfile\?\.first_name,\s*creatorProfile\?\.last_name/,
  );
  assert.match(source, /By \{rank\.creatorName\}/);
});

test("creator profiles come from one bounded public-profile query", () => {
  assert.equal(source.match(/\.from\('public_user_profiles'\)/g)?.length, 1);
  assert.equal(source.match(/\.from\('users'\)/g)?.length ?? 0, 0);
  assert.match(source, /\.in\('id', userOriginIds\)\s*\.limit\(userOriginIds\.length\)/);
});