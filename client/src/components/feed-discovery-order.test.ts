import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeTrendingItems } from "./use-trending-content";

const feed = readFileSync(new URL("../pages/feed.tsx", import.meta.url), "utf8");
const trending = readFileSync(new URL("./top-trending-carousel.tsx", import.meta.url), "utf8");
const trendingHook = readFileSync(new URL("./use-trending-content.ts", import.meta.url), "utf8");
const identityZone = readFileSync(new URL("./feed-identity-zone.tsx", import.meta.url), "utf8");
const identityHero = readFileSync(new URL("./feed-identity-hero.tsx", import.meta.url), "utf8");
const composer = readFileSync(new URL("./feed-composer-bar.tsx", import.meta.url), "utf8");

test("DNA stays above the feed; trending and reviews lead only feed content", () => {
  const trendingHeading = feed.indexOf("<TopTrendingCarousel");
  const reviewHeading = feed.indexOf('data-testid="what-people-are-saying"');
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
  assert.match(identityZone, /max-w-4xl mx-auto px-4 pt-6 pb-5/);
  assert.match(identityZone, /data-testid="guest-dna-teaser"/);
  assert.match(feed, /renderFeedItem\(topRatingDeck, "top-rating-deck"\)/);
  assert.match(feed, /feedSlotsAfterTopRating/);
  assert.match(feed, /preselectedMedia=\{trendingActionMedia\}/);
});

test("Featured review heading lives inside its carousel and uses Fraunces", () => {
  assert.match(feed, /showDiscoveryHeading=\{keyPrefix === "top-rating-deck"\}/);
  assert.match(feed, /data-testid=\{showDiscoveryHeading \? "featured-review-carousel-card" : undefined\}/);
  assert.match(feed, /showDiscoveryHeading && \([^]*?<h2 id="what-people-are-saying-title"/);
  const reviewClass = feed.match(/id="what-people-are-saying-title" className="([^"]+)"/)?.[1];
  assert.equal(reviewClass, "font-fraunces text-base font-semibold leading-snug text-gray-900");
  assert.doesNotMatch(feed, /Real ratings and reviews from your feed|WHAT PEOPLE ARE SAYING/);
  assert.match(feed, /data-testid="what-people-are-saying">\s*\{renderFeedItem\(topRatingDeck, "top-rating-deck"\)\}/);
});

test("Featured reviews emphasize the reviewer and commentary without next controls or dots", () => {
  const ratedCard = feed.slice(feed.indexOf("if (isRatingPost) {"), feed.indexOf("function TinderCardStack"));
  const identity = ratedCard.indexOf("{featuredReviewerDisplayName}");
  const title = ratedCard.indexOf('{post.mediaTitle}</p>', identity);
  const review = ratedCard.indexOf('>"{post.content}"</p>', title);
  assert.ok(identity > 0 && title > identity && review > title);
  assert.match(ratedCard, /font-sans text-\[15px\] font-semibold/);
  assert.match(ratedCard, /line-clamp-5 text-\[17px\]/);
  assert.match(ratedCard, /!showDiscoveryHeading && swipeProps\?\.navigate/);
  assert.match(ratedCard, /boxShadow: "5px 7px/);
  assert.doesNotMatch(ratedCard, /nextFeaturedPost|Next review|Previous review/);
  assert.match(ratedCard, /handleReaction\('up'\)/);
  assert.match(ratedCard, /handleReaction\('down'\)/);
  assert.match(ratedCard, /<ThumbsUp/);
  assert.match(ratedCard, /<ThumbsDown/);
  assert.match(ratedCard, /<MessageCircle[^]*?Reply/);
  assert.match(ratedCard, /Share/);
});

test("Trending discovery uses the production endpoint and preserves provider identity", () => {
  assert.match(trendingHook, /functions\/v1\/get-trending-content/);
  assert.match(trendingHook, /external_id\?: string/);
  assert.match(trendingHook, /external_source\?: string/);
  assert.match(trending, /externalSource: item\.external_source/);
  assert.doesNotMatch(trending, /source_label|Sparkles/);
  assert.match(trending, /Trending now/);
  assert.doesNotMatch(trending, /What everyone’s consuming right now/);
  assert.doesNotMatch(trending, /<select|<option|visibleItems\.length\} titles/);
  assert.match(trending, /aria-pressed=\{category === value\}/);
  assert.match(trending, /data-guest-allowed\s+aria-pressed/);
  assert.match(trending, /selectTrendingItems\(items, category\)/);
  assert.match(trending, /<span>LIVE<\/span>/);
  assert.doesNotMatch(trending, /Live this week/);
  assert.doesNotMatch(trending, /See all|trending-all-dialog/);
  assert.match(trending, /gap-1.5 text-\[10px\]/);
  assert.match(trending, /tracking-\[0.12em\]/);
  assert.match(trending, /data-testid="trending-live-label"/);
  assert.match(trending, /bg-\[#3b82f6\]/);
  assert.match(trending, /motion-safe:animate-\[trending-live-blink_3s_ease-in-out_infinite\]/);
  assert.match(trending, /text-\[24px\] font-semibold/);
  assert.match(trending, /sm:text-\[30px\]/);
  assert.match(trending, /bg-\[#68458c\] text-white/);
  assert.match(trending, /data-testid="trending-position"/);
  assert.match(trending, /\{index \+ 1\}/);
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

test("Trending uses one white card without an outer frame or border line", () => {
  const sectionClasses = trending.match(/<section className="([^"]*)"[^>]*data-testid="top-trending-carousel"/)?.[1];
  assert.ok(sectionClasses);
  assert.match(sectionClasses, /bg-white/);
  assert.doesNotMatch(sectionClasses, /\bborder|bg-\[#f3f1ed\]/);
  assert.doesNotMatch(trending, /rounded-\[24px\] border border-\[#e8e3ec\] bg-white/);
});

test("Trending trims vertical spacing without shrinking its posters or text", () => {
  assert.match(trending, /bg-white px-5 py-4/);
  assert.doesNotMatch(trending, /sm:py-8/);
  assert.match(trending, /<div className="mb-\[14px\]">/);
  assert.match(trending, /relative top-1 flex items-center justify-between gap-3/);
  assert.match(trending, /mt-\[14px\] overflow-x-auto px-1/);
  assert.match(trending, /scrollbar-hide -mx-1 mt-\[14px\] flex snap-x/);
  assert.match(trending, /mt-2 flex items-center gap-1.5 text-left/);
  assert.match(trending, /w-\[100px\] sm:ml-12 sm:w-\[146px\]/);
  assert.match(trending, /text-\[14px\] font-semibold leading-snug/);
  assert.match(trending, /<MediaTypeIcon className="h-4 w-4 text-\[#c8bfd7\]"/);
  assert.match(trending, /pointer-events-none absolute left-2 top-2/);
  assert.match(trending, /data-testid="trending-media-icon"/);
  assert.match(trending, /rounded-full px-2.5 py-1.5 text-\[12px\]/);
  assert.match(trending, /sm:px-3 sm:text-\[13px\]/);
  assert.match(trending, /min-w-0 flex-1 truncate text-\[14px\]/);
  assert.match(trending, /aria-label=\{`\$\{mediaTypeLabel\(item.media_type\)\}: \$\{item.title\}`\}/);
  assert.doesNotMatch(trending, /<span[^>]*>\{mediaTypeLabel\(item.media_type\)\}<\/span>/);
  for (const mapping of ["movie: Film", "tv: Tv", "book: BookOpen", "book_series: BookOpen", "music: Music", "podcast: Podcast"]) {
    assert.ok(trending.includes(mapping));
  }
});

test("DNA name spacing is tighter without shrinking the face or preventing name wrapping", () => {
  assert.match(identityHero, /relative float-right ml-2 mb-1 flex h-\[88px\] w-\[88px\]/);
  assert.match(identityHero, /sm:h-\[108px\] sm:w-\[108px\]/);
  assert.match(identityHero, /<IdentityFace size=\{108\} className="scale-\[\.8\] sm:scale-100"/);
  assert.match(identityHero, /secondaries\.length > 0 && \(\s*<div className="relative mt-2">/);
  assert.match(identityHero, /className="relative flow-root"/);
  assert.match(identityHero, /maxWidth: "100%", overflowWrap: "break-word"/);
  assert.match(identityHero, /<\/h1>\s*\{\/\*[^]*?\*\/\}\s*\{secondaries\.length > 0/);
  assert.match(identityHero, /\{secondaries\.join\(" • "\)\}[^]*?\)\}\s*<\/div>\s*\{\/\* DNA completion nudge/);
});

test("Now DNA cards drop the header labels and apply one gradient across the full greeting", () => {
  for (const source of [identityHero, identityZone]) {
    assert.doesNotMatch(source, /Your Entertainment DNA™|>\s*Profile\s*</);
  }
  assert.match(identityHero, /min-w-0 text-\[13px\] font-bold uppercase leading-snug/);
  assert.match(identityHero, /data-testid="dna-greeting-gradient"/);
  assert.match(identityHero, /backgroundImage: "linear-gradient\(135deg, #c084fc 0%, #a78bfa 55%, #60a5fa 100%\)"/);
  assert.match(identityHero, /WebkitTextFillColor: "transparent"/);
  assert.match(identityHero, /\{greeting\}\s*<\/span>/);
  assert.doesNotMatch(identityHero, /greetingName|greeting\.slice/);
  assert.match(identityHero, /aria-label=\{dna\?\.label \? "Share your DNA" : "Finish setting up your DNA"\}/);
});

test("Add browsing retains a capped, balanced chart selection and provider IDs", () => {
  assert.match(composer, /selectTrendingItems\(trendingContent, "all"\)/);
  assert.match(composer, /type: item\.media_type/);
  assert.match(composer, /external_id: item\.external_id/);
});
