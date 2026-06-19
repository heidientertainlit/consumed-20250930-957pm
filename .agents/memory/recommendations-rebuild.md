---
name: rebuild-recommendations cache safety
description: Rules for the AI cross-media recommender (rebuild-recommendations edge fn) and its user_recommendations cache.
---

# rebuild-recommendations / user_recommendations cache

- AI picks (gpt-4o) are resolved against the `media-search` edge function (POST `{query,type}`, auth = SERVICE_ROLE_KEY as both `Authorization: Bearer` and `apikey`). Only matches with BOTH a real poster (`poster_url`||`image`) AND `external_id` are kept — this doubles as the hallucination filter. The prompt over-generates (14-16) to survive filtering.

- **Never overwrite the cache with too-few/zero resolved recs.** `RecommendationsGlimpse` (and the DNA-tab/track carousels) render nothing when the list is empty, so a single flaky `media-search` run would make the carousel vanish for that user.
  **Why:** the old per-type enrichment saved empty `image_url` on failure; the rewrite filters those out, which means a bad run can yield 0 items.
  **How to apply:** there is a min-quality guard (floor = 4) that, when fewer resolve than a pre-existing set, keeps the previous `recommendations` and just shortens `stale_after` (~1h) so it retries soon instead of clobbering.

- Consumers (`user-profile.tsx`, `track.tsx`) add recs using `media_type`, `image_url`, `external_id`, `external_source`, `creator` — all must be populated from the resolved media-search match. `type` is stored normalized lowercase (e.g. `movie`/`tv`/`book`) so `/media/${type}/...` routing and rate payloads work.
