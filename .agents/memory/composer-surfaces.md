---
name: Composer surfaces (add-media)
description: The two parallel composer components and which one keeps media search in-dialog vs full-screen.
---

There are two near-identical composer components for adding/tracking media. Pick based on whether you want media search to stay inside the dialog.

- **QuickActionSheet** (`quick-action-sheet.tsx`) — bottom Sheet. Its "Add media" opens an **in-dialog** search modal (a nested `Dialog`, `isMediaModalOpen`), selecting a result attaches media and closes the modal. No navigation. Open it standalone for the track/add flow with `preselectedIntent="capture"`.
- **FeedComposerBar** (`feed-composer-bar.tsx`) — its "Add media" shows a **full-screen** search overlay that looks like the `/add` page (same hero). Used by the hero "Share a take".

**Why:** the Now-page DNA hero "Track it" button was switched from navigating to `/add` to opening QuickActionSheet (capture intent) precisely so media search happens inside the dialog instead of a page jump.
**How to apply:** for "search media without leaving the dialog," reuse QuickActionSheet; don't rebuild search. QuickActionSheet is a shared component (replit.md warns: don't change it without explicit user permission).
