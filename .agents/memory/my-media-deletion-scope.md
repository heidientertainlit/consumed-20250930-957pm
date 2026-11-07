---
name: My Media deletion scope
description: User-confirmed meaning of deleting a title from My Media.
---

Deleting a title from My Media must remove it from all of the person's library lists, including the All view, as well as their rating and published reviews about that title. Do not delete anyone else's records or the shared title.

**Why:** The user explicitly corrected an earlier tracking-only interpretation and chose to delete ratings and reviews too.

**How to apply:** Treat this as an owner-scoped, confirmed, all-or-nothing deletion across that title's library memberships and own associated activity. Do not assume removing one visible list row is enough.

The user confirmed the signed-in Delete from My Media flow worked in Preview.

**Why:** This is direct user confirmation of the end-to-end behavior, which isolated database tests and a signed-out screenshot could not establish.

**How to apply:** Preserve the confirmed UI-to-deletion behavior alongside the owner and scope protections when changing My Media.
