export type DnaFeedBlockRow = {
  blocker_id?: unknown;
  blocked_id?: unknown;
};

export type DnaFeedRelationshipRow = Record<string, unknown>;

export type DnaFeedRelationships = {
  targetBlocked: boolean;
  friendIds: string[];
  friendDnas: DnaFeedRelationshipRow[];
  friendUsers: DnaFeedRelationshipRow[];
  cmp1: DnaFeedRelationshipRow[];
  cmp2: DnaFeedRelationshipRow[];
};

function stringId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Convert the two possible user_blocks directions into a viewer-relative set.
 * The caller must treat a failed database lookup as an authorization failure;
 * this helper only handles rows returned by a successful lookup.
 */
export function blockedPeerIdsForViewer(
  viewerId: string,
  rows: readonly DnaFeedBlockRow[],
): Set<string> {
  const blockedPeerIds = new Set<string>();

  for (const row of rows) {
    const blockerId = stringId(row.blocker_id);
    const blockedId = stringId(row.blocked_id);

    if (blockerId === viewerId && blockedId) {
      blockedPeerIds.add(blockedId);
    } else if (blockedId === viewerId && blockerId) {
      blockedPeerIds.add(blockerId);
    }
  }

  return blockedPeerIds;
}

/**
 * Keep the response internally consistent after service-role reads.
 *
 * get-dna-feed-data reads another member's accepted-friend relationships with
 * service_role.  A viewer's block must therefore be applied to the target
 * itself and to every additional friend/comparison row before any of those
 * rows are returned.
 */
export function filterDnaFeedRelationships(input: {
  viewerId: string;
  targetUserId: string;
  friendIds: readonly string[];
  blockedPeerIds: ReadonlySet<string>;
  friendDnas: readonly DnaFeedRelationshipRow[];
  friendUsers: readonly DnaFeedRelationshipRow[];
  cmp1: readonly DnaFeedRelationshipRow[];
  cmp2: readonly DnaFeedRelationshipRow[];
}): DnaFeedRelationships {
  const targetBlocked =
    input.targetUserId !== input.viewerId
    && input.blockedPeerIds.has(input.targetUserId);

  const friendIds = [...new Set(input.friendIds)]
    .filter((id) => id !== input.targetUserId && !input.blockedPeerIds.has(id));
  const allowedFriendIds = new Set(friendIds);

  const friendDnas = input.friendDnas.filter((row) =>
    allowedFriendIds.has(stringId(row.user_id) ?? ""),
  );
  const friendUsers = input.friendUsers.filter((row) =>
    allowedFriendIds.has(stringId(row.id) ?? ""),
  );
  const cmp1 = input.cmp1.filter((row) =>
    row.user_id_1 === input.targetUserId
    && allowedFriendIds.has(stringId(row.user_id_2) ?? ""),
  );
  const cmp2 = input.cmp2.filter((row) =>
    row.user_id_2 === input.targetUserId
    && allowedFriendIds.has(stringId(row.user_id_1) ?? ""),
  );

  return { targetBlocked, friendIds, friendDnas, friendUsers, cmp1, cmp2 };
}