---
name: Avatar upload consistency
description: Concurrency and cleanup rules for optional public profile-photo uploads.
---

Profile-photo uploads must go through an authenticated server boundary. Upload each processed image to a new object, conditionally change the canonical avatar reference only if it still matches the value read at the start, and delete the exact previous object before reporting success.

**Why:** A client that overwrites a stable object before persisting the database reference can destroy the effective prior avatar when persistence fails. Client-selected alternating slots also race across stale sessions or devices.

**How to apply:** Keep `users.avatar` authoritative. Validate the actual processed image server-side, use unique user-scoped objects, guard the reference update with the previous value, clean up losing uploads, and never sweep a user folder in a way that could delete a newer concurrent upload.