---
name: Room Explore genre discovery
description: Why genre rooms must use TMDB discover, not media-search, and how room content is tagged.
---
The room "Explore" tab needs genre-based discovery, not title search.

**Rule:** For genre rooms, do discovery via TMDB `/discover/{movie,tv}` (resolve a TMDB
keyword id from the room's `series_tag`; fall back to a genre-name→TMDB-genre-id map).
Never use `media-search` for this — `media-search` is a TITLE matcher and returns junk
when handed a genre/room name as the query.

**Why:** media-search matches titles; passing "True Crime" as `q` yields unrelated shows.

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
