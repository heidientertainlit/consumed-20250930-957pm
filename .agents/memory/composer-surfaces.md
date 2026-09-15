---
name: Composer surfaces (add-media)
description: The composer components for adding/tracking media, plus the search-first Track flow and its single-track rule.
---

There are three surfaces for adding/tracking media on the Now-page DNA hero.

The “Add media” and “Share a take” actions belong inside the purple identity-hero area beneath the DNA card, not in a separate light section. Use a white primary action and translucent white secondary action for contrast.

- **QuickTrackSheet** (`quick-track-sheet.tsx`) — the hero "Track it" button. **Floating top card + dimmed backdrop** (`createPortal`, NOT a bottom Sheet — user found the bottom sheet claustrophobic), **search-first**, fully **self-contained** (no handoff). Modeled on a user-provided 4-step mockup. Step 1: media search with icon media-type filter pills (toggle to deselect). Step 2 (inline compose): contextual status chips "What are you doing?" (Watching/Reading/Listening/Playing + Finished + Want to…, adapts to media type) mapped to `currently`/`finished`/`queue`; then a **"React to this title (optional)"** all-at-once composer: a single block with a 4-icon mode switcher (Take/Rate/Predict/Poll) where the selected icon shows its body below (Rate=stars+optional review textarea, Take=textarea, Predict/Poll=question+options). State (rating/takeText/pred*/poll*) persists across mode switches so multiple reactions can be filled and all saved; an icon "filled" dot reflects per-mode content. Top-right **Save** runs a multi-action handler. Posting: always one `track-media` (rating+review inline when rated, else `skip_social_post:true`); text-only take → extra `thought` social_post; prediction/poll → `create-prediction` (`type:"predict"|"poll"`, same payload as quick-action-sheet). **Save intent for prediction/poll is derived from entered content, NOT the row's expanded state** — a filled-then-collapsed row must still save (was a real bug).
- **QuickActionSheet** (`quick-action-sheet.tsx`) — shared bottom Sheet composer. Its "Add media" opens an **in-dialog** search modal (`isMediaModalOpen`). Has an additive `preselectedListType` prop (default-off); other callers unaffected. (No longer used by the Track flow — compose is inline in QuickTrackSheet now.)
- **FeedComposerBar** (`feed-composer-bar.tsx`) — hero "Share a take". Text-first; its "Add media" is a **full-screen** `/add`-style overlay.

**Why differentiated:** "Track it" = "I consumed this, log it" (media is the point → search-first, rating/take optional). "Share a take" = "I have something to say" (text is the point). Opening the same composer for both felt wrong to the user.

**Single-track rule (critical):** `track-media` `list_items` are keyed per `(user, list_id, external_id, external_source)`. A second call into a *different* list adds the item to BOTH lists (duplicate). So the Track flow must do exactly ONE track call per path: just-add tracks once; the rating/take path does NOT track in QuickTrackSheet — the composer is the sole tracker and must receive the same list via `preselectedListType`.

**track-media gotcha:** `privateMode` is destructured but UNUSED; only `skip_social_post:true` actually suppresses the add-to-list feed card. Normal tracking (no skip) creates an add-to-list social post — that's intended app behavior, so "just add" posting a feed card is consistent, not a bug.

**How to apply:** reuse QuickTrackSheet for search-first add; reuse QuickActionSheet for in-dialog search/compose; never re-track the same media into a different list in the same flow. QuickActionSheet is shared (replit.md: don't change without explicit user permission — additive optional props are the safe pattern).

**Scope preservation:** A selected season, episode, or volume belongs to the conversation, not the title's canonical identity. Keep its visible label separate from the raw media title.

**Why:** A single save can track media and publish a separate text-only take. Preserving scope on tracking alone left the actual feed post with no season despite a successful save; display-only tests did not catch it.

**How to apply:** Trace every emitted post, not just the tracking request or the main text composer. Verify stored scope for the actual affected post before attributing a missing label to deployment or rendering. Never backfill a season from the post's prose.

**Shared search (July 2026):** media-search-panel.tsx is THE single media search UI (input + type pills + results + spell-fix rescue + race guard). quick-track-sheet's search step and feed-composer-bar's inline "Add media" both render it. Still separate: feed-composer-bar's full-screen dark browse layer (/add poster grid) and quick-action-sheet/new-room searches.
