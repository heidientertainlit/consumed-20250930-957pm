---
name: Composer surfaces (add-media)
description: The composer components for adding/tracking media, plus the search-first Track flow and its single-track rule.
---

There are three surfaces for adding/tracking media on the Now-page DNA hero.

- **QuickTrackSheet** (`quick-track-sheet.tsx`) — the hero "Track it" button. Bottom Sheet, **search-first**: leads with a prominent media search (its own `media-search` call), then pick a result → select a list. Two paths: "Add to [List]" = single quiet `track-media` call (the just-add); "Add a rating or a take" = hands off to QuickActionSheet (no track here).
- **QuickActionSheet** (`quick-action-sheet.tsx`) — shared bottom Sheet composer. Its "Add media" opens an **in-dialog** search modal (`isMediaModalOpen`). Accepts `preselectedMedia` and `preselectedListType` (additive, default-off) so the Track handoff lands rating/take into the chosen list.
- **FeedComposerBar** (`feed-composer-bar.tsx`) — hero "Share a take". Text-first; its "Add media" is a **full-screen** `/add`-style overlay.

**Why differentiated:** "Track it" = "I consumed this, log it" (media is the point → search-first, rating/take optional). "Share a take" = "I have something to say" (text is the point). Opening the same composer for both felt wrong to the user.

**Single-track rule (critical):** `track-media` `list_items` are keyed per `(user, list_id, external_id, external_source)`. A second call into a *different* list adds the item to BOTH lists (duplicate). So the Track flow must do exactly ONE track call per path: just-add tracks once; the rating/take path does NOT track in QuickTrackSheet — the composer is the sole tracker and must receive the same list via `preselectedListType`.

**track-media gotcha:** `privateMode` is destructured but UNUSED; only `skip_social_post:true` actually suppresses the add-to-list feed card. Normal tracking (no skip) creates an add-to-list social post — that's intended app behavior, so "just add" posting a feed card is consistent, not a bug.

**How to apply:** reuse QuickTrackSheet for search-first add; reuse QuickActionSheet for in-dialog search/compose; never re-track the same media into a different list in the same flow. QuickActionSheet is shared (replit.md: don't change without explicit user permission — additive optional props are the safe pattern).
