# Consumer “More like this”: on-demand coverage

## Local changes versus activation

**Backend status (2026-10-16): activated with explicit owner approval.** The
isolated cache migration is recorded in hosted migration history and only
`media-similarity` was deployed. Hosted RLS/grant checks passed; the function is
active with self-authentication, the downloaded entrypoint matches local source,
and missing/forged sessions receive HTTP 401. All 185 pre-existing function
versions remained unchanged. A real signed-in cold preparation/cache-hit cycle
and live recommendation relevance have not yet been verified.

The source changes extend the existing consumer Media Detail section. They do
not alter shared search, canonical identities, personal recommendation caches,
the paused admin lab, or its permissions. No Git network operation, Supabase
deployment, migration application, or paid preparation is part of local testing.

**The hosted app does not gain expanded coverage from frontend changes alone.**
The separately approved backend activation followed this scope:

1. Apply only `20261016060000_consumer_media_similarity.sql`, after checking the
   existing project's migration-history drift. Do not push unrelated migrations.
2. Install the `media-similarity` Edge Function with its self-authentication
   configuration (`verify_jwt = false` in the committed config). It independently
   validates the live session and human account. Do not deploy other functions.
3. Verify hosted storage grants, a real cold title, the second visitor's cache
   hit, and actual recommendation relevance before claiming live verification.
4. The owner controls the frontend Git/release process.

If the backend is unavailable, the frontend retains the 11 reviewed saved
baselines and falls back to the established consumer path for other titles.
It does not expose lab records or require admin permissions.

## Behavior

- Every supported media-detail type checks this path: movie, TV, book, music,
  podcast and YouTube. No new game category or unsupported game destinations.
- Exact identity includes media type, provider, ID and engine version. Open
  Library aliases normalize to one key; identical TMDB movie/TV IDs stay separate.
- First cold visit claims a shared lease and starts bounded background work
  through Edge Runtime `waitUntil`. The HTTP request does not wait for models.
- Existing consumer recommendations remain the fallback while preparation runs.
  If none exist, only the recommendation section uses placeholders.
- Subsequent people reuse title-level cached results. No personal DNA or user
  history is included in shared work profiles or cards.
- The frontend checks pending preparation every two seconds for at most 90
  seconds. Cache requests have a four-second deadline. The rest of the page is
  independent.
- On pointer, keyboard or scrolling interaction, the displayed result set is
  pinned for that visit. New improved results become available on another visit
  rather than replacing a card under someone's finger.
- Results become refreshable after seven days. Refresh is visit-triggered, never
  a catalog-wide advance job. Old cards remain visible. Catalog discovery uses
  current provider popularity within relevant searches; there is no separate
  trending-monitor integration or instant response to a title going viral.
- Failed/depleted runs preserve existing results and wait six hours before
  retrying. At least two verified cards are required to publish a new batch.

## Ranking and preparation boundaries

The reviewed provider/structured/semantic ranker and weights are reused without
LLM reranking. Provider discovery supplies candidates, not AI-invented titles.
Movie/TV provider relationships, keyword/genre discovery, book subjects/authors,
podcast/music catalog searches and existing cached profiles supply bounded lanes.
YouTube search is limited to YouTube sources to avoid unnecessary search-quota
consumption.

Direct provider reads verify destination identities and supply descriptions.
Source-quoted small-model profiles and compatible embeddings are cached for 90
days. Missing descriptions stay missing: album names do not prove sound or lyrics.
Cached profiles are bounded to eight recent entries per supported media type
when recalling additional candidates.

Cross-media results are allowed and ranked by evidence; no type quota forces
unrelated music or podcasts into a list. Unsupported/unavailable provider IDs,
insufficient evidence, API quota problems and spending limits retain the existing
consumer fallback. Enabling an engine path for all supported types does not
guarantee strong recommendations for every work.

## Cost and abuse controls

The initial local implementation has a **$1 USD/day feature-wide preparation
ceiling**, ten newly claimed titles per requesting account per day, and a
conservative **$0.25 reservation per in-flight title**. These are limits, not
predictions of actual charges. No paid requests were made to test this change.
The owner should review these defaults before activating the backend.

PostgreSQL serializes leases and global reservations. Successful usage settles
at the existing small-model token-rate calculation. Unknown request outcomes
retain their reservation; expired workers are conservatively charged against
the internal guard before replacement. This internal accounting is not an
OpenAI billing export. Concurrent visitors to one title start at most one worker.
Preparation has request/time and model-reservation bounds.

Storage uses two isolated consumer tables and one service-only RPC. Browsers,
anonymous users and authenticated SDK clients have no table or RPC grants.
Profiles, model accounting and lease records never appear in the public response.

## Verification

```sh
npm run check
node --import tsx --test client/src/lib/similar-media.test.ts \
  supabase/functions/_shared/media-similarity.test.ts \
  supabase/functions/_shared/recommendation-lab.test.ts
node scripts/test-media-similarity-storage.mjs
node --import tsx scripts/test-consumer-similar-media.mjs
npm run build
```

The storage test starts and deletes a disposable PostgreSQL cluster under `/tmp`;
it never connects to Supabase or the configured Replit database. Browser tests
use real components/hooks with simulated API responses and no real session.
These tests do not certify hosted JWT behavior, real-account saving, installed
native builds, or the relevance of live provider results.
