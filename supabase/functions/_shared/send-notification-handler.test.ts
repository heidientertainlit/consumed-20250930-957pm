import assert from "node:assert/strict";
import test from "node:test";
import {
  handleSendNotificationRequest,
  type SendNotificationDependencies,
} from "./send-notification-handler.ts";
import { checkBlockingRelationship } from "./block-relationships.ts";

const recipientId = "recipient-uuid";
const actorId = "actor-uuid";

type Fixture = {
  inserted: Array<Record<string, unknown>>;
  deleted: string[];
  pushes: Array<{ userId: string; message: string; route: string }>;
  dependencies: SendNotificationDependencies;
};

function fixture(
  relationshipResults: Array<boolean | Error> = [],
  userBlocks: Array<{ blocker_id: string; blocked_id: string }> = [],
  overrides: Partial<SendNotificationDependencies> = {},
): Fixture {
  const inserted: Array<Record<string, unknown>> = [];
  const deleted: string[] = [];
  const pushes: Array<{ userId: string; message: string; route: string }> = [];
  const client = {
    from(table: string) {
      if (table === "user_blocks") {
        return {
          select() {
            const filters: Record<string, string> = {};
            const query = {
              eq(column: string, value: string) {
                filters[column] = value;
                if (Object.keys(filters).length < 2) return query;
                return Promise.resolve({
                  data: userBlocks.filter((row) =>
                    row.blocker_id === filters.blocker_id &&
                    row.blocked_id === filters.blocked_id
                  ),
                  error: null,
                });
              },
            };
            return query;
          },
        };
      }

      assert.equal(table, "notifications");
      return {
        insert(row: Record<string, unknown>) {
          inserted.push(row);
          return {
            select() {
              return {
                single: async () => ({ data: { id: `notification-${inserted.length}` }, error: null }),
              };
            },
          };
        },
        delete() {
          return {
            eq(_column: string, id: string) {
              deleted.push(id);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };

  const dependencies: SendNotificationDependencies = {
    createClient: () => client,
    authorize: () => ({ authorized: true, caller: "service" }),
    loadLiveUser: async () => ({ allowed: true }),
    checkBlockingRelationship: relationshipResults.length
      ? async () => {
        const result = relationshipResults.shift() ?? false;
        if (result instanceof Error) throw result;
        return result;
      }
      : checkBlockingRelationship,
    sendPush: async (userId, message, route) => {
      pushes.push({ userId, message, route });
    },
    supabaseUrl: "https://project.supabase.co",
    serviceRoleKey: "service-role-key",
    ...overrides,
  };

  return { inserted, deleted, pushes, dependencies };
}

function request(body: Record<string, unknown> = {}): Request {
  return new Request("https://project.supabase.co/functions/v1/send-notification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: recipientId,
      type: "comment",
      triggeredByUserId: actorId,
      message: "A real event",
      ...body,
    }),
  });
}

test("actor blocking recipient prevents notification insertion and push", async () => {
  const state = fixture([], [{ blocker_id: actorId, blocked_id: recipientId }]);
  const response = await handleSendNotificationRequest(request(), state.dependencies);

  assert.equal(response.status, 403);
  assert.deepEqual(state.inserted, []);
  assert.deepEqual(state.pushes, []);
});

test("recipient blocking actor prevents notification insertion and push", async () => {
  const state = fixture([], [{ blocker_id: recipientId, blocked_id: actorId }]);
  const response = await handleSendNotificationRequest(request(), state.dependencies);

  assert.equal(response.status, 403);
  assert.deepEqual(state.inserted, []);
  assert.deepEqual(state.pushes, []);
});

test("a block lookup failure before insert fails closed", async () => {
  const state = fixture([new Error("permission denied")]);
  const response = await handleSendNotificationRequest(request(), state.dependencies);

  assert.equal(response.status, 503);
  assert.deepEqual(state.inserted, []);
  assert.deepEqual(state.pushes, []);
});

test("invalid service authorization remains rejected before any side effect", async () => {
  const state = fixture([], [], {
    authorize: () => ({ authorized: false, status: 403, error: "Forbidden" }),
  });
  const response = await handleSendNotificationRequest(request(), state.dependencies);

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Forbidden" });
  assert.deepEqual(state.inserted, []);
  assert.deepEqual(state.pushes, []);
});

test("self and platform notifications retain their existing behavior", async () => {
  const self = fixture();
  const selfResponse = await handleSendNotificationRequest(
    request({ userId: actorId }),
    self.dependencies,
  );
  assert.equal(selfResponse.status, 200);
  assert.deepEqual(self.inserted, []);
  assert.deepEqual(self.pushes, []);

  const platform = fixture();
  const platformResponse = await handleSendNotificationRequest(
    request({ triggeredByUserId: null }),
    platform.dependencies,
  );
  assert.equal(platformResponse.status, 200);
  assert.equal(platform.inserted.length, 1);
  assert.equal(platform.inserted[0].triggered_by_user_id, null);
  assert.deepEqual(platform.pushes, [{
    userId: recipientId,
    message: "A real event",
    route: "/activity",
  }]);
});

test("a block created after insert removes the notification and prevents push", async () => {
  const state = fixture([false, true]);
  const response = await handleSendNotificationRequest(request(), state.dependencies);

  assert.equal(response.status, 403);
  assert.equal(state.inserted.length, 1);
  assert.deepEqual(state.deleted, ["notification-1"]);
  assert.deepEqual(state.pushes, []);
});

test("a late block lookup failure removes the notification and prevents push", async () => {
  const state = fixture([false, new Error("permission denied")]);
  const response = await handleSendNotificationRequest(request(), state.dependencies);

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "Blocking relationship status unavailable",
  });
  assert.equal(state.inserted.length, 1);
  assert.deepEqual(state.deleted, ["notification-1"]);
  assert.deepEqual(state.pushes, []);
});