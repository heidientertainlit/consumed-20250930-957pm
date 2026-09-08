import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";

const adminId = "11111111-1111-4111-8111-111111111111";
const memberId = "22222222-2222-4222-8222-222222222222";
const profiles = [
  { user_id: adminId, label: "Explorer", tagline: "Curious", flavor_notes: ["Variety"], favorite_genres: ["Drama"], profile_text: "Not an export field" },
  { user_id: memberId, label: "Detective", tagline: "Thoughtful", flavor_notes: ["Mystery"], favorite_genres: ["Thriller"], profile_text: "Not an export field" },
];

function controlledExport({ adminLookupFails = false } = {}) {
  let handler: (req: Request) => Promise<Response>;
  let verifiedId: string | null = null;
  let dnaReads = 0;
  const db = {
    auth: {
      getUser: async (token: string) => {
        verifiedId = token === "test-admin" ? adminId : token === "test-member" ? memberId : null;
        return {
          data: { user: verifiedId ? { id: verifiedId, user_metadata: { is_admin: true } } : null },
          error: verifiedId ? null : new Error("Invalid test token"),
        };
      },
    },
    from(table: string) {
      let columns: string[] = [];
      let filter: string[] | null = null;
      if (table === "dna_profiles") dnaReads++;
      const result = () => {
        if (table === "users") {
          return adminLookupFails
            ? { data: null, error: new Error("lookup unavailable") }
            : { data: { is_admin: verifiedId === adminId }, error: null };
        }
        assert.equal(table, "dna_profiles");
        return {
          data: profiles.filter((row) => !filter || filter.includes(row.user_id))
            .map((row) => Object.fromEntries(columns.map((key) => [key, row[key as keyof typeof row]]))),
          error: null,
        };
      };
      const builder: any = {
        select: (value: string) => { columns = value.split(",").map((key) => key.trim()); return builder; },
        eq: (column: string, value: string) => { assert.equal(column, "id"); assert.equal(value, verifiedId); return builder; },
        in: (column: string, values: string[]) => { assert.equal(column, "user_id"); filter = values; return builder; },
        maybeSingle: async () => result(),
        then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
          Promise.resolve(result()).then(resolve, reject),
      };
      return builder;
    },
  };
  const source = readFileSync(new URL("../admin-dna-export/index.ts", import.meta.url), "utf8")
    .replace(/^import .*;\r?$/gm, "");
  const code = transformSync(source, { loader: "ts", format: "cjs" }).code;
  new Function("createClient", "serve", "Deno", code)(
    () => db,
    (callback: typeof handler) => { handler = callback; },
    { env: { get: () => "test-only" } },
  );
  return {
    get dnaReads() { return dnaReads; },
    request: (token?: string, body: unknown = {}) => handler!(new Request("https://example.test/admin-dna-export", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    })),
  };
}

test("admin export returns the authorized dataset and existing CSV fields", async () => {
  const response = await controlledExport().request("test-admin");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.profiles.length, 2);
  assert.deepEqual(Object.keys(body.profiles[0]).sort(), [
    "favorite_genres", "flavor_notes", "label", "tagline", "user_id",
  ]);
  assert.equal(body.profiles[1].user_id, memberId);
});

test("admin export filters requested users without changing the result shape", async () => {
  const response = await controlledExport().request("test-admin", { userIds: [memberId] });
  assert.deepEqual((await response.json()).profiles.map((row: any) => row.user_id), [memberId]);
});

test("ordinary user cannot export DNA even with admin-looking user metadata", async () => {
  const endpoint = controlledExport();
  assert.equal((await endpoint.request("test-member")).status, 403);
  assert.equal(endpoint.dnaReads, 0);
});

test("guest and invalid sessions cannot access the admin dataset", async () => {
  for (const token of [undefined, "expired"]) {
    const endpoint = controlledExport();
    assert.equal((await endpoint.request(token)).status, 401);
    assert.equal(endpoint.dnaReads, 0);
  }
});

test("admin-role lookup failure denies export before reading DNA", async () => {
  const endpoint = controlledExport({ adminLookupFails: true });
  assert.equal((await endpoint.request("test-admin")).status, 500);
  assert.equal(endpoint.dnaReads, 0);
});

test("admin request rejects invalid IDs without a DNA query", async () => {
  const endpoint = controlledExport();
  assert.equal((await endpoint.request("test-admin", { userIds: ["bad-id"] })).status, 400);
  assert.equal(endpoint.dnaReads, 0);
});