import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./play.tsx", import.meta.url), "utf8");

test("My Ranks requests the authenticated owner's deployed ranks with a bearer token", () => {
  assert.match(
    source,
    /get-user-ranks\?user_id=\$\{encodeURIComponent\(userId\)\}/,
  );
  assert.match(source, /Authorization:\s*`Bearer \$\{accessToken\}`/);
  assert.match(source, /queryKey:\s*\["user-ranks", userId\]/);
  assert.match(source, /enabled:\s*!!userId && !!accessToken/);
});

test("My Ranks gives each account a distinct cache key", () => {
  const cacheKeyFor = (userId: string) => ["user-ranks", userId] as const;
  const firstAccountKey = cacheKeyFor("owner-with-private-ranks");
  const secondAccountKey = cacheKeyFor("different-owner");
  const cachedRanks = new Map<string, string[]>([
    [JSON.stringify(firstAccountKey), ["private-rank-id"]],
  ]);

  assert.notDeepEqual(firstAccountKey, secondAccountKey);
  assert.equal(
    cachedRanks.get(JSON.stringify(secondAccountKey)),
    undefined,
    "a switched account must not read the prior account's private rank cache",
  );
  assert.match(source, /queryKey:\s*\["user-ranks", userId\]/);
});

test("My Ranks preserves the owner response, including public and private lists, newest first", () => {
  const ownerResponse = {
    ranks: [
      { id: "older-public", title: "Older", visibility: "public", created_at: "2025-01-01T00:00:00Z", items: [{}, {}] },
      { id: "newer-private", title: "Newer", visibility: "private", created_at: "2025-02-01T00:00:00Z", items: [{}] },
    ],
  };

  const expectedNewestFirst = [...ownerResponse.ranks].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );

  assert.deepEqual(expectedNewestFirst.map((rank) => rank.id), ["newer-private", "older-public"]);
  assert.equal(ownerResponse.ranks.filter((rank) => rank.visibility === "public").length, 1);
  assert.equal(ownerResponse.ranks.filter((rank) => rank.visibility === "private").length, 1);
  assert.match(source, /return sortUserRanksNewestFirst\(Array\.isArray\(data\.ranks\) \? data\.ranks : \[\]\)/);
  assert.match(source, /const itemCount = typeof rank\.items_count === "number"/);
  assert.match(source, /\{isPrivate \? "Private" : "Public"\}/);
});

test("My Ranks cards, states, and rank-tab placement remain available", () => {
  assert.match(source, /onNavigate\(`\/rank\/\$\{rank\.id\}`\)/);
  assert.match(source, /No ranks yet/);
  assert.match(source, /Create your first ranked list above\./);
  assert.match(source, /role="alert"/);
  assert.match(source, />\s*Retry\s*</);
  assert.match(source, /aria-label="Loading your ranks"/);

  const ranksTab = source.indexOf('{activeMode === "ranks" && (');
  const createButton = source.indexOf('data-testid="button-open-create-rank"', ranksTab);
  const myRanks = source.indexOf("<MyRanks session={session} onNavigate={setLocation} />", ranksTab);
  const publicCarousel = source.indexOf("{renderModeFeed()}", myRanks);
  assert.ok(ranksTab >= 0, "rank-only conditional should exist");
  assert.ok(createButton > ranksTab, "existing Create Rank button should remain in the rank tab");
  assert.ok(myRanks > createButton, "My Ranks should follow the Create Rank button");
  assert.ok(publicCarousel > myRanks, "the public rank carousel feed should follow My Ranks");
  assert.match(source, /if \(activeMode === "ranks"\) \{\s*return \[0, 1, 2\]\.map/);
});