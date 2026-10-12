import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeTrendingItems } from "./use-trending-content";

const feed = readFileSync(new URL("../pages/feed.tsx", import.meta.url), "utf8");
const trending = readFileSync(new URL("./top-trending-carousel.tsx", import.meta.url), "utf8");
const trendingHook = readFileSync(new URL("./use-trending-content.ts", import.meta.url), "utf8");
const identityZone = readFileSync(new URL("./feed-identity-zone.tsx", import.meta.url), "utf8");
const composer = readFileSync(new URL("./feed-composer-bar.tsx", import.meta.url), "utf8");

test("DNA stays above the feed; trending and reviews lead only feed content", () => {
  const trendingHeading = feed.indexOf("<TopTrendingCarousel");
  const reviewHeading = feed.indexOf("WHAT PEOPLE ARE SAYING");
  const identityZoneRender = feed.indexOf("<FeedIdentityZone");
  const talkingCard = feed.indexOf("key={everyonesTalking[0].key}");

  assert.ok(trendingHeading >= 0);
  assert.ok(reviewHeading > trendingHeading);
  assert.ok(identityZoneRender < feed.indexOf("data-feed-content"));
  assert.ok(feed.indexOf("data-feed-content") < trendingHeading);
  assert.ok(talkingCard > reviewHeading);
  assert.ok(feed.indexOf("data-testid=\"guest-banner\"") < trendingHeading);
  assert.ok(feed.indexOf("From notification") < trendingHeading);
  assert.equal((feed.match(/<FeedIdentityZone/g) || []).length, 1);
  assert.match(identityZone, /<FeedIdentityHero\s*\/>/);
  assert.match(identityZone, /<HeroCTAButtons\s*\/>/);
  assert.match(identityZone, /data-testid="guest-dna-teaser"/);
  assert.match(feed, /renderFeedItem\(topRatingDeck, "top-rating-deck"\)/);
  assert.match(feed, /feedSlotsAfterTopRating/);
  assert.match(feed, /preselectedMedia=\{trendingActionMedia\}/);
});

test("Trending discovery uses the production endpoint and preserves provider identity", () => {
  assert.match(trendingHook, /functions\/v1\/get-trending-content/);
  assert.match(trendingHook, /external_id\?: string/);
  assert.match(trendingHook, /external_source\?: string/);
  assert.match(trending, /externalSource: item\.external_source/);
  assert.doesNotMatch(trending, /source_label|Sparkles/);
  assert.match(trending, /Trending now/);
  assert.match(trending, /What everyone’s consuming right now/);
  assert.doesNotMatch(trending, /<select|<option|visibleItems\.length\} titles/);
  assert.match(trending, /aria-pressed=\{category === value\}/);
  assert.match(trending, /data-guest-allowed\s+aria-pressed/);
  assert.match(trending, /selectTrendingItems\(items, category\)/);
  assert.match(trending, /Live this week/);
  assert.match(trending, /See all/);
  assert.match(trending, /bg-\[#191523\] text-white/);
  assert.match(trending, /data-testid="trending-position"/);
  assert.match(trending, /\{index \+ 1\}/);
  assert.match(trending, /selectTrendingItems\(items, category, 500\)/);
  assert.match(trending, /data-testid="trending-all-dialog"/);
  assert.match(trending, /pendingAfterClose\.current/);
  assert.match(trending, /onCloseAutoFocus/);
  assert.doesNotMatch(trending, /-mx-4|-mx-5/);
  assert.match(trending, /bg-\[#171322\]\/90 text-white/);
  assert.match(trending, /<Plus size=\{19\}/);
  assert.match(trending, /setLocation\(`\/media\/\$\{item\.media_type/);
  assert.match(trending, /data-guest-allowed aria-label="Scroll trending titles left"/);
  assert.match(trending, /data-guest-allowed aria-label="Scroll trending titles right"/);
  assert.match(trending, /data-guest-allowed onClick=\{\(\) => void refetch\(\)\}/);
  assert.doesNotMatch(trending, /data-guest-allowed[^>]*aria-label=\{`Add/);
});

test("Chart provider aliases preserve real IDs and never use synthetic display IDs", () => {
  const items = normalizeTrendingItems([
    { title: "Movie", image_url: "cover.jpg", media_type: "movie", id: "chart-0", external_id: 42, external_source: "tmdb_movie" },
    { title: "Album", image_url: "album.jpg", media_type: "music", external_id: "123", external_source: "apple-music" },
    { title: "Show", image_url: "show.jpg", media_type: "tv", id: "flix-0", external_id: "", external_source: "tmdb" },
  ]);
  assert.equal(items[0].external_source, "tmdb");
  assert.equal(items[0].external_id, "42");
  assert.equal(items[1].external_source, "itunes");
  assert.equal(items[2].external_id, undefined);
  assert.throws(() => normalizeTrendingItems({}), /Invalid trending/);
  assert.doesNotMatch(trending, /externalId: item\.external_id \|\| item\.id/);
  assert.match(feed, /feedSlotsAfterTopRating: isUnfilteredNowFeed && index >= 0/);
});

test("Add browsing retains a capped, balanced chart selection and provider IDs", () => {
  assert.match(composer, /selectTrendingItems\(trendingContent, "all"\)/);
  assert.match(composer, /type: item\.media_type/);
  assert.match(composer, /external_id: item\.external_id/);
});
