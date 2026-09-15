import test from "node:test";
import assert from "node:assert/strict";
import { QueryClient } from "@tanstack/react-query";
import { searchFriendLabel, markSearchFriendRequested } from "./search-friend-state";

test("search labels distinguish new, accepted, outgoing and incoming relationships", () => {
  assert.equal(searchFriendLabel({}), "Add");
  assert.equal(searchFriendLabel({ relationship_status: "accepted" }), "Friend");
  assert.equal(searchFriendLabel({ relationship_status: "pending", relationship_direction: "outgoing" }), "Requested");
  assert.equal(searchFriendLabel({ relationship_status: "pending", relationship_direction: "incoming" }), "Wants to connect");
});

test("confirmed request updates only the selected result without mutating old data", () => {
  const rows = [{ id: "target" }, { id: "other", relationship_status: "accepted" }];
  const updated = markSearchFriendRequested(rows, "target")!;
  assert.equal(searchFriendLabel(updated[0]), "Requested");
  assert.equal(updated[1], rows[1]);
  assert.equal(searchFriendLabel(rows[0]), "Add");
  assert.equal(markSearchFriendRequested(undefined, "target"), undefined);
});

test("confirmed request updates all searches for its viewer, not another account", () => {
  const client = new QueryClient();
  for (const key of [["inline-user-search", "viewer", "a"], ["inline-user-search", "viewer", "ab"], ["inline-user-search", "other", "a"]]) {
    client.setQueryData(key, [{ id: "target" }]);
  }
  client.setQueriesData(
    { queryKey: ["inline-user-search", "viewer"] },
    (rows: { id: string }[] | undefined) => markSearchFriendRequested(rows, "target"),
  );
  for (const search of ["a", "ab"]) {
    const rows = client.getQueryData<any[]>(["inline-user-search", "viewer", search])!;
    assert.equal(searchFriendLabel(rows[0]), "Requested");
  }
  const other = client.getQueryData<any[]>(["inline-user-search", "other", "a"])!;
  assert.equal(searchFriendLabel(other[0]), "Add");
  client.clear();
});