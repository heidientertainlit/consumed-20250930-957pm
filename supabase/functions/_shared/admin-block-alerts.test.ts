import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";

const alertId = "11111111-1111-4111-8111-111111111111";
const otherAlertId = "22222222-2222-4222-8222-222222222222";

type Authorization =
  | { authorized: true; caller: "service" | "admin"; userId?: string }
  | { authorized: false; status: 401 | 403; error: string };

function privateAlertsEndpoint(
  authorization: Authorization = { authorized: true, caller: "admin", userId: "admin-id" },
) {
  let handler: (request: Request) => Promise<Response>;
  let databaseReads = 0;
  const alerts = [
    {
      id: alertId,
      created_at: "2026-09-15T02:00:00.000Z",
      acknowledged_at: null as string | null,
      acknowledged_by: null as string | null,
      user_blocks: { blocker_id: "blocker-uuid", blocked_id: "blocked-uuid" },
    },
    {
      id: otherAlertId,
      created_at: "2026-09-15T01:00:00.000Z",
      acknowledged_at: "2026-09-15T01:30:00.000Z",
      acknowledged_by: "another-admin",
      user_blocks: { blocker_id: "other-blocker-uuid", blocked_id: "other-blocked-uuid" },
    },
  ];

  const db = {
    from(table: string) {
      assert.equal(table, "admin_block_alerts");
      databaseReads++;
      let mode: "select" | "update" = "select";
      let fields = "";
      let id: string | null = null;
      let state: "open" | "acknowledged" | null = null;
      let update: Record<string, unknown> = {};
      const project = (row: typeof alerts[number]) => ({
        id: row.id,
        created_at: row.created_at,
        acknowledged_at: row.acknowledged_at,
        user_blocks: row.user_blocks,
      });
      const builder: any = {
        select(value: string) { fields = value; return builder; },
        order() { return builder; },
        limit() { return builder; },
        eq(_column: string, value: string) { id = value; return builder; },
        is() { state = "open"; return builder; },
        not() { state = "acknowledged"; return builder; },
        update(value: Record<string, unknown>) { mode = "update"; update = value; return builder; },
        maybeSingle: async () => {
          const row = alerts.find((candidate) => candidate.id === id);
          const canUpdate = !!row && !(state === "open" && row.acknowledged_at);
          if (mode === "update" && row && canUpdate) Object.assign(row, update);
          return { data: row && (mode !== "update" || canUpdate ? project(row) : null), error: null };
        },
        then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
          const rows = alerts
            .filter((row) => state !== "open" || !row.acknowledged_at)
            .filter((row) => state !== "acknowledged" || !!row.acknowledged_at)
            .map(project);
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };

  const source = readFileSync(new URL("../admin-block-alerts/index.ts", import.meta.url), "utf8")
    .replace(/^import .*;\r?$/gm, "");
  const code = transformSync(source, { loader: "ts", format: "cjs" }).code;
  new Function("serve", "createClient", "authorizeAdminOrService", "Deno", code)(
    (callback: typeof handler) => { handler = callback; },
    () => db,
    async () => authorization,
    { env: { get: () => "test-only" } },
  );

  return {
    get databaseReads() { return databaseReads; },
    request(body: unknown) {
      return handler!(new Request("https://example.test/admin-block-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer test" },
        body: JSON.stringify(body),
      }));
    },
  };
}

test("private block alerts are admin-gated and return only opaque block participant UUIDs", async () => {
  const denied = privateAlertsEndpoint({ authorized: false as const, status: 403 as const, error: "Forbidden: admin only" });
  assert.equal((await denied.request({ action: "list" })).status, 403);
  assert.equal(denied.databaseReads, 0);

  const endpoint = privateAlertsEndpoint();
  const response = await endpoint.request({ action: "list", state: "open" });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.alerts, [{
    id: alertId,
    created_at: "2026-09-15T02:00:00.000Z",
    acknowledged_at: null,
    user_blocks: { blocker_id: "blocker-uuid", blocked_id: "blocked-uuid" },
  }]);
  assert.deepEqual(Object.keys(body.alerts[0]).sort(), ["acknowledged_at", "created_at", "id", "user_blocks"]);
  assert.deepEqual(Object.keys(body.alerts[0].user_blocks).sort(), ["blocked_id", "blocker_id"]);
});

test("private alert acknowledgement is valid only for an alert UUID and has a minimal response", async () => {
  const endpoint = privateAlertsEndpoint();
  assert.equal((await endpoint.request({ action: "acknowledge", alert_id: "not-a-uuid" })).status, 400);

  const response = await endpoint.request({ action: "acknowledge", alert_id: alertId });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.deepEqual(Object.keys(body.alert).sort(), ["acknowledged_at", "created_at", "id", "user_blocks"]);
});