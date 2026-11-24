# Five standard lists: local repair and approval-gated release

## Status and scope

**Local implementation only. No SQL in this package has been applied to the project database.**
No new list table, identifier column, translation store, or application-wide identifier rename.
The existing `lists` UUID, exact title and `is_default` model is retained.
`queue` remains a working API identifier for **Want To**. Existing `want_to` values remain valid.
All remains a virtual view. The five stored standard names are Currently, Want To,
Finished, Did Not Finish, Favorites.

The source changes are not a production repair until the separately approved SQL
and Edge Function releases are complete. Do not push/sync, run a production
migration, or deploy as part of this local work.

## Repairs

1. Keep one signup trigger on `public.users`. Its private trigger function and
   the existing public restoration RPC share one private provisioning body.
   Drop the duplicate trigger/function and unused
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
   global records; public All is limited to visible lists. Friend reads check
   accepted friendship and blocking in both directions, with private lists
   excluded from metadata, items, and virtual All totals. List preview metadata
   no longer depends on the nonexistent `lists.description` column.

Deployed-only `default-lists` and `create-user-list` writers now have local
explicit HTTP 410 replacements. Before approving their release, confirm current
traffic/old-client use. They may not recreate arbitrary or per-media definitions.

## Reconciled audit gaps

This is a revision of the existing prepared package, not another migration
architecture. The local disposition is:

| Existing path | Local disposition |
| --- | --- |
| Auth → `handle_new_user` → app user | Preserve existing account creation and unrelated side effects. One app-user trigger calls the existing restorer; Auth signup without an end-user JWT is covered in the isolated trigger chain. |
| `create_default_system_lists` | The old public function is removed; the retained signup trigger uses an owner-only routine in `list_provisioning_private`. No independent list array or INSERT loop. |
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

- The reviewed deployed web and workspace iOS bundles and available request
  history showed no calls to the two legacy routes or generic RPC. This does
  not establish coverage of dormant clients. Recheck traffic immediately before
  retirement; if a supported standard-list caller exists, have the existing
  entrypoint delegate safely rather than silently break that client.
- Unknown SQL dependencies cause the prepared transaction to abort. Recheck
  all function signatures, grants, trigger attachments, schema privileges and
  dependencies immediately before release. The private namespace must be absent
  or already owned exclusively by the release role; unexpected grants abort.
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
- `supabase/manual/five-system-lists-pause-writes.sql` and
  `five-system-lists-resume-writes.sql`: temporary statement triggers covering
  `lists` and `list_items`, including existing clients, RPCs and service jobs.
  They grant no permissions and do not change existing RLS. Only owner
  maintenance is exempt; the genuine Auth session can still insert the five
  empty signup lists through the private trigger. Retries through service-based
  app-profile recovery may need to wait until writes reopen.
- `supabase/manual/five-system-lists-rollback.sql`: rehearse or reverse the exact
  committed list changes from their receipt, without restoring insecure or
  obsolete functions. Defaults to **ROLLBACK**.
- `scripts/test-system-lists-local.sh`: starts its own disposable PostgreSQL
  server on a Unix socket. Does not read any project database URL/secret.

No startup/build hook runs this SQL. Do not use the application's
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
   checkpoints are not assumed to protect this external database. The reviewed
   project showed seven daily backups and no PITR; recovery is a disaster fallback.
7. Rehearse against the frozen live schema and representative synthetic data.
   The included local fixture covers the relevant partial indexes, FKs, roles
   and identity behavior, not a full clone of every production policy/trigger.

## Classification decision approved for a future release

On 2026-11-23 (America/Denver), the owner approved the proposed classification
of the five individually reviewed, populated non-system Want To records
(16 saved items at review time):

- Make each existing record its owner's permanent Want To system destination
  in place. Preserve its UUID, every saved item, share identifier, privacy
  settings and relationships; do not create a replacement or move the items.
- For the one reviewed account with an empty Queue system counterpart, retain
  that Queue record and UUID as non-system history, without deleting it.

This approves inclusion in the future repair plan only. It does not authorize
SQL execution, a live flag/title change, Edge deployment, Git operations or a
frontend release. No live changes were made when this decision was recorded.

This is not blanket approval for any five matching rows or for newly discovered
records. Reidentify the exact reviewed records and revalidate their current
state before constructing an execution manifest outside source control. If
correspondence cannot be established or conflicts have changed, stop for review.
The SQL approval table remains empty. The signup-authorization correction has
been tested locally; final live release approval remains required.

The last read-only census indicated 5 promotions, 35 in-place empty Queue
renames, 3 empty Queue demotions, and 56 inserts (36 human, 20 persona),
with 1,120 existing lists and 3,260 item rows preserved. Six Auth-only accounts
and out-of-scope historical rows were excluded. These counts are not a manifest.

## Signup security review

The live role catalog confirms that `anon` and `authenticated` can create
objects in `public` but cannot attach triggers to `auth.users` or `public.users`.
Trigger depth does not prove that a call comes from the signup trigger and is
no longer an authorization condition. No change to existing `public` or `auth`
schema permissions is needed.

- The no-JWT signup path accepts only an `AFTER INSERT FOR EACH ROW` event on
  `public.users`. It derives the account from `NEW.id`. The trigger and worker
  are owner-only in the new, non-exposed schema. None of the ordinary API roles,
  including the service role, can call either private function.
- The unchanged public RPC signature requires the PostgREST database session.
  It checks that the selected API role agrees with the JWT role, and that an
  authenticated user is restoring their own account. Only the trusted service
  role can restore for another account. No admin or trigger-depth exception.
- The data script calls the private worker as the SQL owner under the existing
  maintenance workflow, with an empty approval table and `ROLLBACK` by default.
- Neither script changes existing RLS policies, table grants, table ownership,
  existing schema grants, authentication helper grants, or unrelated
  trigger/function permissions. The explicitly scoped new RPC grant and
  retirement of legacy list-creation routines stay in the release approval.
- Signup acceptance requires the app profile and all five system rows, not
  just a successful Auth response. The live Auth handler can catch profile
  and downstream trigger failures without rejecting the Auth registration.
  Keep the existing Auth handler and notification hooks unchanged.

The live RLS and grant comparison used read-only catalog queries. The SQL
fixture tests modeled grants, unchanged policy/grant definitions, representative
private data reads, and the same Auth-to-app trigger path. This is not a test
signup on live Supabase or a claim that every existing RLS rule is correct.
Verify PostgREST session/role assumptions and rehearse on the frozen production
schema before approval.

The final corrected package passed 100 isolated SQL assertions, all 728
application tests and TypeScript checking. A second disposable fixture applied
the final foundation twice as non-superuser `postgres` and ran the live Auth
signup and identity-protection function bodies with modeled live grants.
It confirmed the profile and five exact lists, and owner/service RPC access
under the PostgREST session identity. The read-only comparison before and after
local testing showed the same four relevant live RLS policy fingerprints and
confirmed that the prepared schema and functions remained absent from live.

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

1. Confirm the refreshed candidate list, dependencies, roles, completed backup
   and current function source/configuration. Secure the exact five approved
   list IDs and original Edge release material outside source control. Obtain
   explicit approval for the exact SQL, maintenance window, Edge set and sequence.
2. In one transaction, as the database owner, take bounded locks on
   `public.users`, `public.lists` and `public.list_items` in that order, then
   apply the foundation followed by `five-system-lists-pause-writes.sql`.
   Compose the two files without their outer `begin;`/`commit;` statements;
   use one `begin;`, `set local lock_timeout='5s';`, the three locks, both
   file bodies and one `commit;`. Do not run the two files separately in
   production: that would leave a window between the guard and the pause.
   Verify both pause triggers and the narrow Auth signup exception.
3. Run `five-system-lists-data.sql` ending in `ROLLBACK`, with the reviewed
   five-row classification input. Expect 5 promotions, 35 renames, 3
   reclassifications to history, and 56 inserts if the census has not changed.
   Review its operation fingerprint and metadata-only receipt. If any record
   or expected operation has changed, stop rather than using stale counts.
4. With the separately approved commit, populate **both** approval inputs
   (including the dry-run operation fingerprint) and change the final
   `ROLLBACK` to `COMMIT`. The fingerprint checks owners and existing list IDs
   and tolerates only regenerated IDs for new rows. Check the exit status and
   save the receipt from the **successful commit** in restricted operational
   storage. The dry-run new IDs are not the committed IDs.
5. After PostgREST reload and RPC verification, deploy only these existing
   functions: `create-custom-list`, `get-user-lists-with-media`,
   `get-user-lists-metadata`, `track-media`, `predictions`, `import-media`,
   `move-item-to-list`, `delete-list`, `get-public-list`, `get-shared-list`,
   and `share`. Bundle their updated shared imports. Verify active versions
   and source/hash, existing signed-in list reads, privacy, sharing, and
   signup/profile provisioning. Once compatibility is confirmed, retire
   `default-lists` and `create-user-list` last. `share-invite` was not active
   in the review and is not part of this release. Keep existing JWT settings.
6. While paused, do not expect app save/move operations to succeed. After
   authorization/read/signup checks pass and the receipt is secured, run the
   resume file. Run approved save/move restoration smoke checks immediately
   using the currently served web build and a supported installed iOS build.
   On failure, reapply the pause, preserve newer data and fix forward or
   approve a targeted inverse. Never restore old writers just to resume service.
7. The Vercel frontend is separate: its failed build does not apply or block
   Supabase changes. The current web bundle uses the preserved API; the new web
   UI and corrected Open Graph preview take effect only with a successful
   user-controlled Vercel release. No iOS rebuild is required just for the
   backend contracts, but installed-client smoke verification is still required.

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
saved receipt with `five-system-lists-rollback.sql`. It checks the exact
post-change row fingerprints and dependencies before restoring prior titles/
flags or removing only empty, unreferenced new rows. Other list metadata is
checked against the original fingerprint; the existing update timestamp
trigger still records the rollback as a new write. The inverse aborts on
drift or references and defaults to `ROLLBACK`. Commit it only with separate
approval. Keep the corrected authorization and signup paths active; legacy
Queue data restored for recovery is not a state in which to reopen writes.

The local tests rehearse a reviewed commit, a refused commit on fingerprint
drift, an inverse refused for newly referenced data, and an exact inverse
that leaves saved items and signups outside its receipt untouched.

**After writes resume:** do not blindly replay inverse SQL or restore the whole
database over newer user activity. Fence affected writes, compare the receipt
against current data, preserve post-migration additions and apply a reviewed
targeted correction. Use verified provider recovery only as an approved disaster
recovery action with the impact on newer data understood.

Application rollback must not reinstall Queue-creating triggers or silently
swallow restoration errors. Keep the compatible API contracts and corrected
database protections while reverting unrelated frontend changes if necessary.

### Saved release evidence and older Edge recovery

The restricted local release packet is at `generated-artifacts/want-to-release/`
and excluded from Git and deployment. It preserves a hashed copy of the
tested SQL and function sources, the read-only census, and the pre-release Edge
archives and JWT settings. The four older archives (`default-lists`,
`create-user-list`, `delete-list`, `get-public-list`) were rebuilt with their
archived dependencies and tested in local Deno using synthetic loopback
requests. This verifies offline recovery, not a hosted redeployment. Do not
redeploy the old creation writers into an app with writes open.

The refreshed candidate snapshot is not a substitute for the original approved
manifest. Resolve that exact list/owner and saved-item comparison before
authorizing the repair. No actual rollback receipt exists before a successful
approved data commit.

The anonymous direct-table read policy found during preflight is a separate,
preexisting security issue. Want To does not require that policy, modify it,
or close the gap. This is a separate release-risk decision, not a SQL or Edge
ordering dependency. Any later policy repair must preserve intended owner,
public and shared-list reads.

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

### Final local verification

- `bash scripts/test-system-lists-local.sh`: 108 database assertions passed,
  including the atomic foundation/pause install, genuine Auth signup while
  paused, direct and service write denial, manifest drift, committed inverse,
  and write resumption. The script also explicitly refuses an inverse when a
  new list has acquired a relationship.
- `npm test`: 731 passed, zero failed/skipped. Actual handler tests cover
  track/move aliases, owner and friend reads, private rows and All totals,
  blocks in both directions, missing identity and query failures, and the
  public/private Open Graph preview against the production column shape.
- `npm run check`: passed.
- `npm run build`: passed, including the unchanged progress-dialog gate
  (72 layouts), modal gate (30 layouts/interactions), and profile-safety gate.
- `node scripts/test-quick-track-position.mjs`: passed, including complete and
  incomplete shared-cache Want To destinations, restoration failure, review
  retry/no-duplicate-save behavior, and mobile/desktop interaction simulations.

These are local results only. SQL, Edge handlers and frontend assets have not
been released by this work. No Git operations were performed. No live list or
classification was repaired, and no successful Vercel release is claimed.
