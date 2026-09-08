import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./feed.tsx", import.meta.url), "utf8");

test("Trending Now shows three top organic conversations with multiple people", () => {
  assert.match(source, /const originType = p\.origin_type \|\| rawPost\.origin_type/);
  assert.match(source, /originType !== 'user' \|\| isPersona/);
  assert.match(source, /g\.users\.size >= 2 && g\.takes\.length >= 1/);
  assert.match(
    source,
    /\.sort\(\(a: any, b: any\) => \(b\.users\.size - a\.users\.size\) \|\| \(b\.posts\.length - a\.posts\.length\)\)/,
  );
  assert.match(source, /groups=\{everyonesTalking\.slice\(0, 3\)\}/);
  assert.doesNotMatch(source, /groups=\{everyonesTalking\.slice\(0, 5\)\}/);
});