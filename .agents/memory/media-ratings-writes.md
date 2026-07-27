---
name: media_ratings write requirements
description: Required columns and upsert rules when writing to media_ratings from the client
---
Rule: any insert/upsert into `media_ratings` MUST include `media_title` and `media_type` (both NOT NULL), plus `user_id`, `media_external_id`, `media_external_source`. Upserts rely on the unique index `media_ratings_user_media_unique (user_id, media_external_id, media_external_source)` — it exists as an index, not a pg constraint, so `pg_constraint` lookups miss it.

**Why:** Onboarding rating writes failed silently for every user (console-only error) because `media_title`/`media_type` were omitted — profiles showed 0 tracked and DNA had no rating signals.

**How to apply:** When adding any new write path for ratings, include all five fields, and surface write errors loudly. To make picks count as "tracked"/DNA levels, also add them to the user's "Finished" list via `add-media-to-list` (with `skip_social_post: true` for bulk adds) — the tracked counter counts `list_items`, not ratings.
