# Media search performance and safety audit

**Investigation and implementation plan only — November 18, 2026, America/Denver (measurements November 19 UTC).**

## Decision summary

The safest first improvement is **one bounded identity lookup covering the entire returned provider-result page, while retaining the existing synchronous budget for genuinely unresolved identities**. Do not begin by moving all identity persistence into the background.

Confirmed findings:

1. **The deployed search performs avoidable individual identity operations after ranking.** It returns up to 60 ordinary results, but its bulk lookup covers only the first 30 eligible provider results. It then individually resolves up to 30 results lacking an attached canonical ID. “Not covered by the bulk lookup” is incorrectly treated like “not yet cataloged.” Even an entirely cataloged 60-result page therefore takes the individual resolver path for 30 items.
2. **That individual resolver performs writes even on exact alias hits.** An exact provider alias does not skip the fingerprint-link PATCH. Four workers process the candidates before the response returns. The separate six-item background job does not remove this awaited work.
3. **Fresh All searches have substantial post-selection delay.** Without book-series discovery, three All samples took 2,762–5,538 ms at the HTTP client; 1,752–3,507 ms elapsed between the server's final-results log and its HTTP completion log. These intervals include identity work and remaining response overhead, not exclusively database execution.
4. **Provider work is an independent, variable cost.** Providers already start concurrently, but all are awaited before global scoring, merging, deduplication, and response construction. One Books sample spent 2,671 ms before final selection and only 99 ms afterward. Identity optimization will not eliminate provider-dominated searches.
5. **Local safety changes are not the deployed search baseline.** The active search lacks the workspace's positive-clearance classifier and typed TMDB search changes. The fresh timings cannot establish the cost or correctness of those undeployed changes.
6. **The collections endpoint is still failing at Vercel.** GET, OPTIONS, and POST returned platform-level `FUNCTION_INVOCATION_FAILED`; development returned HTTP 200 JSON for the same search. The exact production exception remains unavailable because Vercel is not connected. The earlier local import-resolution failure is independently reproduced evidence, not a verified production root cause.

No application or test source, schema, settings, credentials, deployments, native assets, or real-user records were changed by this audit. Normal search requests did invoke the application's existing catalog housekeeping. Movie collections remain disabled; book-series behavior remains intact.

## 1. Evidence, environments, and limitations

### Active deployment inspected

Read-only Supabase Management API metadata and source downloads targeted project `mahpgcogwpawvviapqza`. The workspace's mismatched service-role credential was not used.

| Function | Active version | Bundle SHA-256 prefix | Workspace comparison |
| --- | ---: | --- | --- |
| media-search | 996 | 9d90414bf38e6dd3 | Different: workspace adds video safety and typed TMDB searches |
| track-media | 117 | c737f8869cac148d | Different: workspace includes additional season/episode/volume handling |
| rate-media | 58 | 0d4dd2f8de5efb4d | Identical entrypoint |
| inline-post | 82 | 5d49977fa5e5163a | Different: workspace adds shared media-scope normalization |
| add-media-to-list | 85 | 5fc78ab9c957417b | Identical entrypoint |
| add-to-custom-list | 60 | 99339edbb76b74a9 | Different: workspace changes the user lookup to administrator/UUID access |
| import-media | 69 | 087b5cd0a74b5ded | Identical entrypoint |

Both downloaded identity dependencies, `_shared/canonical-media.ts` and `_shared/media-fingerprint.ts`, exactly match the workspace. Their SHA-256 source hashes were respectively `062ce36a3530fcf2e451b03a2b3373da42cab211271e2755e49570bacc05fbb6` and `5269e30f425201d6b0b6e0735dc0093c92761e4bacd8cced8cb2539ca3245bd1`. A normalized runtime-import comparison also identified local-only safety and media-scope dependencies; their absence is consistent with the older deployed entrypoints, not proof of a broken deployed import.

Live schema reads confirmed the bulk RPC body, canonical validation triggers, provider-alias uniqueness, fingerprint primary key, authoritative identity indexes, verified title/creator/year uniqueness, and canonical rating/list uniqueness. These were not inferred solely from migration files. They establish structural protections, not successful concurrent user transactions.

Production web checks target the existing Vercel site `https://app.consumedapp.com`. Replit deployment metadata reports no Replit-hosted deployment; it does not describe the externally hosted Vercel app. The signed-in production UI and native device experience were not verified.

### Measurement method

- Fourteen sequential, ordinary search requests, with `query`, `type` where applicable, and an explicit `include_book_series` boolean.
- Two representative queries, Harry Potter and Dune; All, Movies, TV, and Books. Harry Potter was repeated after intervening requests, plus two series-enabled samples.
- UTC measurement window: **2026-11-19 05:09:34.253–05:09:59.789**.
- HTTP completion measured using a monotonic clock from this development container. This is not a phone trace or a browser render measurement.
- Server provider/ranking interval: existing `Original query` log to existing `Final results` log. It includes provider aggregation and ranking; it is not an individually instrumented provider breakdown.
- Post-selection interval: final-results log to the matching function HTTP completion event. It includes bulk lookup, individual resolution, serialization, and residual server overhead.
- Console and HTTP events were matched through sequential request windows and endpoint evidence. **Execution IDs were reused across requests** and were not treated as unique request identifiers.
- Every sample returned HTTP 200, `partial: false`, and an empty failed-provider array.
- Returned canonical counts describe response fields, not a count of bulk-lookup hits. The remaining items may be synthetic/model suggestions intentionally excluded from canonical persistence.

No forced cold start, cache purge, paid-provider load test, or production instrumentation change was performed. These are small individual samples, not population percentiles. Changing provider results make the series-on/off samples unsuitable for estimating isolated series overhead.

## 2. Fresh performance baseline

All durations below are milliseconds. “Provider → final” includes ranking. “Final → HTTP” is server completion, not client receipt. All starts are UTC on November 19.

| Sample | Start | Query | Type | Series | Client HTTP | Server execution | Provider → final | Final → HTTP | Canonical / results |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | 05:09:34.253 | Harry Potter | All | no | 5538 | 5359 | 1686 | 3507 | 60/60 |
| 2 | 05:09:39.791 | Harry Potter | Movies | no | 481 | 366 | 20 | 229 | 19/19 |
| 3 | 05:09:40.273 | Harry Potter | TV | no | 328 | 206 | 5 | 179 | 19/19 |
| 4 | 05:09:40.602 | Harry Potter | Books | no | 1513 | 1410 | 541 | 851 | 21/21 |
| 5 | 05:09:42.115 | Dune | All | no | 3419 | 3282 | 1151 | 2109 | 59/60 |
| 6 | 05:09:45.535 | Dune | Movies | no | 281 | 180 | 7 | 152 | 12/12 |
| 7 | 05:09:45.817 | Dune | TV | no | 289 | 178 | 3 | 150 | 12/12 |
| 8 | 05:09:46.106 | Dune | Books | no | 2425 | 2314 | 1366 | 928 | 24/24 |
| 9 | 05:09:48.531 | Harry Potter | All | no | 2762 | 2642 | 872 | 1752 | 60/60 |
| 10 | 05:09:51.294 | Harry Potter | Movies | no | 326 | 206 | 4 | 178 | 19/19 |
| 11 | 05:09:51.620 | Harry Potter | TV | no | 324 | 203 | 3 | 177 | 19/19 |
| 12 | 05:09:51.945 | Harry Potter | Books | no | 2880 | 2790 | 2671 | 99 | 15/15 |
| 13 | 05:09:54.826 | Harry Potter | All | yes | 3125 | 2996 | 1539 | 1438 | 60/61 |
| 14 | 05:09:57.951 | Harry Potter | Books | yes | 1837 | 1728 | 1561 | 149 | 18/19 |

Observed client ranges without series: **All 2,762–5,538; Movies 281–481; TV 289–328; Books 1,513–2,880 ms**. Series-enabled samples were All 3,125 and Books 1,837 ms; there is insufficient evidence for a series-enabled range.

Important baseline qualifications:

- The active TMDB branch uses mixed search even for Movies/TV; both types appeared in both responses. The workspace now uses typed provider searches and the shared panel additionally filters its display. The active endpoint's current output is not a pure Movies/TV provider benchmark.
- Ordered identity hashes matched the repeated Harry Potter Movies requests and repeated TV requests, but All and Books changed their result mixes. Those changes preclude attributing all timing differences to cache warmth.
- The first All sample used a different execution ID than later samples. This does not prove a cold process. Neither repeated requests nor cached metadata prove every provider/database/model cache was warm.
- Existing logs show the sports child function contributing 1,653, 1,135, 711, and 706 ms in the four All windows. This demonstrates a real independently awaited provider branch, not proof that it was always the slowest branch.
- A bounded REST-log sample found bulk-RPC origin times of **127–742 ms**. These are request-origin timings, not pure PostgreSQL execution times. A read-only EXPLAIN request was rejected by the Management API; no database execution-plan benefit is claimed.

### Corroborating identity traffic

Between sample 9's final-results event at **05:09:49.501** and HTTP completion at **05:09:51.253**, the narrow REST log window contained:

| Operation | Count | Origin-time range |
| --- | ---: | --- |
| Bulk canonical RPC | 1 | 178 ms |
| Alias GET | 34 | 57–184 ms |
| Alias POST | 4 | 67–75 ms |
| Fingerprint PATCH | 32 | 57–66 ms |
| Fingerprint POST | 2 | 74–177 ms |
| Canonical row POST | 4 | 66–184 ms |

These counts corroborate the deployed source's database activity. Background work from earlier searches can overlap this window; the log system does not prove every counted operation belongs to sample 9. Do not sum parallel request times or present the total as response latency.

### Isolated reproduction of the coverage defect

An ephemeral diagnostic executed the downloaded search's actual bulk-lookup and enrichment helpers against an in-memory catalog in which **all 60 aliases already existed**. No real database or provider was involved.

| Diagnostic | Bulk items | Individual resolver calls | Canonical IDs returned |
| --- | ---: | ---: | ---: |
| Actual deployed helpers | 30 | 30 | 60 |
| Hypothetical full-page lookup, in memory only | 60 | 0 | 60 |

This proves an unnecessary-call mechanism and retained identity coverage on this fixture. It does **not** establish a production millisecond saving, race safety, or a cold-result performance improvement. No diagnostic variant was written into application or test source.

## 3. Blocking-operation inventory

| Operation before response | Current behavior | Essential dependency / deferral assessment |
| --- | --- | --- |
| Provider fetches and response decoding | Concurrent top-level branches, then `Promise.allSettled`; some branches contain additional sequential lookups/fallbacks | Need returned provider IDs and verified metadata before ranking/selection. Do not drop providers or silently truncate slower sources. |
| Optional book-series discovery | Explicit opt-in; model request up to 7 seconds, followed by optional cover request up to 4 seconds; awaited with other branches | Preserve All/Books discovery and individual/whole-series actions. Track already scopes its opt-in to matching filters. Other callers, including navigation, retain their existing opt-in. |
| Scoring, provider merging, deduplication, trimming | Global pass, ordinarily top 60, with synthetic series prepended | Essential to current order and selection behavior. These operations complicate independent provider delivery. |
| Positive video safety gate | Awaited in workspace, **absent from active search** | Positive clearance must precede exposing title/artwork or identity persistence. Never move clearance after response. No fresh production timing can be assigned to this undeployed gate. |
| Known-identity batch RPC | Awaited once for first 30 eligible provider tuples | Supplies immediate canonical IDs, verification metadata, and fingerprints. Retain a bounded read; correct page coverage first. |
| Individual exact-alias GET | Up to 30 eligible results without attached IDs, four workers | Redundant when omitted by the 30-item bulk window but already cataloged. Still required for genuinely unresolved identities unless an equivalent authoritative operation replaces it. |
| Trusted search fingerprint construction | Uses real provider-result metadata; no external/model request on this synchronous branch | Keep source evidence and identity precedence. This is different from expensive semantic enrichment. |
| Exact-alias fingerprint-link PATCH | Awaited even when alias already exists; update can match zero rows | Search reads do not require an identical link to be rewritten. However, link repair serves later fingerprint/canonical consumers; removing all repairs without replacement is not justified. |
| Authoritative-key and verified-text reads | For non-exact aliases: story/work/ISBN lookups, authoritative aliases, then verified title+creator+source-backed year when eligible | Required to prevent unsafe title-only matching and preserve cross-provider identity. Do not replace with browser hints or title matching. |
| Canonical insert, alias inserts, race-winner reads | Awaited for genuinely new identities; authoritative aliases can add serial operations | Retain authoritative identity creation before dependent writes. Alias uniqueness and work-key indexes are part of correctness. |
| Final fingerprint linkage for new identity | Awaited after identity resolution | Separately evaluate repair/write minimization; do not conflate an optional cache link with durable alias creation. |
| Typo correction and recursive search | Only on empty results and once per corrected request; extra model + function request | Preserve spelling recovery. Workspace additionally prevents safety-filtered results from triggering a bypass. Existing provider fetch timeouts are not one end-to-end search deadline. |
| Six-item `waitUntil` enrichment | Scheduled without awaiting HTTP completion; starts before response creation | Already background work. Can still consume resources and overlap later searches. Cache misses can trigger provider, classifier, embedding, and Wikidata work. Its success is not guaranteed and cannot be required for a subsequent user action. |

Timeout nuance: the search helper clears its abort timer when `fetch` resolves, before callers finish `.json()`. Multiple sequential requests/fallbacks can also accumulate. A nominal per-fetch timeout is therefore not proof of a hard total response bound. This is an additional robustness consideration, not the measured primary cause.

## 4. Downstream dependency matrix

| Consumer | Identity path inspected | Requirement if search identity work changes |
| --- | --- | --- |
| Track / system-list save | Deployed `track-media` independently resolves identity, ignores conflicting browser hints, and handles canonical/provider duplicate paths | Keep provider fields, canonical handoff, chosen list/status, season/episode/book scope, and existing failure fallback. Do not shift extra cold provider/model latency onto Save without measuring it. |
| Ratings create/edit/delete | Deployed `rate-media` resolves independently; canonical-first lookup/upsert/delete with provider fallback and collision recovery | Preserve one current rating per user/work; rating zero remains delete. Resolution failure is not proof cross-provider deduplication remains complete. |
| Ratings/reviews inside Track | Uses track endpoint; posts and ratings receive resolved identity when available | Test rating with/without review, spoiler flag, edit/retry, and write failures. A successful resolver alone does not prove all downstream writes succeed. |
| Inline reviews/posts | Deployed `inline-post` resolves independently; local version has extra scope handling | Preserve actual deployed contract and explicit provider identity. Do not roll unrelated local scope changes into a search-only release. |
| Text-only takes / direct SDK posts | Quick Track posts directly after tracking; QuickActionSheet and QuickReactCard contain direct SDK social-post inserts | Quick Track's ordering helps only when tracking established the alias. Not every direct post path resolves first. Keep immediate aliases, or separately harden these paths before deferring creation. |
| List insertion | Deployed `add-media-to-list` and `add-to-custom-list` resolve independently, query canonical then provider identity, and use canonical conflict keys when available | Preserve owner/collaborator checks, provider fallback and canonical uniqueness. Legacy custom-list handler exists, but this is not approval to add new custom-list destinations. |
| Direct SDK ratings | Room composer writes `media_ratings` with provider-tuple conflict target; media-detail also has direct rating paths | Cannot rely on a background resolver. A provider-key upsert does not necessarily recover a separate canonical uniqueness violation. Include these callers in race tests. |
| Imports | Deployed import uses provider-first inserts and later background identity enrichment/repair | It has its own reconciliation process. Do not infer that ordinary search background work repairs arbitrary legacy rows. Keep import insert-only and deduplication boundaries. |
| Media detail, community ratings, match scoring | Canonical lookup/read with legacy provider compatibility; preferred-rating merger favors a user's canonical row | A missing canonical link may hide a cross-provider rating even if provider fallback still works on the original route. Search selection must keep exact provider/type/ID/year/creator fields and existing routes. |
| Search selection and series | Shared panel normalizes results; request IDs, aborts, and query/filter keys protect panel state; series children use their own provider identities | Keep canonical IDs additive, never substitute synthetic series IDs for individual books/films, and preserve whole-series versus individual-book actions. |

### What the live database protects

- `media_provider_aliases` has a unique `(external_source, external_id)` key.
- Canonical story key, Open Library work ID, and ISBN have unique indexes.
- Verified normalized title/creator/year has a partial unique index. Unknown years and unverified metadata do not satisfy that identity rule.
- Ratings have both provider-tuple uniqueness and user/canonical uniqueness.
- List items have both provider-tuple uniqueness and user/list/canonical uniqueness.
- Before-write triggers replace or clear browser-supplied canonical IDs using the exact persisted provider alias. Canonical catalog tables are server-owned.
- Fingerprints have a provider-tuple primary key; the batch RPC's fingerprint lookup is already supported by that key. No missing-index root cause was established.

### Races and remaining proof obligations

1. **Immediate selection before alias persistence:** a direct SDK write can see no alias and receive a null canonical ID. Later search enrichment writes aliases/fingerprints, not arbitrary existing ratings/posts/list rows. There is no demonstrated universal automatic repair. Cross-provider uniqueness does not protect null canonical links.
2. **Concurrent search/background/action for the same tuple:** the unique alias selects one mapping and the resolver rereads a winning alias after an insert conflict. This protects the exact provider mapping, but when no authoritative or verified-year key exists, concurrent canonical inserts can leave an unused row before alias arbitration. Offline concurrency and rollback-only database tests are needed before claiming no duplicates.
3. **Concurrent cross-provider resolution:** authoritative-key and verified-year uniqueness reduce duplication, and the resolver has conflict recovery. Alternative ISBN/work aliases, partial failures, and interleavings still require explicit convergence tests. Inspect all alias mappings, returned IDs, and trigger-stamped user rows, not just a final HTTP status.
4. **Provider-key versus canonical-key conflicts:** direct SDK upserts can conflict with a different unique index than their chosen conflict target. Endpoint-specific recovery cannot be assumed for every direct caller.
5. **Fingerprint refresh and exact alias:** the ordinary mutation resolver builds/loads its fingerprint before returning an exact alias and still patches linkage. A cold/expired fingerprint can cost provider/model time even when the identity is already known. Do not optimize this by returning unverified metadata or bypassing strict-verification requirements.
6. **Background lifetime/failure:** worker termination, failed calls, or overlapping work must not lose a user's rating/list/post relationship. Browser abort is not proof that already-running server work stopped.
7. **Deletion/privacy:** catalog enrichment must remain catalog-only; do not copy user content into it, recreate deleted user records, weaken RLS/ownership checks, or invent suppression bypasses. Existing privacy/deletion behavior was not exercised with real users here.

**Conclusion:** broad background identity creation is not certified safe. Independent endpoint resolvers are useful protection, not proof that all clients and all failures are covered.

## 5. Provider-loading assessment

Faster providers **can technically return independently**, but doing that transparently would change the current single-response contract:

- Ranking currently compares all provider results together; an early top result can move when books, music, games, sports, or series arrive.
- Google Books editions and Open Library works are merged/deduplicated inside the book branch. Emitting either prematurely risks duplicates, changed cover choices, and selection of a row later replaced.
- Music has its own title/creator/subtype deduplication. Stable identity must include provider, type, and subtype where applicable, not title alone.
- Synthetic book series currently precede ordinary results; asynchronous series must preserve the approved discovery and expansion experience without moving a row under the user's finger.
- The shared panel currently returns one array. It uses request IDs, abort controllers, and query/filter isolation. Every independent request would need those protections and late callbacks must not affect a newer query/filter/session.
- Navigation has query-key isolation but does not currently forward the query's cancellation signal into media fetch. Old requests can continue consuming server work even though their data is stored under a different key.
- Many legacy callers expect a single `{results, partial, failedProviders}` response or just the extracted array. Streaming or multi-response behavior cannot silently replace that contract.
- The shared panel currently extracts results without surfacing provider/safety partial-state metadata. Partial provider delivery must not silently imply a completed, fully screened search.

**Recommendation:** retain one response and current ranking/deduplication for the first optimization. After measuring that change, consider a narrowly scoped, explicitly designed progressive enhancement only if provider wait is still unacceptable. Prefer preserving the existing default endpoint contract; do not introduce SSE, polling, provider-specific endpoints, or a broad rewrite as the starting point.

Any future progressive version must specify stable item keys, merging/deduplication ownership, how an already selected item remains stable, completion/error status, bounded overall work, cancellation, and exactly when screened items can become visible. Movie/TV items cannot appear as unverified placeholders containing restricted titles or artwork.

## 6. Movie-collection safety and cache recommendations

Collections are disabled at the shared client hook. No recommendation here authorizes enabling them.

### Current source behavior

- Search summaries are not trusted. The handler fetches details for at most three candidate collections and screens their members before returning even the parent title/poster.
- An explicit block in any member blocks the whole collection. Missing/uncertain members cause explicit unavailability rather than a cached successful empty search.
- Direct collection IDs are screened too; unsafe parents/members cannot bypass search filtering.
- Handler response cache: process-local, at most 200 entries; search TTL 10 minutes, detail TTL one hour. Only screened successful responses enter that cache.
- Classifier cache: process-local, at most 1,000 entries; positive/negative verdict TTL six hours, uncertain TTL 15 seconds. Same-instance in-flight maps deduplicate checks by `movie:id` / `tv:id`, with bounded concurrency and batches.
- The classifier's exported policy version is `pornography-classification-v2`; backend verdict and collection-response map keys do **not** themselves include that version. The client query keys are safety-versioned. A new process clears backend maps, but a future persistent/shared cache would need explicit versioning.
- The classifier metadata phase uses a 12-second deadline, with per-fetch limits and four-way concurrency. Classification then has its own 12-second request timeout and shares the limiter. This is not one guaranteed 12-second end-to-end operation.
- Collection response cache misses are not coalesced as whole collection requests. Same-instance member verdicts are coalesced, but two concurrent collection requests can still repeat collection search/detail fetches.

### Targeted recommendations, in increasing scope

1. **Reuse only exact, sufficiently complete source evidence.** Collection summaries or `adult: false` are not clearance. Collection members often lack keywords and useful overviews. Reuse already fetched full TMDB evidence only after checking type/ID, language, required fields, source provenance, freshness, and a consistent metadata fingerprint. Never use browser-supplied metadata as authoritative clearance.
2. **Keep same-instance single-flight behavior and add bounded collection-level coalescing if measurements justify it.** Key exact search/detail requests separately. Resolve every waiter on errors; no hanging promise or success cache entry for uncertainty. Bound inflight entries and cleanup.
3. **Version any shared/persistent verdict cache.** A suitable identity includes provider, media type, stable provider ID, policy/prompt/model version, and source-metadata version/hash or an explicit freshness policy. Names are neither stable identity nor a safe cache key for classification.
4. **Version parent responses against membership.** Parent clearance depends on every current member. A new/changed member or newer member-policy verdict must invalidate/revalidate the parent before exposure; a previously approved parent cannot grant clearance to added films.
5. **Treat warm memory as an optimization, not a service guarantee.** Fresh instances, multiple Vercel regions, and Supabase workers do not share process maps. A durable cache would be a separate approved schema/infrastructure change, not an invisible extension of this audit.
6. **Never stale-serve unverified content.** A newer block, missing decision, unsupported source, provider/model failure, policy-version mismatch, or failed identity verification means withhold the affected collection/title/artwork. Keep short negative/uncertain retry behavior distinct from long-lived positive clearance.

Expected benefit is fewer repeat metadata/model calls. No production speedup, hit rate, cost reduction, or model accuracy guarantee has been measured for these proposals. Retain the approved classification policy/model; do not replace it with cheaper metadata-only heuristics or a weaker classifier. Existing mocked tests prove handling, not semantic model accuracy on unseen works.

## 7. Collections HTTP 500: confirmed symptom and evidence blocker

Fresh public checks at approximately **2026-11-19 05:13:49–50 UTC**:

| Request | Production | Development / source expectation |
| --- | --- | --- |
| GET, query “Where the red fern grows” | HTTP 500, Vercel `FUNCTION_INVOCATION_FAILED` | Same development query returned HTTP 200 `{"collections":[]}` |
| OPTIONS | HTTP 500, same Vercel error | Current handler returns 204 before provider/configuration work |
| POST | HTTP 500, same Vercel error | Current handler returns 405 before provider/configuration work |

Production request IDs for authorized log lookup:

- GET: `cle1::glpwr-1795065229563-64356d460788`
- OPTIONS: `cle1::vh956-1795065229842-6ddefbbccccb`
- POST: `cle1::cln7b-1795065230200-14d3b62e806a`

The current endpoint wrapper imports `../server/movie-collections.js`. That handler now imports the shared safety modules through extensionless paths. Earlier investigation reproduced an unbundled Node `ERR_MODULE_NOT_FOUND` involving the new safety import. Development's transpiler/bundler resolving those imports does not establish how Vercel packaged them.

**Evidence-supported conclusion:** failure occurs outside, or instead of, the current handler's normal handled responses; it is not explained by ordinary provider failure in that handler. Missing TMDB configuration would produce 503; handled upstream failure would produce 502; neither explains the observed OPTIONS result.

**Not yet confirmed:** whether Vercel is running this exact source, whether module resolution is the production exception, which deployment introduced the failure, or whether another startup/package/runtime condition is responsible. Local source chronology and reproduction make the recent imports worth investigating; they do not prove causality in production.

**Specific missing evidence:** authorized Vercel runtime exception/stack for one request ID, deployment/build ID and commit, runtime/package configuration, and the corresponding function bundle/build trace. No Vercel connection was present when checked. Obtain those through an authorized connection or a user-supplied redacted runtime log; do not request secrets in chat. Keep collections disabled. Do not deploy a speculative import fix and call the root cause verified.

## 8. Verification performed, without implementation

### Passed

- **28 focused tests** across client canonical rating merging and shared canonical resolution, backfill safety, metadata filtering, and video classification.
- **22 additional tests** for collection handler behavior, mixed-list placement, book-series child identity, and series request scoping.
- Existing Track browser fixture at **390×844 and 1280×800**: no collection requests/warnings; book expansion, cached children, individual/whole-series and ordinary movie selection retained; filter behavior, series failure/retry, query reset, stale-response protection, and no browser errors.
- Existing app-bar browser fixture at **390×844 and 1280×800**: collections disabled; book dropdown, individual-book selection, and ordinary movie selection retained.
- Ephemeral handler-only diagnostic, using the existing fixture catalog and actual collection handler: only allowed parents returned; explicit/softcore direct IDs blocked; child filtering and warm cache reuse retained. No real provider network or account writes.
- Ephemeral deployed-helper diagnostic proved the 30-of-60 bulk coverage issue and a hypothetical full-page read's eliminated resolver calls on an already-known fixture.

### Failed / not established

- `node scripts/check-catalog-content-safety.mjs` timed out at line 152 waiting for `movie-collection-10`. It assumes enabled collection UI, while the shared production hook intentionally disables collections. Its later browser assertions did not run. Do not report this script as passing or infer active UI exposure from it.
- The separate unit/handler checks do not replace a future enabled-collection end-to-end check. That script needs an isolated, explicitly enabled fixture that cannot change the real app flag.
- No optimization was implemented, so no “after” performance or behavior result exists.
- No authenticated production write tests, live concurrency writes, native build/device checks, or fresh full application build were run. Source inspection plus isolated tests does not certify every tracking/review/rating/list path end to end.

Reproduction commands:

```text
npx tsx --test client/src/lib/canonical-media.test.ts supabase/functions/_shared/canonical-media.test.ts supabase/functions/_shared/canonical-backfill-safety.test.ts supabase/functions/_shared/catalog-content-safety.test.ts supabase/functions/_shared/catalog-video-classification.test.ts
npx tsx --test client/src/lib/movie-collections.test.ts client/src/lib/blend-movie-collections.test.ts client/src/lib/media-search*.test.ts client/src/lib/book-series*.test.ts
node scripts/check-track-series-search.mjs
node scripts/check-appbar-movie-collections.mjs
node scripts/check-catalog-content-safety.mjs
```

The last command is the known fixture failure described above, not a required retry until its assumptions are corrected.

## 9. Regression matrix for separately approved work

These are proposed tests, not new test code added during the audit. Mutation tests must use in-memory doubles, a dedicated isolated database, or explicitly authorized rollback-only fixtures—not real users.

| Area | Fixtures / failure or concurrency case | Required assertions |
| --- | --- | --- |
| Full-page bulk lookup | 0/1/29/30/31/59/60 provider rows; all-known, all-new, mixed known across both halves; series/model-only rows | All eligible returned tuples get one bounded read; all-known 60 makes zero individual resolver calls; genuinely unresolved work retains its prior independent budget; no external/model call on trusted search persistence. |
| Response compatibility | Same provider fixtures before/after; missing creator/year; duplicates; unusual IDs; optional fields | Ordered rows, titles, artwork, type/subtype, IDs, creator/year, canonical IDs and verified metadata remain correct; no new title-based merges; partial/failure contract retained. |
| Bulk read failure | RPC error, timeout, empty/partial rows, malformed metadata | No silent identity corruption; explicit logging/error policy; fallback remains bounded and preserves provider search results; no unbounded fan-out. |
| Tracking | Every system list/status, repeated same title, provider aliases, immediate click, server resolver failure, save retry | Correct owner/list; one intended item; stable provider/canonical fields; completion/progress behavior and optional follow-up retained; no new save latency hidden by faster search. |
| Ratings | Create/edit, half-stars, zero/delete, provider and canonical conflicts, same-user concurrent aliases, other-user controls | One current rating per work; correct edit/delete target; unrelated users untouched; direct SDK callers handle non-target unique violations. |
| Reviews and takes | Rated review, unrated text-only take, standalone inline post, QuickAction/QuickReact, spoilers, TV episode/book volume | Post body/type/scope/visibility retained; correct media relationship; moderation unchanged; tracking success is not mistaken for post success. |
| Lists | System destinations, existing provider/canonical duplicate, concurrent saves, collaborator/foreign-owner denial, legacy custom handler | No duplicate rows or wrong-list moves; owner/collaborator boundaries unchanged; no new custom destinations. |
| Identity matching | Exact alias; ISBN/work/story IDs; same title different creator/year; unknown-year/unverified; multiple ISBNs | Existing precedence preserved; one correct work graph; no title-only merge; all returned aliases and trigger-stamped rows converge. |
| Search/background/action race | Pause before/after canonical insert, before alias insert, during fingerprint update; worker failure; alias conflict | User write never depends on eventual background success; no changed mapping; orphan rows/repair obligations detected, not hidden by HTTP 200. |
| Deletion/privacy | Delete user content while catalog enrichment is pending; forged canonical ID; private/blocked-user controls | No resurrected user record, cross-user mutation, RLS weakening, or exposure through cache/enrichment. |
| Canonical reads | Same work across Goodreads/Google Books/Open Library; immediate media-detail navigation; ratings/community/match reads | Existing rating visible, canonical preferred without duplicate user votes; provider fallback and routes preserved. |
| Book series | All/Books versus Movies/TV; individual book versus whole series; child lookup failure/retry; missing cover | Discovery retained in approved filters/callers, no unwanted non-book opt-in, correct child provider IDs and action payloads, no stale series after query change. |
| Provider ordering | Artificial slow/failing providers; late books/music; spelling retry; new query/filter/session during old response | Same final order/deduplication for equivalent inputs; selected row stable; no stale result/error overwrite; bounded retry/work and explicit partial status. |
| Dormant collection UI | Global disabled flag; isolated enabled fixture; old client-cache keys; query reset; expansion/selection | Real app makes no collection request and shows no warning; isolated enabled fixture exercises approved placement and individual-film actions without flipping production flag. |
| Collection safety | False/missing adult flags, ordinary names, softcore controls, mainstream mature controls, mixed members, newly added member | Unsafe/uncertain parent/title/artwork/children never serialize or render; mainstream positive controls retained; direct ID cannot bypass. |
| Classifier failure | Missing keys, timeout, 429/5xx, refused/truncated/malformed model JSON, low confidence, duplicate/foreign keys, missing/wrong provider ID | Fail closed; uncertain remains distinct from clear and retries promptly; no cached successful empty result hiding a failure. |
| Cache behavior | Cold process, warm process, two independent instances, concurrent misses, policy/model/metadata/membership change, full cache | Stable type+provider ID; correct invalidation; bounded single-flight/cleanup; no old clearance after a new block; response payload filtered before cache storage. |
| Collection deployment | Actual Vercel-built function artifact with real runtime import behavior; OPTIONS/POST/GET; missing configuration | Startup/import succeeds; 204/405/503/502/200 as appropriate; evidence ties production exception and fix to a specific deployment. |
| Performance | Repeat controlled query/filter set; preserve ordered result identity; distinguish known versus newly cataloged; process/provider cache state recorded | Separate provider/safety/identity/HTTP and save-click latency; compare individual runs and adequate later distributions; no claimed gain from absent safety, different results, or work shifted to Save. |

## 10. Safest implementation order and rollback gates

### First: fix bulk lookup coverage, not identity architecture

Proposed change: in search, give the known-identity read a bound covering the entire eligible returned page (currently up to 60). **Decouple that bound from the existing 30-item synchronous unresolved-resolution limit.** Simply changing the shared constant to 60 would also double worst-case new-identity work and could make cold searches slower.

Keep the current bulk RPC/response fields initially, current provider/ranking/safety paths, original provider IDs, and independent mutation resolvers. Keep genuinely unresolved identity creation synchronous within its existing budget. Do not deploy unrelated local caller changes or treat the older active safety behavior as a benchmark to preserve.

Expected benefit: remove the demonstrated individual lookups/PATCHes for already-cataloged items omitted by the current 30-item read. **Unproven:** numerical HTTP improvement and the added batch payload/read cost, especially fingerprints/embeddings. Measure them; do not promise the entire 1.75–3.51-second interval disappears.

Release prerequisites: full-page/failed-read/mixed/cold fixtures, identity/read compatibility, existing browser/safety tests, isolated save-path tests, and active bundle/dependency verification. Measure a candidate retaining the intended positive-clearance safety policy; the current older live deployment cannot supply that comparison by itself.

Rollback: restore the prior search implementation/bundle if any identity/order/safety regression occurs, canonical links disappear, cold unresolved work increases unexpectedly, or repeated comparable searches/save actions worsen. Do not disable adult safety as a performance rollback. Preserve database content and investigate rather than deleting canonical rows.

### Second: reduce redundant fingerprint linkage carefully

After the first change is measured, identify already-correct links and repair-needed links separately. Preserve canonical alias authority, metadata verification, and fingerprint/canonical consumers. A conditional UPDATE still makes an HTTP request; it is not equivalent to eliminating that round trip.

Consider bounded, explicitly nonessential linkage/enrichment batching or deferral only after immediate canonical handoff is secured. Do not remove strict source verification, rely on `waitUntil` for correctness, or broaden the change into all mutation resolvers without tests. Roll back on missing fingerprint links, verification changes, or increased action latency.

### Third: verify mutation races before broader deferral

Cover direct SDK callers, unique-index conflict targets, alias-creation timing, alternative authoritative aliases, and null-link repair. Use isolated execution, then separately approved non-user database fixtures where required. Resolve the older deployed user-lookup compatibility risk before using legacy custom-list behavior as proof.

Only after these pass should broader background identity creation even be considered. No blanket deferral is recommended by this audit.

### Separately: repair the dormant collection verification and deployment issue

Obtain the exact Vercel exception and matching build trace; fix only the confirmed packaging/runtime cause after approval. Update the safety browser fixture to enable collections in isolation while preserving the real disabled flag. Version/coalesce caches only with the safety and cross-instance tests above. Require another explicit decision before collections are enabled.

### Last: reconsider progressive provider delivery only if needed

Repeat comparable baselines after the targeted identity improvement. If provider wait remains the dominant user-visible problem, scope a limited caller-compatible experiment with explicit ordering/selection/partial-state rules. Do not make a major search rewrite a prerequisite for the first improvement.

## Final status

The investigation and proposed implementation sequence are complete. **No optimization or speculative collections fix has been applied.** The confirmed avoidable-work mechanism is suitable for a narrowly scoped implementation proposal. Broad background persistence, progressive provider delivery, live collection classifier performance, and the exact Vercel production exception remain unproven as detailed above.
