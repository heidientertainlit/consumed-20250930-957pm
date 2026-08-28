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
    friendsData,
    pendingData,
    isLoadingFriends,
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
    <>
    <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(165deg, #4c2a85 0%, #3b3f9e 50%, #2f6bc4 100%)", border: "1px solid rgba(140,170,255,0.25)" }}>
      {/* Find Friends — title + search */}
      <div className="p-4 pb-1">
        <h4 className="text-base font-bold text-white mb-3">Find Friends</h4>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
          <input
            type="text"
            placeholder="Search people"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm text-white placeholder-gray-400"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
            data-testid="input-search-friends"
          />
        </div>

        {searchQuery.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto mt-3">
            {searchQuery.length >= 3 ? (
              searchLoading ? (
                <div className="text-center py-4 text-sm text-gray-400">Searching...</div>
              ) : searchResults?.users && searchResults.users.length > 0 ? (
                searchResults.users.map((searchUser: any) => {
                  const displayName = searchUser.display_name ||
                                     (searchUser.first_name && searchUser.last_name ? `${searchUser.first_name} ${searchUser.last_name}` : '') ||
                                     searchUser.user_name ||
                                     'Unknown User';
                  return (
                    <div key={searchUser.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <Link
                        href={`/user/${searchUser.id}`}
                        className="flex items-center space-x-3 flex-1 min-w-0 cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center shrink-0" style={{ background: "rgba(168,85,247,0.2)" }}>
                          {searchUser.avatar
                            ? <img src={searchUser.avatar} alt="" className="h-full w-full object-cover" />
                            : <span className="text-xs font-bold text-purple-200">
                                {`${searchUser.first_name?.[0] || searchUser.user_name?.[0] || "?"}${searchUser.last_name?.[0] || ""}`.toUpperCase()}
                              </span>}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white truncate">{displayName}</div>
                          <div className="text-xs text-gray-400 truncate">{searchUser.email}</div>
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
                <div className="text-center py-4 text-sm text-gray-400">
                  No users found. Try a different search.
                </div>
              )
            ) : (
              <div className="text-center py-4 text-sm text-gray-400">
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
        className="w-full flex items-center gap-3 px-4 py-4 text-left"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        data-testid="row-friend-requests"
      >
        <Users size={20} className="text-purple-300 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-white">Friend Requests</p>
          <p className="text-[13px] text-gray-400">Review and approve</p>
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
                <div key={request.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center shrink-0" style={{ background: "rgba(168,85,247,0.2)" }}>
                      {request.users?.avatar
                        ? <img src={request.users.avatar} alt="" className="h-full w-full object-cover" />
                        : <span className="text-xs font-bold text-purple-200">
                            {`${request.users?.first_name?.[0] || request.users?.user_name?.[0] || "?"}${request.users?.last_name?.[0] || ""}`.toUpperCase()}
                          </span>}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {request.users?.first_name && request.users?.last_name
                          ? `${request.users.first_name} ${request.users.last_name}`
                          : request.users?.user_name || 'Unknown User'}
                      </div>
                      <div className="text-xs text-gray-400 truncate">@{request.users?.user_name}</div>
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
                      className="border-white/15 bg-transparent text-gray-300 hover:bg-white/10 px-2.5 py-1.5 text-xs rounded-full"
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
        className="w-full flex items-center gap-3 px-4 py-4 text-left"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        data-testid="button-invite-friends"
      >
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(168,85,247,0.2)" }}>
          <Plus size={17} className="text-purple-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-white">Invite Friends</p>
          <p className="text-[13px] text-gray-400">Invite people you know to join Consumed.</p>
        </div>
        <ChevronRight size={18} className="text-gray-400 shrink-0" />
      </button>
    </div>
    <section className="mt-7">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-bold tracking-[-.02em] text-[#30203f]">Your friends</h3>
          <p className="mt-0.5 text-xs text-[#7d7382]">The people you’re connected with.</p>
        </div>
        {!isLoadingFriends && friendsData?.friends?.length > 0 && (
          <span className="text-xs font-semibold text-[#79618f]">{friendsData.friends.length}</span>
        )}
      </div>

      {isLoadingFriends ? (
        <div className="space-y-2">
          {[1, 2, 3].map((item) => <div key={item} className="h-[62px] animate-pulse rounded-xl bg-[#e6e0e7]" />)}
        </div>
      ) : friendsData?.friends?.length ? (
        <div className="divide-y divide-[#e2dce4] border-y border-[#e2dce4]">
          {friendsData.friends.map((friendship: any) => {
            const friend = friendship.friend;
            if (!friend) return null;
            const first = friend.first_name?.trim();
            const last = friend.last_name?.trim();
            const displayName = first
              ? `${first}${last ? ` ${last[0].toUpperCase()}.` : ""}`
              : friend.display_name || friend.user_name || "Consumed member";
            const avatarInitials = `${first?.[0] || friend.user_name?.[0] || "?"}${last?.[0] || ""}`.toUpperCase();
            return (
              <Link
                key={friendship.id}
                href={`/user/${friend.id}`}
                className="group flex min-h-[66px] items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-[#ece6ee]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#e5dff3] text-xs font-bold text-[#4c3972]">
                  {friend.avatar
                    ? <img src={friend.avatar} alt="" className="h-full w-full object-cover" />
                    : avatarInitials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[#30263a]">{displayName}</span>
                  {friend.user_name && <span className="mt-0.5 block truncate text-xs text-[#817686]">@{friend.user_name}</span>}
                </span>
                <ChevronRight size={17} className="shrink-0 text-[#8b7e91] transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#d6ceda] px-5 py-6 text-sm text-[#746b7b]">
          Your accepted friends will appear here.
        </div>
      )}
    </section>
    </>
  );
}
