---
name: iOS keyboard viewport sizing
description: How portaled sheets and dialogs should react to the Capacitor keyboard without hiding content or applying the keyboard offset twice.
---

With Capacitor `KeyboardResize.Native`, let the native webview resize provide the keyboard geometry. Keep portaled sheets and dialogs on stable sizing instead of continuously rewriting their top, bottom, height, or max-height from visual-viewport measurements. Keyboard events may maintain a simple open/closed root state for non-geometric UI such as bottom-nav visibility. Do not smooth-scroll focused inputs globally during the keyboard animation.

**Why:** In installed iOS builds, native resize and JavaScript visual-viewport updates animate on different timelines. Updating sheet geometry on every viewport event makes the same surface respond to both systems, producing visible bouncing even when web preview looks stable.

**How to apply:** Do not add shared visible-height, keyboard-offset, or sheet-top CSS variables while native resize is enabled. Keep keyboard listeners state-only. If a specific input is obscured, diagnose that component locally rather than adding global viewport-driven repositioning.