---
name: Genre cache architecture
description: How per-title genre data is stored/resolved app-wide (media_genres cache).
---

# Genre behavioral data — media_genres cache

Genre is cached **per title**, keyed by `(external_source, external_id)`, in the
`media_genres` table — NOT on a media catalog. There is no catalog: `media_items`
is dead (1 row); real media lives denormalized in `media_ratings`, `list_items`,
and `media_engagements`, each carrying its own `external_source` + `external_id`.

**Why:** genre used to be resolved live via source APIs (TMDB/Google Books/iTunes)
on every DNA calc and profile view, then discarded — slow, rate-limited, and the
raw vocabulary was inconsistent (sci-fi vs science fiction, thriller vs thrillers).
Caching once + canonicalizing fixes both and makes genre reusable everywhere.

**Table:** `media_genres(external_source, external_id, media_type, raw_genres[],
canonical_genres[], resolved_at)`, PK `(external_source, external_id)`. RLS on,
public SELECT, writes via service role only. GIN index on `canonical_genres`.

**How it fills:**
- `_shared/genre-taxonomy.ts` — `canonicalGenre` / `canonicalizeMany` normalize raw
  API genres to a clean lowercase vocab (matches user_dna_signals genre values).
- `_shared/genre-cache.ts` — per-source resolvers + `getOrResolveGenres`
  (cache-first, write-back on miss). Supported sources: tmdb, googlebooks, itunes,
  openlibrary (`SUPPORTED_GENRE_SOURCES`). youtube/spotify/rawg/thesportsdb are
  NOT supported → resolve to null, not cached, callers fall back to prior behavior.
- `backfill-genres` edge fn — re-runnable idempotent sweep of all uncached tracked
  titles. Body `{limit}`; call until `remaining: 0`. It runs with service-role and
  triggers external API + DB writes, so it is **admin-only**: deployed with JWT
  verification ON (no `--no-verify-jwt`) and gated in-function on `users.is_admin`
  (401 without a valid JWT, 403 for non-admins). Invoke only with an admin user's
  session token. **Why:** a service-role write endpoint must never be public.
- `extract-dna-signals` now reads genres via the shared cache (warms it too).

**Consumers read the cache:** profile "Tracked Genres" (`user-profile.tsx`) reads
`media_genres` directly (public read) instead of live per-item API calls.

**How to apply:** never re-add live per-title genre lookups; route through
`getOrResolveGenres` or read `media_genres`. Match the full `source::id` key —
`external_id` is NOT globally unique across sources. Canonical genres are lowercase.
openlibrary returns noisy "subjects" (e.g. "new york times bestseller") — a known,
minority noise source.
