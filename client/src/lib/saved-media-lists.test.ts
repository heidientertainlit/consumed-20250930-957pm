import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSavedMediaListIds } from "./saved-media-lists";

function fixture({ alias = "canonical-work", aliasError = null, legacyError = null, canonicalError = null }: {
  alias?: string | null;
  aliasError?: object | null;
  legacyError?: object | null;
  canonicalError?: object | null;
} = {}) {
  const queries: Record<string, string>[] = [];
  const client = {
    rpc: async (name: string, params: object) => {
      assert.equal(name, "resolve_media_canonical_id");
      assert.deepEqual(params, { p_external_source: "tmdb", p_external_id: "123" });
      return { data: alias, error: aliasError };
    },
    from: (table: string) => {
      assert.equal(table, "list_items");
      const filters: Record<string, string> = {};
      queries.push(filters);
      const builder = {
        select: (columns: string) => { assert.equal(columns, "list_id"); return builder; },
        eq: (key: string, value: string) => { filters[key] = value; return builder; },
        then: (resolve: (value: object) => unknown) => Promise.resolve(resolve({
          data: filters.canonical_media_id
            ? [{ list_id: "finished" }, { list_id: "favorites" }]
            : [{ list_id: "finished" }],
          error: filters.canonical_media_id ? canonicalError : legacyError,
        })),
      };
      return builder;
    },
  };
  return { client: client as any, queries };
}

test("combines exact and canonical membership without duplicates, always owner-scoped", async () => {
  const { client, queries } = fixture();
  assert.deepEqual(await loadSavedMediaListIds(client, "owner", "123", "tmdb"), ["finished", "favorites"]);
  assert.equal(queries.length, 2);
  for (const query of queries) assert.equal(query.user_id, "owner");
  assert.deepEqual(queries[0], { user_id: "owner", external_id: "123", external_source: "tmdb" });
  assert.deepEqual(queries[1], { user_id: "owner", canonical_media_id: "canonical-work" });
});

test("missing alias or resolver error preserves exact provider lookup", async () => {
  for (const options of [{ alias: null }, { aliasError: { message: "unavailable" } }]) {
    const { client, queries } = fixture(options);
    assert.deepEqual(await loadSavedMediaListIds(client, "owner", "123", "tmdb"), ["finished"]);
    assert.equal(queries.length, 1);
  }
});

test("membership read failures are not presented as an empty library", async () => {
  for (const options of [{ legacyError: new Error("denied") }, { canonicalError: new Error("denied") }]) {
    await assert.rejects(loadSavedMediaListIds(fixture(options).client, "owner", "123", "tmdb"));
  }
});
