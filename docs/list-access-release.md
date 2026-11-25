# List access and Want To release

**Status:** rehearsed locally with synthetic data in Supabase Auth, PostgREST,
PostgreSQL, Edge Runtime, and an isolated Chromium harness. The exact shipped
iOS builds, managed routing, and other hosted release gates remain unverified.
No live SQL, push, or deployment is authorized here. The approved Want To
identifiers remain manifest-only approval.

## Local rehearsal without infrastructure changes

Replit Preview and Vercel intentionally use the same live Supabase project.
Do not repoint either, use Preview as a rehearsal, or create another hosted
project. Use a disposable work directory on a machine that can run the full
Supabase CLI stack. Initialize it locally, without linking a remote project
or loading production secrets. Start it with local Postgres, Auth, PostgREST
and Edge Runtime. Bootstrap a reviewed, schema-only baseline with the relevant
roles, grants, extensions, constraints, triggers, indexes and policies; do
not replay the entire migration directory on the assumption that it matches
the current hosted schema. Use only synthetic Auth users, data and imports.

Before hitting any route, verify the local API and database addresses and
use only local-issued keys and sessions. For browser/iOS tests, use disposable
test builds or an intercepting test harness. Hardcoded production destinations
make a `VITE_SUPABASE_URL` override insufficient: inspect the built artifacts,
fail requests outside the local allowlist, and prove the guard before
signing in or attempting writes. Use fixtures for external providers; do not
enable production OAuth, cron, notifications or analytics. This is a test
setup, not a change to the project's regular development architecture.

Exercise actual HTTP requests with the guest key and valid/invalid Auth
sessions; test direct table reads, RPC grants and schema-cache refreshes,
and invoke the unmodified release handlers in the appropriate release order.
Cover guest, owner, accepted/pending friend, collaborator, both block
directions and unrelated accounts, including privileged reader outputs. Test
list create/add/move, both visibility paths, aliases and UUID links, feed
enrichment, synthetic signup and import/dedupe, DNA readiness and cold/cached
comparisons. Diff the records before/after, exercise recovery on synthetic
data, and measure locks/plans with representative fixture volume. The local
stack can test route responses and cache headers, not Vercel's live routing,
managed JWT gateway settings, or real crawler caches. An isolated test build
does not certify a shipped binary with a hardcoded production origin.

## Sequence

1. **Before either release:** finish local rehearsal independently and
   together, and verify supported clients and remaining browser checks.
   Then, with approval for read-only hosted inspection, refresh the existing project's RLS/grant/
   trigger inventory, actual deployed handler hashes and JWT settings,
   supported client versions, live routes, current Want To manifest and
   backup/recovery readiness. Stop on drift, routes that cannot be accounted
   for, or missing recovery evidence. Do not use the workspace-wide migration
   push. Neither this plan nor the shared Preview authorizes hosted work.
2. **Want To first.** Use only the frozen package and its
   [five-list runbook](five-system-lists-release.md). Atomically install its
   foundation and list/item write pause. Run the rollback-only repair, and
   separately approve the exact manifest and operation fingerprint before
   committing. Save the committed receipt; dry-run IDs cannot substitute.
   After PostgREST verification, deploy only the 11 corrected Want To Edge
   functions with verified JWT settings; retire `default-lists` and
   `create-user-list` last after compatibility checks. Resume writes and
   verify save/move, signup, imports, aliases, and sharing. Use the frozen
   Want To baseline for this stage, not the combined web or Edge bundle.
3. **Prepare security on the verified Want To baseline.** Apply
   `supabase/manual/list-access-1-prepare.sql` as the approved database release
   role. It installs the private predicate, narrow legacy owner trigger, and
   temporary `service_role` ID-only bridge; no row is rewritten and existing
   policies are still in place. Wait for a real PostgREST schema-cache reload
   and prove the bridge works as service but not as guest or ordinary user.
   Deploy `get-public-list`, `get-shared-list`, `get-user-lists-with-media`,
   `get-user-lists-metadata`, `social-feed`, `get-friends-consuming`,
   `get-user-stats`, `compare-dna-friend` and `update-list-visibility`. The
   Express UUID handler must also be updated wherever it is actually hosted.
   Use `LIST_ACCESS_ENFORCEMENT=bridge` (the default) on Edge and Express;
   a missing bridge in this mode denies access, not an unfiltered fallback.
   Confirm active hashes and drain the old service-backed readers.
4. **Verify supported clients before narrowing the database.** Keep the
   user's manual Replit Sync/Push and existing automatic Vercel release;
   the combined frontend must not go out before the compatible readers
   are verified. Any web or iOS release is separately approved. New
   clients use the existing UUID Edge function with their verified session and
   the aggregate DNA eligibility in `compare-dna-friend`; they no longer count
   raw friend-library records or fall back to direct public-slug reads. An old
   direct owner PATCH still toggles public/private, and restores friend-only
   to friends-only. A binary that reads other users' raw rows can undercount or
   lose its sessionless private link; stop if it is still supported and neither
   the tested compatibility path nor an approved supported-version policy
   covers it. The frozen web source still includes a same-origin UUID fallback
   without a session header; source alone does not establish which installed
   builds use it or where that route is active. Do not reopen raw reads to
   preserve an old display.
5. **Cut over once.** Apply `supabase/manual/list-access-2-cutover.sql` in one
   transaction. It amends `final_lists_select` and `final_items_select` and
   drops exactly seven obsolete reads. Lock timeout or unexpected policy/role
   definitions are stop conditions. Check direct PostgREST access before
   changing any host to `rls`. Do not allow anonymous or unrelated friend reads
   of private/unfiled rows; retain owners' imported history, explicit private
   collaborators, public lists and accepted friend-only access, with blocks in
   either direction. Recheck active hashes, query plans and latency.
6. **Retire the compatibility bridge.** Set `LIST_ACCESS_ENFORCEMENT=rls` on
   all active readers only after verifying the corrected policy state. Re-run
   the endpoint matrix in `rls` mode; prove no active deployment needs the
   bridge. Then apply `supabase/manual/list-access-3-retire-bridge.sql`, reload
   PostgREST and repeat checks. Keep the owner toggle trigger until one-field
   clients are no longer supported. No public RPC or duplicate visibility
   predicate remains. No planned outage is expected for security if bounded
   attempts succeed; Want To's deliberate list/item write pause is separate.

The four overlapping Edge readers are updated **after**, never overwritten
by, the frozen Want To deploy. Clear the local checks and preflight for both
repairs before scheduling either. The old direct-table exposure remains
until step 5; on a scoped hosted check failure, stop rather than advancing.
Keep an ownerless private-flagged record unpublished unless its intended
audience is explicitly resolved.

## Recovery

- **Want To before commit:** stop on mismatched receipts or inventory; the
  rollback-only run leaves the data unchanged. If a committed run fails its
  checks before resuming writes, keep the write pause; use the Want To runbook
  and its exact committed, fingerprinted receipt. Never restore the two
  retired creation writers into an open-for-writes app. After writes resume,
  compare newer activity and prepare a targeted, separately approved fix.
- **Security before cutover:** on handler failure, stop. Keep the bridge and
  repair or restore a verified bridge-compatible version. A lock timeout
  leaves the old policies unchanged; retry a bounded transaction after the
  lock is resolved. Do not revert to a privileged list reader.
- **Security after cutover:** retain the corrected policies. While the bridge
  exists, a verified compatible reader can temporarily use `bridge` mode
  without widening database access. After retirement, prefer a verified
  `rls`-mode bundle. If needed and separately approved, restore only the
  service-only function definition and its grants from the reviewed prepare
  SQL under the original release owner, then reverify ACLs and refresh the
  gateway before switching a reader back. Do **not** rerun the full prepare
  file, reinstall broad policies, or deploy the older Want To reader bundles.
- **Data:** the security steps do not change stored rows. The combined
  release does not delete user data. Use fingerprints and receipt comparisons,
  never a blanket reverse or wholesale restore over newer user activity.

## Verification record and outstanding gates

For the authorized November 25 UTC live read-only inspection, see
[Production preflight](list-release-production-preflight.md). It confirms
manifest and frozen Edge baseline stability, but identifies the live web
client's raw-row DNA picker and obsolete UUID fallback as dependencies that
must be replaced before security cutover. Installed iOS/WebKit and Vercel
administrative recovery evidence remain explicit gates; no production
changes were performed.

- The local guarded build passed the unchanged Chromium checks for progress
  dialogs (72 layouts), modal foundation (30 layouts), and profile safety
  menus. The quick-track browser suite also passed, including the mounted
  reduced-motion transition and its haptic assertions. The isolated build
  kept Replit's non-secret loader/audit settings while excluding application
  credentials. The separate WebKit test could
  not start on this host because its required native libraries are missing;
  run the unchanged check on a supported Mac or Linux environment rather than
  disabling it or treating Chromium as Safari/iOS certification.
- Local integration: actual tracked security SQL and handler sources (not
  text overlays), executed against disposable PostgreSQL with synthetic
  records. Tested bridge/old RLS, bridge/corrected RLS, RLS-only/bridge removed,
  and actual frozen Want To foundation, dry-run fingerprint, synthetic commit,
  and resume followed by the complete security sequence. Includes both UUID
  readers, public aliases/All/custom links, feed list enrichment, library and
  metadata, friend activity and aggregate stats, owner visibility updates,
  collaborator/block roles, import-ledger preservation, readiness and cached
  friend comparisons. Local adapter runs real PostgreSQL queries but is not
  PostgREST, Supabase Auth, an installed app, or an external import provider.
  Reproduce with `bash generated-artifacts/list-permissions-review/run-implementation.sh`
  when the local frozen packet and fixture are present.
- The native Supabase rehearsal used a separate, unlinked temporary work
  directory, an empty app schema, and synthetic accounts. Real Auth issued
  sessions; real PostgREST exercised grants, write paths and schema reloads.
  The actual frozen and corrected handlers ran in Supabase Edge Runtime,
  behind a loopback-only test dispatcher because the experimental CLI router
  did not resolve the test handlers. The test dispatcher does not stand in for
  managed JWT routing. The harness uses the workspace Supabase JS package
  and a `Deno.serve` adapter, and refuses off-loopback provider requests.
  Reproduce with `bash generated-artifacts/list-permissions-review/run-native-rehearsal.sh
  <disposable-workdir> <native-supabase-cli>` once the unlinked test fixture
  and official service archives are present. The review README records the
  prerequisites; no app dependencies or workflows are required to change.
- Want To ran before security. The exercise checked the paused, rollback-only
  dry run, the fingerprint-approved local commit and receipt, signup during the
  pause, original item IDs and row fingerprints, `queue`/`want_to` and UUID
  compatibility, the two no-write endpoints and resumed writes. A synthetic
  Goodreads CSV added an item to Want To with receipt metadata; reimport
  skipped it. ZIP parsing and provider enrichment were not tested in this
  harness.
- The cleanup kept preparation separate from the atomic policy swap, tested
  bridge and RLS readers on the same data, and verified bridge retirement
  without changing item, collaborator or import-batch fingerprints. Real API
  checks covered permitted and denied sessions, list-linked feed content,
  the old direct owner toggle, the new owner route, and DNA readiness and
  cold/warm comparison with seeded signals. Chromium exercised the actual
  list page and current DNA readiness client with synthetic sessions through
  those APIs; the harness does not represent a complete signed-in app or a
  shipped web or iOS artifact.
- After bridge retirement, a synthetic owner added a canonically identified
  item, moved it using the legacy `queue` target, and repeated the move using
  the same request ID without a second mutation. Another account with a
  valid destination could not move the item. A local authenticated read plan
  with 1,000 extra lists and 10,000 extra items planned in 0.287 ms and
  executed in 1.03 ms on that run. This covers one synthetic query, not
  production latency, the live index inventory, or cutover lock readiness.
- Verify supported client behavior before cutover. If an older supported
  client relies on broad reads and cannot be certified, do not proceed
  until there is a verified compatible path or a separately approved
  support/version decision. Do not widen reads as a compatibility fix.
- Hosted-only preflight on the existing project: active bundle hashes/JWT
  configuration and rollback material, hosted roles/grant drift, current
  manifest and production backup, active Vercel routes/cache headers and
  supported versions, baseline logs and lock readiness. The approved Want
  To fingerprint dry run is a separate operation even though it rolls back:
  it takes locks and requires the approved write pause.
- At each separately approved production checkpoint, verify the hosted
  gateway sees the expected RPC and policies, active hashes and JWT routes
  match, guest/private cache behavior is correct, locks and latency are
  acceptable, and receipt-backed counts and privacy probes pass. Any write
  smoke tests use only authorized test accounts. Record what the currently
  served web and supported installed apps actually did. If a checkpoint fails,
  use the phase-specific recovery above; never reopen broad reads.
- Test public-to-private transitions both on a fresh list-preview request and
  after a public preview has been cached. The existing Open Graph HTML permits
  `max-age=60, stale-while-revalidate=300`; a correct uncached denial is not
  evidence that existing Vercel or third-party preview caches have expired.
  Stop if hosted caches still expose protected metadata beyond the approved
  cache behavior, and do not assume an external crawler can be purged by
  changing Supabase policies.
- Review active bypass routes, not just local files: both UUID hosts, public
  list lookup, feed enrichment and friend activity must not return protected
  rows. Test the legitimate privileged paths (owner-scoped import/list writes,
  aggregate stats/leaderboards, public share metadata, and authorized DNA
  evidence) for the same output contract and no raw library disclosure. Do
  not equate source inventory with verified hosting or client traffic.
