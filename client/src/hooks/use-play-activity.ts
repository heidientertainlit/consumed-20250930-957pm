import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import type { PlayActivityItem } from "@/lib/play-activity";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://mahpgcogwpawvviapqza.supabase.co";

/** Both feeds share the same account-scoped activity cache and source. */
export function usePlayActivity(providedFriendIds?: string[], enabled = true) {
  const { user, session } = useAuth();
  const token = session?.access_token;
  const canLoad = enabled && !!token && !!user?.id;
  const friends = useQuery<string[]>({
    queryKey: ["play-activity-friends", user?.id],
    queryFn: async ({ signal }) => {
      const response = await fetch(`${supabaseUrl}/functions/v1/manage-friendships`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getFriends" }),
        signal,
      });
      if (!response.ok) throw new Error("Couldn't load friends for Play updates.");
      const data = await response.json();
      return (data.friends || []).map((friend: any) => friend.friend?.id || friend.id).filter(Boolean);
    },
    enabled: canLoad && providedFriendIds === undefined,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const friendIds = providedFriendIds ?? friends.data;
  const sortedIds = [...new Set(friendIds || [])].sort();
  const activity = useQuery<PlayActivityItem[]>({
    queryKey: ["play-activity-v2", user?.id, sortedIds],
    queryFn: async ({ signal }) => {
      const response = await fetch(`${supabaseUrl}/functions/v1/get-play-activity`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ friendIds: sortedIds }),
        signal,
      });
      if (!response.ok) throw new Error("Couldn't load Play updates.");
      const data = await response.json();
      if (data.error) throw new Error("Couldn't load Play updates.");
      return data.items || [];
    },
    enabled: canLoad && friendIds !== undefined,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const friendsFailed = providedFriendIds === undefined && friends.isError;
  return {
    ...activity,
    isError: activity.isError || friendsFailed,
    refetch: () => friendsFailed ? friends.refetch() : activity.refetch(),
  };
}
