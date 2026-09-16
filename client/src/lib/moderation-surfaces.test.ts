import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("moderation sheets cover navigation and keep actions scrollable above the safe area", () => {
  for (const name of ["block-user-sheet", "unblock-user-sheet", "report-sheet"]) {
    const source = readFileSync(`client/src/components/${name}.tsx`, "utf8");
    assert.match(source, /overlayClassName="z-\[100000\]"/);
    assert.match(source, /z-\[100001\]/);
    assert.match(source, /max-h-\[85dvh\] overflow-y-auto/);
    assert.match(source, /env\(safe-area-inset-bottom\)/);
  }
});

test("Play ranks wait for account blocks and exclude authors before pagination", () => {
  const source = readFileSync("client/src/components/ranks-carousel.tsx", "utf8");
  assert.match(source, /useBlockedUsers\(viewerId\)/);
  assert.match(source, /viewerId \?\? 'guest', blockedUsersSignature\(blockedIds\)/);
  assert.match(source, /enabled: !!session\?\.access_token && blocksReady/);
  assert.ok(source.indexOf("user_id.not.in.") < source.indexOf(".range(from, to)"));
  assert.match(source, /user_id\.is\.null/);
  assert.match(source, /if \(!blocksReady \|\| !ranks/);
});