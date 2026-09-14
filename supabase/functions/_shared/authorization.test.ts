import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";

const adminId = "11111111-1111-4111-8111-111111111111";
const memberId = "22222222-2222-4222-8222-222222222222";

function authorizationModule({ lookupFails = false } = {}) {
  const calls = { getUser: 0, profileLookup: 0 };
  let lookedUpId: string | null = null;
  const db = {
    auth: {
      getUser: async (token: string) => {
        calls.getUser++;
        if (token === "admin-token") {
          return { data: { user: { id: adminId } }, error: null };
        }
        if (token === "member-token") {
          return { data: { user: { id: memberId } }, error: null };
        }
        return { data: { user: null }, error: new Error("invalid token") };
      },
    },
    from(table: string) {
      assert.equal(table, "users");
      const builder: any = {
        select: (columns: string) => {
          assert.equal(columns, "is_admin");
          return builder;
        },
        eq: (column: string, value: string) => {
          calls.profileLookup++;
          assert.equal(column, "id");
          assert.ok(value === adminId || value === memberId);
          lookedUpId = value;
          return builder;
        },
        maybeSingle: async () => lookupFails
          ? { data: null, error: new Error("lookup unavailable") }
          : { data: { is_admin: lookedUpId === adminId }, error: null },
      };
      return builder;
    },
  };

  const source = readFileSync(new URL("./authorization.ts", import.meta.url), "utf8")
    .replace(/^import .*;\r?$/gm, "");
  const code = transformSync(source, { loader: "ts", format: "cjs" }).code;
  const module = { exports: {} as Record<string, unknown> };
  new Function("createClient", "Deno", "exports", "module", code)(
    () => db,
    { env: { get: (name: string) => name === "SUPABASE_SERVICE_ROLE_KEY" ? "service-token" : "https://example.test" } },
    module.exports,
    module,
  );

  return {
    calls,
    authorize: module.exports.authorizeAdminOrService as (request: Request) => Promise<unknown>,
  };
}

function request(token?: string) {
  return new Request("https://example.test/reporting", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

test("reporting authorization rejects guests and malformed credentials with 401", async () => {
  const endpoint = authorizationModule();
  assert.deepEqual(await endpoint.authorize(request()), {
    authorized: false,
    status: 401,
    error: "Missing authorization header",
  });
  assert.deepEqual(await endpoint.authorize(new Request("https://example.test/reporting", {
    headers: { Authorization: "Basic not-a-bearer" },
  })), {
    authorized: false,
    status: 401,
    error: "Missing authorization header",
  });
  assert.equal(endpoint.calls.getUser, 0);
});

test("reporting authorization validates the session then authoritative users.is_admin", async () => {
  const endpoint = authorizationModule();
  assert.deepEqual(await endpoint.authorize(request("member-token")), {
    authorized: false,
    status: 403,
    error: "Forbidden: admin only",
  });
  assert.deepEqual(await endpoint.authorize(request("admin-token")), {
    authorized: true,
    caller: "admin",
    userId: adminId,
  });
  assert.equal(endpoint.calls.getUser, 2);
  assert.equal(endpoint.calls.profileLookup, 2);
});

test("reporting authorization keeps the explicit service-role caller", async () => {
  const endpoint = authorizationModule();
  assert.deepEqual(await endpoint.authorize(request("service-token")), {
    authorized: true,
    caller: "service",
  });
  assert.equal(endpoint.calls.getUser, 0);
  assert.equal(endpoint.calls.profileLookup, 0);
});

test("reporting authorization fails closed when the admin lookup fails", async () => {
  const endpoint = authorizationModule({ lookupFails: true });
  assert.deepEqual(await endpoint.authorize(request("admin-token")), {
    authorized: false,
    status: 403,
    error: "Forbidden: admin only",
  });
});