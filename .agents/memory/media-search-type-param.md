---
name: media-search type param contract
description: The media-search edge function reads `type`, not `media_type` — callers sending `media_type` get no server-side filtering.
---

# media-search filter param contract

The `media-search` edge function parses the filter param as **`body.type`** (and `?type=` query string). It does **not** read `media_type`.

- When `type` is provided it narrows which sources are searched (`if (!type || type === 'movie' ...)`), and also has query-keyword type auto-detection when `type` is absent.
- The correct param name is `type` (see `feed-composer-bar.tsx`). Historically the Track sheet and quick-action sheet sent `media_type` (ignored by server) — now fixed to send `type`. If a filter ever silently no-ops again, check the client is sending `type`, not `media_type`.
- **Typo-correction fallback:** when a search returns zero results, the function asks OpenAI (gpt-4o) for the corrected spelling of the original query and re-calls itself once (guarded by a `_corrected` flag) — returning only real catalog results. It only fires on a miss, so successful searches are untouched. Covers all media types. Response includes `corrected_from`/`corrected_to` when it fired.

**Also:** the function returns these `type` values only: `movie`, `tv`, `book`, `book_series`, `podcast`, `music`, `youtube`. There is **no `game`** source — any "Game" media-type filter pill will always yield zero client-side results.

**Why:** explains the "media search doesn't work quite right" symptom in the Track sheet.
**How to apply:** don't add a Game filter pill expecting results unless a game source is added server-side. Note "gibberish" queries can still return junk from noisy sources (so typo-correction won't fire) — pre-existing, not yet addressed.

## Testing edge functions via curl
`SUPABASE_ANON_KEY` is a **legacy JWT that the project rejects** (`401 UNAUTHORIZED_LEGACY_JWT`). Use **`VITE_SUPABASE_ANON_KEY`** as the Bearer token when cur/testing edge functions for this project — it returns 200.
