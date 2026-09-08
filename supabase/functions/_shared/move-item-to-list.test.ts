import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";

const ownerId = "11111111-1111-4111-8111-111111111111";
const attackerId = "22222222-2222-4222-8222-222222222222";
const itemId = "33333333-3333-4333-8333-333333333333";
const eventId = "44444444-4444-4444-8444-444444444444";

type Options = {
  destination?: "available" | "missing" | "denied";
  rpcError?: string;
  rpcResult?: unknown;
};

type Query = {
  table: string;
  filters: Array<{ operation: "eq" | "ilike"; column: string; value: unknown }>;
};

function controlledMove(options: Options = {}) {
  let handler: (req: Request) => Promise<Response>;
  let authorization: string | null = null;
  let usersReads = 0;
  let rpcCalls = 0;
  const queries: Query[] = [];
  const rpcArguments: unknown[] = [];
  const destination = options.destination ?? "available";

  const db = {
    auth: {
      getUser: async () => {
        const match = authorization?.match(/^Bearer (owner-token|attacker-token)$/);
        const id = match?.[1] === "owner-token"
          ? ownerId
          : match?.[1] === "attacker-token"
          ? attackerId
          : null;
        return {
          data: { user: id ? { id } : null },
          error: id ? null : new Error("Invalid test session"),
        };
      },
    },
    from(table: string) {
      if (table === "users") {
        usersReads++;
        throw new Error("permission denied for table users");
      }
      assert.equal(table, "lists");
      const query: Query = { table, filters: [] };
      queries.push(query);
      const builder: any = {
        select: (columns: string) => {
          assert.equal(columns, "id");
          return builder;
        },
        eq: (column: string, value: unknown) => {
          query.filters.push({ operation: "eq", column, value });
          return builder;
        },
        ilike: (column: string, value: unknown) => {
          query.filters.push({ operation: "ilike", column, value });
          return builder;
        },
        maybeSingle: async () => {
          if (destination === "denied") {
            return { data: null, error: new Error("permission denied for table lists") };
          }
          if (destination === "missing") return { data: null, error: null };
          const userFilter = query.filters.find((filter) => filter.column === "user_id");
          const defaultFilter = query.filters.find((filter) => filter.column === "is_default");
          if (userFilter?.value !== ownerId || defaultFilter?.value !== true) {
            return { data: null, error: null };
          }
          return { data: { id: "owner-default-list" }, error: null };
        },
      };
      return builder;
    },
    rpc(name: string, args: unknown) {
      rpcCalls++;
      assert.equal(name, "move_list_item_with_completion");
      rpcArguments.push(args);
      return Promise.resolve(options.rpcError
        ? { data: null, error: new Error(options.rpcError) }
        : { data: options.rpcResult ?? { moved: true }, error: null });
    },
  };

  const source = readFileSync(new URL("../move-item-to-list/index.ts", import.meta.url), "utf8")
    .replace(/^import .*;\r?$/gm, "");
  const code = transformSync(source, { loader: "ts", format: "cjs" }).code;
  new Function("createClient", "serve", "Deno", code)(
    (_url: string, _key: string, clientOptions: any) => {
      authorization = clientOptions?.global?.headers?.Authorization ?? null;
      return db;
    },
    (callback: typeof handler) => { handler = callback; },
    { env: { get: () => "test-only" } },
  );

  return {
    get queries() { return queries; },
    get rpcCalls() { return rpcCalls; },
    get rpcArguments() { return rpcArguments; },
    get usersReads() { return usersReads; },
    request: (
      token?: string,
      body: unknown = { item_id: itemId, target_list: "currently" },
      rawBody?: string,
      authorizationScheme = "Bearer",
    ) => handler!(new Request("https://example.test/move-item-to-list", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `${authorizationScheme} ${token}` } : {}),
      },
      body: rawBody ?? JSON.stringify(body),
    })),
  };
}

function assertOwnerDefaultQueries(endpoint: ReturnType<typeof controlledMove>) {
  assert.ok(endpoint.queries.length > 0);
  for (const query of endpoint.queries) {
    assert.equal(query.table, "lists");
    assert.ok(query.filters.some(({ operation, column, value }) =>
      operation === "eq" && column === "user_id" && value === ownerId));
    assert.ok(query.filters.some(({ operation, column, value }) =>
      operation === "eq" && column === "is_default" && value === true));
  }
}

test("all default destinations move successfully with the expected completion flag", async () => {
  const destinations = [
    ["currently", false],
    ["queue", false],
    ["finished", true],
    ["dnf", false],
    ["favorites", false],
  ] as const;

  for (const [target_list, completed] of destinations) {
    const endpoint = controlledMove();
    const response = await endpoint.request("owner-token", {
      item_id: itemId,
      target_list,
      client_event_id: eventId,
    });
    assert.equal(response.status, 200, target_list);
    assert.equal((await response.json()).success, true);
    assert.deepEqual(endpoint.rpcArguments, [{
      p_item_id: itemId,
      p_target_list_id: "owner-default-list",
      p_mark_completed: completed,
      p_client_event_id: eventId,
    }]);
    assertOwnerDefaultQueries(endpoint);
    assert.equal(endpoint.usersReads, 0);
  }
});

test("verified auth identity controls destination lookup, not spoofed body identity", async () => {
  const endpoint = controlledMove();
  const response = await endpoint.request("owner-token", {
    item_id: itemId,
    target_list: "queue",
    user_id: attackerId,
    userId: attackerId,
  });
  assert.equal(response.status, 200);
  assertOwnerDefaultQueries(endpoint);
  assert.equal(endpoint.usersReads, 0);
  assert.equal(endpoint.rpcCalls, 1);
});

test("missing, invalid, and malformed bearer authorization cannot query or mutate", async () => {
  for (const [token, scheme] of [
    [undefined, "Bearer"],
    ["expired-token", "Bearer"],
    ["owner-token", "Basic"],
  ] as const) {
    const endpoint = controlledMove();
    const response = await endpoint.request(token, undefined, undefined, scheme);
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Not authenticated/);
    assert.equal(endpoint.queries.length, 0);
    assert.equal(endpoint.rpcCalls, 0);
    assert.equal(endpoint.usersReads, 0);
  }
});

test("malformed JSON, event IDs, and list names fail before mutation", async () => {
  const cases: Array<{ body?: unknown; raw?: string }> = [
    { raw: "{" },
    { body: { item_id: itemId, target_list: "currently", client_event_id: "not-a-uuid" } },
    { body: { item_id: itemId, target_list: "unknown" } },
    { body: { item_id: itemId, target_list: { name: "currently" } } },
    { body: { item_id: itemId } },
  ];
  for (const { body, raw } of cases) {
    const endpoint = controlledMove();
    const response = await endpoint.request("owner-token", body, raw);
    assert.equal(response.status, 400);
    assert.equal(endpoint.rpcCalls, 0);
    assert.equal(endpoint.usersReads, 0);
  }
});

test("array-valued target list is rejected as malformed input", async () => {
  const endpoint = controlledMove();
  const response = await endpoint.request("owner-token", {
    item_id: itemId,
    target_list: ["currently"],
  });
  assert.equal(response.status, 400);
  assert.equal(endpoint.rpcCalls, 0);
});

test("missing and permission-denied destinations fail closed without RPC", async () => {
  for (const destination of ["missing", "denied"] as const) {
    const endpoint = controlledMove({ destination });
    const response = await endpoint.request("owner-token");
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Target list "Currently" not found/);
    assert.equal(endpoint.rpcCalls, 0);
    assertOwnerDefaultQueries(endpoint);
    assert.equal(endpoint.usersReads, 0);
  }
});

test("RPC ownership denial is forwarded without a success response", async () => {
  const endpoint = controlledMove({ rpcError: "source item is not owned by authenticated user" });
  const response = await endpoint.request("owner-token");
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /not owned by authenticated user/);
  assert.equal(endpoint.rpcCalls, 1);
  assert.equal(endpoint.usersReads, 0);
});

test("duplicate/idempotent RPC success preserves the compatible response", async () => {
  const duplicate = { already_in_target: true, data: { receipt_id: eventId } };
  const endpoint = controlledMove({ rpcResult: duplicate });
  const response = await endpoint.request("owner-token", {
    item_id: itemId,
    target_list: "favorites",
    event_id: eventId,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    message: "Item already in target list",
    data: { receipt_id: eventId },
  });
  assert.deepEqual(endpoint.rpcArguments, [{
    p_item_id: itemId,
    p_target_list_id: "owner-default-list",
    p_mark_completed: false,
    p_client_event_id: eventId,
  }]);
  assert.equal(endpoint.usersReads, 0);
});