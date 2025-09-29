import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Search, Check, UserPlus, Star, Sparkles, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";

export default function FriendsCreatorsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get friends list
  const { data: friendsData, isLoading: friendsLoading } = useQuery({
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

      if (!response.ok) throw new Error('Failed to fetch friends');
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

      if (!response.ok) throw new Error('Failed to fetch pending requests');
      return response.json();
    },
    enabled: !!session?.access_token,
  });

  // Search users
  const { data: searchResults, isLoading: searchLoading, error: searchError } = useQuery({
    queryKey: ['user-search', searchQuery],
    queryFn: async () => {
      console.log('🔍 Searching for users with query:', searchQuery);
      if (!session?.access_token || !searchQuery.trim()) {
        console.log('❌ Search skipped - no session or empty query');
        return { users: [] };
      }

      console.log('📡 Calling manage-friendships API...');
      const response = await fetch(`https://mahpgcogwpawvviapqza.supabase.co/functions/v1/manage-friendships`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'searchUsers', query: searchQuery }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Search failed:', response.status, errorText);
        throw new Error('Failed to search users');
      }
      
      const result = await response.json();
      console.log('✅ Search results:', result);
      return result;
    },
    enabled: !!session?.access_token && searchQuery.length > 2,
  });
  
  console.log('Search state:', { searchQuery, searchResults, searchLoading, searchError, enabled: !!session?.access_token && searchQuery.length > 2 });

  // Send friend request mutation
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
        throw new Error(errorData.error || 'Failed to send friend request');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-search'] });
      queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
      toast({
        title: "Friend Request Sent!",
        description: "Your friend request has been sent successfully.",
      });
    },
    onError: (error) => {
      console.error('Failed to send friend request:', error);
      toast({
        title: "Failed to Send Request",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Accept friend request mutation
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
        title: "Friend Request Accepted!",
        description: "You are now friends and can share your entertainment lists.",
      });
    },
    onError: (error) => {
      console.error('Failed to accept friend request:', error);
      toast({
        title: "Failed to Accept Request",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    },
  });

  const handleSendRequest = (friendId: string) => {
    sendRequestMutation.mutate(friendId);
  };

  const handleAcceptRequest = (friendId: string) => {
    acceptRequestMutation.mutate(friendId);
  };

  // Follow friend mutation for recommended friends
  const followFriendMutation = useMutation({
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
        throw new Error(errorData.error || 'Failed to send friend request');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Friend Request Sent!",
        description: "Your friend request has been sent to this user.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Send Request",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleFollowFriend = (friendId: string) => {
    followFriendMutation.mutate(friendId);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navigation />
      <Toaster />

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-semibold text-black mb-3">
            Friends
          </h1>
          <p className="text-lg text-gray-600">
            Connect with fellow entertainment fans and discover friends with similar tastes
          </p>
        </div>

        {/* Friends Section */}
        <div className="space-y-6">
          {/* Connect with Friends */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 bg-gradient-to-r from-purple-800 to-purple-900 bg-clip-text text-transparent">
              Connect with Fellow Fans
            </h3>

            {/* Search Bar */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by username or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-700 focus:border-transparent text-sm text-black placeholder-gray-500"
                data-testid="input-friend-search"
              />
            </div>

            {/* Pending Friend Requests */}
            {pendingData?.requests?.length > 0 && (
              <div className="mb-6">
                <h4 className="text-md font-semibold mb-3 text-gray-700">Pending Requests</h4>
                <div className="space-y-3">
                  {pendingData.requests.map((request: any) => (
                    <div key={request.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-blue-50">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-lg">👤</span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{request.sender?.user_name || 'Unknown User'}</div>
                          <div className="text-sm text-gray-500">{request.sender?.email}</div>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleAcceptRequest(request.user_id)}
                        className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-medium px-4 py-2 text-sm rounded-full"
                      >
                        <Check size={14} className="mr-1" />
                        Accept
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search Results */}
            <div className="space-y-3">
              {searchQuery.length > 2 ? (
                searchLoading ? (
                  <div className="text-center py-4">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                      <div className="text-gray-500">Searching...</div>
                    </div>
                  </div>
                ) : searchResults?.users?.length > 0 ? (
                  searchResults.users.map((user: any) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-lg">👤</span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{user.user_name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleSendRequest(user.id)}
                        disabled={sendRequestMutation.isPending}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium px-4 py-2 text-sm rounded-full disabled:opacity-50"
                      >
                        <UserPlus size={14} className="mr-1" />
                        {sendRequestMutation.isPending ? 'Sending...' : 'Add Friend'}
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <div className="text-gray-500">
                      {searchQuery.length < 3 ? 'Type at least 3 characters to search' : 'No users found matching your search'}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      Try searching by username or email
                    </div>
                  </div>
                )
              ) : (
                // Show existing friends when not searching
                friendsLoading ? (
                  <div className="text-center py-4">
                    <div className="text-gray-500">Loading friends...</div>
                  </div>
                ) : friendsData?.friends?.length > 0 ? (
                  friendsData.friends.map((friendship: any) => (
                    <div key={friendship.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-lg">👤</span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{friendship.friend?.user_name || 'Unknown User'}</div>
                          <div className="text-sm text-gray-500">{friendship.friend?.email}</div>
                          <div className="text-xs text-gray-400">Friends since {new Date(friendship.accepted_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 text-green-600 font-medium text-sm">
                        <Check size={14} />
                        <span>Friends</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <div className="text-gray-500">No friends yet. Search above to find people to connect with!</div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Recommended for You Section - Friends */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-200 p-6 shadow-sm">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <Sparkles className="text-white" size={16} />
              </div>
              <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-800 to-purple-900 bg-clip-text text-transparent">
                Recommended for You
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">Friends with similar entertainment tastes</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  id: "rec-friend-1",
                  username: "SciFiFanatic",
                  name: "Emma Rodriguez",
                  reason: "Both love sci-fi shows and Dune series",
                  compatibility: "94% match",
                  mutualFriends: 18,
                  isFollowing: false
                },
                {
                  id: "rec-friend-2",
                  username: "BookClubQueen",
                  name: "Olivia Park",
                  reason: "Shares your love for romance novels",
                  compatibility: "91% match",
                  mutualFriends: 12,
                  isFollowing: false
                },
                {
                  id: "rec-friend-3",
                  username: "IndieVibes",
                  name: "Jordan Martinez",
                  reason: "Similar music taste - indie and alternative",
                  compatibility: "87% match",
                  mutualFriends: 7,
                  isFollowing: false
                },
                {
                  id: "rec-friend-4",
                  username: "CinemaLover24",
                  name: "Taylor Brooks",
                  reason: "You both rate A24 films highly",
                  compatibility: "89% match",
                  mutualFriends: 14,
                  isFollowing: false
                }
              ].map((friend) => (
                <div key={friend.id} className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">👤</span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{friend.name}</div>
                        <div className="text-sm text-gray-500">@{friend.username}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 text-blue-600">
                      <Star className="fill-current" size={14} />
                      <span className="text-xs font-medium">{friend.compatibility}</span>
                    </div>
                  </div>

                  <div className="text-sm text-gray-600 mb-3">{friend.reason}</div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{friend.mutualFriends} mutual connections</span>
                    {friend.isFollowing ? (
                      <div className="flex items-center space-x-1 text-green-600 font-medium text-sm">
                        <Check size={14} />
                        <span>Following</span>
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleFollowFriend(friend.id)}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium px-3 py-1 text-sm rounded-full"
                        data-testid={`button-follow-recommended-friend-${friend.id}`}
                      >
                        <UserPlus size={12} className="mr-1" />
                        Follow
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}