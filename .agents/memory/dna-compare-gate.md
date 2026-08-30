---
name: DNA compare gate
description: Item-count threshold for friend DNA comparison and where it's enforced.
---

**Rule:** Friend DNA comparison unlocks at DNA survey + 10 logged items (lowered from 30, July 2026). Comparisons where either side has <30 items show an amber "Early match" tag.

**Why:** 30 items blocked the key social hook for new users; 10 keeps enough signal (survey carries most of it) while labeling low-confidence scores honestly.

**How to apply:** The gate lives in THREE places that must agree: `client/src/pages/dna.tsx`, `client/src/pages/user-profile.tsx` (own-profile DNA/Friends tabs), and the `compare-dna-friend` edge function (deployed). Known pre-existing quirk: frontend counts items from user stats (movies+tv+books+games) while the edge fn counts all `list_items` — totals can differ for music/podcast-heavy users; unify only with user approval.

**Also:** The old `/identity` page was deleted (route + `pages/identity.tsx`); `/profile` (`user-profile.tsx`) is the live DNA profile page with My DNA / Friends / My Media pills.

**Privacy rule:** Pairwise DNA comparisons are not public Now-feed content. Keep comparison tools and direct results available to the participating user, but do not offer “Post to feed” or surface shared comparison cards in the public feed.

**Why:** A comparison exposes names, photos, affinity, genres, and shared titles for two people even though only one person initiates sharing.

**How to apply:** Treat Compare DNA as a friend-scoped feature; use image/text sharing only when the initiating user explicitly chooses it, and do not reintroduce public comparison posts without consent from both people.

**Invite empty state:** When the viewer has no completed friend comparison, use the private Now-feed card to invite a real friend onto Consumed. Match the Tribe-card visual language, show the viewer versus an unknown friend without a fake score, and open the platform invite/share flow directly.

**Why:** The empty state should grow the user’s real friend network and lead toward an authentic pairwise comparison rather than presenting placeholder affinity or passive navigation.
