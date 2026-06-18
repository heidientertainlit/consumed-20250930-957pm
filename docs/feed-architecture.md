# Consumed — Social Feed Architecture & UI Rules

> Moved out of `replit.md` to keep it lean. Covers the feed data pipeline, protected ordering rules, the shared QuickActionSheet, and the in-progress cosmetic redesign plan.

---

## Social Feed Architecture

- Feed fetch limit: `limit = 200;`.
- Infinite scroll via `IntersectionObserver`.
- UGC post rendering pipeline: Filters `socialPosts` into `ugcSlots`, deduplicates/groups, and assigns to `slotAssignments` for interleaved rendering.
- `predict`, `prediction`, `poll`, and `cast_approved` types are EXEMPT from deduplication to prevent silent erasure.
- `rate-review` type: `social-feed` returns `type: 'rate-review'` for review posts.
- **Feed mix**: `feedPlaySlots` (game_moments + predictions) is interleaved with up to 4 `promoted_rating` items and 2 `binge_battle_promo` cards.

---

## ⚠️ Feed promoted-card-first order — DO NOT change without explicit user permission

The first item in `mixedFeedSlots` (in `client/src/pages/feed.tsx`, the `useMemo` at ~line 3443) is intentionally the first promoted rating card (persona/high-signal post). This puts Jordan's / persona posts at the very top of the feed right after the Daily Hero section. The pattern: prepend `wrapPromoted(0)` before `feedPlaySlots.forEach`. Never remove or reorder this without asking the user first.

---

## ⚠️ QuickActionSheet is shared — changes affect BOTH the global nav "+" button AND the room "Write something..." button

The `useEffect` at the top of `quick-action-sheet.tsx` controls which flow opens based on props (`roomId`, `preselectedMedia`). Room discussion MUST open `intent: "capture"` / `action: "track"` (Add Media flow). NEVER change this to `intent: "say"` / `action: "post"` for room mode — that breaks the room discussion and shows the wrong composer. Any edit to this file must be tested in both contexts.

---

## Feed UI Redesign Plan (COSMETIC ONLY — no functional changes)

All changes are styling/layout only. No voting logic, point systems, interaction handlers, or data pipelines may change.

**Next steps (in order):**
1. **Individual post cards** (reviews, ratings, thoughts) — tighten to compact card shell with type pill in top-right, subtle bottom bar with likes/comments.
2. **Trivia/poll cards** — same card shell, keep all answer options + voting logic untouched, only tighten wrapper styling.
