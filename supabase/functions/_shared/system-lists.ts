import { SYSTEM_LIST_TITLES, isSystemListTitle, systemListTitle } from "../../../shared/system-lists.ts";
import { checkBlockingRelationship } from "./block-relationships.ts";
import { isProfileId } from "./public-profile-access.ts";
export { SYSTEM_LIST_TITLES, isSystemListTitle, systemListTitle };

/** Check both directions before using a service client for a member's library. */
export async function canReadFriendLists(db: any, viewerId: string, ownerId: string) {
  if (!isProfileId(viewerId) || !isProfileId(ownerId) || viewerId === ownerId) return false;
  const [friendship, blocked] = await Promise.all([
    db.from("friendships").select("id").eq("status", "accepted")
      .or(`and(user_id.eq.${viewerId},friend_id.eq.${ownerId}),and(user_id.eq.${ownerId},friend_id.eq.${viewerId})`)
      .limit(1),
    checkBlockingRelationship(db, viewerId, ownerId),
  ]);
  return !blocked && !friendship.error && Array.isArray(friendship.data) && friendship.data.length > 0;
}

/** Missing or conflicting privacy fields must not disclose a friend's list. */
export function isVisibleToFriend(list: { is_private?: boolean | null; visibility?: string | null }) {
  return list.is_private === false && (list.visibility === "public" || list.visibility === "friends");
}

/** Restoration is an owner-authorized, serialized transaction in the EXISTING lists store. */
export async function restoreSystemLists(db: {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: any }>;
}, userId: string) {
  const { data, error } = await db.rpc("ensure_standard_system_lists", { p_user_id: userId });
  if (error) throw new Error(`System lists could not be restored: ${error.message || error.code || "Unknown database error"}`);
  if (!Array.isArray(data) || SYSTEM_LIST_TITLES.some(title =>
    data.filter(list => list.user_id === userId && list.title === title && list.is_default === true).length !== 1)) {
    throw new Error("System lists could not be restored: incomplete or duplicate standard lists");
  }
  return data;
}

/** Import parsers have a historical "want-to" shelf token, not a database title. */
export function importSystemListId(
  lists: Array<{ id: string; user_id: string; title: string; is_default: boolean }>,
  userId: string,
  shelf: string,
) {
  const title = systemListTitle(shelf === "want-to" ? "want_to" : shelf);
  const matches = lists.filter(list => list.user_id === userId &&
    list.is_default === true && list.title === title);
  if (!title || matches.length !== 1) {
    throw new Error(`Import standard destination unavailable: ${shelf}`);
  }
  return matches[0].id;
}
