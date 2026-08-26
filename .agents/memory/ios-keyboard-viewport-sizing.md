---
name: iOS keyboard viewport sizing
description: How portaled sheets and dialogs should react to the Capacitor keyboard without hiding content or applying the keyboard offset twice.
---

Size native portaled sheets and dialogs from the shared visible-viewport CSS metrics rather than fixed `vh` values or component-local keyboard listeners. Keep search/content regions as `min-height: 0` flex children with their own vertical overflow and bottom clearance. Keep the bottom nav mounted during keyboard transitions; hide it non-destructively from the shared root keyboard state. Do not smooth-scroll the focused input on every intermediate visual-viewport event.

**Why:** On iOS, `keyboardDidHide` can arrive before the visual viewport has finished expanding, and Capacitor's native resize mode may already shrink the layout viewport. Treating the reported keyboard height as an unconditional bottom offset either leaves sheets stale after closing or moves them twice when the webview has already resized. Unmounting the nav or repeatedly calling smooth `scrollIntoView` during that animation makes drawers and dialogs visibly bounce in installed builds even when web dev looks stable.

**How to apply:** Reuse the root visible-height, bottom-offset, sheet-top, and keyboard-open state maintained by the keyboard adjustment hook. Preserve the pre-keyboard viewport baseline through the close animation and refresh metrics on both Capacitor events and visual-viewport resize events. Let focus handling scroll once; metric refreshes should only update metrics.