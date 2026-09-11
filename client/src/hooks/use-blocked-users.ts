import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { blockedUsersQueryKey, loadBlockedUserIds } from "@/lib/block-user";

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