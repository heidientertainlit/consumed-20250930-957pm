# Five standard lists: local repair and approval-gated release

## Status and scope

**Local implementation only. Neither SQL file has been applied to the project database.**
No new list table, identifier column, translation store, or application-wide identifier rename.
The existing `lists` UUID, exact title and `is_default` model is retained.
`queue` remains a working API identifier for **Want To**. Existing `want_to` values remain valid.
All remains a virtual view. The five stored standard names are Currently, Want To,
Finished, Did Not Finish, Favorites.

The source changes are not a production repair until the separately approved SQL
and Edge Function releases are complete. Do not push/sync, run a production
migration, or deploy as part of this local work.

## Repairs

1. Keep one existing signup trigger and make its function delegate to
   `ensure_standard_system_lists`. Drop the duplicate trigger/function and unused
   HTTP-producing `create_default_lists` helper without CASCADE. Unknown database
   dependencies abort the transaction rather than being silently removed.
2. Enforce permanent system status at database writes/deletes, including direct
   client writes. Standard-name records cannot newly be inserted with a false
   flag. Historical wrong-flag rows remain protected and require reviewed repair.
   Actual Auth account-deletion cascades remain allowed only after their parent
   Auth row has been removed; a client-set maintenance flag cannot bypass protection.
3. Restore the existing rows through a serialized owner-authorized transaction,
   targeting the real partial unique index predicate. Do not swallow restoration errors.
4. Reuse the five title definitions across the existing creation/retrieval/tracking
   paths. Existing IDs, metadata, custom-history rows and associations are not discarded.
5. Normalize picker destinations when consuming cached data. A custom record's
   name does not suppress a missing system destination. Keep cache entries
   account-scoped; show fetch/save/restoration errors inline with retry.
6. Keep API slugs compatible while making exact title/status lookup consistent.
   Remove fuzzy move patterns that could confuse Finished with Did Not Finish.
   Public/shared retrieval uses personal lists, not obsolete `user_id=null`
   global records; public All is limited to visible lists.

Deployed-only `default-lists` and `create-user-list` writers now have local
explicit HTTP 410 replacements. Before approving their release, confirm current
traffic/old-client use. They may not recreate arbitrary or per-media definitions.

## Reconciled audit gaps

This is a revision of the existing prepared package, not another migration
architecture. The local disposition is:

| Existing path | Local disposition |
| --- | --- |
| Auth → `handle_new_user` → app user | Preserve existing account creation and unrelated side effects. One app-user trigger calls the existing restorer; Auth signup without an end-user JWT is covered in the isolated trigger chain. |
| `create_default_system_lists` | Delegates; no independent list array or INSERT loop. Trigger-function client execution is revoked. |
| `create_lists_trigger` / `create_default_lists_for_user` | Duplicate trigger and obsolete function removed in prepared SQL. No CASCADE; dependency drift is a stop. |
| Unattached `create_default_lists` | Obsolete HTTP helper removed in prepared SQL without CASCADE. |
| Generic `create_list(uuid,text,text,boolean,boolean,boolean,text,text)` | Existing signature retained as an explicit `LIST_CREATION_RETIRED` no-write shim; PUBLIC/anon/authenticated/service_role execution revoked. This preserves dependency structure without leaving the arbitrary writer behind. |
| `track-media`, `predictions`, `get-user-lists-with-media` | Independent provisioning loops removed; same owner-authorized restoration RPC. Existing app-user creation remains. |
| `get-user-lists-metadata`, `create-custom-list` | Shared recognition/restoration, exact canonical classification and explicit errors; no title-only adoption of custom records. |
| `import-media` | Personal destinations through the same restorer. Goodreads `want-to` maps explicitly to Want To; no global/ownerless or silent null destination. Import dedupe, ledger, ratings, and enrichment logic retained. |
| `move-item-to-list` | Exact owner/system/title lookup; no fuzzy match. Existing move/completion RPC retained. |
| `get-public-list`, `get-shared-list` | Both `queue` and `want_to` resolve to Want To while retaining owner/privacy checks. |
| `share`, `share-invite` | Both aliases display Want To; existing share behavior otherwise retained. |
| List-detail and server share metadata | Legacy aliases match canonical Want To, not historical Queue or a same-title custom row; ID/title-slug history remains available. |
| `delete-list` / database guard | All five names protected, including ambiguous legacy standard-title records; real Auth deletion cascade retained. |
| `default-lists`, `create-user-list` | Local HTTP 410 no-write replacements; release requires caller/traffic review first. |
| Old root `supabase_lists_schema.sql` | Historical incompatible schema, not referenced by current runtime/setup scripts. Clearly labelled and transactionally blocked from execution; old contents are not a supported bootstrap. Applied migration history is not rewritten. |

The generic RPC's successful execution under the current live schema/RLS was
not established. Its permissive signature/grants are verified, but this is not
an assertion that it was a working bypass. The shim is a proposed retirement,
not an authorized live permission change.

Other profile-provisioning handlers activate the one app-user trigger; they
must not add another direct list writer. The source-inventory regression scans
local Edge entrypoints for direct list INSERT/upsert chains and rejects a
`queue` → `Queue` lookup. It also verifies that prepared SQL has one provisioning
INSERT body. These source checks supplement, not replace, executed SQL/handler tests.

### Release blockers, not local completion claims

- Production request history/native caller coverage for the two legacy routes
  and generic RPC has NOT been established. Their retirement release is blocked
  until reviewed. If a supported standard-list caller exists, revise the existing
  route/RPC to delegate safely rather than silently break that client.
- Unknown SQL dependencies cause the prepared transaction to abort. Recheck
  all function signatures, grants, trigger attachments, schema privileges and
  dependencies immediately before release. Client roles must not be able to
  create arbitrary trusted database triggers.
- Historical Queue fixes cannot be reconstructed from the recorded migration
  statements; do not invent their order or assume these files were applied.
- The Preview/production display discrepancy is not proven to result from
  any single backend fault. Vercel build fixes remain separate.
- Ambiguous standard-title records, including the observed four-item non-system
  Want To example, remain unchanged until per-record provenance/approval.

## What the other four lists share

The audit found standard-title custom/non-system rows for Finished and Favorites
as well as Want To. A title by itself is not evidence that they were incorrectly
classified rather than genuine historical custom lists. Keep them untouched
when a canonical system row already exists. All five now have the same
creation, protection, complete-restoration and fallback invariants.

The old fuzzy Finished move match could also select Did Not Finish if Finished
was missing; this is now an exact system-list lookup, with an explicit failure
rather than moving to an approximate title.

## SQL package — PREPARED, not executed

- `supabase/manual/five-system-lists-foundation.sql`: transactional function and
  trigger definitions; role checks; permanent identity protection. No backfill
  of existing rows. Applying it is a schema change requiring separate approval.
- `supabase/manual/five-system-lists-data.sql`: candidate handling and whole-item/
  relationship fingerprints. It ends in **ROLLBACK** deliberately.
- `scripts/test-system-lists-local.sh`: starts its own disposable PostgreSQL
  server on a Unix socket. Does not read any project database URL/secret.

No startup/build hook runs either SQL file. Do not use the application's
`db:push` command to apply these changes. The project's migration history is
known to diverge; any approved application must isolate exactly this package.

## Fresh preflight required before approval

1. Reinspect the live definitions, role grants, triggers (including external
   side effects), indexes, all FKs and non-FK/JSON list/item references. Compare
   active Edge source with local code; local files do not establish live behavior.
2. Rerun the all-account census with personas and auth-only accounts separated.
   Prior counts are not a migration manifest. Confirm ownership, title, flag,
   item counts, visibility, collaborators, shared links and timestamps.
3. Individually review every non-system standard-name record lacking a
   canonical counterpart. The approval table is EMPTY by default. Do not populate
   it by title alone. Record approved list UUID, owner UUID, and exact title
   outside source control. Ambiguous or genuine custom records are not auto-promoted.
4. Classify every Queue record. Only exact Queue with `is_default=true` is
   eligible for the legacy path. Custom Queue stays untouched.
5. Produce and review per-account expected operations. Keep identifiers and
   metadata receipts in access-controlled operational storage, not Git/chat.
6. Verify Supabase recovery/PITR availability/retention with the owner. Replit
   checkpoints are not assumed to protect this external database.
7. Rehearse against the frozen live schema and representative synthetic data.
   The included local fixture covers the relevant partial indexes, FKs, roles
   and identity behavior, not a full clone of every production policy/trigger.

## Data handling

- **Queue only:** rename the same system row to Want To. Preserve UUID, share ID,
  owner, items, progress, metadata and relationships.
- **Existing canonical Want To plus EMPTY Queue system row:** demote the empty
  Queue row to historical/non-system status. Preserve its UUID, title, share ID
  and existing relationships; do not delete or recreate it. Active consumers
  use the canonical Want To. Existing source links still refer to that
  historical record; no new redirect/identifier layer is introduced.
- **Both contain items, or source has collaborators:** abort for reviewed merge
  handling. The package does not claim that these cases were automatically merged.
  This is deliberate data preservation, not silent success.
- **Wrong-flag standard row:** promote IN PLACE only if its exact UUID/owner/title
  is approved. If another canonical system row exists, abort rather than
  adopting or overwriting the historical row.
- **Missing standard row without ambiguity:** insert one with the correct name,
  preserving all existing rows.
- **Other obsolete system names, including per-media lists:** abort for review,
  rather than silently keep a sixth system destination or reclassify history.

If fresh data requires a nonempty merge, block release of that account until a
separately reviewed merge maps every source/survivor item and dependent row.
Use canonical/provider identity with compatible media/TV scope, never title-only
matching. Do not discard conflicting notes/progress or rely on CASCADE/SET NULL.
Current safe migration never changes list_items, so it cannot create item
duplicates or delete existing duplicate history.

## Approval-gated execution order

1. Obtain explicit approval for exact SQL, candidate classification, maintenance
   window, Edge deployment set and release sequence. Local acceptance is not approval.
2. Establish a write fence covering direct clients and service writers; check
   scheduled jobs and old clients, not only the current UI.
3. Apply foundation transaction, then run the data file in its default ROLLBACK
   mode with the reviewed approval input. It takes bounded table locks and fails
   on ambiguity/drift. Any statement/lock error is a stop condition.
4. Inspect its inverse receipt, counts and relationship checks. On a second,
   explicitly approved pass, replace only the final ROLLBACK with COMMIT.
   Save the receipt and original changed-row metadata securely.
5. Deploy ONLY the reviewed Edge changes after the SQL function exists and
   PostgREST schema cache has been refreshed. Verify active source/hash and
   behavior, not just a success message/version increment.
6. Release the frontend through the user's normal manually controlled process.
   Verify supported native/web clients and public/shared routes. Reopen writes
   only after the acceptance checks pass.

The affected Edge set is create-custom-list, get-user-lists-with-media,
get-user-lists-metadata, track-media, predictions, import-media, move-item-to-list,
delete-list, get-public-list, get-shared-list, share, share-invite, and the two
retired creation routes. Functions
importing the shared system-list module must be bundled with that dependency.
Do not bulk-deploy unrelated functions. Check deployed source independently for drift.

## Before/after assertions

- Every preexisting list UUID and owner remains present.
- Whole-row list-item fingerprints and counts are identical, including item IDs,
  list IDs, canonical/provider identity, dates, notes and progress.
- Dynamically discovered FK-dependent tables and known text-ID relationships
  have identical content fingerprints. Newly discovered JSON/application
  references must be reviewed during preflight as well.
- Genuine custom lists are unchanged. Approved standard-row flag repairs are
  the only custom-classification changes.
- Every fully provisioned eligible account has exactly five canonical names,
  with one system row per name. No Queue system row remains.
- Source/survivor IDs, share links and permission behavior are checked individually.
  Retired historical rows are not represented as live system destinations.
- Repeat execution is a no-op (review approvals accept already-repaired rows).
- New signup, missing-list restoration, save/move, review follow-up, public/shared
  reads and both old `queue`/existing `want_to` inputs work.
- Rehearse the actual account-deletion transaction against the frozen production
  schema as well as the included Auth-cascade/control fixture.
- No restoration error is returned as a successful empty list response.

## Rollback

**Before commit:** any assertion failure aborts the transaction. Default data
execution always rolls back. Fix the cause in isolation before trying again.

**After data commit, before reopening writes:** keep the write fence. Use the
saved receipt to verify each changed row still has the expected migrated
title/flag/owner; inspect new canonical rows and all dependents. An approved
inverse may restore original classification/title in place under the privileged
maintenance context, with the same item/relationship fingerprint assertions.
Never delete newly created lists that have acquired items/references. Do not
change genuine custom data. Reverting legacy Queue titles also requires retaining
the write fence and explicit approval; it is not a safe running-app state.

The local tests rehearse data rollback, reviewed classification inversion,
repeat execution and failed dual-list handling. A full production-schema inverse
must be rehearsed with the actual receipt before production approval.

**After writes resume:** do not blindly replay inverse SQL or restore the whole
database over newer user activity. Fence affected writes, compare the receipt
against current data, preserve post-migration additions and apply a reviewed
targeted correction. Use verified provider recovery only as an approved disaster
recovery action with the impact on newer data understood.

Application rollback must not reinstall Queue-creating triggers or silently
swallow restoration errors. Keep the compatible API contracts and corrected
database protections while reverting unrelated frontend changes if necessary.

## Local verification commands

```sh
bash scripts/test-system-lists-local.sh
npm test
npm run check
npm run build
node scripts/test-quick-track-position.mjs
```

The database fixtures cover all five classifications, genuine custom Queue,
legacy Queue with saved content and relationships, fresh signup, concurrent
restoration, authorization, direct insert/delete/demotion protection, dry-run
rollback, idempotency, empty dual-list preservation and blocked nonempty merges.
Auth account-deletion cascades and unrelated-user preservation are also tested.
Browser tests use isolated mocked auth/network; they are not proof of live
signed-in behavior or physical-iPhone operation.

The SQL fixture additionally covers retirement dependency failure/rollback,
generic RPC permissions/no-write behavior, real-shaped Auth-to-app-user signup
without a JWT, retained unrelated signup effects, all five missing-list cases,
service-write bypass rejection, and halfway data-repair rollback. The handler
fixtures execute actual track-media, predictions and import request handling;
provider responses/auth are synthetic and no live-user writes are made.

### Measured local results for the reconciled repair

- `bash scripts/test-system-lists-local.sh`: passed, 83 explicit database
  assertions, including repeat foundation/data execution, real-shaped signup
  chain, concurrency, unknown-dependency rollback, halfway rollback, and blocked
  obsolete bootstrap execution even when the SQL client continues after errors.
- `npm test`: 728 passed, zero failed/skipped. Actual handler tests cover both
  tracking aliases, provisioning retries, personal import destinations,
  review-required import failure before item writes, public/shared lists,
  classification, retired routes and deletion protection.
- `npm run check`: passed.
- `npm run build`: passed, including the unchanged progress-dialog gate
  (72 layouts), modal gate (30 layouts/interactions), and profile-safety gate.
- `node scripts/test-quick-track-position.mjs`: passed, including complete and
  incomplete shared-cache Want To destinations, restoration failure, review
  retry/no-duplicate-save behavior, and mobile/desktop interaction simulations.

These are local results only. SQL, Edge handlers and frontend assets have not
been released by this work. No Git operations were performed. No live list or
classification was repaired, and no successful Vercel release is claimed.
