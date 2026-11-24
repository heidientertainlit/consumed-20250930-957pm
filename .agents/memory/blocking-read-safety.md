---
name: Blocking read safety
description: Block enforcement needs authoritative hydration and refetch-safe filtering, not just optimistic removal.
---

Treat a successful empty RLS query as inconclusive until the owner-read policy has been verified against authenticated roles.

**Why:** The blocks table had RLS enabled without a SELECT policy. Reads silently returned no rows, so fresh clients appeared to have no blocked users.

**How to apply:** Verify owner isolation with role-based database assertions when altering block-list access. Keep filtering account-scoped and authoritative across reloads. Queries that close over a block list need its signature in their key, or invalidation can reuse a pre-block closure and restore hidden content.

Preserve block filtering before feed pagination, and do not promote descendants of a blocked comment into visible roots.

**Why:** Moving author filtering after pagination changes otherwise valid pages; tree builders that normally promote orphan replies can expose a hidden conversation when a blocked parent is removed.

**How to apply:** Test both block directions independently, nonblocked pagination behavior, and multi-level comment descendants. Keep existing orphan behavior for unrelated missing parents. Endpoint-level enforcement is not proof that direct-table RLS blocks the same operations.

For the list privacy release, check direct production read permissions as well as
the friend-list handlers. An unconditional permissive read policy can override
narrower policies, even when every stored list currently has public visibility.

**Why:** The read-only preflight confirmed anonymous access to user-owned
unfiled saved items, which the friend-list handlers exclude. Checking only
lists with a private flag returned zero and would have missed this exposure.

**How to apply:** Compare effective grants and policies with aggregate-only
anonymous requests. Cover private, public, and unfiled rows; test both the Edge
handlers and direct reads. Do not fetch or copy individual user records to
confirm a visibility mismatch.