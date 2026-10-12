---
name: Rated feed card structure
description: Approved hierarchy for rated and reviewed posts in the main feed.
---

Keep the poster, title, stars, match score, short review, and reviewer identity together as the primary media moment. A rating and its review text may arrive as separate rating-only and thought records; pair same-user/same-media companions created close together so stars stay with the visible review, and suppress the redundant rating-only slide. Additional ratings and comments belong together beneath that primary media moment, in one white discussion section with avatars, short names, optional stars, text, and thumbs-up/thumbs-down voting rather than hearts.

**Why:** The user approved separating the primary review from discussion, then provided examples and explicitly asked for additional ratings and comments in the same place. They subsequently requested thumbs up or thumbs down instead of a heart. Rendering companion records independently made review cards appear to lose their stars.

**How to apply:** Preserve both thumbs, Reply (including its bubble icon on the primary card footer), Rate, Share, post reporting, comment reporting, and threaded replies when changing rated feed cards. Standalone rated/list-activity cards must use the same grouped thumbs-up/thumbs-down treatment as the main card path rather than the legacy heart footer. Never collapse those capabilities into decorative or nonfunctional controls. Reply previews must be readable in guest mode without exposing private profile fields. Once the comment request succeeds, the actual flattened comment tree is authoritative over denormalized counts: show a real reply preview when present, and hide stale reply counts when no comment row exists.

If the viewer has rated the title, show the rating together with their comment in the shared discussion section, labeled “You,” and pin that combined row first. Use a standalone rating row only when there is no suitable top-level comment by the viewer.

**Why:** The user first requested their rating at the top, then clarified, “if I've rated it, it shows along with my comment,” after seeing separate rating-only and comment rows.

**How to apply:** Attach the actual saved rating, including half-stars, to the viewer's comment without changing its identity, reactions, moderation actions, or replies. Preserve distinct comments and separate review text; deduplicate only identical text. Never repeat the stars in a second rating-only row.

In discussion rows, place the thumbs side by side beneath the comment in light gray. Reply is an icon-only curved left arrow. Put the owner's Delete control in the upper-right corner.

**Why:** The user explicitly requested this arrangement and supplied a curved-arrow reference.

**How to apply:** Keep real counts, selected vote state, toggling, and both directions functional. Preserve reporting for other people's comments and accessible labels for icon-only Reply/Delete/Report controls. Do not restyle the primary review's separate action footer.

Replies to both actual comments and additional review rows must stay inline beneath the selected row, never navigate to a post page or open another dialog.

**Why:** The user found replying to their own comment worked inline while replying to a friend's additional review opened a separate view.

**How to apply:** Save a response to an additional review in that review's own post thread, then show it nested beneath the review. Preserve that owning-post context for deeper replies, voting, and deletion. Do not attach a friend's review replies to the primary card's unrelated post.

The featured “What People Are Saying” heading belongs inside its carousel's white card, matching the font of Trending now but slightly smaller. Omit the “Real ratings and reviews from your feed” subtitle.

**Why:** After trying serif styles, the user explicitly requested the same font as Trending now.

**How to apply:** Match Trending now's sans-serif heading family, weight, leading, spacing, and color, preserving the smaller size. Keep this heading specific to the featured Now review carousel.

For all Now rating and review cards, put avatar and shortened reviewer name first, then commentary at its original size, then the smaller app sans-serif title and season. Commentary may be clamped. Shorten multi-surname display names using the first surname's initial, even for the owner or accepted friends.

**Why:** The user approved this hierarchy, then asked for additional rating cards to match it. Only the first carousel needs “What People Are Saying” to orient people entering the app.

**How to apply:** Share the presentation across all Now rating and review cards, independently of whether the introductory heading is shown. Preserve stars, match pills, related ratings, all reaction controls, and owner delete.

Use the app's body sans-serif font, matching the review text, for media titles on these rating/review cards. Do not use Fraunces, Georgia, or another serif.

**Why:** The user clarified, “I want Crew Girl to be our SAN serif font.” Earlier references to “serif” meant sans-serif; replacing Fraunces with another serif did not achieve the requested look.

**How to apply:** Match the review text's Plus Jakarta Sans family and its system sans-serif fallbacks. Keep this scoped to the shared Now rating/review title styling. Preserve its size, weight, placement, and the separate discovery heading; do not change fonts elsewhere.

Use a subtle overlapping-card edge plus a simple upper-right “>” to suggest more reviews, without dots, “Next” labels, thumbnails, or a previous/next navigation strip. Keep the heading slightly smaller than Trending now.

**Why:** The user rejected the added next-review strip and preview, then specifically requested an upper-right “>” and a heading slightly smaller than Trending now.

**How to apply:** Preserve swipe navigation and show the overlap only when the carousel contains multiple posts. The corner chevron advances to another review and must not overlap reporting. Do not introduce another labeled navigation strip.