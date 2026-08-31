---
name: DNA compare gate
description: Eligibility, evidence-readiness, privacy, and score rules for friend DNA comparison.
---

**Rule:** Access to Friend DNA comparison unlocks at DNA survey + 10 logged items. A detailed result has a separate readiness gate: both people need 10 unique positive items and at least one canonically verified title they both positively liked.

**Why:** Production-pair analysis showed 10 positive items gives a strong chance of real overlap while avoiding percentages and explanations built only from broad affinity. Access can remain welcoming without presenting unsupported detail.

**How to apply:** Keep access eligibility and detailed readiness distinct. Positive evidence is Favorites or ratings ≥3.5; a lower rating or DNF vetoes that work. Intersect only canonical identity or exact provider identity—never title text alone. If developing, hide score, evidence, AI copy, and share controls and show the developing message.

**Picker rule:** Before selection, show each friend in one unified list with a single “COMPARE” or “NEEDS MORE DNA TO COMPARE” pill beside their name using the same server readiness rule. Sort comparable friends first while preserving order within each group. Building rows are informative, not clickable; never make users discover readiness through a result error.

**Evidence presentation:** Compare is a tall, edge-to-edge white bottom sheet with the feed still visible above it, not a full-screen takeover or dark sheet. Brand results with the Consumed logo and “Comparing your Entertainment DNA.” Give evidence generous spacing and render verified shared titles as plain clickable text without pills or arrows. Do not show “Creators in common”; normalized creator signals can look ambiguous or incorrectly cased without work-level context.

**Why:** Readiness after selection wastes a tap, while unexplained creator names make sound comparison evidence feel unreliable.

**Score rule:** When detailed comparison is ready, retain the same authoritative pairwise affinity score used by People/feed alignment. Readiness filters whether detail may be shown; it never changes the affinity algorithm or score.

**Cache rule:** Store versioned Compare readiness and strict shared-title evidence separately from the legacy People shared-title cache contract. Directional “you/them” evidence must be oriented for the requester when a deterministic pair cache is reused.

**Also:** The old `/identity` page was deleted (route + `pages/identity.tsx`); `/profile` (`user-profile.tsx`) is the live DNA profile page with My DNA / Friends / My Media pills.

**Privacy rule:** Pairwise DNA comparisons are not public Now-feed content. Keep comparison tools and direct results available to the participating user, but do not offer “Post to feed” or surface shared comparison cards in the public feed.

**Why:** A comparison exposes names, photos, affinity, genres, and shared titles for two people even though only one person initiates sharing.

**How to apply:** Treat Compare DNA as a friend-scoped feature; use image/text sharing only when the initiating user explicitly chooses it, and do not reintroduce public comparison posts without consent from both people.

**Invite empty state:** When the viewer has no completed friend comparison, use the private Now-feed card to invite a real friend onto Consumed. Match the Tribe-card visual language, show the viewer versus an unknown friend without a fake score, and open the platform invite/share flow directly.

**Why:** The empty state should grow the user’s real friend network and lead toward an authentic pairwise comparison rather than presenting placeholder affinity or passive navigation.
