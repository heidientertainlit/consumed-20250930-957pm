---
name: Room Explore genre discovery
description: Why genre rooms must use TMDB discover, not media-search, and how room content is tagged.
---
The room "Explore" tab needs genre-based discovery, not title search.

**Rule:** For genre rooms, do discovery via TMDB `/discover/{movie,tv}` driven by an
explicit per-`series_tag` `ROOM_CONFIG` (TMDB genre ids + a `without` exclusion list),
NOT a fuzzy TMDB keyword lookup. A room's `examples` titles are also passed as `seeds`,
resolved on TMDB, and their `/recommendations` power a "More Like Your Favorites" rail
(seed rail must respect the room's `without` exclusions and is movie/tv only). Keyword is
kept only for rooms a keyword genuinely models (e.g. `true-crime`). Never use
`media-search` for any of this — it is a TITLE matcher and returns junk for a room name.

**Why:** A fuzzy keyword on the room tag pulled wrong content — the "heartwarming"
keyword is heavily tagged on kids/animation (Bluey, Kronk), so the cozy/Hallmark room
filled with cartoons. Explicit genres + exclusions + seed recommendations fixed it.
media-search matches titles; passing "True Crime" as `q` yields unrelated shows.

**Play tab uses the same philosophy:** room Play matches `prediction_pools` to genre
rooms via an explicit per-`series_tag` config over `media_genres.canonical_genres`
(anyOf/allOf/none — e.g. heartwarming = romance/family life/friendship MINUS all dark
genres; rom-com = romance AND comedy). Tag match (partner_tag = series_tag, or
show_tag/media_tags = room name/examples) is the primary layer; genre match is the
second layer. Never add a random category fallback — empty state instead.

**Caveat:** genre discovery can't fully isolate a niche vibe like "Hallmark" — TMDB's
Romance/Drama genres are broad and its recommendation graph occasionally leaks off-tone
titles (e.g. erotic romance tagged only Drama/Romance). The seed rail carries the
specificity; broad rails always have some noise.

**How to apply:** The `room-explore` edge function is the canonical source (sections:
Trending This Week / New Releases / Fan Favorites). Rooms live in the `pools` table;
a genre room is `room_category='genre'` with `series_tag` set (e.g. True Crime =
`series_tag='true-crime'`, `media_type=null`). Items come back `external_source='tmdb'`
for both movie and tv; detail route is `/media/{type}/{source}/{external_id}`.
Edge fns rely on the user session access_token (verify_jwt on) — the legacy anon key is
rejected at the gateway, so curl-with-anon-key is NOT a valid verifier; test in-app.

## Multi-media-type sections
room-explore returns vibe sections (Trending/New Releases/Fan Favorites, mixed
movie+tv) plus browse-by-type sections: Movies, TV Shows, Podcasts, Books — each
gated by the room's `media_type` (null = show all).
- Books: Google Books `subject:"<term>"` → external_source `googlebooks`.
- Podcasts: free iTunes Search API (no key) → external_source `itunes`.
- get-media-details must have a matching source branch or cards 404. `itunes` was
  added (iTunes lookup); `googlebooks` already existed.
- FlixPatrol was considered for real streaming "trending" charts but the account's
  subscription lapsed (key returns "API key not valid"), so TV/movie stays on TMDB.

## Edge fn boilerplate
Deploy bundling intermittently fails fetching `deno.land/std .../http/server.ts`
(10s timeout, server-side). Prefer the native global `Deno.serve` — no external
import, no bundling fetch. esm.sh imports (e.g. supabase-js) are reliable.
