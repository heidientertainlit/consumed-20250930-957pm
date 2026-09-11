---
name: Blocking read safety
description: Block enforcement needs authoritative hydration and refetch-safe filtering, not just optimistic removal.
---

Treat a successful empty RLS query as inconclusive until the owner-read policy has been verified against authenticated roles.

**Why:** The blocks table had RLS enabled without a SELECT policy. Reads silently returned no rows, so fresh clients appeared to have no blocked users.

**How to apply:** Verify owner isolation with role-based database assertions when altering block-list access. Keep filtering account-scoped and authoritative across reloads. Queries that close over a block list need its signature in their key, or invalidation can reuse a pre-block closure and restore hidden content.