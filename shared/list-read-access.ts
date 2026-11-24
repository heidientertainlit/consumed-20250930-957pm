export type ListAudience = "any" | "public" | "friend";

type QueryError = { message: string };
type Result<T> = PromiseLike<{ data: T | null; error: QueryError | null }>;
type ListRow = { id: string; user_id: string | null };
type Friendship = { user_id: string; friend_id: string };
type ReadQuery<T> = Result<T[]> & {
  select(fields: string): ReadQuery<T>;
  in(column: string, values: string[]): ReadQuery<T>;
  eq(column: string, value: string | boolean): ReadQuery<T>;
  or(filter: string): ReadQuery<T>;
};
type Caller = { from(table: "lists" | "friendships"): unknown };
type RolloutService = { rpc(name: string, args: Record<string, unknown>): Result<unknown> };

export function verifiedListViewer(
  authorization: string | null | undefined,
  anonKey: string,
  verifiedUser: { id: string } | null | undefined,
): string | null {
  if (verifiedUser?.id) return verifiedUser.id;
  const bearer = /^Bearer +(\S+)$/i.exec(authorization?.trim() ?? "");
  if (authorization == null || (anonKey && bearer?.[1] === anonKey)) return null;
  throw new Error("Unverified list session");
}

/**
 * Reader authorization during the policy transition. Default to the temporary
 * service-only bridge, never fall back when it fails. Enable RLS mode only on
 * hosts whose database has passed the corrected-policy cutover checks.
 */
export function createListReadGate(
  caller: Caller,
  rolloutService: () => RolloutService,
  verifiedViewer: string | null,
  enforcement: string | undefined,
) {
  return async (ids: readonly string[], audience: ListAudience = "any"): Promise<Set<string>> => {
    if (enforcement !== undefined && enforcement !== "bridge" && enforcement !== "rls") {
      throw new Error("Invalid list read enforcement mode");
    }
    if (audience === "friend" && !verifiedViewer) return new Set();
    const unique = [...new Set(ids)];
    const allowed = new Set<string>();
    for (let start = 0; start < unique.length; start += 100) {
      const batch = unique.slice(start, start + 100);
      if (enforcement !== "rls") {
        const { data, error } = await rolloutService().rpc("list_read_rollout_ids", {
          p_viewer_id: verifiedViewer, p_list_ids: batch, p_audience: audience,
        });
        if (error || !Array.isArray(data) || data.some(id => !batch.includes(id))) {
          throw new Error("List authorization unavailable");
        }
        data.forEach(id => allowed.add(id));
        continue;
      }

      // Use the signed caller, never a service client, in the permanent mode.
      let query = (caller.from("lists") as ReadQuery<ListRow>).select("id,user_id").in("id", batch);
      if (audience !== "any") {
        query = query.eq("is_private", false).in("visibility", audience === "public" ? ["public"] : ["public", "friends"]);
      }
      const { data: lists, error } = await query;
      if (error || !lists) throw new Error("Could not verify list scope");
      if (audience !== "friend" || !lists.length) {
        lists.forEach(list => allowed.add(list.id));
        continue;
      }
      // The friend-library routes are narrower than generic public-URL access.
      const { data: friends, error: friendsError } = await (caller.from("friendships") as ReadQuery<Friendship>)
        .select("user_id,friend_id").eq("status", "accepted")
        .or(`user_id.eq.${verifiedViewer},friend_id.eq.${verifiedViewer}`);
      if (friendsError || !friends) throw new Error("Could not verify friendship");
      const friendIds = new Set(friends.map(row => row.user_id === verifiedViewer ? row.friend_id : row.user_id));
      for (const list of lists) {
        if (list.user_id && friendIds.has(list.user_id)) allowed.add(list.id);
      }
    }
    return allowed;
  };
}
