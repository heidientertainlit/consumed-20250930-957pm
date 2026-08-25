---
name: iOS keyboard viewport sizing
description: How portaled sheets and dialogs should react to the Capacitor keyboard without hiding content or applying the keyboard offset twice.
---

Size native portaled sheets and dialogs from the shared visible-viewport CSS metrics rather than fixed `vh` values or component-local keyboard listeners. Keep search/content regions as `min-height: 0` flex children with their own vertical overflow and bottom clearance.

**Why:** On iOS, `keyboardDidHide` can arrive before the visual viewport has finished expanding, and Capacitor's native resize mode may already shrink the layout viewport. Treating the reported keyboard height as an unconditional bottom offset either leaves sheets stale after closing or moves them twice when the webview has already resized.

**How to apply:** Reuse the root visible-height, bottom-offset, and sheet-top variables maintained by the keyboard adjustment hook. Preserve the pre-keyboard viewport baseline through the close animation and refresh metrics on both Capacitor events and visual-viewport resize events.