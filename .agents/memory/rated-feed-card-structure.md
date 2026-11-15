---
name: Rated feed card structure
description: Approved hierarchy for rated and reviewed posts in the main feed.
---

Keep the poster, title, stars, match score, short review, and reviewer identity together as the primary media moment. A rating and its review text may arrive as separate rating-only and thought records; pair same-user/same-media companions created close together so stars stay with the visible review, and suppress the redundant rating-only slide. Additional ratings and comments belong together beneath that primary media moment, in one white discussion section with avatars, short names, optional stars, text, and thumbs-up/thumbs-down voting rather than hearts.

Additional title ratings/reviews start collapsed behind an avatar/initials summary with an extra-person count and the average of those additional ratings. Clicking toggles their individual rows inline. Genuine comments on the primary post remain visible separately.

**Why:** The user supplied a compact summary reference and clarified that a friend's review text is their overall commentary on the title, not a comment addressed to the primary reviewer.

**How to apply:** Keep title reviews distinct from actual post comments and preserve each review's own reply thread. Never imply that the summary is a global/community rating or include unrated commentary in its average. Reset the dropdown when the post/viewer scope changes.

Consumed-source IDs must include absorbed rating companions, not only visible
review IDs, across every lower-feed fallback and consolidated-rating path.

**Why:** Merged companion stars resurfaced below the shared cards as old
“rated / Available On / See more lists” posts. Styling only the top stream left
those duplicate source records visible.

**How to apply:** Keep the same modern rating/review renderer for standalone and
deck paths; test companion suppression against the actual lower-feed filter.
Explicit reviews and positive ratings take precedence over words such as
“finished” or “completed” inside user-written commentary.

**Why:** The user approved separating the primary review from discussion, then provided examples and explicitly asked for additional ratings and comments in the same place. They subsequently requested thumbs up or thumbs down instead of a heart. Rendering companion records independently made review cards appear to lose their stars.

**How to apply:** Preserve both thumbs, Reply (including its bubble icon on the primary card footer), Rate, Share, post reporting, comment reporting, and threaded replies when changing rated feed cards. Standalone rated/list-activity cards must use the same grouped thumbs-up/thumbs-down treatment as the main card path rather than the legacy heart footer. Never collapse those capabilities into decorative or nonfunctional controls. Reply previews must be readable in guest mode without exposing private profile fields. Once the comment request succeeds, the actual flattened comment tree is authoritative over denormalized counts: show a real reply preview when present, and hide stale reply counts when no comment row exists.

If the viewer has rated the title, show the rating together with their comment in the shared discussion section, labeled “You,” and pin that combined row first. Use a standalone rating row only when there is no suitable top-level comment by the viewer.

Do not repeat the primary post author as an additional saved-rating/review row beneath their own post, including the “You” fallback. Preserve genuine comments and replies by that author.

**Why:** The user explicitly objected to seeing themselves twice, once as the post and again as a comment.

**How to apply:** Distinguish synthesized related-rating rows from actual comment records. Do not delete or hide genuine replies to remove a duplicated review display.

**Why:** The user first requested their rating at the top, then clarified, “if I've rated it, it shows along with my comment,” after seeing separate rating-only and comment rows.

**How to apply:** Attach the actual saved rating, including half-stars, to the viewer's comment without changing its identity, reactions, moderation actions, or replies. Preserve distinct comments and separate review text; deduplicate only identical text. Never repeat the stars in a second rating-only row.

In discussion rows, place the thumbs side by side beneath the comment in light gray, followed by written Reply. Put a three-dot options menu in the upper-right corner: Delete for the owner, Flag for other people's comments.

**Why:** The user replaced the earlier arrow-only Reply reference with written Reply and requested three dots instead of the exposed trash icon.

**How to apply:** Keep real counts, selected vote state, toggling, and both directions functional. Preserve reporting and deletion permissions, confirmation, and accessible menu labels. Opening options must not perform moderation. Do not restyle the primary review's separate action footer.

Replies to both actual comments and additional review rows must stay inline beneath the selected row, never navigate to a post page or open another dialog.

**Why:** The user found replying to their own comment worked inline while replying to a friend's additional review opened a separate view.

**How to apply:** Save a response to an additional review in that review's own post thread, then show it nested beneath the review. Preserve that owning-post context for deeper replies, voting, and deletion. Do not attach a friend's review replies to the primary card's unrelated post.

The featured “What People Are Saying” heading belongs inside its carousel's white card, matching the font of Trending now but slightly smaller. Omit the “Real ratings and reviews from your feed” subtitle.

**Why:** After trying serif styles, the user explicitly requested the same font as Trending now.

**How to apply:** Match Trending now's sans-serif heading family, weight, leading, spacing, and color, preserving the smaller size. Keep this heading specific to the featured Now review carousel.

For all Now rating and review cards, put avatar and shortened reviewer name first, then the bold app sans-serif media title and compact season, then stars and commentary at its original size. Commentary may be clamped. Shorten multi-surname display names using the first surname's initial, even for the owner or accepted friends.

**Why:** The user supplied a later reference placing the media title below reviewer/alignment and above the stars and quote, replacing the previous title-below-commentary arrangement.

Clamped primary reviews must let people tap the text or “Read more” to see the
entire review inline, without navigating away. Keep spoiler reveal explicit.

**Why:** The user pointed out that reviews longer than the available space must
still be readable in full.

**How to apply:** Keep short reviews compact; support keyboard expansion and do
not carry an expanded state over to another review.

Show TV scope as a small muted inline code beside the title, such as “(S4-E2),” rather than the full season, episode, and episode name on a separate line.

**Why:** The user requested the compact notation next to the title and said it should be “less aggressive.”

**How to apply:** Use “(S4)” for a season-only selection. Keep the canonical media title unchanged and preserve non-TV scope such as book volumes.

**Why:** The user approved this hierarchy, then asked for additional rating cards to match it. Only the first carousel needs “What People Are Saying” to orient people entering the app.

**How to apply:** Share the presentation across all Now rating and review cards, independently of whether the introductory heading is shown. Preserve stars, match pills, related ratings, all reaction controls, and owner delete.

Use the app's body sans-serif font, matching the review text, for media titles on these rating/review cards. Do not use Fraunces, Georgia, or another serif.

**Why:** The user clarified, “I want Crew Girl to be our SAN serif font.” Earlier references to “serif” meant sans-serif; replacing Fraunces with another serif did not achieve the requested look.

**How to apply:** Match the review text's Plus Jakarta Sans family and its system sans-serif fallbacks. Keep this scoped to the shared Now rating/review title styling. Preserve its size, weight, placement, and the separate discovery heading; do not change fonts elsewhere.

Use a subtle overlapping-card edge plus a simple upper-right “>” to suggest more reviews, without dots, “Next” labels, thumbnails, or a previous/next navigation strip. Keep the heading slightly smaller than Trending now.

**Why:** The user rejected the added next-review strip and preview, then specifically requested an upper-right “>” and a heading slightly smaller than Trending now.

**How to apply:** Preserve swipe navigation and show the overlap only when the carousel contains multiple posts. The corner chevron advances to another review and must not overlap reporting. Do not introduce another labeled navigation strip.

For rating-card Reply fields and DNA Clash comment fields, use a slim, lightly outlined pill with a small unfilled send arrow inside it.

**Why:** The user explicitly changed their mind about the earlier DNA Clash-style field and supplied a new reference with a subtle pill border and no filled send button, then requested DNA Clash match the rating/review fields.

**How to apply:** Avoid the filled rectangular composer and separate circular send button. Preserve each surface's visibility rules, existing mention support, and working submission. Do not change posted comments or other DNA Clash content.

Keep the primary rating-card actions immediately after the review and before the discussion. Group outline thumbs up/down, reply bubble, and rating star on the left, without written Reply/Rate labels. Use exactly one horizontal divider between the post actions and comments, and none below the comments. Keep counts close to the right of each thumb and preserve each comment's own actions beneath that comment.

**Why:** The user approved “Review → compact actions → comments → comment field” so the primary controls do not appear to belong to the last comment, then requested just one divider above the comments.

**How to apply:** Put moderation in bare three dots above the poster, slightly inset to the right of the poster's left edge. Keep the original share arrow separate beside the carousel chevron, never inside the moderation menu or a circle. The user explicitly rejected circular controls and the connected-dots share icon, and provided an icon-only action-row reference. Opening Report must only open the reporting form; preserve owner/persona deletion permissions and confirmation.

Comment-level controls differ from the main review actions: use thumbs up/down and a written “Reply” button, with numeric counts only when positive.

**Why:** The user supplied a separate reference specifically for reply-comment controls and asked to show numbers only “if there are any.”

**How to apply:** Use this presentation for both comments and nested replies. Keep the primary review's reply bubble icon-only, and preserve real voting, reply targets, moderation, and guest restrictions.