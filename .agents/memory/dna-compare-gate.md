---
name: DNA compare gate
description: Item-count threshold for friend DNA comparison and where it's enforced.
---

**Rule:** Friend DNA comparison unlocks at DNA survey + 10 logged items (lowered from 30, July 2026). Comparisons where either side has <30 items show an amber "Early match" tag.

**Why:** 30 items blocked the key social hook for new users; 10 keeps enough signal (survey carries most of it) while labeling low-confidence scores honestly.

**How to apply:** The gate lives in THREE places that must agree: `client/src/pages/dna.tsx`, `client/src/pages/user-profile.tsx` (own-profile DNA/Friends tabs), and the `compare-dna-friend` edge function (deployed). Known pre-existing quirk: frontend counts items from user stats (movies+tv+books+games) while the edge fn counts all `list_items` — totals can differ for music/podcast-heavy users; unify only with user approval.

**Also:** The old `/identity` page was deleted (route + `pages/identity.tsx`); `/profile` (`user-profile.tsx`) is the live DNA profile page with My DNA / Friends / My Media pills.
