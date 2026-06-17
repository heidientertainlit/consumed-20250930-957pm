---
name: DNA Compare card scoring
description: How alignment % is computed in dna-compare-feed-card.tsx — authoritative source and fallback rules.
---

## Rule
`dna_comparisons.match_score` is the AUTHORITATIVE source for the alignment % shown in the DNA Compare feed card (both the featured friend circle and the "Others Aligned" list).

Jaccard genre overlap (`calcOverlapPct`) is a FALLBACK ONLY — used when a friend has no row in `dna_comparisons`. It produces flat/fake-looking scores (e.g. everyone at 50%) because many friends share the same top genres.

**Why:** Real scores from the `compare-dna-friend` edge function encode viewing history, ratings, trivia, and DNA signal weights — far more accurate than simple genre intersection. Jaccard was used as a placeholder during early development and caused repeated regressions where all friends showed identical percentages.

**How to apply:**
- In `fetchPersonalized()` (dna-compare-feed-card.tsx): fetch ALL `dna_comparisons` rows for the current user in one query using `or=(user_id_1.eq.{uid},user_id_2.eq.{uid})`.
- Build a `cmpMap: Map<friendId, match_score>`.
- When scoring each friend: `realPct = cmpMap.has(friendId) ? cmpMap.get(friendId) : jaccard`.
- Sort: friends with real scores first (desc), then Jaccard fallbacks (desc).
- The featured friend (highest score) and all "Others Aligned" use this same priority order.
- Do NOT make a separate per-friend `dna_comparisons` lookup after sorting — fetch all at once upfront.

## TWO components in dna-compare-feed-card.tsx — fix the right one
The file exports TWO near-identical-looking DNA compare cards. The feed renders the SECOND one for actual posts:
- `DnaCompareFeedCard` (default export) — generic standalone card, rendered with NO props as a single slot. Computes its own featured + Others Aligned from the current user's data.
- `DnaComparePostCard` (named export) — renders a `dna_compare` UGC post (`standaloneUGCPosts.filter(type==='dna_compare')`). This is what shows in the feed when a user posted a comparison. Featured circle = poster vs the post's friend (from post content JSON `cmp.match_score`); "Others Aligned" = the POSTER's other friends.

**Lesson:** A user-reported "nothing changed" can mean you fixed the wrong twin. Confirm which component is actually rendered (grep feed.tsx for the import + JSX usage) before editing.

**Others Aligned in DnaComparePostCard:** fetch the POSTER's real scores via `get-dna-feed-data` edge function with `body: { target_user_id: posterId }` (the function falls back to the auth user when no target given). The expanded list MUST render `u.pct` next to the name — that render line was missing the percentage entirely (only showed name+avatar), which was the actual "no percentages" bug.

## Data quirks to expect
- `dna_comparisons` can contain duplicate rows for the same friend pair — always keep the highest `match_score`.
- Friends with no cached `dna_comparisons` row fall back to the Jaccard genre overlap (flat-looking scores).
