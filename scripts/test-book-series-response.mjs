import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transform } from "esbuild";

// Execute the actual series branch, not a duplicate of its parsing logic.
// Providers are isolated here; the release check separately uses live search.
const sourcePath = process.argv[2] || "supabase/functions/media-search/index.ts";
const source = await readFile(sourcePath, "utf8");
const start = source.indexOf("    if (includeBookSeries) {");
const end = source.indexOf("    // Wait for all searches to complete", start);
assert.ok(start >= 0 && end > start, "The real book-series branch must be found");
const { code } = await transform(source.slice(start, end), { loader: "ts" });
const runBranch = new Function("includeBookSeries", "searchPromises", "Deno",
  "fetchWithTimeout", "searchQuery", "bookSeriesResults", "console", code);
const series = {
  series_name: "Harry Potter", author: "J. K. Rowling", book_count: 7,
  first_book_title: "Harry Potter and the Philosopher's Stone",
  description: "A young wizard attends Hogwarts.",
};
const json = JSON.stringify(series);

async function search(content, { enabled = true, key = true, status = 200, timeout = false } = {}) {
  const promises = [], results = [];
  let calls = 0;
  const env = { env: { get: name => name === "OPENAI_API_KEY" && key ? "test-only" : undefined } };
  const fetcher = async () => {
    calls++;
    if (timeout) throw new DOMException("Test timeout", "AbortError");
    return Response.json({ choices: [{ message: { content } }] }, { status });
  };
  runBranch(enabled, promises, env, fetcher, "Harry Potter", results, { error() {} });
  await Promise.all(promises);
  return { results, calls };
}

for (const [name, content] of [
  ["plain JSON", json],
  ["pretty JSON", JSON.stringify(series, null, 2)],
  ["JSON fence", "```json\n" + json + "\n```"],
  ["unlabelled fence", "```\n" + json + "\n```"],
  ["uppercase JSON fence", "```JSON\n" + json + "\n```"],
  ["Windows newlines", "```json\r\n" + json + "\r\n```"],
  ["outer whitespace", " \n```json\n" + json + "\n``` \n"],
  ["fence indentation", "```json  \n" + json + "\n  ```"],
]) {
  test(`${name} returns the same seven-book series`, async () => {
    const actual = await search(content);
    const expected = await search(json);
    assert.deepEqual(actual, expected);
    assert.equal(actual.results.length, 1);
    assert.equal(actual.results[0].type, "book_series");
    assert.equal(actual.results[0].series_count, 7);
    assert.equal(actual.results[0].external_id, "series-harry-potter");
  });
}

for (const [name, content] of [
  ["null", "null"], ["fenced null", "```json\nnull\n```"],
  ["missing series name", "{}"], ["fenced missing name", "```json\n{}\n```"],
  ["invalid JSON", "{invalid}"], ["fenced invalid JSON", "```json\n{invalid}\n```"],
  ["truncated JSON", "```json\n{\"series_name\":"],
  ["missing closing fence", "```json\n" + json],
  ["extra prose", "Here is the series:\n```json\n" + json + "\n```"],
  ["different code language", "```javascript\n" + json + "\n```"],
]) {
  test(`${name} does not fabricate a series`, async () => {
    assert.deepEqual((await search(content)).results, []);
  });
}

for (const [name, options, expectedCalls] of [
  ["not requested", { enabled: false }, 0],
  ["missing credential", { key: false }, 0],
  ["provider error", { status: 429 }, 1],
  ["provider timeout", { timeout: true }, 1],
]) {
  test(`${name} retains existing behavior`, async () => {
    const result = await search(json, options);
    assert.deepEqual(result.results, []);
    assert.equal(result.calls, expectedCalls);
  });
}
