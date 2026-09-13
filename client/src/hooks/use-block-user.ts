import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  blockUserRequest,
  removeBlockedUserFromCaches,
  removeUnblockedUserFromCaches,
  unblockUserRequest,
} from "@/lib/block-user";

interface UseBlockUserOptions {
  /** Do not show a success toast when another flow (such as a report) owns messaging. */
  notifySuccess?: boolean;
  /** Do not show an error toast when the caller needs to combine the error with another result. */
  notifyError?: boolean;
  onBlocked?: (blockedUserId: string) => void;
}

interface UseUnblockUserOptions {
  /** Do not show a success toast when the caller owns confirmation messaging. */
  notifySuccess?: boolean;
  /** Do not show an error toast when the caller renders the mutation error inline. */
  notifyError?: boolean;
  onUnblocked?: (blockedUserId: string) => void;
}

export function useBlockUser(options: UseBlockUserOptions = {}) {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  const viewerId = user?.id || session?.user?.id;
  const { toast } = useToast();
  const { notifySuccess = true, notifyError = true, onBlocked } = options;

  return useMutation({
    mutationFn: async (blockedUserId: string) => {
      if (!blockedUserId) throw new Error("The user to block could not be identified.");
      if (viewerId && blockedUserId === viewerId) throw new Error("You can't block yourself.");
      if (!session?.access_token) throw new Error("Sign in is required to block someone.");
      return blockUserRequest(session.access_token, blockedUserId, viewerId);
    },
    onSuccess: (_result, blockedUserId) => {
      removeBlockedUserFromCaches(queryClient, blockedUserId, viewerId);
      if (notifySuccess) {
        toast({
          title: "User blocked",
          description: "They won't appear in your feed or people lists.",
        });
      }
      onBlocked?.(blockedUserId);
    },
    onError: (error: Error) => {
      if (notifyError) {
        toast({
          title: "Couldn't block user",
          description: error.message || "Please try again.",
          variant: "destructive",
        });
      }
    },
  });
}

export function useUnblockUser(options: UseUnblockUserOptions = {}) {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  const viewerId = user?.id || session?.user?.id;
  const { toast } = useToast();
  const { notifySuccess = true, notifyError = true, onUnblocked } = options;

  return useMutation({
    mutationFn: async (blockedUserId: string) => {
      if (!blockedUserId) throw new Error("The user to unblock could not be identified.");
      if (viewerId && blockedUserId === viewerId) throw new Error("You can't unblock yourself.");
      if (!session?.access_token) throw new Error("Sign in is required to unblock someone.");
      return unblockUserRequest(session.access_token, blockedUserId, viewerId);
    },
    onSuccess: (_result, blockedUserId) => {
      removeUnblockedUserFromCaches(queryClient, blockedUserId, viewerId);
      if (notifySuccess) {
        toast({
          title: "User unblocked",
          description: "They can appear in your feeds and people lists again. Your friendship was not restored.",
        });
      }
      onUnblocked?.(blockedUserId);
    },
    onError: (error: Error) => {
      if (notifyError) {
        toast({
          title: "Couldn't unblock user",
          description: error.message || "Please try again.",
          variant: "destructive",
        });
      }
    },
  });
}