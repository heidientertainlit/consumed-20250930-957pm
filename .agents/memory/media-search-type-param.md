---
name: media-search type param contract
description: The media-search edge function reads `type`, not `media_type` — callers sending `media_type` get no server-side filtering.
---

# media-search filter param contract

The `media-search` edge function parses the filter param as **`body.type`** (and `?type=` query string). It does **not** read `media_type`.

- When `type` is provided it narrows which sources are searched (`if (!type || type === 'movie' ...)`), and also has query-keyword type auto-detection when `type` is absent.
- Callers that send **`media_type`** (e.g. the Track sheet `quick-track-sheet.tsx` and `quick-action-sheet.tsx`) have their server-side filter **silently ignored** — the server searches all sources and returns a mixed bag, and only the client's own `filteredResults` (`r.type === filter`) narrows afterward. Because the server returns a limited set not targeted to the chosen type, this produces empty/odd results (e.g. "No results" with a filter on even when matching media exist).
- The correct param name is `type` (see `feed-composer-bar.tsx`, which sends `type:` and works).

**Also:** the function returns these `type` values only: `movie`, `tv`, `book`, `book_series`, `podcast`, `music`, `youtube`. There is **no `game`** source — any "Game" media-type filter pill will always yield zero client-side results.

**Why:** explains the "media search doesn't work quite right" symptom in the Track sheet.
**How to apply:** if asked to fix Track/quick-action search filtering, rename the client param `media_type` → `type` (verify before changing — user must approve). Don't add a Game filter pill expecting results unless a game source is added server-side.
