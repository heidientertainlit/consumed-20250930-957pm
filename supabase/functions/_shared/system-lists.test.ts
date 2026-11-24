import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { transformSync } from "esbuild";
import { webcrypto } from "node:crypto";
import { SYSTEM_LIST_TITLES, isSystemListTitle, systemListTitle, systemListDestinations, matchesListRoute } from "../../../shared/system-lists.ts";
import { restoreSystemLists, importSystemListId } from "./system-lists.ts";
import { IMPORT_POINT_WEIGHTS, importPointsForInserted, reconcileImportOutcomes } from "./import-ledger.ts";

const owner = "11111111-1111-4111-8111-111111111111";
const standardRows = () => SYSTEM_LIST_TITLES.map((title, i) =>
  ({ id: `standard-${i}`, title, user_id: owner, is_default: true, is_private: false }));

test("existing queue and want_to contracts both mean Want To; five database titles only", () => {
  assert.equal(systemListTitle("queue"), "Want To");
  assert.equal(systemListTitle("want_to"), "Want To");
  assert.equal(systemListTitle("did-not-finish"), "Did Not Finish");
  assert.equal(systemListTitle("dnf"), "Did Not Finish");
  assert.equal(systemListTitle("completed"), "Finished");
  assert.equal(isSystemListTitle("Queue"), false);
  assert.equal(systemListTitle("Want a custom book"), undefined);
  assert.equal(SYSTEM_LIST_TITLES.length, 5);
});

test("own-list and share metadata routes resolve both aliases without selecting historical Queue/custom Want To", () => {
  const canonical = standardRows()[1];
  const historical = { id: "historical-id", title: "Queue", is_default: false };
  const custom = { id: "custom-id", title: "Want To", is_default: false };
  for (const alias of ["queue", "want_to"]) {
    assert.equal(matchesListRoute(canonical, alias), true);
    assert.equal(matchesListRoute(historical, alias), false);
    assert.equal(matchesListRoute(custom, alias), false);
  }
  assert.equal(matchesListRoute(historical, historical.id), true, "historical ID links remain valid");
  assert.equal(matchesListRoute(custom, custom.id), true);
  assert.equal(matchesListRoute(canonical, "want-to"), true, "existing title-slug links remain valid");
  for (const file of ["../../../client/src/pages/list-detail.tsx", "../../../server/open-graph.ts"]) {
    assert.match(readFileSync(new URL(file, import.meta.url), "utf8"), /matchesListRoute\(/,
      "both actual route consumers must use the tested predicate");
  }
});

test("source inventory rejects new direct list writers and duplicate provisioning definitions", () => {
  for (const dir of readdirSync(new URL("../", import.meta.url), { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const file = new URL(`../${dir.name}/index.ts`, import.meta.url);
    if (!existsSync(file)) continue;
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /\.from\(['"]lists['"]\)[^;]{0,1600}\.(?:insert|upsert)\s*\(/,
      `${dir.name} must delegate list creation, not introduce another writer`);
    assert.doesNotMatch(source, /['"]queue['"]\s*:\s*['"]Queue['"]/,
      `${dir.name} must not resolve the compatibility token to the old stored name`);
  }
  const sql = readFileSync(new URL("../../manual/five-system-lists-foundation.sql", import.meta.url), "utf8");
  assert.equal((sql.match(/insert into public\.lists\b/gi) || []).length, 1,
    "the existing restorer must be the sole provisioning INSERT body");
  assert.match(sql, /perform list_provisioning_private\.ensure_system_lists_for_owner\(new\.id\)/);
  assert.doesNotMatch(sql, /pg_trigger_depth/);
  assert.match(sql, /drop function if exists public\.create_default_system_lists\(\)/);
  assert.match(sql, /drop function if exists public\.create_default_lists_for_user\(\)/);
  assert.match(sql, /drop function if exists public\.create_default_lists\(\)/);
  assert.match(sql, /LIST_CREATION_RETIRED/);
  const data = readFileSync(new URL("../../manual/five-system-lists-data.sql", import.meta.url), "utf8");
  assert.match(data, /rollback;\s*$/i, "data repair stays a dry run until separate approval");
  const oldSchema = readFileSync(new URL("../../../supabase_lists_schema.sql", import.meta.url), "utf8");
  assert.match(oldSchema, /begin;\s*do \$\$ begin\s*raise exception 'OBSOLETE_LIST_SCHEMA/);
  assert.match(oldSchema, /rollback;\s*$/i);
});

test("consumer normalization covers all five warm-cache omissions and ignores misclassified/custom names", () => {
  for (const title of SYSTEM_LIST_TITLES) {
    for (const flag of [false, undefined]) {
      const data = [...standardRows().filter(row => row.title !== title),
        { id: "historical-custom", title, is_default: flag }];
      const before = JSON.stringify(data);
      const normalized = systemListDestinations(data);
      assert.equal(normalized.length, 5);
      assert.equal(normalized.find(row => row.title === title)?.id, `__placeholder_${title}`);
      assert.equal(JSON.stringify(data), before, "shared cache must not be mutated");
    }
  }
  const normalized = systemListDestinations([{ id: "legacy", title: "Queue", is_default: true }]);
  assert.equal(normalized.find(row => row.title === "Want To")?.id, "__placeholder_Want To");
  const rows = standardRows();
  assert.deepEqual(systemListDestinations(rows)[0], rows[0], "real list content and UUID retained");
});

test("restoration validates owner, completeness and uniqueness and exposes database failures", async () => {
  for (const title of SYSTEM_LIST_TITLES) {
    await assert.rejects(restoreSystemLists({
      rpc: async () => ({ data: standardRows().filter(row => row.title !== title), error: null }),
    }, owner), /incomplete/);
  }
  for (const data of [[...standardRows(), standardRows()[0]], standardRows().map(r => ({ ...r, user_id: "other" }))]) {
    await assert.rejects(restoreSystemLists({ rpc: async () => ({ data, error: null }) }, owner), /incomplete or duplicate/);
  }
  await assert.rejects(restoreSystemLists({ rpc: async () => ({
    data: null, error: { code: "42P10", message: "ON CONFLICT mismatch" },
  }) }, owner), /ON CONFLICT mismatch/);
});

function handler(slug: string, db: any) {
  let callback: (req: Request) => Promise<Response>;
  const source = readFileSync(new URL(`../${slug}/index.ts`, import.meta.url), "utf8")
    .replace(/^import .*;\r?$/gm, "");
  const code = transformSync(source, { loader: "ts", format: "cjs" }).code;
  const bindings = {
    createClient: () => db, serve: (fn: any) => { callback = fn; },
    Deno: { env: { get: () => "fixture-only" } },
    restoreSystemLists, importSystemListId, SYSTEM_LIST_TITLES, isSystemListTitle, systemListTitle,
    IMPORT_POINT_WEIGHTS, importPointsForInserted, reconcileImportOutcomes,
    resolveCanonicalMedia: async () => ({ canonicalMediaId: null }),
    crypto: webcrypto,
    // All provider traffic stays synthetic, including deferred poster enrichment.
    fetch: async () => new Response("", { status: 404 }),
    EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => promise.catch(() => {}) },
    console: { log() {}, error() {}, warn() {} },
  };
  new Function(...Object.keys(bindings), code)(...Object.values(bindings));
  return (title: string, method = "POST", search = "", body?: unknown) => callback!(new Request("https://example.test/" + slug + search, {
    method, headers: { ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }), Authorization: "Bearer fixture" },
    ...(method === "POST" ? { body: body instanceof FormData ? body : JSON.stringify(body ?? { title }) } : {}),
  }));
}

test("actual create-custom-list handler restores each standard title, rejects Queue/custom and surfaces failures", async () => {
  const rpcCalls: any[] = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }) },
    rpc: async (name: string, args: any) => {
      rpcCalls.push({ name, args });
      return { data: standardRows(), error: null };
    },
    from() { throw Error("Old lookup/insert path must not bypass classification"); },
  };
  const request = handler("create-custom-list", db);
  for (const title of SYSTEM_LIST_TITLES) {
    const response = await request(title);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.list.title, title);
    assert.equal(body.list.id, standardRows().find(row => row.title === title)!.id);
  }
  assert.equal((await request("Queue")).status, 403);
  assert.equal((await request("My custom list")).status, 403);
  assert.equal(rpcCalls.length, 5);
  assert.ok(rpcCalls.every(call => call.name === "ensure_standard_system_lists" && call.args.p_user_id === owner));
  for (const message of ["SYSTEM_LIST_REVIEW_REQUIRED", "42P10", "permission denied", "RPC unavailable"]) {
    const failing = handler("create-custom-list", { ...db, rpc: async () => ({ data: null, error: { message } }) });
    const response = await failing("Want To");
    assert.equal(response.status, 500);
    assert.match((await response.json()).error, new RegExp(message));
  }
  assert.equal((await handler("create-custom-list", {
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  })("Want To")).status, 401);
});

test("import shelf tokens require exact personal system destinations, never globals or historical custom names", () => {
  for (const [shelf, title] of [
    ["want-to", "Want To"], ["queue", "Want To"], ["want_to", "Want To"],
    ["currently", "Currently"], ["finished", "Finished"],
  ]) {
    assert.equal(importSystemListId(standardRows(), owner, shelf), standardRows().find(r => r.title === title)!.id);
  }
  for (const rows of [
    standardRows().map(row => ({ ...row, user_id: "other" })),
    standardRows().map(row => ({ ...row, is_default: false })),
    [...standardRows(), standardRows()[1]],
  ]) assert.throws(() => importSystemListId(rows, owner, "want-to"), /unavailable/);
  assert.throws(() => importSystemListId(standardRows(), owner, "Queue"), /unavailable/);
});

test("actual track-media provisions and resolves queue/want_to through the same RPC without direct list INSERTs", async () => {
  for (const alias of ["queue", "want_to"]) {
    let profileExists = false;
    const rpcCalls: string[] = [];
    const writes: any[] = [];
    const db = {
      auth: { getUser: async () => ({ data: { user: { id: owner, email: "fixture@example.invalid", user_metadata: {} } }, error: null }) },
      rpc: async (name: string, args: any) => {
        assert.equal(args.p_user_id, owner); rpcCalls.push(name);
        return { data: standardRows(), error: null };
      },
      from(table: string) {
        assert.notEqual(table, "lists", "provisioning/alias lookup must not maintain another direct-list path");
        let payload: any;
        const b: any = {
          select: () => b, eq: () => b,
          insert(value: any) { payload = value; writes.push({ table, value }); return b; },
          single: async () => {
            if (table === "users") {
              if (!profileExists && !payload) return { data: null, error: { code: "PGRST116" } };
              profileExists = true;
              return { data: { id: owner }, error: null };
            }
            assert.equal(table, "list_items");
            return { data: { id: "saved-item", ...payload }, error: null };
          },
        };
        return b;
      },
    };
    const request = handler("track-media", db);
    const body = { media: { title: "Fixture book", mediaType: "book", imageUrl: "fixture-cover" },
      listType: alias, skip_social_post: true };
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await request("", "POST", "", body);
      assert.equal(response.status, 200, JSON.stringify(await response.json()));
    }
    assert.equal(writes.filter(w => w.table === "users").length, 1);
    assert.equal(rpcCalls.length, 3, "one provisioning and two destination resolutions");
    assert.ok(rpcCalls.every(name => name === "ensure_standard_system_lists"));
    assert.ok(writes.filter(w => w.table === "list_items").every(w => w.value.list_id === "standard-1"));
  }
});

test("actual predictions provisioning delegates once and does not recreate five lists on repeated requests", async () => {
  let profileExists = false;
  let restored = 0;
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: owner, email: "fixture@example.invalid", user_metadata: {} } }, error: null }) },
    rpc: async (name: string, args: any) => {
      assert.equal(name, "ensure_standard_system_lists"); assert.equal(args.p_user_id, owner); restored++;
      return { data: standardRows(), error: null };
    },
    from(table: string) {
      assert.equal(table, "users", "an unmatched route must not create lists or predictions");
      let inserting = false;
      const b: any = { select: () => b, eq: () => b,
        insert() { inserting = true; return b; },
        single: async () => {
          if (!inserting && !profileExists) return { data: null, error: { code: "PGRST116" } };
          profileExists = true; return { data: { id: owner }, error: null };
        } };
      return b;
    },
  };
  const request = handler("predictions", db);
  for (let i = 0; i < 2; i++) assert.equal((await request("")).status, 404);
  assert.equal(restored, 1);
});

test("actual import handler maps Goodreads shelves to personal lists and fails before item writes on review-required", async () => {
  for (const reviewRequired of [false, true]) {
    const itemWrites: any[] = [];
    const ledgerWrites: any[] = [];
    const db = {
      auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }) },
      rpc: async (name: string, args: any) => {
        if (name === "ensure_standard_system_lists") {
          assert.equal(args.p_user_id, owner);
          return reviewRequired ? { data: null, error: { message: "SYSTEM_LIST_REVIEW_REQUIRED" } } :
            { data: standardRows(), error: null };
        }
        return { data: null, error: null };
      },
      from(table: string) {
        assert.notEqual(table, "lists", "the import must not query global/ownerless lists");
        let operation = "select", payload: any;
        const result = () => ({ data: table === "users" ? { id: owner } :
          table === "media_import_batches" && operation === "insert" ? { id: "import-receipt" } :
          table === "list_items" && operation === "insert"
            ? payload.map((row: any, i: number) => ({ ...row, id: `import-item-${i}` })) : [], error: null });
        const b: any = {
          select: () => b, eq: () => b, in: () => b, range: () => b, order: () => b,
          insert(value: any) {
            operation = "insert"; payload = value;
            if (table === "list_items") itemWrites.push(...value);
            else ledgerWrites.push({ table, value });
            return b;
          },
          update(value: any) { operation = "update"; ledgerWrites.push({ table, value }); return b; },
          upsert(value: any) { operation = "upsert"; ledgerWrites.push({ table, value }); return b; },
          single: async () => result(),
          then: (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject),
        };
        return b;
      },
    };
    const form = new FormData();
    form.set("file", new Blob([
      "Title,Author,Exclusive Shelf,My Rating\nLater,Writer,to-read,0\nNow,Writer,currently-reading,0\nDone,Writer,read,0",
    ], { type: "text/csv" }), "goodreads.csv");
    const response = await handler("import-media", db)("", "POST", "", form);
    const body = await response.json();
    assert.equal(response.status, reviewRequired ? 500 : 200, JSON.stringify(body));
    if (reviewRequired) {
      assert.match(body.error, /SYSTEM_LIST_REVIEW_REQUIRED/);
      assert.equal(itemWrites.length, 0);
    } else {
      assert.deepEqual(itemWrites.map(row => row.list_id), ["standard-1", "standard-0", "standard-2"]);
      assert.ok(itemWrites.every(row => row.user_id === owner));
      assert.ok(ledgerWrites.some(w => w.table === "media_import_rows"));
    }
  }
});

test("actual public-list handler uses personal system lists and never exposes private items through All", async () => {
  const queries: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
  const rows = standardRows();
  const db = {
    from(table: string) {
      const query = { table, filters: [] as Array<[string, unknown]> };
      queries.push(query);
      const data = () => table === "lists" ? rows :
        table === "list_items" ? [
          ...rows.map(row => ({ id: "item-" + row.id, list_id: row.id })),
          { id: "private-item", list_id: "private-list" },
        ] : { id: owner, user_name: "fixture", email: "fixture@example.invalid" };
      const b: any = {
        select: () => b, order: () => b,
        eq: (key: string, value: unknown) => { query.filters.push([key, value]); return b; },
        single: async () => ({ data: data(), error: null }),
        then: (resolve: any) => Promise.resolve({ data: data(), error: null }).then(resolve),
      };
      return b;
    },
  };
  const request = handler("get-public-list", db);
  for (const slug of ["currently", "queue", "want_to", "finished", "did-not-finish", "favorites", "all"]) {
    const response = await request("", "GET", `?user_id=${owner}&list_slug=${slug}`);
    assert.equal(response.status, 200, slug);
    const body = await response.json();
    assert.equal(body.list.items.length, slug === "all" ? 5 : 1);
    assert.ok(body.list.items.every((i: any) => i.id !== "private-item"));
  }
  for (const query of queries.filter(query => query.table === "lists")) {
    assert.ok(query.filters.some(([key, value]) => key === "user_id" && value === owner));
    assert.ok(query.filters.some(([key, value]) => key === "is_private" && value === false));
    assert.ok(query.filters.some(([key, value]) => key === "visibility" && value === "public"));
  }
});

test("actual list retrieval does not disguise failed restoration as HTTP 200", async () => {
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }) },
    from(table: string) {
      assert.equal(table, "users");
      const builder: any = { select: () => builder, eq: () => builder,
        single: async () => ({ data: { id: owner }, error: null }) };
      return builder;
    },
    rpc: async () => ({ data: null, error: { message: "SYSTEM_LIST_REVIEW_REQUIRED: Want To" } }),
  };
  const response = await handler("get-user-lists-with-media", db)("", "GET");
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /SYSTEM_LIST_REVIEW_REQUIRED/);
});

test("retired creation handlers are explicit no-write routes", async () => {
  for (const slug of ["default-lists", "create-user-list"]) {
    const request = handler(slug, null);
    assert.equal((await request("Queue")).status, 410);
    assert.equal((await request("Queue", "OPTIONS")).status, 200);
  }
});

test("actual deletion endpoint protects all five names even when legacy flags are wrong", async () => {
  for (const title of SYSTEM_LIST_TITLES) for (const is_default of [true, false]) {
    const db = {
      auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }) },
      from() {
        const b: any = { select: () => b, eq: () => b,
          single: async () => ({ data: { id: "fixture-list", title, user_id: owner, is_default }, error: null }),
          delete() { throw Error("Protected list must never reach DELETE"); } };
        return b;
      },
    };
    const response = await handler("delete-list", db)("", "POST", "", { list_id: "fixture-list" });
    assert.equal(response.status, 403, `${title}/${is_default}`);
  }
});

test("actual shared-list slugs resolve all five owner system lists rather than null-owner globals", async () => {
  for (const slug of ["currently", "queue", "want_to", "finished", "did-not-finish", "dnf", "favorites"]) {
    const queries: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
    const db = {
      auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }) },
      from(table: string) {
        const query = { table, filters: [] as Array<[string, unknown]> }; queries.push(query);
        const data = () => table === "users" ? { id: owner } : table === "lists" ?
          { ...standardRows().find(r => r.title === query.filters.find(([k]) => k === "title")?.[1]), is_public: false } :
          [{ id: "saved-item" }];
        const b: any = { select: () => b, order: () => b,
          eq: (k: string, v: unknown) => { query.filters.push([k, v]); return b; },
          single: async () => ({ data: data(), error: null }),
          then: (resolve: any) => Promise.resolve({ data: data(), error: null }).then(resolve) };
        return b;
      },
    };
    const response = await handler("get-shared-list", db)("", "POST", "", { list_id: slug });
    assert.equal(response.status, 200, slug);
    assert.equal((await response.json()).title, systemListTitle(slug));
    assert.ok(queries.filter(q => q.table === "lists").every(q =>
      q.filters.some(([k, v]) => k === "user_id" && v === owner) &&
      q.filters.some(([k, v]) => k === "is_default" && v === true)));
  }
});
