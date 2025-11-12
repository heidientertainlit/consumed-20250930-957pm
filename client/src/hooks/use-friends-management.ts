import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export function useFriendsManagement() {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get friends list
  const friendsQuery = useQuery({
    queryKey: ['friends'],
    queryFn: async () => {
      if (!session?.access_token) return { friends: [] };

      const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/manage-friendships`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'getFriends' }),
      });

      if (!response.ok) return { friends: [] };
      return response.json();
    },
    enabled: !!session?.access_token,
  });

  // Get pending friend requests
  const pendingRequestsQuery = useQuery({
    queryKey: ['pending-requests'],
    queryFn: async () => {
      if (!session?.access_token) return { requests: [] };

      const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/manage-friendships`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'getPendingRequests' }),
      });

      if (!response.ok) {
        console.error('Pending requests error:', await response.text());
        return { requests: [] };
      }
      
      const data = await response.json();
      return data;
    },
    enabled: !!session?.access_token,
  });

  // Search users
  const useUserSearch = (searchQuery: string) => {
    return useQuery({
      queryKey: ['user-search', searchQuery],
      queryFn: async () => {
        if (!session?.access_token || !searchQuery.trim() || searchQuery.length < 3) {
          return { users: [] };
        }

        const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/manage-friendships`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'searchUsers', query: searchQuery }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Search error:', errorData);
          throw new Error(errorData.error || 'Search failed');
        }
        
        const data = await response.json();
        return data;
      },
      enabled: !!session?.access_token && searchQuery.length >= 3,
    });
  };

  // Send friend request
  const sendRequestMutation = useMutation({
    mutationFn: async (friendId: string) => {
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/manage-friendships`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'sendRequest', friendId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Send request error:', errorData);
        throw new Error(errorData.error || 'Failed to send friend request');
      }
      
      const result = await response.json();
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-search'] });
      toast({
        title: "Friend Request Sent",
        description: "Your friend request has been sent!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Send Request",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Accept friend request
  const acceptRequestMutation = useMutation({
    mutationFn: async (friendId: string) => {
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/manage-friendships`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'acceptRequest', friendId }),
      });

      if (!response.ok) throw new Error('Failed to accept friend request');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      toast({
        title: "Friend Request Accepted",
        description: "You are now friends!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Accept Request",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Reject friend request
  const rejectRequestMutation = useMutation({
    mutationFn: async (friendId: string) => {
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/manage-friendships`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'rejectRequest', friendId }),
      });

      if (!response.ok) throw new Error('Failed to reject friend request');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
      toast({
        title: "Request Rejected",
        description: "Friend request has been declined.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Reject Request",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  return {
    user,
    friendsData: friendsQuery.data,
    pendingData: pendingRequestsQuery.data,
    isLoadingFriends: friendsQuery.isLoading,
    isLoadingPending: pendingRequestsQuery.isLoading,
    useUserSearch,
    sendRequestMutation,
    acceptRequestMutation,
    rejectRequestMutation,
  };
}
