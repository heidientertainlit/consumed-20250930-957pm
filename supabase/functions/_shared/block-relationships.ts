type BlockRow = { blocker_id: string; blocked_id: string };
type BlockQuery = PromiseLike<{ data: BlockRow[] | null; error: { message?: string } | null }> & {
  eq(column: "blocker_id" | "blocked_id", value: string): BlockQuery;
};

export type BlockRelationshipClient = {
  from(table: "user_blocks"): {
    select(columns: string): BlockQuery;
  };
};

function blockLookupError(error: { message?: string } | null): Error | null {
  return error ? new Error(`Unable to check block relationship: ${error.message || "unknown error"}`) : null;
}

/**
 * Returns true when either person has blocked the other. Lookup failures throw
 * so callers can fail closed before making a protected mutation or response.
 */
export async function checkBlockingRelationship(
  client: BlockRelationshipClient,
  actorId: string,
  targetId: string,
): Promise<boolean> {
  if (!actorId || !targetId || actorId === targetId) return false;

  const [blockedByActor, actorBlocked] = await Promise.all([
    client.from("user_blocks").select("blocker_id, blocked_id")
      .eq("blocker_id", actorId).eq("blocked_id", targetId),
    client.from("user_blocks").select("blocker_id, blocked_id")
      .eq("blocker_id", targetId).eq("blocked_id", actorId),
  ]);
  const error = blockLookupError(blockedByActor.error) || blockLookupError(actorBlocked.error);
  if (error) throw error;
  return (blockedByActor.data?.length || 0) > 0 || (actorBlocked.data?.length || 0) > 0;
}

/**
 * Returns every peer with a block relationship to the viewer in either
 * direction. Lookup failures throw so list endpoints never leak unfiltered
 * service-role results.
 */
export async function loadBlockedPeerIds(
  client: BlockRelationshipClient,
  viewerId: string,
): Promise<Set<string>> {
  if (!viewerId) return new Set();

  const [blockedByViewer, blockedViewer] = await Promise.all([
    client.from("user_blocks").select("blocked_id").eq("blocker_id", viewerId),
    client.from("user_blocks").select("blocker_id").eq("blocked_id", viewerId),
  ]);
  const error = blockLookupError(blockedByViewer.error) || blockLookupError(blockedViewer.error);
  if (error) throw error;

  return new Set([
    ...(blockedByViewer.data || []).map((row) => row.blocked_id),
    ...(blockedViewer.data || []).map((row) => row.blocker_id),
  ].filter(Boolean));
}