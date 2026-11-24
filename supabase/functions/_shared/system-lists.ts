import { SYSTEM_LIST_TITLES, isSystemListTitle, systemListTitle } from "../../../shared/system-lists.ts";
export { SYSTEM_LIST_TITLES, isSystemListTitle, systemListTitle };

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
