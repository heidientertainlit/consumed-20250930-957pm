# Report/block repair regression baseline

## Purpose

This is a **test-only, pre-repair baseline** for the narrow reporting/blocking repair. It does not alter
application or production database behavior. The local wrapper is:

```sh
scripts/test-report-block-repair-baseline-local.sh
```

It initializes an empty PostgreSQL cluster in `/tmp`, applies the checked-in
migrations, runs transaction-rollback fixtures, and destroys the cluster on
exit. It reads no database URL, project credentials, or application data.

## What the local baseline covers

| Area | Test and assertion |
| --- | --- |
| Direct block RLS | `supabase/tests/user-blocks-read-access.sql`: authenticated users see only blocks they created; anonymous users see none; direct authenticated inserts are denied. |
| Friendship/block interaction | The wrapper applies `20260904000000_harden_friendship_mutations_and_search.sql`; the direct block fixture exercises its block trigger while the existing `scripts/test-security-migrations-local.sh` remains the fuller transition/concurrency regression test. |
| DNA privacy | `supabase/tests/dna-signals-read-access.sql`: owner and accepted unblocked friends can read synthetic raw signals, either block direction hides them, anonymous reads are rowless, and service-role extraction/scoring access remains available. The wrapper also applies the DNA profile helper migration used by the signal policy. |
| Analytics reporting RPC authorization | `supabase/tests/reporting-rpc-grants.sql`: every listed analytics reporting RPC is denied to `anon` and `authenticated`, but remains executable by `service_role`. This is separate from user Report/Flag submission. |
| Account-deletion authorization | The wrapper verifies the final deletion RPC is not executable by `authenticated` and rejects an authenticated call before the deletion fixture runs. |
| Account-deletion rollback | `supabase/tests/account-deletion-rollback.sql` invokes the actual `public.delete_account_transaction(uuid)` body from `20260914000700_provider_deletion_queue.sql`, as `service_role`, then rolls back. It checks target cleanup, unrelated-user preservation, immutable canonical provenance retention, provider tombstone/job compatibility, and transaction rollback isolation. |
| Feed visibility | Static source-contract checks confirm that `social-feed` reads blocks in both directions, filters blocked authors, excludes DNA comparisons from the main feed, and scopes a direct DNA-comparison request to its participants. |

The deletion harness intentionally supplies migration-derived table names,
columns, and referential actions needed by the existing rollback fixture. It
does **not** replace `delete_account_transaction` with test logic: the
checked-in production migration is executed verbatim.

## Existing baseline commands

The following existing commands are retained and were reported passing before
this baseline was added:

```sh
npm test
npm run check
scripts/test-security-migrations-local.sh
scripts/test-ugc-text-filter-local.sh
scripts/test-admin-block-alerts-local.sh
```

They are not edited by this work. In particular, the security migration script
continues to cover friendship transition authorization, search visibility,
DNA-profile RLS, and the send/block concurrency cases.

## After-repair regression command and results

The executable aggregate command is:

```sh
./scripts/test-report-block-repair-regressions.sh
```

It runs `npm test`, `npm run check`, the existing security/UGC/admin-alert
and report/block SQL harnesses, both report-flow modes, and a disposable
pre-seed migration fixture. The fixture seeds five valid legacy report rows
before applying `20260916010000_allow_user_content_reports.sql`, then checks
that the rows, RLS flag, policy catalog, table ACL, and role privileges are
unchanged while the `user` value is accepted and an invalid value remains
rejected.

The command was run after the repair and completed successfully with this
exact unit-test result:

```text
npm test
1..281
# tests 281
# pass 281
# fail 0
```

The exact aggregate milestones were:

```sh
npm run check
# exit 0

bash scripts/test-security-migrations-local.sh
# All isolated local security migration tests passed.

bash scripts/test-ugc-text-filter-local.sh
# All isolated UGC filter migration tests passed.

bash scripts/test-admin-block-alerts-local.sh
# All isolated admin block-alert migration tests passed.

bash scripts/test-report-block-repair-baseline-local.sh
# All isolated report/block repair baseline tests passed.

node scripts/test-report-block-flow-local.mjs baseline
# PASS: user reports reproduce the pre-migration five-type CHECK failure

node scripts/test-report-block-flow-local.mjs postrepair
# PASS: migrated content_reports stores post/comment/user and all five legacy types
# PASS: invalid report values are rejected without storage

./scripts/test-report-block-repair-regressions.sh
# PASS: pre-seeded report rows are unchanged after migration
# PASS: content_reports RLS remains enabled after migration
# PASS: content_reports policy catalog is unchanged after migration
# PASS: content_reports ACL is unchanged after migration
# PASS: post-migration CHECK contains user plus all five verified legacy types
# PASS: post-migration user report insert succeeds
# PASS: post-migration invalid content type remains rejected
# All report/block repair regressions passed.
```

## Actual handler and UI baseline

Before implementation changes, `node scripts/test-report-block-flow-local.mjs`
passed using the actual ReportSheet and extracted report-content, block-user,
and social-feed handlers, with an isolated PostgreSQL-backed Supabase adapter:

- Invalid authentication creates no report or block.
- ReportSheet payload reaches report-content and stores a content report.
- Duplicate report/block requests preserve one row.
- A user/profile report reproduces the existing five-type constraint failure.
- A successful block removes the author from the actual client cache updater
  and from the actual social-feed handler's returned posts.

The five-type constraint failure is the deliberately reproduced defect, not a
security invariant to preserve. The other passing assertions must remain passing.
The original unit-suite baseline is **257 passing tests**.

## Baseline limitations / NOT RUN

* The earlier read-only live metadata snapshot is available under
  `.agents/outputs/ugc-schema-inspection-20260915`. The deletion harness does not
  replay that entire catalog; its local schema is migration-derived. It must
  not be represented as a complete live-schema deletion test.
* **NOT RUN: live or staging database fixture execution.** No live mutation,
  deployment, or production connection is performed. The rollback SQL files
  are suitable for a separately authorized isolated database run.
* **NOT RUN: deployed Edge Runtime integration.** The separate handler harness
  executes source handlers with local adapters, not real Supabase Auth/PostgREST
  or the deployed Edge Runtime. It does not certify live configuration.
* **NOT RUN: historical moderation/admin workflow.** The Report/Flag submission
  path is tested locally as above; the undeployed historical moderation system
  is intentionally not restored or certified.
* **NOT RUN: all account-deletion dependencies against a catalog snapshot.**
  The fixture exercises the documented target/control paths. It cannot prove
  that every current live foreign key, trigger, extension, or later migration
  dependency is represented by this local fixture.

These are coverage limits, not passing claims. Any repair should retain the
passing local assertions and add an authorized integration test before claiming
live feed or moderation behavior is verified.