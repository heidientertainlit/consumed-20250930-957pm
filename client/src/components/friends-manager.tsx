import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Search, Check, UserPlus, X, Users, Plus, ChevronRight, ChevronDown, User } from "lucide-react";
import { useFriendsManagement } from "@/hooks/use-friends-management";
import { APP_BASE } from "@/lib/share";
import { useToast } from "@/hooks/use-toast";

interface FriendsManagerProps {
  userId: string;
}

export default function FriendsManager({ userId }: FriendsManagerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [requestsOpen, setRequestsOpen] = useState(false);
  const { toast } = useToast();

  const {
    pendingData,
    useUserSearch,
    sendRequestMutation,
    acceptRequestMutation,
    rejectRequestMutation,
  } = useFriendsManagement();

  const { data: searchResults, isLoading: searchLoading } = useUserSearch(searchQuery);

  const pendingCount = pendingData?.requests?.length || 0;

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
      } catch (err) {}
      // Native share sheet handled it (or user cancelled) — no toast fallback
      return;
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
    <div className="rounded-xl border border-purple-200 overflow-hidden" style={{ background: "linear-gradient(165deg, #faf5ff 0%, #f3e8ff 100%)" }}>
      {/* Find Friends — title + search */}
      <div className="p-4 pb-1">
        <h4 className="text-base font-bold text-gray-900 mb-3">Find Friends</h4>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
          <input
            type="text"
            placeholder="Search people"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent text-sm text-black placeholder-gray-400 bg-white"
            data-testid="input-search-friends"
          />
        </div>

        {searchQuery.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto mt-3">
            {searchQuery.length >= 3 ? (
              searchLoading ? (
                <div className="text-center py-4 text-sm text-gray-500">Searching...</div>
              ) : searchResults?.users && searchResults.users.length > 0 ? (
                searchResults.users.map((searchUser: any) => {
                  const displayName = searchUser.display_name ||
                                     (searchUser.first_name && searchUser.last_name ? `${searchUser.first_name} ${searchUser.last_name}` : '') ||
                                     searchUser.user_name ||
                                     'Unknown User';
                  return (
                    <div key={searchUser.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl bg-gray-50/60">
                      <Link
                        href={`/user/${searchUser.id}`}
                        className="flex items-center space-x-3 flex-1 min-w-0 cursor-pointer"
                      >
                        <div className="w-9 h-9 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                          <User size={16} className="text-purple-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{displayName}</div>
                          <div className="text-xs text-gray-500 truncate">{searchUser.email}</div>
                        </div>
                      </Link>
                      <Button
                        onClick={() => sendRequestMutation.mutate(searchUser.id)}
                        disabled={sendRequestMutation.isPending}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-1.5 text-xs rounded-full shrink-0"
                        data-testid={`button-add-friend-${searchUser.id}`}
                      >
                        <UserPlus size={13} className="mr-1" />
                        Add
                      </Button>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-4 text-sm text-gray-500">
                  No users found. Try a different search.
                </div>
              )
            ) : (
              <div className="text-center py-4 text-sm text-gray-500">
                Keep typing to search...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Friend Requests row */}
      <button
        type="button"
        onClick={() => setRequestsOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-4 border-t border-purple-100 text-left"
        data-testid="row-friend-requests"
      >
        <Users size={20} className="text-purple-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-gray-900">Friend Requests</p>
          <p className="text-[13px] text-gray-500">Review and approve</p>
        </div>
        {pendingCount > 0 && (
          <span className="bg-purple-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0">
            {pendingCount}
          </span>
        )}
        {requestsOpen
          ? <ChevronDown size={18} className="text-gray-400 shrink-0" />
          : <ChevronRight size={18} className="text-gray-400 shrink-0" />}
      </button>

      {requestsOpen && (
        <div className="px-4 pb-4">
          {pendingCount > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {pendingData.requests.map((request: any) => (
                <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50/60 border border-gray-100 rounded-xl">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-9 h-9 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                      <User size={16} className="text-purple-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {request.users?.first_name && request.users?.last_name
                          ? `${request.users.first_name} ${request.users.last_name}`
                          : request.users?.user_name || 'Unknown User'}
                      </div>
                      <div className="text-xs text-gray-500 truncate">@{request.users?.user_name}</div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      onClick={() => acceptRequestMutation.mutate(request.user_id)}
                      disabled={acceptRequestMutation.isPending || rejectRequestMutation.isPending}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 text-xs rounded-full"
                      data-testid={`button-accept-request-${request.id}`}
                    >
                      <Check size={13} className="mr-1" />
                      Accept
                    </Button>
                    <Button
                      onClick={() => rejectRequestMutation.mutate(request.user_id)}
                      disabled={acceptRequestMutation.isPending || rejectRequestMutation.isPending}
                      variant="outline"
                      className="border-gray-200 text-gray-500 hover:bg-gray-50 px-2.5 py-1.5 text-xs rounded-full"
                      data-testid={`button-reject-request-${request.id}`}
                    >
                      <X size={13} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-gray-400 text-center py-2">No pending requests</p>
          )}
        </div>
      )}

      {/* Invite Friends row */}
      <button
        type="button"
        onClick={handleInviteFriends}
        className="w-full flex items-center gap-3 px-4 py-4 border-t border-purple-100 text-left"
        data-testid="button-invite-friends"
      >
        <div className="w-9 h-9 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
          <Plus size={17} className="text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-gray-900">Invite Friends</p>
          <p className="text-[13px] text-gray-500">Invite people you know to join Consumed.</p>
        </div>
        <ChevronRight size={18} className="text-gray-400 shrink-0" />
      </button>
    </div>
  );
}
