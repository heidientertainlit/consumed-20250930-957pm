---
name: /add page composer & nav layering
description: Why the bottom nav must render INSIDE the composer portal on /add, and the app's portal z-index contract.
---

The `/add` page renders `FeedComposerBar` in `pageMode`, which mounts its content via `createPortal` to `document.body` inside a `fixed inset-0 z-[99999]` div. Inside that portal the browse/search layer is at inline `zIndex:1` and the series bulk-add sheet at `zIndex:20`.

The app bottom nav (`navigation.tsx`) normally renders via its own `createPortal` to body at `z-[9999]`.

**Rule:** To make the bottom nav visible on `/add` you CANNOT just render `<Navigation/>` on the page — a separate body-level portal can only sit wholly above or below the composer's `z-99999` stacking context, never interleaved between its `z:1` browse layer and `z:20` sheets. The nav must be rendered as a child INSIDE the composer portal. `Navigation` has an `inline` prop that skips its own `createPortal` and uses `z-[10]` so it sits above the browse layer but below the in-portal sheets.

**Why:** stacking contexts — children of the `z-99999` portal are ordered relative to each other; an external `z-9999` body portal is ordered relative to the `z-99999` root as a whole.

**Drawer/Sheet elevation over the composer:** `QuickAddListSheet` (and its follow-ups `JustTrackedSheet`, `ProgressUpdateSheet`) use Vaul `Drawer`/Radix `Sheet` at default `z-50`, below the composer's `z-99999` — so launched from `/add` they render behind the composer, invisible/unclickable. Fix pattern: shared `DrawerContent`/`SheetContent` now accept an additive `overlayClassName`; an `elevated` boolean is threaded from `FeedComposerBar` (`elevated={pageMode}`) through the sheets, applying `z-[100000]` to BOTH content and overlay only when elevated. **Do NOT globally bump the shared `z-50` default** — toasts are `z-[100]` and would hide behind every drawer app-wide; keep elevation opt-in via `elevated`.
