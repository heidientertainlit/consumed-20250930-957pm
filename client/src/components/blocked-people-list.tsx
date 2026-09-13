import { useState } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UnblockUserSheet } from "@/components/unblock-user-sheet";
import { useBlockedUserProfiles } from "@/hooks/use-blocked-users";
import type { BlockedUserDisplayIdentity } from "@/lib/block-user";

interface BlockedPeopleListProps {
  userId: string;
}

/**
 * Renders the viewer's account-authoritative blocked users and owns the
 * confirmation flow for removing a block.
 */
export function BlockedPeopleList({ userId }: BlockedPeopleListProps) {
  const [unblockTarget, setUnblockTarget] = useState<{ id: string; name?: string } | null>(null);
  const {
    data: blockedUserProfiles,
    blockedUsers,
    blockedUserIds,
    error: blockedProfilesError,
  } = useBlockedUserProfiles(userId);

  if (!blockedUsers.isSuccess || !blockedUserIds.length) return null;

  const profilesById = new Map<string, BlockedUserDisplayIdentity>(
    (blockedUserProfiles || []).map((profile): [string, BlockedUserDisplayIdentity] => [profile.id, profile]),
  );

  return (
    <>
      <BlockedPeopleSection
        blockedUserIds={blockedUserIds}
        profilesById={profilesById}
        error={blockedProfilesError}
        onUnblock={(target) => setUnblockTarget(target)}
      />
      {unblockTarget && (
        <UnblockUserSheet
          isOpen
          onClose={() => setUnblockTarget(null)}
          targetUserId={unblockTarget.id}
          targetUserName={unblockTarget.name}
        />
      )}
    </>
  );
}

function BlockedPeopleSection({
  blockedUserIds,
  profilesById,
  error,
  onUnblock,
}: {
  blockedUserIds: string[];
  profilesById: Map<string, BlockedUserDisplayIdentity>;
  error: Error | null;
  onUnblock: (target: { id: string; name?: string }) => void;
}) {
  return (
    <div className="mt-5 border-t border-[#e2dce4] pt-4" data-testid="section-blocked-people">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h4 className="text-[10px] font-medium uppercase tracking-[.18em] text-[#817786]">Blocked</h4>
          <p className="mt-0.5 text-xs text-[#7d7382]">These people stay out of your friends and matches.</p>
        </div>
        <span className="text-xs font-semibold text-[#9b4a4a]">{blockedUserIds.length}</span>
      </div>
      {error && (
        <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" data-testid="text-blocked-identities-error">
          {error.message || "Blocked people’s display names could not be loaded."}
        </p>
      )}
      <div className="divide-y divide-[#eadfe2] border-y border-[#eadfe2]">
        {blockedUserIds.map((blockedUserId) => (
          <BlockedPersonRow
            key={blockedUserId}
            userId={blockedUserId}
            profile={profilesById.get(blockedUserId)}
            onUnblock={onUnblock}
          />
        ))}
      </div>
    </div>
  );
}

function BlockedPersonRow({
  userId,
  profile,
  onUnblock,
}: {
  userId: string;
  profile?: BlockedUserDisplayIdentity;
  onUnblock: (target: { id: string; name?: string }) => void;
}) {
  const first = profile?.first_name?.trim();
  const last = profile?.last_name?.trim();
  const displayName = profile?.display_name?.trim()
    || (first ? `${first}${last ? ` ${last}` : ""}` : "")
    || profile?.user_name
    || "Blocked member";

  return (
    <div className="flex min-h-[66px] items-center gap-3 rounded-xl px-2 py-2.5" data-testid={`row-blocked-user-${userId}`}>
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#d84949]"
        aria-label="Blocked"
        data-testid="icon-blocked-minus"
      >
        <span className="h-0.5 w-4 rounded-full bg-white" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-bold text-[#30263a]">{displayName}</span>
          <span className="shrink-0 rounded-full bg-[#fbe6e6] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.08em] text-[#a63838]" data-testid="badge-blocked">Blocked</span>
        </span>
        {profile?.user_name && <span className="mt-0.5 block truncate text-xs text-[#817686]">@{profile.user_name}</span>}
      </span>
      <Button
        type="button"
        variant="outline"
        onClick={() => onUnblock({ id: userId, name: profile?.user_name || displayName })}
        className="shrink-0 rounded-full border-[#cbbdd4] px-3 py-1.5 text-xs font-semibold text-[#5b387f] hover:bg-[#f2ecf5]"
        aria-label={`Unblock ${displayName}`}
        data-testid={`button-unblock-user-${userId}`}
      >
        <Undo2 size={14} className="mr-1" />
        Unblock
      </Button>
    </div>
  );
}