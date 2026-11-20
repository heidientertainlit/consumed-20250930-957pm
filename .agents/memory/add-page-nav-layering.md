---
name: /add page composer & nav layering
description: Why the bottom nav must render INSIDE the composer portal on /add, and the app's portal z-index contract.
---

The `/add` page renders `FeedComposerBar` in `pageMode`, which mounts its content via `createPortal` to `document.body` inside a `fixed inset-0 z-[99999]` div. Inside that portal the browse/search layer is at inline `zIndex:1` and the series bulk-add sheet at `zIndex:20`.

The app bottom nav (`navigation.tsx`) normally renders via its own `createPortal` to body at `z-[9999]`.

**Rule:** To make the bottom nav visible on `/add` you CANNOT just render `<Navigation/>` on the page — a separate body-level portal can only sit wholly above or below the composer's `z-99999` stacking context, never interleaved between its `z:1` browse layer and `z:20` sheets. The nav must be rendered as a child INSIDE the composer portal. `Navigation` has an `inline` prop that skips its own `createPortal` and uses `z-[10]` so it sits above the browse layer but below the in-portal sheets.

**Why:** stacking contexts — children of the `z-99999` portal are ordered relative to each other; an external `z-9999` body portal is ordered relative to the `z-99999` root as a whole.

**Drawer/Sheet elevation over the composer:** `QuickAddListSheet` (and its follow-ups `JustTrackedSheet`, `ProgressUpdateSheet`) use Vaul `Drawer`/Radix `Sheet` at default `z-50`, below the composer's `z-99999` — so launched from `/add` they render behind the composer, invisible/unclickable. Fix pattern: shared `DrawerContent`/`SheetContent` now accept an additive `overlayClassName`; an `elevated` boolean is threaded from `FeedComposerBar` (`elevated={pageMode}`) through the sheets, applying `z-[100000]` to BOTH content and overlay only when elevated. **Do NOT globally bump the shared `z-50` default** — toasts are `z-[100]` and would hide behind every drawer app-wide; keep elevation opt-in via `elevated`.

**Rule:** The Add Media page should use the same shared app bar as the other destinations, not its own back-arrow/title header.

**Why:** The user explicitly requested the same app bar as all the other pages.

**How to apply:** Preserve the shared top and bottom navigation within the composer portal, keep scrolling content beneath the app bar, and leave non-page composer headers unchanged.

**Rule:** The Add Media filter label should read “Search by media type” in regular-weight, sentence-case gray text with normal letter spacing.

**Why:** The user replaced the earlier uppercase direction with a screenshot reference, saying “the all caps is too much.”

**How to apply:** Use the understated sentence-case helper style rather than the identity-stat uppercase labels. Preserve its placement between the search bar and filter pills. Keep the Add Media headline large while fitting on one line.

**Rule:** The Now page's Add Media button opens the existing Add page and returns
to Now after a successful save, preserving the feed's position and loaded state.
Opening Add from the bottom navigation must stay on Add after saving; having
visited Now earlier does not count. Failed primary saves stay in the add flow.
Back or cancel from the Now-origin flow returns to Now.

**Why:** The user explicitly required return behavior to depend on how Add was
opened this time, and required all existing functions and buttons to remain.

**How to apply:** Keep return intent scoped to the individual navigation entry,
not a sticky session preference. Preserve the feed rather than rebuilding it
when returning. Optional post-save ratings, reactions and progress must remain
available above Now after the successful primary save, and closing them must
not navigate back a second time. Retain normal direct-Add behavior and the
existing shared app bar; contextual Back is an additional control, not its replacement.
