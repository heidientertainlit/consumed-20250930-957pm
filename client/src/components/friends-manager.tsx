import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Search, Check, UserPlus, X, Share2 } from "lucide-react";
import { useFriendsManagement } from "@/hooks/use-friends-management";
import { urlFor, APP_BASE } from "@/lib/share";
import { useToast } from "@/hooks/use-toast";

interface FriendsManagerProps {
  userId: string;
}

export default function FriendsManager({ userId }: FriendsManagerProps) {
  const [activeTab, setActiveTab] = useState<'requests' | 'friends'>('requests');
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const {
    user,
    friendsData,
    pendingData,
    useUserSearch,
    sendRequestMutation,
    acceptRequestMutation,
    rejectRequestMutation,
  } = useFriendsManagement();

  const { data: searchResults, isLoading: searchLoading } = useUserSearch(searchQuery);

  const handleInviteFriends = async () => {
    if (!userId) return;
    const inviteUrl = `${APP_BASE}/u/${userId}`;
    const shareText = "My entire entertainment personality is on Consumed — every show, book, album, podcast. Join me and let's see who has better taste.";

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on Consumed",
          text: shareText,
          url: inviteUrl,
        });
        return;
      } catch (err) {}
    }

    try {
      const fullText = `${shareText}\n${inviteUrl}`;
      await navigator.clipboard.writeText(fullText);
      toast({
        title: "Invite copied!",
        description: "Paste and send to a friend to invite them.",
      });
    } catch (err) {
      toast({
        title: "Your invite link",
        description: inviteUrl,
      });
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Find Friends Section — moved to top */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h4 className="text-sm font-semibold mb-2 text-gray-900">Find Friends</h4>

        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by username or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent text-sm text-black placeholder-gray-500 bg-white"
            data-testid="input-search-friends"
          />
        </div>

        {searchQuery.length > 0 && (
          <div className="space-y-3 max-h-64 overflow-y-auto mt-3">
            {searchQuery.length >= 3 ? (
              searchLoading ? (
                <div className="text-center py-4 text-gray-500">Searching...</div>
              ) : searchResults?.users && searchResults.users.length > 0 ? (
                searchResults.users.map((searchUser: any) => {
                  const displayName = searchUser.display_name ||
                                     (searchUser.first_name && searchUser.last_name ? `${searchUser.first_name} ${searchUser.last_name}` : '') ||
                                     searchUser.user_name ||
                                     'Unknown User';
                  return (
                    <div key={searchUser.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-white bg-white">
                      <Link
                        href={`/user/${searchUser.id}`}
                        className="flex items-center space-x-3 flex-1 cursor-pointer"
                      >
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm">👤</span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{displayName}</div>
                          <div className="text-sm text-gray-500">{searchUser.email}</div>
                        </div>
                      </Link>
                      <Button
                        onClick={() => sendRequestMutation.mutate(searchUser.id)}
                        disabled={sendRequestMutation.isPending}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 text-sm rounded-full"
                        data-testid={`button-add-friend-${searchUser.id}`}
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
                Keep typing to search...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Header with Invite Button */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <Button
            onClick={handleInviteFriends}
            size="sm"
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 rounded-full shrink-0"
            data-testid="button-invite-friends"
          >
            <Share2 size={14} className="mr-1.5" />
            Invite Friends
          </Button>
          <p className="text-xs text-gray-500">Connect with other entertainment fans</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all text-sm ${
              activeTab === 'requests'
                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent'
            }`}
            data-testid="tab-requests"
          >
            <div className="flex items-center justify-center gap-2">
              Requests to Approve
              {(pendingData?.requests?.length || 0) > 0 && (
                <span className="bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {pendingData.requests.length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all text-sm ${
              activeTab === 'friends'
                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent'
            }`}
            data-testid="tab-friends"
          >
            <div className="flex items-center justify-center gap-2">
              Your Friends
              {(friendsData?.friends?.length || 0) > 0 && (
                <span className="bg-gray-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {friendsData.friends.length}
                </span>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4 border-b border-gray-200">
        {activeTab === 'requests' ? (
          /* Pending Requests Content */
          pendingData?.requests && pendingData.requests.length > 0 ? (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {pendingData.requests.map((request: any) => (
                <div key={request.id} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm">👤</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {request.users?.first_name && request.users?.last_name 
                          ? `${request.users.first_name} ${request.users.last_name}` 
                          : request.users?.user_name || 'Unknown User'}
                      </div>
                      <div className="text-sm text-gray-500">@{request.users?.user_name}</div>
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
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">No pending requests</p>
            </div>
          )
        ) : (
          /* Your Friends Content */
          friendsData?.friends && friendsData.friends.length > 0 ? (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {friendsData.friends.map((friendship: any) => (
                <Link 
                  key={friendship.id} 
                  href={`/user/${friendship.friend?.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center">
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
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">No friends yet</p>
            </div>
          )
        )}
      </div>

    </div>
  );
}
