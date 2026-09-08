import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { transformSync } from "esbuild";

const ownerId = "11111111-1111-4111-8111-111111111111";
const strangerId = "22222222-2222-4222-8222-222222222222";
const rankId = "33333333-3333-4333-8333-333333333333";

type Failure = { table: string; operation: string; message: string; code?: string };
type Options = {
  ranks?: any[];
  items?: any[];
  failures?: Failure[];
  invalidTokens?: string[];
  missingUsers?: string[];
};
type Call = {
  client: "user" | "service";
  table: string;
  operation: string;
  value?: any;
  filters: Array<{ column: string; value: any }>;
};

function controlledFunction(
  functionName: "create-rank" | "add-rank-item" | "get-user-ranks",
  options: Options = {},
  sourcePath?: string,
) {
  let handler: (req: Request) => Promise<Response>;
  const calls: Call[] = [];
  const ranks = options.ranks ?? [];
  const items = options.items ?? [];
  let authorization: string | null = null;
  let normalUsersReads = 0;

  const identity = () => {
    const token = authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token || options.invalidTokens?.includes(token)) return null;
    if (token === "owner-token") return ownerId;
    if (token === "stranger-token") return strangerId;
    return null;
  };

  function failure(table: string, operation: string) {
    return options.failures?.find((entry) =>
      entry.table === table && entry.operation === operation);
  }

  function client(kind: "user" | "service") {
    return {
      auth: {
        getUser: async () => {
          const id = identity();
          return {
            data: {
              user: id
                ? {
                  id,
                  email: `${id}@example.test`,
                  user_metadata: { user_name: "verified-name", display_name: "Verified Name" },
                }
                : null,
            },
            error: id ? null : new Error("Invalid test session"),
          };
        },
      },
      from(table: string) {
        if (kind === "user" && table === "users") {
          normalUsersReads++;
          throw new Error("permission denied for table users");
        }
        const call: Call = { client: kind, table, operation: "query", filters: [] };
        calls.push(call);
        let operation = "select";
        let value: any;
        const builder: any = {
          select: () => {
            if (operation === "query") operation = "select";
            return builder;
          },
          insert: (inserted: any) => {
            operation = "insert";
            value = inserted;
            call.operation = operation;
            call.value = inserted;
            return builder;
          },
          update: (updated: any) => {
            operation = "update";
            value = updated;
            call.operation = operation;
            call.value = updated;
            return builder;
          },
          eq: (column: string, filterValue: any) => {
            call.filters.push({ column, value: filterValue });
            return builder;
          },
          in: (column: string, filterValue: any) => {
            call.filters.push({ column, value: filterValue });
            return builder;
          },
          order: () => builder,
          single: () => execute(true),
          maybeSingle: () => execute(true),
          then: (resolve: any, reject: any) => execute(false).then(resolve, reject),
        };

        async function execute(single: boolean) {
          const configured = failure(table, operation);
          if (configured) {
            return {
              data: null,
              error: { message: configured.message, code: configured.code },
            };
          }
          const filter = (rows: any[]) => rows.filter((row) =>
            call.filters.every(({ column, value: expected }) =>
              Array.isArray(expected) ? expected.includes(row[column]) : row[column] === expected));
          if (table === "users") {
            const id = call.filters.find(({ column }) => column === "id")?.value;
            if (operation === "insert") return { data: value, error: null };
            if (options.missingUsers?.includes(id)) {
              return { data: null, error: { message: "not found", code: "PGRST116" } };
            }
            if (id === ownerId || id === strangerId) {
              return { data: { id, email: `${id}@example.test`, user_name: "app-user" }, error: null };
            }
            return { data: null, error: { message: "not found", code: "PGRST116" } };
          }
          if (table === "ranks") {
            if (operation === "insert") {
              return { data: { id: rankId, ...value }, error: null };
            }
            const found = filter(ranks);
            return { data: single ? found[0] ?? null : found, error: null };
          }
          if (table === "rank_items") {
            if (operation === "insert") {
              return { data: { id: "item-new", ...value }, error: null };
            }
            return { data: filter(items), error: null };
          }
          if (table === "rank_item_votes") return { data: [], error: null };
          if (table === "social_posts") return { data: { id: "post-1", ...value }, error: null };
          throw new Error(`Unexpected table ${table}`);
        }
        return builder;
      },
    };
  }

  const source = readFileSync(sourcePath ?? new URL(`../${functionName}/index.ts`, import.meta.url), "utf8")
    .replace(/^import .*;\r?$/gm, "");
  const code = transformSync(source, { loader: "ts", format: "cjs" }).code;
  new Function("createClient", "serve", "Deno", code)(
    (_url: string, _key: string, clientOptions: any) => {
      if (clientOptions) {
        authorization = clientOptions.global?.headers?.Authorization ?? null;
        return client("user");
      }
      return client("service");
    },
    (callback: typeof handler) => { handler = callback; },
    { env: { get: () => "test-only" } },
  );

  return {
    calls,
    get normalUsersReads() { return normalUsersReads; },
    request: (token?: string, body?: any, query = "") => handler!(new Request(
      `https://example.test/${functionName}${query}`,
      {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    )),
  };
}

const ownerRank = (visibility: "public" | "private" = "public", max_items = 10) => ({
  id: rankId,
  user_id: ownerId,
  title: `${visibility} rank`,
  visibility,
  max_items,
  created_at: "2025-01-01",
});

function getUserRanksSources(): Array<{ label: string; path?: string }> {
  const sources: Array<{ label: string; path?: string }> = [{ label: "local" }];
  if (existsSync("/tmp/rank-live-get-user-ranks.ts")) {
    sources.push({ label: "live", path: "/tmp/rank-live-get-user-ranks.ts" });
  }
  return sources;
}

test("create-rank uses verified identity and service client for server-owned author fields", async () => {
  for (const visibility of ["public", "private"] as const) {
    const endpoint = controlledFunction("create-rank");
    const response = await endpoint.request("owner-token", {
      title: "My rank",
      visibility,
      user_id: strangerId,
      userId: strangerId,
      author_id: strangerId,
    });
    assert.equal(response.status, 200);
    const insert = endpoint.calls.find((call) => call.table === "ranks" && call.operation === "insert");
    assert.equal(insert?.client, "service");
    assert.deepEqual(
      { title: insert?.value.title, visibility: insert?.value.visibility, user_id: insert?.value.user_id },
      { title: "My rank", visibility, user_id: ownerId },
    );
    assert.equal(endpoint.normalUsersReads, 0);
  }
});

test("create-rank denies guest/invalid auth before database access", async () => {
  for (const token of [undefined, "invalid-token"]) {
    const endpoint = controlledFunction("create-rank", { invalidTokens: ["invalid-token"] });
    const response = await endpoint.request(token, { title: "Nope" });
    assert.equal(response.status, 401);
    assert.equal(endpoint.calls.length, 0);
    assert.equal(endpoint.normalUsersReads, 0);
  }
});

test("create-rank reports missing title, missing app user, and backend insert errors", async () => {
  const noTitle = controlledFunction("create-rank");
  assert.equal((await noTitle.request("owner-token", {})).status, 400);

  const lookupFailure = controlledFunction("create-rank", {
    failures: [{ table: "users", operation: "select", message: "users unavailable", code: "XX001" }],
  });
  const lookupResponse = await lookupFailure.request("owner-token", { title: "Rank" });
  assert.equal(lookupResponse.status, 401);
  assert.match((await lookupResponse.json()).error, /users unavailable/);

  const insertFailure = controlledFunction("create-rank", {
    failures: [{ table: "ranks", operation: "insert", message: "rank write failed" }],
  });
  const insertResponse = await insertFailure.request("owner-token", { title: "Rank" });
  assert.equal(insertResponse.status, 500);
  assert.match((await insertResponse.json()).error, /rank write failed/);
});

test("create-rank provisions a missing app user through the service client", async () => {
  const endpoint = controlledFunction("create-rank", { missingUsers: [ownerId] });
  const response = await endpoint.request("owner-token", { title: "First rank" });
  assert.equal(response.status, 200);
  const userInsert = endpoint.calls.find((call) => call.table === "users" && call.operation === "insert");
  assert.equal(userInsert?.client, "service");
  assert.equal(userInsert?.value.id, ownerId);
  assert.equal(endpoint.normalUsersReads, 0);
});

test("add-rank-item lets an owner add to public and private ranks using verified identity", async () => {
  for (const visibility of ["public", "private"] as const) {
    const endpoint = controlledFunction("add-rank-item", { ranks: [ownerRank(visibility)] });
    const response = await endpoint.request("owner-token", {
      rankId,
      user_id: strangerId,
      media: { title: "Actual title", mediaType: "book" },
    });
    assert.equal(response.status, 200);
    const insert = endpoint.calls.find((call) => call.table === "rank_items" && call.operation === "insert");
    assert.equal(insert?.client, "service");
    assert.equal(insert?.value.user_id, ownerId);
    assert.equal(insert?.value.rank_id, rankId);
    assert.equal(endpoint.normalUsersReads, 0);
  }
});

test("add-rank-item denies other owners and reports missing ranks", async () => {
  const other = controlledFunction("add-rank-item", {
    ranks: [{ ...ownerRank(), user_id: strangerId }],
  });
  assert.equal((await other.request("owner-token", { rankId, media: { title: "Nope" } })).status, 403);
  assert.equal(other.calls.some((call) => call.table === "rank_items" && call.operation === "insert"), false);

  const missing = controlledFunction("add-rank-item");
  assert.equal((await missing.request("owner-token", { rankId, media: { title: "Nope" } })).status, 404);
});

test("add-rank-item reports a missing app user without touching ranks", async () => {
  const endpoint = controlledFunction("add-rank-item", {
    ranks: [ownerRank()],
    missingUsers: [ownerId],
  });
  const response = await endpoint.request("owner-token", { rankId, media: { title: "Nope" } });
  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /not found/);
  assert.equal(endpoint.calls.some((call) => call.table === "ranks"), false);
  assert.equal(endpoint.normalUsersReads, 0);
});

test("add-rank-item enforces max cap and propagates item backend errors", async () => {
  const full = controlledFunction("add-rank-item", {
    ranks: [ownerRank("public", 1)],
    items: [{ id: "existing", rank_id: rankId, position: 1 }],
  });
  const fullResponse = await full.request("owner-token", { rankId, media: { title: "Nope" } });
  assert.equal(fullResponse.status, 400);
  assert.match((await fullResponse.json()).error, /limited to 1 items/);

  const readError = controlledFunction("add-rank-item", {
    ranks: [ownerRank()],
    failures: [{ table: "rank_items", operation: "select", message: "item read failed" }],
  });
  const readResponse = await readError.request("owner-token", { rankId, media: { title: "Nope" } });
  assert.equal(readResponse.status, 500);
  assert.match((await readResponse.json()).error, /Could not check existing rank items/);
  assert.equal(
    readError.calls.some((call) => call.table === "rank_items" && call.operation === "insert"),
    false,
  );

  const writeError = controlledFunction("add-rank-item", {
    ranks: [ownerRank()],
    failures: [{ table: "rank_items", operation: "insert", message: "item write failed" }],
  });
  const writeResponse = await writeError.request("owner-token", { rankId, media: { title: "Nope" } });
  assert.equal(writeResponse.status, 500);
  assert.match((await writeResponse.json()).error, /item write failed/);
});

test("add-rank-item denies guest/invalid auth without reads or writes", async () => {
  for (const token of [undefined, "invalid-token"]) {
    const endpoint = controlledFunction("add-rank-item", {
      ranks: [ownerRank()],
      invalidTokens: ["invalid-token"],
    });
    assert.equal((await endpoint.request(token, { rankId, media: { title: "Nope" } })).status, 401);
    assert.equal(endpoint.calls.length, 0);
    assert.equal(endpoint.normalUsersReads, 0);
  }
});

test("get-user-ranks owner sees private/public while stranger is constrained to public", async () => {
  const ranks = [ownerRank("public"), { ...ownerRank("private"), id: "private-rank" }];
  for (const source of getUserRanksSources()) {
    const owner = controlledFunction("get-user-ranks", { ranks }, source.path);
    const ownerResponse = await owner.request("owner-token");
    assert.equal(ownerResponse.status, 200, source.label);
    assert.deepEqual((await ownerResponse.json()).ranks.map((rank: any) => rank.visibility).sort(), ["private", "public"]);

    const stranger = controlledFunction("get-user-ranks", { ranks }, source.path);
    const strangerResponse = await stranger.request("stranger-token", undefined, `?user_id=${ownerId}`);
    assert.equal(strangerResponse.status, 200, source.label);
    assert.deepEqual((await strangerResponse.json()).ranks.map((rank: any) => rank.visibility), ["public"]);
    const rankRead = stranger.calls.find((call) => call.table === "ranks");
    assert.ok(rankRead?.filters.some(({ column, value }) => column === "visibility" && value === "public"));
  }
});

test("get-user-ranks ignores attempts to widen public reads", async () => {
  for (const source of getUserRanksSources()) {
    const endpoint = controlledFunction("get-user-ranks", {
      ranks: [ownerRank("public"), { ...ownerRank("private"), id: "private-rank" }],
    }, source.path);
    const response = await endpoint.request(
      "stranger-token",
      undefined,
      `?user_id=${ownerId}&visibility=private&include_private=true&isOwnProfile=true`,
    );
    assert.equal(response.status, 200, source.label);
    assert.deepEqual((await response.json()).ranks.map((rank: any) => rank.visibility), ["public"]);
  }
});

test("get-user-ranks treats guest/invalid auth as non-owners and requires an explicit target", async () => {
  for (const source of getUserRanksSources()) {
    for (const token of [undefined, "invalid-token"]) {
      const endpoint = controlledFunction("get-user-ranks", {
        ranks: [ownerRank("public"), { ...ownerRank("private"), id: "private-rank" }],
        invalidTokens: ["invalid-token"],
      }, source.path);
      const response = await endpoint.request(token, undefined, `?user_id=${ownerId}`);
      assert.equal(response.status, 200, source.label);
      assert.deepEqual((await response.json()).ranks.map((rank: any) => rank.visibility), ["public"]);
      const rankRead = endpoint.calls.find((call) => call.table === "ranks");
      assert.ok(rankRead?.filters.some(({ column, value }) =>
        column === "visibility" && value === "public"));
      assert.equal(endpoint.normalUsersReads, 0);
    }

    const missingTarget = controlledFunction("get-user-ranks", { ranks: [ownerRank()] }, source.path);
    const missingTargetResponse = await missingTarget.request();
    assert.equal(missingTargetResponse.status, 400, source.label);
    assert.equal(missingTarget.calls.length, 0);
  }
});

test("get-user-ranks propagates rank backend errors", async () => {
  const failed = controlledFunction("get-user-ranks", {
    failures: [{ table: "ranks", operation: "select", message: "rank read failed" }],
  });
  const response = await failed.request("owner-token");
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /rank read failed/);
});