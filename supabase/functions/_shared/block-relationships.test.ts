import assert from "node:assert/strict";
import test from "node:test";
import { checkBlockingRelationship, loadBlockedPeerIds } from "./block-relationships.ts";

function client(rows: { blocker_id: string; blocked_id: string }[], fail = false) {
  return {
    from() {
      const filters: Record<string, string> = {};
      const chain: any = {
        select: () => chain,
        eq: (column: string, value: string) => {
          filters[column] = value;
          return chain;
        },
        then: (resolve: (result: unknown) => unknown) => resolve(
          fail
            ? { data: null, error: { message: "lookup failed" } }
            : { data: rows.filter((row) => Object.entries(filters).every(([key, value]) => row[key as keyof typeof row] === value)), error: null },
        ),
      };
      return chain;
    },
  };
}

test("block relationship checks both directions and leaves self/unblocked users available", async () => {
  const blocks = client([{ blocker_id: "target", blocked_id: "actor" }]);
  assert.equal(await checkBlockingRelationship(blocks as any, "actor", "target"), true);
  assert.equal(await checkBlockingRelationship(client([]) as any, "actor", "target"), false);
  assert.equal(await checkBlockingRelationship(blocks as any, "actor", "actor"), false);
});

test("blocked-peer lists include both directions and fail closed", async () => {
  const peers = await loadBlockedPeerIds(client([
    { blocker_id: "viewer", blocked_id: "outbound" },
    { blocker_id: "inbound", blocked_id: "viewer" },
  ]) as any, "viewer");
  assert.deepEqual(peers, new Set(["outbound", "inbound"]));
  await assert.rejects(() => loadBlockedPeerIds(client([], true) as any, "viewer"), /Unable to check block relationship/);
});