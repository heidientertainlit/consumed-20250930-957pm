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
