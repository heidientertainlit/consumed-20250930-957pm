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

## Real scores for Heidi (as of June 2026)
- Snazzyman: 85%
- Jeeppler: 79% (duplicate rows exist — keep highest)
- kjwoodsemh: 75%
- Hillary Hess: 57%
- Trey: 47%
- KChandler, ericandsarahansen, MegBassett, MoDjanie: no cached row → Jaccard fallback
