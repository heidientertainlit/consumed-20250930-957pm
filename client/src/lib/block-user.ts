import type { QueryClient } from "@tanstack/react-query";

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";
export const blockedUsersQueryKey = (viewerId: string) => ["blocked-user-ids", viewerId] as const;
export const blockedUsersSignature = (blockedUserIds: readonly string[]) =>
  [...new Set(blockedUserIds)].sort().join(",");

type BlockedUserCacheOverrides = {
  added: Set<string>;
  removed: Set<string>;
};

// The blocks query deliberately keeps a small, viewer-scoped tombstone set in
// memory. A blocks request can finish while an older hydration is still in
// flight; without the tombstone that older response would union an unblocked
// id back into the active query.
const blockedUserCacheOverrides = new Map<string, BlockedUserCacheOverrides>();

function overridesForViewer(viewerId: string): BlockedUserCacheOverrides {
  const existing = blockedUserCacheOverrides.get(viewerId);
  if (existing) return existing;
  const overrides = { added: new Set<string>(), removed: new Set<string>() };
  blockedUserCacheOverrides.set(viewerId, overrides);
  return overrides;
}

export function mergeBlockedUserIdsForViewer(
  viewerId: string,
  hydratedIds: readonly string[],
  optimisticIds: readonly string[] = [],
): string[] {
  const overrides = overridesForViewer(viewerId);
  const ids = [...new Set([...hydratedIds, ...optimisticIds, ...overrides.added])];
  return ids.filter((id) => !overrides.removed.has(id));
}

export type BlockedUserDisplayIdentity = {
  id: string;
  user_name?: string | null;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

const blockedUserDisplayColumns = "id,user_name,display_name,first_name,last_name";

type CacheUpdate = { changed: boolean; data: unknown };

function idOf(value: any): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  return value.triggered_by_user_id || value.user_id || value.author_id || value.actor_id || value.sender_id || value.friend_id ||
    value.blocked_id || value.blocked_user_id || value.user?.id || value.author?.id ||
    value.users?.id || value.friend?.id || value.id;
}

function belongsToUser(value: any, blockedUserId: string): boolean {
  if (!value || typeof value !== "object") return false;
  // Notifications carry both the recipient (`user_id`) and the actor who
  // should be hidden (`triggered_by_user_id`). Always check actor fields
  // explicitly before falling back to the generic owner id.
  return value.triggered_by_user_id === blockedUserId ||
    idOf(value) === blockedUserId ||
    value.id === blockedUserId ||
    value.user?.id === blockedUserId ||
    value.author?.id === blockedUserId ||
    value.users?.id === blockedUserId ||
    value.friend?.id === blockedUserId;
}

export function getBlockedUserIdsForViewer(queryClient: QueryClient, viewerId?: string): string[] {
  if (!viewerId) return [];
  const cached = queryClient.getQueryData<string[]>(blockedUsersQueryKey(viewerId)) || [];
  return mergeBlockedUserIdsForViewer(viewerId, cached);
}

export function rememberBlockedUserForViewer(queryClient: QueryClient, viewerId: string | undefined, blockedUserId: string) {
  if (!viewerId || !blockedUserId) return;
  const overrides = overridesForViewer(viewerId);
  overrides.removed.delete(blockedUserId);
  overrides.added.add(blockedUserId);
  const next = getBlockedUserIdsForViewer(queryClient, viewerId);
  if (!next.includes(blockedUserId)) next.push(blockedUserId);
  queryClient.setQueryData(blockedUsersQueryKey(viewerId), next);
}

export function rememberUnblockedUserForViewer(viewerId: string | undefined, blockedUserId: string) {
  if (!viewerId || !blockedUserId) return;
  const overrides = overridesForViewer(viewerId);
  overrides.added.delete(blockedUserId);
  overrides.removed.add(blockedUserId);
}

export function filterCommentsForBlockedUsers<T>(comments: T[], blockedUserIds: readonly string[]): T[] {
  if (!blockedUserIds.length) return comments;
  return blockedUserIds.reduce((result, blockedUserId) => filterComments(result, blockedUserId).data as T[], comments);
}

export async function loadBlockedUserIds(client: any, viewerId: string): Promise<string[]> {
  const { data, error } = await client
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", viewerId);
  if (error) throw new Error(`Blocked users could not be verified: ${error.message}`);
  const rows = Array.isArray(data) ? data as Array<{ blocked_id: string | null }> : [];
  const ids = rows.map((row) => row.blocked_id).filter((id): id is string => Boolean(id));
  return [...new Set<string>(ids)];
}

/**
 * Resolve only the public identity fields needed to label blocked rows. The
 * blocks query remains the account-authoritative source of membership; this
 * second query must never be used to infer whether a person is blocked.
 */
export async function loadBlockedUserDisplayIdentities(
  client: any,
  blockedUserIds: readonly string[],
): Promise<BlockedUserDisplayIdentity[]> {
  const ids = [...new Set(blockedUserIds)].filter(Boolean);
  if (!ids.length) return [];

  const { data, error } = await client
    .from("public_user_profiles")
    .select(blockedUserDisplayColumns)
    .in("id", ids);
  if (error) throw new Error(`Blocked user identities could not be loaded: ${error.message}`);

  const requestedIds = new Set(ids);
  return (Array.isArray(data) ? data : [])
    .filter((profile): profile is BlockedUserDisplayIdentity =>
      Boolean(profile && typeof profile.id === "string" && requestedIds.has(profile.id))
    )
    .map((profile) => ({
      id: profile.id,
      user_name: profile.user_name ?? null,
      display_name: profile.display_name ?? null,
      first_name: profile.first_name ?? null,
      last_name: profile.last_name ?? null,
    }));
}

export function filterNotificationsForBlockedUsers<T extends { triggered_by_user_id?: string | null }>(
  notifications: T[],
  blockedUserIds: readonly string[],
): T[] {
  if (!blockedUserIds.length) return notifications;
  return notifications.filter((notification) => !notification.triggered_by_user_id || !blockedUserIds.includes(notification.triggered_by_user_id));
}

function filterUserArray(value: unknown, blockedUserId: string): CacheUpdate {
  if (!Array.isArray(value)) return { changed: false, data: value };
  const filtered = value.filter((item) => !belongsToUser(item, blockedUserId));
  return { changed: filtered.length !== value.length, data: filtered };
}

function filterComments(value: unknown, blockedUserId: string): CacheUpdate {
  if (!Array.isArray(value)) return { changed: false, data: value };
  let changed = false;
  const comments = value
    .filter((comment: any) => {
      const keep = !belongsToUser(comment, blockedUserId);
      changed ||= !keep;
      return keep;
    })
    .map((comment: any) => {
      if (!Array.isArray(comment?.replies)) return comment;
      const replies = filterComments(comment.replies, blockedUserId);
      changed ||= replies.changed;
      return replies.changed ? { ...comment, replies: replies.data } : comment;
    });
  return { changed, data: changed ? comments : value };
}

function updateFeedData(data: any, blockedUserId: string): CacheUpdate {
  if (Array.isArray(data)) return filterUserArray(data, blockedUserId);
  if (!data || typeof data !== "object") return { changed: false, data };

  if (Array.isArray(data.pages)) {
    let changed = false;
    const pages = data.pages.map((page: unknown) => {
      const update = filterUserArray(page, blockedUserId);
      changed ||= update.changed;
      return update.data;
    });
    return { changed, data: changed ? { ...data, pages } : data };
  }

  if (belongsToUser(data, blockedUserId)) return { changed: true, data: null };
  return { changed: false, data };
}

function updateFriendships(data: any, blockedUserId: string, property: "friends" | "requests"): CacheUpdate {
  if (!data || typeof data !== "object" || !Array.isArray(data[property])) return { changed: false, data };
  const filtered = data[property].filter((item: any) => !belongsToUser(item, blockedUserId));
  return { changed: filtered.length !== data[property].length, data: filtered.length !== data[property].length ? { ...data, [property]: filtered } : data };
}

function updateAffinity(data: any, blockedUserId: string): CacheUpdate {
  if (!data || typeof data !== "object" || !Array.isArray(data.bands)) return { changed: false, data };
  let changed = false;
  const bands = data.bands.map((band: any) => {
    if (!Array.isArray(band?.people)) return band;
    const people = band.people.filter((person: any) => person?.id !== blockedUserId);
    changed ||= people.length !== band.people.length;
    return people.length !== band.people.length ? { ...band, people } : band;
  });
  return { changed, data: changed ? { ...data, bands } : data };
}

function updateTribes(data: any, blockedUserId: string): CacheUpdate {
  if (!data || typeof data !== "object" || !Array.isArray(data.tribes)) return { changed: false, data };
  let changed = false;
  const tribes = data.tribes.map((tribe: any) => {
    let tribeChanged = false;
    const next = { ...tribe };
    for (const property of ["members", "people"] as const) {
      if (!Array.isArray(tribe?.[property])) continue;
      next[property] = tribe[property].filter((person: any) => person?.id !== blockedUserId);
      tribeChanged ||= next[property].length !== tribe[property].length;
    }
    if (Array.isArray(tribe?.recent_takes)) {
      next.recent_takes = tribe.recent_takes.filter((take: any) => !belongsToUser(take, blockedUserId));
      tribeChanged ||= next.recent_takes.length !== tribe.recent_takes.length;
    }
    changed ||= tribeChanged;
    return tribeChanged ? next : tribe;
  });
  return { changed, data: changed ? { ...data, tribes } : data };
}

function updateUserSearch(data: any, blockedUserId: string): CacheUpdate {
  if (!data || typeof data !== "object" || !Array.isArray(data.users)) return { changed: false, data };
  const users = data.users.filter((person: any) => person?.id !== blockedUserId);
  return { changed: users.length !== data.users.length, data: users.length !== data.users.length ? { ...data, users } : data };
}

function removeBlockedUserFromDisplayData(data: unknown, blockedUserId: string): CacheUpdate {
  if (!Array.isArray(data)) return { changed: false, data };
  const filtered = data.filter((profile: any) => profile?.id !== blockedUserId);
  return { changed: filtered.length !== data.length, data: filtered };
}

/**
 * Removes the target from the known client-side social caches. This is only an
 * optimistic privacy update; the follow-up invalidations re-read server data
 * after the block endpoint has succeeded.
 */
export function removeBlockedUserFromQueryData(queryKey: readonly unknown[], data: unknown, blockedUserId: string): CacheUpdate {
  const root = String(queryKey[0] || "");
  if (root === "post-comments") return filterComments(data, blockedUserId);
  if (root === "social-feed" || root === "highlighted-post" || root === "play-activity" || root === "/api/notifications") {
    return updateFeedData(data, blockedUserId);
  }
  if (root === "friends" || root === "user-friends" || root === "compare-friends") {
    return root === "friends" ? updateFriendships(data, blockedUserId, "friends") : filterUserArray(data, blockedUserId);
  }
  if (root === "pending-requests") return updateFriendships(data, blockedUserId, "requests");
  if (root === "user-search") return updateUserSearch(data, blockedUserId);
  if (root === "people-affinity-v9") return updateAffinity(data, blockedUserId);
  if (root === "people-tribes-v6") return updateTribes(data, blockedUserId);
  return { changed: false, data };
}

export function removeBlockedUserFromCaches(queryClient: QueryClient, blockedUserId: string, viewerId?: string) {
  for (const [queryKey, data] of queryClient.getQueriesData({})) {
    if (String(queryKey[0] || "") === "post-comments" && viewerId && queryKey[2] && queryKey[2] !== viewerId) continue;
    const update = removeBlockedUserFromQueryData(queryKey, data, blockedUserId);
    if (update.changed) queryClient.setQueryData(queryKey, update.data);
  }
  rememberBlockedUserForViewer(queryClient, viewerId, blockedUserId);

  // Refetch active data so the local privacy update is reconciled with the
  // database trigger that removes relationships in both directions.
  invalidateBlockedUserRelatedCaches(queryClient, viewerId);
}

const blockedUserRelatedQueryRoots = [
  ["social-feed"],
  ["highlighted-post"],
  ["post-comments"],
  ["play-activity"],
  ["/api/notifications"],
  ["friends"],
  ["user-friends"],
  ["compare-friends"],
  ["pending-requests"],
  ["user-search"],
  ["people-affinity-v9"],
  ["people-tribes-v6"],
  ["people-friends"],
  ["people-affinity"],
  ["dna-compare-friends"],
  ["user-profile"],
  ["profile"],
  ["nav-avatar"],
  ["user-lists-with-media"],
] as const;

function invalidateBlockedUserRelatedCaches(queryClient: QueryClient, viewerId?: string) {
  for (const queryKey of blockedUserRelatedQueryRoots) {
    if (queryKey[0] === "post-comments" && viewerId) {
      void queryClient.invalidateQueries({
        queryKey,
        predicate: (query) => query.queryKey[2] === viewerId,
      });
      continue;
    }
    void queryClient.invalidateQueries({ queryKey });
  }
}

export function removeUnblockedUserFromQueryData(
  queryKey: readonly unknown[],
  data: unknown,
  blockedUserId: string,
): CacheUpdate {
  if (String(queryKey[0] || "") !== "blocked-user-profiles") return { changed: false, data };
  return removeBlockedUserFromDisplayData(data, blockedUserId);
}

export function removeUnblockedUserFromCaches(queryClient: QueryClient, blockedUserId: string, viewerId?: string) {
  if (!viewerId || !blockedUserId) return;
  rememberUnblockedUserForViewer(viewerId, blockedUserId);
  queryClient.setQueryData<string[]>(
    blockedUsersQueryKey(viewerId),
    (current) => (current || []).filter((id) => id !== blockedUserId),
  );

  for (const [queryKey, data] of queryClient.getQueriesData({})) {
    if (String(queryKey[0] || "") === "blocked-user-profiles" && queryKey[1] === viewerId) {
      const update = removeUnblockedUserFromQueryData(queryKey, data, blockedUserId);
      if (update.changed) queryClient.setQueryData(queryKey, update.data);
    }
  }

  // The target may have been removed from privacy-filtered caches when the
  // block was created. Refetch those feeds and profile/people queries after
  // the successful unblock; the endpoint does not restore a friendship.
  void queryClient.invalidateQueries({ queryKey: blockedUsersQueryKey(viewerId) });
  invalidateBlockedUserRelatedCaches(queryClient, viewerId);
}

type BlockUserAction = "block" | "unblock";

async function blockUserActionRequest(
  accessToken: string,
  blockedUserId: string,
  currentUserId: string | undefined,
  action: BlockUserAction,
): Promise<{ success?: boolean; action?: string }> {
  const actionLabel = action === "unblock" ? "unblock" : "block";
  if (!accessToken) throw new Error(`Sign in is required to ${actionLabel} someone.`);
  if (!blockedUserId) throw new Error(`The user to ${actionLabel} could not be identified.`);
  if (currentUserId && blockedUserId === currentUserId) throw new Error(`You can't ${actionLabel} yourself.`);

  const response = await fetch(`${SUPABASE_URL}/functions/v1/block-user`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      apikey: import.meta.env?.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      blocked_user_id: blockedUserId,
      ...(action === "unblock" ? { action } : {}),
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error || `Unable to ${actionLabel} this user. Please try again.`);
  return result;
}

export function blockUserRequest(
  accessToken: string,
  blockedUserId: string,
  currentUserId?: string,
  action: BlockUserAction = "block",
): Promise<{ success?: boolean; action?: string }> {
  return blockUserActionRequest(accessToken, blockedUserId, currentUserId, action);
}

export function unblockUserRequest(
  accessToken: string,
  blockedUserId: string,
  currentUserId?: string,
): Promise<{ success?: boolean; action?: string }> {
  return blockUserActionRequest(accessToken, blockedUserId, currentUserId, "unblock");
}