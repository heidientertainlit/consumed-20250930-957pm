---
name: Composer surfaces (add-media)
description: The composer components for adding/tracking media, plus the search-first Track flow and its single-track rule.
---

Add Media, rating, and Share a Take should use the same shared dialog.

The “Add media” and “Share a take” actions belong inside the purple identity-hero area beneath the DNA card, not in a separate light section. Use a white primary action and translucent white secondary action for contrast.

- **Shared rating dialog** — preserve the floating top card and dimmed backdrop, not a bottom sheet (the user found that claustrophobic). Keep rating, reaction, and spoiler controls together and above the list choices.
- **QuickActionSheet** (`quick-action-sheet.tsx`) — shared bottom Sheet composer. Its "Add media" opens an **in-dialog** search modal (`isMediaModalOpen`). Has an additive `preselectedListType` prop (default-off); other callers unaffected. (No longer used by the Track flow — compose is inline in QuickTrackSheet now.)
- **Add browsing** — remains a full-page browsing/search surface; selecting a rating action enters the shared dialog.

**Why shared:** The user later explicitly said “share a take was supposed to look exactly like the overall rating box” and requested the rating box higher. This supersedes the earlier preference for a separate text-first Share a Take composer.

**Single-track rule (critical):** A save must track the title once to the selected list. Do not chain a quick-add write with another tracking write from the shared rating dialog or add the title to an unrequested second list.

**Why:** Multiple tracking calls previously created duplicate list memberships.

**How to apply:** reuse QuickTrackSheet for search-first add; reuse QuickActionSheet for in-dialog search/compose; never re-track the same media into a different list in the same flow. QuickActionSheet is shared (replit.md: don't change without explicit user permission — additive optional props are the safe pattern).

**Scope preservation:** A selected season, episode, or volume belongs to the conversation, not the title's canonical identity. Keep its visible label separate from the raw media title.

**Why:** A single save can track media and publish a separate text-only take. Preserving scope on tracking alone left the actual feed post with no season despite a successful save; display-only tests did not catch it.

**How to apply:** Trace every emitted post, not just the tracking request or the main text composer. Verify stored scope for the actual affected post before attributing a missing label to deployment or rendering. Never backfill a season from the post's prose.

**Shared search (July 2026):** media-search-panel.tsx is THE single media search UI (input + type pills + results + spell-fix rescue + race guard). quick-track-sheet's search step and feed-composer-bar's inline "Add media" both render it. Still separate: feed-composer-bar's full-screen dark browse layer (/add poster grid) and quick-action-sheet/new-room searches.

## One Add Media/rating flow

The user wants Now → Add Media, Share a Take, the orange rating button in global search, and the orange rating button in navigation → Add page search to open the exact same dialog and use one save path, not separately maintained look-alikes.

**Why:** The user explicitly clarified “not two separate paths but one path” before authorizing this change.

**How to apply:** Search entry points should supply the selected title to the shared Add Media flow rather than introduce their own composer or save handler. Put rating/reaction above “Add to a list.” Keep room composers and the purple quick-add button separate unless the user asks to change those too.

## Add page poster intent

On navigation → Add, a tap on a poster in browsing or search results belongs to the media detail page, not the shared rating dialog. The adjacent purple and orange actions remain separate.

**Why:** The user explicitly asked to restore poster navigation without accidentally turning the poster itself into a rating trigger.

**How to apply:** Keep poster hit areas independent of both action buttons, and only navigate when the media has a usable type, source, and ID. Include browse and result posters in interaction checks.
