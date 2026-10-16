import test from "node:test";
import assert from "node:assert/strict";
import prepared from "../data/prepared-similar-media.json";
import { preparedSimilarMedia } from "./prepared-similar-media";

test("the bounded consumer export has eleven exact sources and only public card fields", () => {
  assert.equal(prepared.length, 11);
  for (const row of prepared) {
    assert.deepEqual(Object.keys(row.source).sort(), ["external_id", "external_source", "title", "type"]);
    assert.ok(row.recommendations.length <= 6);
    const keys = new Set<string>();
    for (const item of row.recommendations) {
      assert.deepEqual(Object.keys(item).sort(), ["external_id", "external_source", "poster_url", "title", "type"]);
      assert.ok(item.external_id && item.external_source && item.title);
      assert.notEqual(`${item.type}:${item.external_source}:${item.external_id}`,
        `${row.source.type}:${row.source.external_source}:${row.source.external_id}`);
      const key = `${item.type}:${item.external_source}:${item.external_id}`;
      assert.ok(!keys.has(key)); keys.add(key);
    }
  }
});
test("prepared sources use the saved order, without title inference or source-media filtering", () => {
  for (const row of prepared) {
    assert.deepEqual(preparedSimilarMedia(row.source.external_source, row.source.external_id, row.source.type), row.recommendations);
  }
  assert.deepEqual(preparedSimilarMedia("tmdb", "1236045", "film"), preparedSimilarMedia("tmdb", "1236045", "movie"));
  assert.ok(prepared.some(row => row.recommendations.some(item => item.type !== row.source.type)));
});
test("unknown, missing and wrong-media identities fall through to the existing path", () => {
  assert.equal(preparedSimilarMedia("tmdb", "not-prepared", "movie"), null);
  assert.equal(preparedSimilarMedia("tmdb", "1236045", "tv"), null);
  assert.equal(preparedSimilarMedia("itunes", "1236045", "movie"), null);
  assert.equal(preparedSimilarMedia(undefined, "1236045", "movie"), null);
  assert.equal(preparedSimilarMedia("tmdb", "1236045", undefined), null);
});
