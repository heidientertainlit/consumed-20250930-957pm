import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  blockedUsersQueryKey,
  blockedUsersSignature,
  loadBlockedUserDisplayIdentities,
  loadBlockedUserIds,
  type BlockedUserDisplayIdentity,
} from "@/lib/block-user";

/**
 * Loads the viewer's blocks from the account-authoritative table. Callers
 * should not render user-authored content until this query succeeds.
 */
export function useBlockedUsers(viewerId?: string) {
  const queryClient = useQueryClient();
  return useQuery<string[], Error>({
    queryKey: viewerId ? blockedUsersQueryKey(viewerId) : ["blocked-user-ids", "anonymous"],
    enabled: !!viewerId,
    staleTime: Infinity,
    retry: 1,
    queryFn: async () => {
      if (!viewerId) throw new Error("Your account could not be identified while checking blocked users.");
      const hydratedIds = await loadBlockedUserIds(supabase, viewerId);
      const optimisticIds = queryClient.getQueryData<string[]>(blockedUsersQueryKey(viewerId)) || [];
      return [...new Set([...hydratedIds, ...optimisticIds])];
    },
  });
}

/**
 * Hydrates display-only identities after the account-authoritative block list
 * has loaded. Keeping this as a separate query means callers never use a
 * public profile row to decide whether a person is blocked.
 */
export function useBlockedUserProfiles(viewerId?: string) {
  const blockedUsers = useBlockedUsers(viewerId);
  const blockedUserIds = blockedUsers.data || [];
  const blockedIdsKey = blockedUsersSignature(blockedUserIds);
  const profiles = useQuery<BlockedUserDisplayIdentity[], Error>({
    queryKey: ["blocked-user-profiles", viewerId || "anonymous", blockedIdsKey],
    enabled: !!viewerId && blockedUsers.isSuccess,
    staleTime: Infinity,
    retry: 1,
    queryFn: async () => {
      if (!viewerId) throw new Error("Your account could not be identified while loading blocked people.");
      if (!blockedUsers.isSuccess) throw new Error("Blocked users have not been verified for this account yet.");
      return loadBlockedUserDisplayIdentities(supabase, blockedUserIds);
    },
  });

  return {
    ...profiles,
    blockedUsers,
    blockedUserIds,
  };
}