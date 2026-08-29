import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Search, Check, UserPlus, X, Users, Plus, ChevronRight, ChevronDown, User } from "lucide-react";
import { useFriendsManagement } from "@/hooks/use-friends-management";
import { APP_BASE } from "@/lib/share";
import { useToast } from "@/hooks/use-toast";
import type { Person } from "@/pages/people";

interface FriendsManagerProps {
  userId: string;
  matchScores?: Record<string, number>;
  featuredFriend?: Person;
}

export default function FriendsManager({ userId, matchScores = {}, featuredFriend }: FriendsManagerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [showAllFriends, setShowAllFriends] = useState(false);
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
  const sortedFriends = [...(friendsData?.friends || [])].filter((friendship: any) => friendship.friend?.id !== featuredFriend?.id).sort((a: any, b: any) => {
    const scoreDifference = (matchScores[b.friend?.id] ?? -1) - (matchScores[a.friend?.id] ?? -1);
    if (scoreDifference) return scoreDifference;
    const aName = a.friend?.display_name || a.friend?.user_name || "";
    const bName = b.friend?.display_name || b.friend?.user_name || "";
    return aName.localeCompare(bName);
  });
  const visibleFriends = showAllFriends ? sortedFriends : sortedFriends.slice(0, 5);

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
    <div className="mb-6">
      {/* People search */}
      <div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8b7e91]" size={17} />
          <input
            type="text"
            placeholder="Search people and friends"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-[#ded7e1] bg-[#f7f4f6] py-2.5 pl-10 pr-4 text-sm text-[#30203f] placeholder-[#9a909e] focus:outline-none focus:ring-2 focus:ring-[#765394]/35"
            data-testid="input-search-friends"
          />
        </div>

        {searchQuery.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto mt-3">
            {searchQuery.length >= 3 ? (
              searchLoading ? (
                <div className="py-4 text-center text-sm text-[#817686]">Searching...</div>
              ) : searchResults?.users && searchResults.users.length > 0 ? (
                searchResults.users.map((searchUser: any) => {
                  const displayName = searchUser.display_name ||
                                     (searchUser.first_name && searchUser.last_name ? `${searchUser.first_name} ${searchUser.last_name}` : '') ||
                                     searchUser.user_name ||
                                     'Unknown User';
                  const isFriend = searchUser.relationship_status === "accepted";
                  const isIncoming = searchUser.relationship_status === "pending" && searchUser.relationship_direction === "incoming";
                  const isRequested = searchUser.relationship_status === "pending" && searchUser.relationship_direction === "outgoing";
                  return (
                    <div key={searchUser.id} className="flex items-center justify-between rounded-xl border border-[#e5dfe7] bg-white p-3">
                      <Link
                        href={`/user/${searchUser.id}`}
                        className="flex items-center space-x-3 flex-1 min-w-0 cursor-pointer"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e5dff3]">
                          {searchUser.avatar
                            ? <img src={searchUser.avatar} alt="" className="h-full w-full object-cover" />
                            : <span className="text-xs font-bold text-[#4c3972]">
                                {`${searchUser.first_name?.[0] || searchUser.user_name?.[0] || "?"}${searchUser.last_name?.[0] || ""}`.toUpperCase()}
                              </span>}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-[#30263a]">{displayName}</div>
                          <div className="truncate text-xs text-[#817686]">{searchUser.email}</div>
                        </div>
                      </Link>
                       {isFriend ? (
                         <span className="shrink-0 rounded-full bg-[#e4eee9] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[.08em] text-[#456b5c]">Friend</span>
                       ) : isIncoming ? (
                         <button type="button" onClick={() => setRequestsOpen(true)} className="shrink-0 rounded-full bg-[#f3e3ed] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[.08em] text-[#8b3f68]">Wants to connect</button>
                       ) : isRequested ? (
                         <span className="shrink-0 rounded-full bg-[#eee9f3] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[.08em] text-[#6f5d7d]">Requested</span>
                       ) : (
                         <Button
                           onClick={() => sendRequestMutation.mutate(searchUser.id)}
                           disabled={sendRequestMutation.isPending}
                           className="shrink-0 rounded-full bg-[#5b387f] px-3.5 py-1.5 text-xs text-white hover:bg-[#4b2f70]"
                           data-testid={`button-add-friend-${searchUser.id}`}
                         >
                           <UserPlus size={13} className="mr-1" />
                           Add
                         </Button>
                       )}
                    </div>
                  );
                })
              ) : (
                <div className="py-4 text-center text-sm text-[#817686]">
                  No users found. Try a different search.
                </div>
              )
            ) : (
              <div className="py-4 text-center text-sm text-[#817686]">
                Keep typing to search...
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    <div className="overflow-hidden rounded-[20px] border border-[#e4dedb] bg-[#fffdfb] shadow-[0_7px_18px_rgba(65,49,55,.055)]">
      {/* Friend Requests row */}
      <button
        type="button"
        onClick={() => setRequestsOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-4 text-left"
        data-testid="row-friend-requests"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eee8f2] text-[#5b3e78]"><Users size={17} /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-[#30263a]">Friend requests</p>
          <p className="text-[13px] text-[#817686]">Review and approve</p>
        </div>
        {pendingCount > 0 && (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5b387f] text-xs font-bold text-white">
            {pendingCount}
          </span>
        )}
        {requestsOpen
          ? <ChevronDown size={18} className="shrink-0 text-[#8b7e91]" />
          : <ChevronRight size={18} className="shrink-0 text-[#8b7e91]" />}
      </button>

      {requestsOpen && (
        <div className="px-4 pb-4">
          {pendingCount > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {pendingData.requests.map((request: any) => (
                <div key={request.id} className="flex items-center justify-between rounded-xl border border-[#e5dfe7] bg-[#f7f4f6] p-3">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e5dff3]">
                      {request.users?.avatar
                        ? <img src={request.users.avatar} alt="" className="h-full w-full object-cover" />
                        : <span className="text-xs font-bold text-[#4c3972]">
                            {`${request.users?.first_name?.[0] || request.users?.user_name?.[0] || "?"}${request.users?.last_name?.[0] || ""}`.toUpperCase()}
                          </span>}
                    </div>
                    <div className="min-w-0">
                       <div className="flex min-w-0 items-center gap-1.5">
                         <span className="truncate text-sm font-bold text-[#30263a]">
                           {request.users?.first_name && request.users?.last_name
                             ? `${request.users.first_name} ${request.users.last_name}`
                             : request.users?.user_name || 'Unknown User'}
                         </span>
                         <span className="shrink-0 rounded-full bg-[#f3e3ed] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.08em] text-[#8b3f68]">Wants to connect</span>
                      </div>
                      <div className="truncate text-xs text-[#817686]">@{request.users?.user_name}</div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      onClick={() => acceptRequestMutation.mutate(request.user_id)}
                      disabled={acceptRequestMutation.isPending || rejectRequestMutation.isPending}
                      className="rounded-full bg-[#5b387f] px-3 py-1.5 text-xs text-white hover:bg-[#4b2f70]"
                      data-testid={`button-accept-request-${request.id}`}
                    >
                      <Check size={13} className="mr-1" />
                      Accept
                    </Button>
                    <Button
                      onClick={() => rejectRequestMutation.mutate(request.user_id)}
                      disabled={acceptRequestMutation.isPending || rejectRequestMutation.isPending}
                      variant="outline"
                      className="rounded-full border-[#d5cbd9] bg-white px-2.5 py-1.5 text-xs text-[#756985] hover:bg-[#f2edf4]"
                      data-testid={`button-reject-request-${request.id}`}
                    >
                      <X size={13} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-2 text-center text-[13px] text-[#817686]">No pending requests</p>
          )}
        </div>
      )}

      {/* Invite Friends row */}
      <button
        type="button"
        onClick={handleInviteFriends}
        className="w-full flex items-center gap-3 px-4 py-4 text-left"
        style={{ borderTop: "1px solid #e5dfe7" }}
        data-testid="button-invite-friends"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eee8f2]">
          <Plus size={17} className="text-[#5b3e78]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-[#30263a]">Invite friends</p>
          <p className="text-[13px] text-[#817686]">Invite people you know to join Consumed.</p>
        </div>
        <ChevronRight size={18} className="shrink-0 text-[#8b7e91]" />
      </button>
    </div>
    {featuredFriend && <ClosestFriendCard friend={featuredFriend} />}
    {(!featuredFriend || sortedFriends.length > 0) && <section className="mt-7">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
           <h3 className="text-base font-bold tracking-[-.02em] text-[#30203f]">{featuredFriend ? "More friends" : "Your friends"}</h3>
           <p className="mt-0.5 text-xs text-[#7d7382]">{featuredFriend ? "Everyone else in your circle." : "Closest DNA matches first."}</p>
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
          {visibleFriends.map((friendship: any) => {
            const friend = friendship.friend;
            if (!friend) return null;
            const matchScore = matchScores[friend.id];
            const first = friend.first_name?.trim();
            const last = friend.last_name?.trim();
            const displayName = first
              ? `${first}${last ? ` ${last[0].toUpperCase()}.` : ""}`
              : friend.display_name || friend.user_name || "Consumed member";
            const avatarInitials = `${first?.[0] || friend.user_name?.[0] || "?"}${last?.[0] || ""}`.toUpperCase();
            return (
              <div
                key={friendship.id}
                className="group flex min-h-[66px] items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-[#ece6ee]"
              >
                <Link href={`/user/${friend.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#e5dff3] text-xs font-bold text-[#4c3972]">
                    {friend.avatar
                      ? <img src={friend.avatar} alt="" className="h-full w-full object-cover" />
                      : avatarInitials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-bold text-[#30263a]">{displayName}</span>
                      <span className="shrink-0 rounded-full bg-[#e4eee9] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.08em] text-[#456b5c]">Friend</span>
                    </span>
                    {friend.user_name && <span className="mt-0.5 block truncate text-xs text-[#817686]">@{friend.user_name}</span>}
                  </span>
                </Link>
                <Link
                  href={`/dna?tab=compare&friend=${encodeURIComponent(friend.id)}`}
                  className={`shrink-0 rounded-full font-bold transition ${matchScore != null
                    ? "bg-[#e9dff2] px-3 py-1.5 text-xs text-[#5b3777] hover:bg-[#ddcde9]"
                    : "border border-[#cbbdd4] px-3 py-1.5 text-[10px] uppercase tracking-[.08em] text-[#684d7b] hover:bg-[#f2ecf5]"}`}
                >
                  {matchScore != null ? `${matchScore}% match` : "Compare DNA"}
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#d6ceda] px-5 py-6 text-sm text-[#746b7b]">
          Your accepted friends will appear here.
        </div>
      )}
      {!isLoadingFriends && sortedFriends.length > 5 && (
        <button
          type="button"
          onClick={() => setShowAllFriends((current) => !current)}
          className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#5b387f]"
        >
          {showAllFriends ? "Show fewer friends" : `See all ${friendsData?.friends?.length || sortedFriends.length} friends`}
          <ChevronDown size={14} className={`transition-transform ${showAllFriends ? "rotate-180" : ""}`} />
        </button>
      )}
    </section>}
    </>
  );
}

function ClosestFriendCard({ friend }: { friend: Person }) {
  const first = friend.first_name?.trim();
  const last = friend.last_name?.trim();
  const displayName = first
    ? `${first}${last ? ` ${last[0].toUpperCase()}.` : ""}`
    : friend.display_name || friend.user_name || "Consumed member";
  const avatar = friend.profile_image_url || friend.avatar_url || friend.avatar;
  const avatarInitials = `${first?.[0] || friend.user_name?.[0] || "?"}${last?.[0] || ""}`.toUpperCase();
  const shared = (friend.shared_titles || [])
    .map((item) => typeof item === "string" ? { title: item } : { title: item.title || item.name || "", image_url: item.image_url })
    .filter((item) => item.title);
  const posters = shared.filter((item) => item.image_url).slice(0, 3);
  const totalShared = shared.length + (friend.shared_genres?.length || 0) + (friend.shared_creators?.length || 0);

  return <section className="mt-7">
    <div className="mb-3">
      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#65457b]">Closest friend match</p>
      <p className="mt-1 text-xs text-[#7d7382]">The friend whose Entertainment DNA feels most like yours.</p>
    </div>
    <Link
      href={`/user/${encodeURIComponent(friend.id)}`}
      className="group block overflow-hidden rounded-[22px] border border-[#d9cedf] bg-[#fffdfb] p-4 shadow-[0_8px_22px_rgba(65,49,55,.075)] transition hover:-translate-y-0.5 hover:border-[#bea9cc] hover:shadow-[0_12px_28px_rgba(81,49,111,.13)]"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[#e5dff3] text-sm font-bold text-[#4c3972]">
          {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : avatarInitials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-bold text-[#2c2038]">{displayName}</p>
          <span className="mt-1 inline-flex rounded-full bg-[#e4eee9] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.09em] text-[#456b5c]">Friend with the closest taste</span>
        </div>
        <p className="shrink-0 font-serif text-3xl leading-none tracking-[-.06em] text-[#4f2d73]">{Math.round(friend.match_score || 0)}%</p>
      </div>
      {posters.length > 0 && <div className="mt-5">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[.12em] text-[#67447c]">You both love</p>
        <div className="flex gap-2">
          {posters.map((item, index) => <div key={`${item.title}-${index}`} className="aspect-[4/5] w-[64px] shrink-0 overflow-hidden rounded-xl bg-[#ddd6e0] shadow-sm"><img src={item.image_url || ""} alt={item.title} className="h-full w-full object-cover" loading="lazy" /></div>)}
          {totalShared > posters.length && <div className="flex aspect-[4/5] w-[64px] shrink-0 flex-col items-center justify-center rounded-xl bg-[#e7dfee] text-[#583875]"><span className="text-lg font-bold">+{totalShared - posters.length}</span><span className="text-[9px] font-semibold">more</span></div>}
        </div>
      </div>}
      <div className="mt-4 flex items-center justify-between border-t border-[#dcd2df] pt-3 text-xs font-semibold text-[#614276]">
        <span>{totalShared ? `${totalShared} thing${totalShared === 1 ? "" : "s"} in common` : "View your DNA comparison"}</span>
        <span className="inline-flex items-center gap-1">View profile <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" /></span>
      </div>
    </Link>
  </section>;
}
