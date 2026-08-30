---
name: Goodreads/Letterboxd import
description: How the import-media edge fn behaves — dedupe, enrichment, safety rails
---
- Entry point: QuickTrackSheet (Track dialog) has an "import" step; the full-screen Add Media page does NOT have it yet (Heidi wants it added there after the dialog version proves out).
- Dedupe is by lowercase title+media_type vs the user's existing list_items, fail-closed (import aborts if the existing-items fetch errors). In-file dupes keep the rated copy (Letterboxd ZIP has the same movie in watched.csv unrated and ratings.csv rated).
- Enrichment (TMDB movies / Google Books books) runs in the BACKGROUND via EdgeRuntime.waitUntil AFTER inserts + response (Heidi's explicit preference): rows save instantly without posters, then updates patch ONLY the just-inserted row ids (.eq id + user_id). 300s budget, 8s per-fetch timeouts, 600-item cap.
- Matches are validated (normalized title equality, year ±1 for movies; title prefix-containment for books) — first-result-blind matching attaches wrong posters.
- Unmatched rows keep external_source='tmdb_verified' (legacy marker that stops auto-fix rechecks); matched rows get real external_id/source.
- Letterboxd ratings are 0.5–5 half-stars → round to 1–5.
- Goodreads "My Rating" values belong in `media_ratings`, never `list_items`; preserve existing in-app ratings by normalized title and use ISBN/Open Library IDs or stable Goodreads IDs for new rows.
- **Why:** An older import path parsed 308 Goodreads ratings but discarded them into a nonexistent list column; list membership and user-entered rating evidence must be persisted independently.
- Known residual risks (accepted): read-then-insert dedupe can race across concurrent imports (no DB unique constraint); parseCSVLine doesn't handle quoted fields spanning newlines.
- **Why:** Heidi is extremely protective of backend data — imports must be insert-only, never update/delete existing rows.
- Netflix import deliberately not surfaced in UI (Younify planned; Netflix exports are noisy viewing history).
- Imported `list_items` contribute to recalculated `user_points.all_time` using media weights (book 15, movie 8, TV 10, music 1, podcast 3, game 5, YouTube 2); imported rating stars add no separate points. The import itself does not write a per-row ledger entry.
- `items_tracked` is derived by fetching items through lists owned by the user, so list membership must be valid; rows with a null/dangling `list_id` are omitted even when their own `user_id` is populated.
- **How to apply:** Reconcile imported rows against the media-weight component of the calculated total, not against a ledger insert. Future import auditing still needs a server-owned batch ledger and separate origin provenance; keep import origin distinct from normalized catalog-provider identity.
