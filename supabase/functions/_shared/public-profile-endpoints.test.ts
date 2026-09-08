import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import * as accessHelpers from "./public-profile-access.ts";

const targetId = "22222222-2222-4222-8222-222222222222";
const viewerId = "11111111-1111-4111-8111-111111111111";
const secretParagraph = "Private full DNA paragraph";
type Scenario = { friend?: boolean; blocked?: boolean; private?: boolean; discoverable?: boolean; fail?: string };

function clientFor(s: Scenario) {
  return {
    auth: { getUser: async (token: string) => token === "viewer" || token === "owner"
      ? { data: { user: { id: token === "owner" ? targetId : viewerId } }, error: null }
      : { data: { user: null }, error: new Error("expired") } },
    from(table: string) {
      let columns = "";
      const rows: Record<string, any> = {
        users: { id: targetId, people_discoverable: s.discoverable ?? true, is_persona: false },
        dna_profiles: { id: targetId, user_id: targetId, is_private: s.private ?? false, label: "Explorer", tagline: "A curious viewer", profile_text: secretParagraph, evidence: ["Private title"], favorite_genres: ["Drama"] },
        public_user_profiles: { id: targetId, user_name: "example", display_name: "Test Person", first_name: "Test", last_name: "Person", avatar: null },
        friendships: s.friend ? [{ id: "friend" }] : [],
        user_blocks: s.blocked ? [{ id: "block" }] : [],
      };
      assert.ok(table in rows, `Endpoint must not fetch unapproved table ${table}`);
      const result = () => {
        if (s.fail === table) return { data: null, error: { message: "private internal error" } };
        const row = rows[table];
        return { data: Array.isArray(row) ? row : Object.fromEntries(
          columns.split(",").map((x) => x.trim()).filter((key) => key in row).map((key) => [key, row[key]])
        ), error: null };
      };
      const chain: any = {
        select: (value: string) => { columns = value; return chain; },
        eq: () => chain, or: () => chain,
        maybeSingle: async () => result(), limit: async () => result(),
      };
      return chain;
    },
  };
}

function handlerFor(slug: string, scenario: Scenario) {
  // Execute the real edge handler with only its runtime/client imports replaced.
  const source = readFileSync(new URL(`../${slug}/index.ts`, import.meta.url), "utf8")
    .replace(/^import .*;\r?$/gm, "");
  const compiled = transformSync(source, { loader: "ts", format: "cjs" }).code;
  let handler: (req: Request) => Promise<Response>;
  const serve = (callback: typeof handler) => { handler = callback; };
  const Deno = { serve, env: { get: (key: string) => key === "SUPABASE_ANON_KEY" ? "anon" : "test" } };
  const dependencies = { ...accessHelpers, createClient: () => clientFor(scenario), serve, Deno };
  new Function(...Object.keys(dependencies), compiled)(...Object.values(dependencies));
  return (token = "anon") => handler!(new Request(`https://example.test/?user_id=${targetId}`, {
    headers: { Authorization: `Bearer ${token}` },
  }));
}

for (const slug of ["get-public-dna", "get-public-profile"]) {
  test(`${slug}: public teaser never includes full DNA, history, or fake stats`, async () => {
    const response = await handlerFor(slug, {})();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.access, "preview");
    assert.ok(!JSON.stringify(body).includes(secretParagraph));
    for (const key of ["profile_text", "evidence", "currently_consuming", "total_points", "items_logged"]) {
      assert.ok(!(key in (body.dna_profile ?? body)), key);
    }
    const identity = body.dna_profile?.users ?? body;
    assert.equal(identity.display_name, "Test P.");
    assert.match(response.headers.get("Cache-Control")!, /no-store/);
  });

  for (const fail of ["users", "dna_profiles", "friendships", "user_blocks"]) {
    test(`${slug}: ${fail} lookup error fails closed`, async () => {
      const response = await handlerFor(slug, { friend: true, fail })("viewer");
      assert.equal(response.status, 404);
      assert.ok(!(await response.text()).includes("private internal error"));
    });
  }
  test(`${slug}: invalid bearer does not become an anonymous viewer`, async () => {
    assert.equal((await handlerFor(slug, {})("expired")).status, 404);
  });
  test(`${slug}: private/undiscoverable strangers and blocked friends are denied`, async () => {
    for (const scenario of [{ private: true }, { discoverable: false }, { friend: true, blocked: true }]) {
      assert.equal((await handlerFor(slug, scenario)("viewer")).status, 404);
    }
  });
}

test("get-public-dna: accepted friend keeps full access despite privacy/discovery settings", async () => {
  const response = await handlerFor("get-public-dna", { friend: true, private: true, discoverable: false })("viewer");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.access, "full");
  assert.equal(body.dna_profile.profile_text, secretParagraph);
});

test("public-profile permission flag authorizes only owners and accepted friends", async () => {
  for (const { token, scenario, allowed } of [
    { token: "owner", scenario: { private: true, discoverable: false }, allowed: true },
    { token: "viewer", scenario: { friend: true, private: true, discoverable: false }, allowed: true },
    { token: "viewer", scenario: {}, allowed: false },
    { token: "anon", scenario: {}, allowed: false },
  ]) {
    const response = await handlerFor("get-public-profile", scenario)(token);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.can_view_full_profile, allowed);
    assert.equal(body.access, "preview");
    assert.equal(body.profile_text, undefined);
    assert.equal(body.total_points, undefined);
  }
});

test("blocked friend is denied, not given a full-profile navigation flag", async () => {
  const response = await handlerFor("get-public-profile", { friend: true, blocked: true })("viewer");
  assert.equal(response.status, 404);
  assert.equal((await response.json()).can_view_full_profile, undefined);
});

test("own full DNA response is retained without opening stranger access", async () => {
  const response = await handlerFor("get-public-dna", { private: true, discoverable: false })("owner");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.access, "full");
  assert.equal(body.dna_profile.profile_text, secretParagraph);
});