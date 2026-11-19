# Search identity optimization: development results

**November 18, 2026, America/Denver; measurements November 19 UTC. Development only.**

## Outcome

Implemented the approved 30-of-60 correction locally. Known identity lookup now covers 60 eligible results. A separate constant preserves the existing 30-result synchronous resolution budget. Concurrency remains four; the separate background limit remains six.

No broad identity deferral, fingerprint-link optimization, provider/ranking changes, safety-policy changes, application collection enablement, production schema changes, production writes, deployment, Vercel connection, or Git network operations were performed for this implementation. The newer local positive-clearance safety filtering and typed TMDB paths remain in both the comparison baseline and candidate.

**The Edge Function source is local and undeployed. The ordinary development app still uses its configured Supabase endpoint; restarting the development web server does not deploy this Edge Function.**

## Controlled comparison

These are **local fixture measurements, not production or authenticated-browser timings**:

- Real search, track-media, rate-media, inline-post and add-media-to-list handlers are bundled from application source.
- HTTP search/save/rating requests reach those handlers through an isolated local server.
- An actual disposable PostgreSQL instance executes canonical tables, the bulk RPC, identity-stamping triggers, constraints and queries.
- Provider results, classification decisions, authentication and the Supabase client transport are fixtures. Unknown provider destinations throw; no live provider requests or real-user writes are needed.
- The PostgreSQL-backed client adapter does not reproduce PostgREST transport, field projection, RLS enforcement, Supabase network latency, Edge hosting, real provider/model latency, or signed-in mobile/browser behavior. Its query adapter returns complete rows even where an SDK caller requests selected fields.
- There are no artificial latency delays. Each phase uses the same fixture data, handlers, local database setup, queries and database-state scenarios. Five measured trials run per combination: two query fixtures × All/Movies/TV/Books × known/new/mixed = **120 trials per phase**.
- Database state resets between trials. “Known” means all returned aliases/fingerprints exist. “New” means none do. “Mixed” seeds the first 15 and positions 41 onward where present; this intentionally includes known titles beyond position 30.
- Each trial measures search, then immediate tracking, then rating with review, before explicitly draining search background work. Additional cases exercise simultaneous tracking/rating. These are sequential phase measurements, not randomized, blinded or statistically conclusive latency estimates.

The unchanged workspace search was captured before the application edit, rather than using the older deployed search that lacks newer safety work.

| Source | SHA-256 |
| --- | --- |
| Baseline search | `4357f722bc8bc627c2e9488257b523e30d247a363b20e849bf4201336597f737` |
| Candidate search | `a9c32326e12747e514365223e95ae1e9cd7753af591ea47b58b0dfb195c98291` |

The baseline matches `supabase/functions/media-search/index.ts` at local commit `7e5f06adc0550f3de0630e7a641411451ea945ff`. No Git remote access was used to obtain it.

## Measured results

All values below are medians in milliseconds; five trials per cell. Query labels refer to synthetic provider catalogs matching those queries, not live searches for those titles.

| Query fixture | State | Search before → after | Immediate save before → after | Rating + review before → after |
| --- | --- | --- | --- | --- |
| Dune, All | Known | 67.15 → 23.37 | 17.76 → 23.32 | 17.59 → 20.72 |
| Harry Potter, All | Known | 59.31 → 18.84 | 17.69 → 19.67 | 17.01 → 17.23 |
| Dune, All | New | 118.09 → 120.46 | 43.77 → 41.97 | 17.88 → 18.02 |
| Harry Potter, All | New | 116.41 → 117.61 | 38.77 → 43.44 | 17.03 → 18.93 |
| Dune, All | Mixed | 112.14 → 109.79 | 23.53 → 25.39 | 18.83 → 19.35 |
| Harry Potter, All | Mixed | 110.12 → 104.78 | 25.29 → 25.47 | 17.92 → 18.06 |

Known All search medians fell **65.2%** and **68.2%**. The stronger deterministic result is that a fully known 60-result page needs **zero individual synchronous alias reads after the bulk RPC, versus 30 before**.

Known typed-search medians, pooled across the two query fixtures, were Movies **15.46 → 15.17 ms**, TV **15.30 → 15.77 ms**, and Books **13.53 → 12.51 ms**. These catalogs fit within the old 30-result lookup window, so little benefit is expected.

Cold and mixed results show no comparable improvement. Some save/rating medians increased by a few milliseconds, including Dune's known save increasing by 5.56 ms. The benchmark does not establish the reason or prove downstream latency equivalence. No saving/rating handler was modified. Do not interpret these local numbers as evidence of a production speedup, universal improvement, or absence of downstream performance risk.

In mixed results, finding more known identities can allow the unchanged 30-slot resolver budget to resolve more genuinely new identities instead of spending slots revisiting known ones. Keeping the cap unchanged does not imply identical write counts for every mixed page.

## Correctness and regression checks

Both baseline and candidate passed **13 focused contract/safety cases and 120 HTTP search/save/rating trials**:

- Known-page boundaries: 0, 1, 29, 30, 31, 59 and 60 results.
- Known, new and mixed identity states; failed bulk RPC with bounded fallback.
- Synthetic book-series/model-only results excluded from canonical batch lookup.
- Actual search handler with blocked and uncertain classification results: withheld titles never receive persisted aliases; uncertainty retains partial-result reporting.
- The newer movie/TV typed provider paths and safety classifier execute.
- Result order, type and provider IDs remain consistent within each fixture catalog.
- Known fingerprint records and source metadata remain unchanged.
- A new final result on a 60-result page remains outside the 30-item synchronous budget; immediate save and rating still create consistent identity links.
- Saved list items, ratings and published review posts share a canonical identity; review text, spoiler flag and half-star rating survive.
- Duplicate save, rating edit and rating deletion work; deleting a rating preserves the saved list item.
- All five system-list destinations and the dedicated list endpoint work.
- Unrated inline thoughts work. A direct-client-style insert exercises the real trigger and cannot override the authoritative provider alias with a fabricated canonical ID.
- Competing immediate save/rate requests resolve to the provider alias's canonical identity.
- Unexpected SQL/schema errors fail the runner rather than being treated as successful actions.

Also passed:

- **50 existing focused tests** covering canonical media, catalog safety/classification, media search, collections and book-series helpers.
- Existing Track and app-bar browser fixtures at mobile and desktop sizes, with collections disabled and book-series behavior preserved.
- Collection safety browser fixture at mobile and desktop sizes, including blocked direct IDs, cached-content isolation and blocked artwork. Its dormant collection UI is enabled **only in the isolated in-memory test bundle**; an assertion requires the real application's collection flag to remain false.
- Full `npm run build`, including the existing progress-dialog, shared-modal and profile-safety browser gates.
- Development workflow restart and public mobile sign-in screenshot: the app renders without a manifest runtime failure. Signed-in production UI was not verified by that screenshot.

These checks do not substitute for real Supabase role/RLS, production provider/model, or native-device verification.

## Fingerprint-link recommendation

**Do not implement fingerprint-link optimization yet.** This change removes the confirmed known-page lookup mismatch without changing identity persistence policy.

Exact-alias fingerprint linking and the existing background resolver remain unchanged. The present measurements do not isolate the production cost of the remaining link PATCH, and they do not show improved save/rating latency. Measure remaining identity work separately from real provider/safety wait before deciding whether a narrowly scoped, equality-guarded redundant-link write reduction is worthwhile. Do not broadly defer identity creation or remove repair writes on the strength of this fixture benchmark.

## Collections HTTP 500: investigation only

No collections application code or production configuration was changed.

Local evidence:

1. `api/movie-collections.ts` imports the server handler. The newer server handler adds runtime imports from shared safety modules; the older version's shared import was type-only.
2. A controlled unbundled JavaScript build of the current wrapper and modules fails under Node with `ERR_MODULE_NOT_FOUND` for the extensionless shared `catalog-content-safety` import.
3. A bundled build imports successfully and returns **204** for OPTIONS.
4. The pre-safety server version imports successfully when compiled without bundling.
5. Local `vercel.json` has no function-specific collections packaging configuration, and the local `.github` directory contains no workflow files. This does not reveal Vercel dashboard settings or prove what artifact was deployed.
6. Previously observed production GET, OPTIONS and POST platform-level 500 responses remain distinct from the normal handler's 204 OPTIONS / 405 unsupported-method behavior. Missing-key and upstream error handling would normally return 503 and 502 respectively.

**Conclusion:** import/packaging failure is a locally demonstrated possibility, not a confirmed production cause. The actual deployment's exception, runtime, commit and build configuration are still missing. Do not label the endpoint fixed or make speculative production changes.

### Exact Vercel dashboard retrieval steps

The user retrieves this evidence; Replit must not connect to Vercel.

1. In the Vercel dashboard, select the project serving **app.consumedapp.com**.
2. Open **Logs** in the project sidebar. Filter **Environment → Production**, **Request Path → /api/movie-collections**, and **Status Code → 500**.
3. Open a failed request. Copy its exception message and stack trace, UTC timestamp and request ID.
4. If older requests are no longer retained, open `https://app.consumedapp.com/api/movie-collections?query=Where%20the%20red%20fern%20grows` once in another browser tab, then inspect the fresh failure.
5. From **Deployments**, open the deployment associated with that request. Include its deployment ID/URL and Git commit, and the function's Node/runtime version if shown. Inspect **Build Logs** for `movie-collections`, missing modules or bundling errors.
6. Redact credentials, authorization headers, cookies and personal information before sharing the evidence.

Vercel documentation distinguishes runtime logs in the project sidebar from build logs attached to deployments. Log retention depends on plan, and displayed log timestamps are UTC.

References: https://vercel.com/docs/logs/runtime and https://vercel.com/docs/functions/logs .

## Reproduction and retained evidence

Run the fixture from the repository root with the existing Node dependencies and PostgreSQL binaries (`initdb`, `pg_ctl`, `postgres`) available:

```sh
node scripts/check-search-identity.mjs --before
node scripts/check-search-identity.mjs
```

The `--before` command expects the captured baseline at `generated-artifacts/search-identity/before.ts`. On a clean checkout, obtain that exact file from the baseline local commit listed above; verify its hash before comparing. The normal command tests current local source without requiring a baseline file.

The runner creates a private temporary PostgreSQL instance using a Unix socket with no TCP listener, never reads environment database credentials, and stops/removes that instance on completion. Its schema is a disposable test fixture, not an application migration.

Raw measurements are retained in `generated-artifacts/search-identity/before.json` and `after.json`. That ignored directory also holds the baseline source and controlled collections-packaging reproduction. The accompanying self-contained HTML report embeds both raw measurement sets for inspection.
