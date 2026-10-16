---
name: Media-detail recommendation scope
description: User-approved cross-media recommendation boundaries and verification requirements.
---

Cross-media recommendations are intentional and important to Consumed. Do not prioritize recommendations simply because they share the source title's media type, and do not change the generator's mix or ranking as part of resolution or presentation work.

**Why:** The user explicitly corrected a proposed same-type-first approach before approving implementation.

**How to apply:** Type restrictions belong to resolving each generated recommendation: a suggested book resolves as a book, an album as music, a movie as a movie. Year/creator restrictions must come from the recommended item, never the unrelated source title. Preserve generator order among successful matches; lookup speed must not become ranking.

Keep conversation behavior, Play, ratings, tracking, shared search ranking, canonical identity rules, database/schema, and recommendation-generation logic outside recommendation-row repair scope.

**Why:** These were explicit boundaries of the user's approval.

**How to apply:** Changes needed in those systems require a separate discussion rather than being bundled into a poster-row repair.

Real-component browser fixtures need the production stylesheet for layout, scrolling, visibility, and pending-slot assertions.

**Why:** A JavaScript-only fixture with CSS imports stubbed out rendered empty loading blocks with zero height, falsely reporting production skeletons as hidden.

**How to apply:** Compile the actual Tailwind stylesheet in the isolated fixture before making visual or scrolling assertions. Controlled transport proves frontend behavior, not live personalized recommendation quality or server completion.

Do not pursue TasteDive for Consumed recommendations.

**Why:** The user tested TasteDive, found its recommendations poor, and explicitly said not to go in that direction.

**How to apply:** Exclude TasteDive from provider proposals and implementation; do not treat earlier suggestions to evaluate it as approval.
