---
name: Live motion preferences
description: Persistent animations must respond to accessibility preference changes after mounting.
---

Do not assume the installed animation library's reduced-motion hook subscribes
React components to changes. It snapshots the preference when a component mounts.

**Why:** In the persistent post-add overlay, changing the OS preference disabled
CSS animation while JavaScript transforms and the pending native haptic still
ran. A page reload or newly mounted test component would hide this gap.

**How to apply:** Observe the media query live for long-lived animated UI, cancel
pending impact feedback when reduced motion becomes active, and test preference
changes after mounting as well as initial reduced-motion startup.
