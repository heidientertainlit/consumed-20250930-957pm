import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { SYSTEM_LIST_TITLES, isSystemListTitle, systemListTitle, systemListDestinations } from "../../../shared/system-lists.ts";
import { restoreSystemLists } from "./system-lists.ts";

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
  new Function("createClient", "serve", "Deno", "restoreSystemLists", "SYSTEM_LIST_TITLES",
    "isSystemListTitle", "console", code)(
    () => db, (fn: any) => { callback = fn; }, { env: { get: () => "fixture-only" } },
    restoreSystemLists, SYSTEM_LIST_TITLES, isSystemListTitle,
    { log() {}, error() {}, warn() {} },
  );
  return (title: string, method = "POST", search = "", body?: unknown) => callback!(new Request("https://example.test/" + slug + search, {
    method, headers: { "Content-Type": "application/json", Authorization: "Bearer fixture" },
    ...(method === "POST" ? { body: JSON.stringify(body ?? { title }) } : {}),
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
