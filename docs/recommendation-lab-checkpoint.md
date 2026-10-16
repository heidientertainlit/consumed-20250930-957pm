# Private recommendation lab — bounded checkpoint

## Initial checkpoint outcome

- 12 source cases selected; 11 verified sources have saved comparisons.
- Pink Floyd's *Animals* remains unavailable: the bounded Apple search returned
  other albums, not an exact verified target. No replacement was invented.
- 48 prepared works: 11 sources plus 37 other candidates; 41 have embeddings.
- Coverage: 13 films, 17 TV shows, 10 books, 4 albums, 4 podcasts.
- 95 model requests: 43 profile extractions, 41 embedding batches, 11 CURRENT
  captures. Token-rate usage cost: approximately **$0.0207**; no outstanding
  reservations. No new paid provider service was used.
- Film/TV has the strongest provider relationship and descriptive coverage.
  Books vary in descriptive evidence and edition resolution. The four albums
  have no supported semantic profile. Podcast show descriptions support some
  works, but Heavyweight has insufficient descriptive evidence and Serial
  yielded no supported dimensions. Empty evidence remains visible.
- CURRENT verification retained only 1–4 of its 5 generated suggestions per
  source, depending on media type; unresolved suggestions remain diagnostic
  records, not displayed verified recommendations.
- 29 focused lab/consumer tests, TypeScript checks, build, browser interaction
  tests and live transactional feedback/item-cap/rollback checks passed.
- Existing recommendation/catalog/fingerprint/cache data and existing Edge
  versions matched baseline. A cross-time audit saw independent session and
  App Store sync activity; audited same-transaction lab operations left all 157
  pre-existing public application tables unchanged.

## Entry point and boundaries

Open **Admin → Recommendation Lab** (`/admin/recommendation-lab`) in the workspace.
Frontend changes are local until the owner handles their normal Git/release flow.
Only the new `admin-recommendation-lab` Edge Function is deployed; no consumer
function is redeployed. The endpoint verifies the session and authoritative
human-admin flags before reading data or doing paid work. Gateway verification
is disabled only for this new self-authorizing endpoint, matching the existing
admin pattern for asymmetric session tokens.

The two existing lab tables contain every prepared item, profile, vector,
comparison, usage receipt and evaluation. No additional persistent tables,
production triggers, jobs, caches, identity writes or consumer V2 integration.
The additive migration installs one service-only worker function, with a fixed
search path. Browsers and guests cannot call it or write the tables directly.

Production fingerprints, canonical references and the preparing admin's CURRENT
context are read-only inputs. Provider metadata is fetched directly, never
through shared search/enrichment/canonical helpers. Provider links in the lab
open external catalog pages, not consumer detail pages that may enrich data.

## Frozen experiment

- Twelve deliberately chosen source cases, five media types; rationale is in the
  source selector and the fixed manifest.
- At most **48 prepared works total**, including sources. Unavailable sources are
  not replaced or relabeled. No expansion after completion.
- A fixed stress-test seed set plus bounded TMDB relationship candidates. This
  is not a test of catalog-wide recall. Both V2 variants use the same pool.
- `CURRENT`: exact consumer generation query, server prompt, `gpt-4o-mini`,
  temperature and response settings, using the capturing admin's DNA and recent
  media. It is a generator replay, **not a snapshot of an existing consumer
  cache**. Direct provider verification deliberately replaces shared search,
  so resolution coverage can differ. Unsupported/unverified suggestions stay
  unavailable; generated order is preserved. The original generated proposals
  and failures are retained for diagnosis, never presented as verified results.
- `Structured / provider`: deterministic provider relationship, existing story
  relationship, creator, genre and source-supported structured profile signals.
- `+ Semantic scoring`: the same signals plus separate appeal/experience,
  tone/style and subject/theme cosine scores. Exact scoring across the tiny pool
  avoids unnecessary ANN/index infrastructure.
- Weights and the semantic floor were fixed **before examining results** and
  remain unchanged. Scores are raw experimental scores, not match probabilities.
- No LLM candidate generation for V2 and no LLM reranking. The only generative
  recommendation call is the isolated CURRENT baseline.

## Profiles and embeddings

Small-model extraction is grounded only in provider descriptions. Each retained
characteristic must have a supporting quotation actually present in that text.
This proves source provenance, not that the model's interpretation is correct.
Unknown dimensions stay empty. Album titles, artist names and generic genres
are not sufficient evidence for sound, lyrics, tone or emotional appeal.

Use `text-embedding-3-small`, 256 dimensions, with three separate text inputs:
appeal/experience; tone/style; subject/themes. Only populated inputs are embedded.
Store the model, input hash, dimension count and profile version. Models or input
versions must not be mixed in the same cosine comparison.

## Spending and preparation

The database serializes preparation leases, reservations, settlement and feedback.
The checkpoint-wide cap is **$0.75**, including unsettled reservations, not a
per-request or per-admin budget. This is below the earlier $15 experiment ceiling.
Calls reserve a conservative bounded amount before contacting the model. Known
rejections release it; unknown transport/server outcomes retain it. No automatic
paid retries. The receipt includes actual API token usage and model identity.

Usage costs use $0.15/M input + $0.60/M output tokens for `gpt-4o-mini` and $0.02/M
tokens for embeddings. Displayed totals are usage-based calculations, not invoice
reconciliation. Provider metadata reads use existing/free endpoints, not a new
paid-per-call recommendation service. Reservations and actual costs are distinct.

The UI does not prepare or capture on mount. Initial preparation is an explicit
bounded operator batch. The UI also supports one preparation step per click,
and disables it once complete. Cached reads and saved comparisons do not make
model calls. A different human admin can explicitly capture their own CURRENT
without preparing any additional candidate works.

## Evaluations and traces

All three paths retain origins, raw signals, weighted contributions, missingness,
supporting profiles/quotations and relevant relationship notes. CURRENT's prose
is its generated explanation, not independent verification of a relationship.

Great / Fine / Bad is attributed to exact run, variant, candidate and reviewer.
Optional diagnostic reasons:

- same subject, wrong experience
- weak connection
- good but obvious
- surprising/great connection
- identity/data problem
- already know this

Optional notes are limited to 500 characters. Updates target only that evaluation
key under a row lock; they never overwrite frozen results or another reviewer's
feedback. Admins can read the private lab, so feedback is not reviewer-secret.

## Operation and verification

Use `npx --no-install tsx scripts/recommendation-lab-checkpoint.ts MODE`.
Modes are explicit:

- `preflight`: retain consumer/Edge hashes and production digests; check absence.
- `test`: install and exercise the new worker using real database roles, then
  roll everything back. A single-snapshot audit covers all 157 pre-existing
  public application tables and existing functions.
- `apply`: require passing tests and an isolated CLI dry run listing only the
  intended migration, then apply it and one migration-history bookkeeping row
  inside an audited transaction. Never run an unrestricted migration push.
- `prepare`: process only the fixed bounded checkpoint; existing successes are
  reused, not regenerated.
- `compare`: capture one immutable three-way run per available source for the
  preparing admin. Existing captures are reused.
- `state`, `verify`: inspection only; verify consumer code, existing Edge
  versions, the exact live worker body, usage and production data digests.

The first operator batch exposed a deadline incorrectly shared across steps.
It was corrected to reset per operation; only failed metadata-read entries were
resumed. Successful profiles were reused. All model attempts remain in receipts.

Evidence and browser screenshots are kept under `/tmp/recommendation-lab-checkpoint`.
Cross-time digests can detect unrelated session or App Store sync activity; the
same-transaction rollback/apply tests distinguish lab writes from concurrency.
Do not describe a running production database as frozen.

Tests: `node --import tsx --test supabase/functions/_shared/recommendation-lab.test.ts
client/src/lib/similar-media.test.ts`. The isolated browser contract test is
`node --import tsx scripts/test-recommendation-lab-ui.mjs`: it uses live lab data
with mocked auth/API transport, tests comparison/trace/save/error/mobile behavior,
and never persists its fixture feedback. It does not establish a live signed-in
browser session. The real app keeps its authentication in place.

## Stop and rollback

Stop after this checkpoint. The owner's quality review must precede any candidate
expansion, weight adjustment, LLM reranking or consumer integration.

To disable the checkpoint without deleting data, disable only its new Edge
Function and UI entry, then run
`supabase/operations/recommendation-lab-checkpoint.rollback.sql`.
The foundation and all lab data remain for export. Full deletion needs explicit
approval, and the original foundation rollback continues to refuse nonempty
tables. Do not use CASCADE or reset the model-spend ledger to bypass the cap.
