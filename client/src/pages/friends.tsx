import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Search, Check, UserPlus, Users, X, Share2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { copyLink } from "@/lib/share";

export default function FriendsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<'requests' | 'friends'>('requests');
  const { session, user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get friends list
  const { data: friendsData } = useQuery({
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
  const { data: pendingData } = useQuery({
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
      console.log('Pending requests data:', data);
      return data;
    },
    enabled: !!session?.access_token,
  });

  // Search users
  const { data: searchResults, isLoading: searchLoading, error: searchError } = useQuery({
    queryKey: ['user-search', searchQuery],
    queryFn: async () => {
      if (!session?.access_token || !searchQuery.trim() || searchQuery.length < 3) {
        return { users: [] };
      }

      console.log('Searching for users with query:', searchQuery);

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
      console.log('Search results:', data);
      return data;
    },
    enabled: !!session?.access_token && searchQuery.length >= 3,
  });

  // Send friend request
  const sendRequestMutation = useMutation({
    mutationFn: async (friendId: string) => {
      if (!session?.access_token) throw new Error('Not authenticated');

      console.log('Sending friend request to:', friendId);

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
      console.log('Friend request sent successfully:', result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-search'] });
      queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
      toast({
        title: "Friend Request Sent",
        description: "Your friend request has been sent successfully.",
      });
    },
    onError: (error: Error) => {
      console.error('Friend request mutation error:', error);
      toast({
        title: "Failed to Send Request",
        description: error.message,
        variant: "destructive"
      });
    }
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
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
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

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation />
      <Toaster />

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-semibold text-black mb-2">Friends</h1>
          <p className="text-gray-600">Connect with other entertainment fans</p>
          
          {/* Invite Friends Button */}
          <Button
            onClick={async () => {
              if (!user?.id) return;
              await copyLink({ kind: 'profile', id: user.id });
              toast({
                title: "Invite Link Copied!",
                description: "Share this link to invite friends to find you on consumed",
              });
            }}
            className="mt-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-2 rounded-full"
            data-testid="button-invite-friends"
          >
            <Share2 size={16} className="mr-2" />
            Invite Friends
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-3 px-6 rounded-t-xl font-semibold transition-all ${
              activeTab === 'requests'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            data-testid="tab-requests"
          >
            <div className="flex items-center justify-center gap-2">
              Requests to Approve
              <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingData?.requests?.length || 0}
              </span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-3 px-6 rounded-t-xl font-semibold transition-all ${
              activeTab === 'friends'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            data-testid="tab-friends"
          >
            <div className="flex items-center justify-center gap-2">
              Your Friends
              <span className="bg-gray-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {friendsData?.friends?.length || 0}
              </span>
            </div>
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          {activeTab === 'requests' ? (
            /* Pending Requests Content */
            pendingData?.requests && pendingData.requests.length > 0 ? (
              <div className="space-y-3">
                {pendingData.requests.map((request: any) => (
                  <div key={request.id} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">👤</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{request.sender?.user_name || 'Unknown User'}</div>
                        <div className="text-sm text-gray-500">{request.sender?.email}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => acceptRequestMutation.mutate(request.user_id)}
                        disabled={acceptRequestMutation.isPending || rejectRequestMutation.isPending}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm rounded-full"
                        data-testid={`button-accept-request-${request.id}`}
                      >
                        <Check size={14} className="mr-1" />
                        Accept
                      </Button>
                      <Button
                        onClick={() => rejectRequestMutation.mutate(request.user_id)}
                        disabled={acceptRequestMutation.isPending || rejectRequestMutation.isPending}
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50 px-4 py-2 text-sm rounded-full"
                        data-testid={`button-reject-request-${request.id}`}
                      >
                        <X size={14} className="mr-1" />
                        Deny
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-3 text-gray-400">
                <p className="text-sm">No pending requests</p>
              </div>
            )
          ) : (
            /* Your Friends Content */
            friendsData?.friends && friendsData.friends.length > 0 ? (
              <div className="space-y-3">
                {friendsData.friends.map((friendship: any) => (
                  <div key={friendship.id} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">👤</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{friendship.friend?.user_name || 'Unknown User'}</div>
                        <div className="text-sm text-gray-500">{friendship.friend?.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 text-green-600 font-medium text-sm">
                      <Check size={14} />
                      <span>Friends</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-3 text-gray-400">
                <p className="text-sm">No friends yet</p>
              </div>
            )
          )}
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Find Friends</h3>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by username or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-700 focus:border-transparent text-sm text-black placeholder-gray-500"
            />
          </div>

          {/* Search Results */}
          <div className="space-y-3">
            {searchQuery.length >= 3 ? (
              searchLoading ? (
                <div className="text-center py-4 text-gray-500">Searching...</div>
              ) : searchResults?.users && searchResults.users.length > 0 ? (
                searchResults.users.map((user: any) => {
                  const displayName = user.display_name || 
                                     (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : '') ||
                                     user.user_name || 
                                     'Unknown User';
                  return (
                  <div key={user.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">👤</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{displayName}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                    <Button
                      onClick={() => sendRequestMutation.mutate(user.id)}
                      disabled={sendRequestMutation.isPending}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 text-sm rounded-full"
                    >
                      <UserPlus size={14} className="mr-1" />
                      Add
                    </Button>
                  </div>
                );
                })
              ) : (
                <div className="text-center py-4 text-gray-500">
                  No users found. Try a different search.
                </div>
              )
            ) : (
              <div className="text-center py-4 text-gray-500">
                Type at least 3 characters to search for friends
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}