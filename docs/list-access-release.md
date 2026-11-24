# List access and Want To release

**Status:** locally implemented and rehearsed against synthetic PostgreSQL.
No hosted staging result, live SQL, production deployment, or Git operation is
implied. The approved Want To identifiers remain manifest-only approval.

## Isolation gate

Use an independently verified Supabase **project**, not a database/schema
inside production or the current Replit Preview. Verify the target project
reference and organization, database connection identity, API origin, Edge
environment, web host, and iOS build configuration before any staging write.
The current Preview config and older web/iOS bundle source contain hardcoded
production origins. A separate `VITE_SUPABASE_URL` alone is not proof of
isolation: check the built artifacts and capture/deny requests to live Supabase
and unrelated external providers before signing in or running any write
flows. Use staging-only secrets, synthetic users (including Auth users), and
synthetic import files. Do not import production rows, enable production
integrations/cron, or use the production-targeted Replit workflows. If the
build, API, database, or credentials cannot be tied to the verified stage
project, stop. A project reference is not a credential.

## Sequence

1. **Before either release:** rehearse both phases independently and together
   on the separate project. For a future approved production release, refresh
   the active RLS/grant/trigger inventory, actual deployed handler hashes and
   JWT settings, approved Want To manifest and dry-run evidence, logs, and
   receipt-based recovery readiness. Check for unexpected owner policies,
   affected supported versions, role/default grant drift, and working
   snapshots. Do not use the workspace-wide migration push.
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
4. **Verify supported clients before narrowing the database.** Release the
   combined web/iOS code only through the separately approved paths. New
   clients use the existing UUID Edge function with their verified session and
   the aggregate DNA eligibility in `compare-dna-friend`; they no longer count
   raw friend-library records or fall back to direct public-slug reads. An old
   direct owner PATCH still toggles public/private, and restores friend-only
   to friends-only. A binary that reads other users' raw rows can undercount or
   lose its sessionless private link; stop if it is still supported and neither
   the tested compatibility path nor an approved supported-version policy
   covers it. Do not reopen raw rows to preserve an old display.
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
by, the frozen Want To deploy. Prepare and clear staging for both releases
before scheduling them. The old direct-table exposure remains until step 5.
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
- Hosted verification still required: real JWT and PostgREST role/grant
  behavior, actual signup and recovery paths, authenticated/guest list shares
  and caches, old/new toggle, iOS versions, save/move, synthetic import
  write and dedupe, and a cold and cached authorized friend comparison. Run
  before/after aggregates and verify no unintended persisted changes. Check
  locks, policy query plans and latency with representative synthetic volume.
- Review active bypass routes, not just local files: both UUID hosts, public
  list lookup, feed enrichment and friend activity must not return protected
  rows. Test the legitimate privileged paths (owner-scoped import/list writes,
  aggregate stats/leaderboards, public share metadata, and authorized DNA
  evidence) for the same output contract and no raw library disclosure. Do
  not equate source inventory with verified hosting or client traffic.
