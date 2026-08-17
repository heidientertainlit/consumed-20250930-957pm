---
name: Goodreads/Letterboxd import
description: How the import-media edge fn behaves — dedupe, enrichment, safety rails
---
- Entry point: QuickTrackSheet (Track dialog) has an "import" step; the full-screen Add Media page does NOT have it yet (Heidi wants it added there after the dialog version proves out).
- Dedupe is by lowercase title+media_type vs the user's existing list_items, fail-closed (import aborts if the existing-items fetch errors). In-file dupes keep the rated copy (Letterboxd ZIP has the same movie in watched.csv unrated and ratings.csv rated).
- Enrichment (TMDB movies / Google Books books) runs only on rows about to insert, under a 60s time budget + 8s per-fetch timeouts; when budget runs out, remaining rows import WITHOUT posters — the import must never time out because of enrichment.
- Matches are validated (normalized title equality, year ±1 for movies; title prefix-containment for books) — first-result-blind matching attaches wrong posters.
- Unmatched rows keep external_source='tmdb_verified' (legacy marker that stops auto-fix rechecks); matched rows get real external_id/source.
- Letterboxd ratings are 0.5–5 half-stars → round to 1–5.
- Known residual risks (accepted): read-then-insert dedupe can race across concurrent imports (no DB unique constraint); parseCSVLine doesn't handle quoted fields spanning newlines.
- **Why:** Heidi is extremely protective of backend data — imports must be insert-only, never update/delete existing rows.
- Netflix import deliberately not surfaced in UI (Younify planned; Netflix exports are noisy viewing history).
