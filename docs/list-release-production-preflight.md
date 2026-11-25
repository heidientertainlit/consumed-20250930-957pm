# Want To and list security: production preflight

Inspection window: **November 24, 2026, approximately 11:42–11:50 p.m. MST**
(November 25, 06:42–06:50 UTC). Point-in-time evidence, not a continuing guarantee.

## Decision

**Read-only inspection finished. Do not authorize an unconditional security
cutover yet.** The approved Want To manifest is stable and the frozen Edge
recovery baseline matches production. The current Vercel web client still has
the two legacy client paths that the completed security package replaces.
Supported installed iOS behavior and the WebKit gate remain unverified.

No repair package was reopened or changed. No production SQL writes, locking
dry runs, new accounts, application write tests, migrations, Git operations,
deployments, environment changes or new infrastructure were performed.
Management SQL requests used `read_only: true` and SELECT statements only.
HTTP checks fetched public resources and a confirmed read-only public-list
handler; no profile-provisioning or comparison-generation route was invoked.

## Database and manifest

- All **six approved records** still exist: five Want To promotions and the
  approved Queue companion. All six match their full list-row fingerprints,
  owner/title/classification/privacy fields, exact saved-item IDs/titles/owners,
  collaborator counts and share-ID fingerprints.
- SELECT-only projection of the frozen operation order still yields **5
  promotions, 35 renames, 3 history reclassifications and 56 inserts**.
  This is not the locking dry run or its approval fingerprint.
- Current totals: 1,120 lists, 3,264 items, 228 app profiles, six Auth-only
  accounts, 38 system Queue rows, no nonempty Queue rows and no duplicate
  system-title groups. The earlier census contained 3,260 items; those four
  additional items did not alter the six approved records.
- RLS is enabled on the relevant tables. The seven obsolete SELECT policies
  and two policies to amend are still present. The retained ALL policies are
  recognizably owner-only. The broad direct-read exposure remains; neither
  repair has been applied.
- Live list indexes match the frozen dependency inventory; the ten inbound
  foreign keys match it. All inspected relevant indexes are valid and ready.
  Required identity types remain UUID, with text share IDs and the existing
  timestamp type. Catalog privilege checks confirmed API roles retain their
  existing table access; RLS is what must restrict reads.
- The private release schemas, new owner restoration RPC and temporary bridge
  are not installed. Existing list-provisioning triggers are still present;
  the legacy dependency inventory matches the prepared replacement scope.
- No locks on the three inspected release tables, idle transactions or lock
  waiters were observed in the sample. This does not prove a later exclusive
  lock attempt will succeed. The release must retain its short timeout.

## Edge functions and gateway

All 18 affected functions inspected are active and have `verify_jwt=true`.

The **13 frozen Want To archives are byte-for-byte identical** to the saved
production baseline, including the two writers scheduled for retirement.
No recovery baseline refresh is required for those bytes at inspection time.

The additional security functions were downloaded read-only, their archive
checksums verified during parsing, their entrypoints identified, and their
complete dependency graphs bundled offline for recovery evidence. These are
snapshots of the current production code, not deployed corrections:

| Function | Current version |
|---|---:|
| social-feed | 845 |
| get-friends-consuming | 34 |
| get-user-stats | 63 |
| compare-dna-friend | 162 |
| update-list-visibility | 64 |

The current reader archives do not contain the completed bridge/RLS rollout
contract. They still need the approved release sequence. The existing
comparison function has a readiness action, but that alone does not make
every client use it.

The production public-list gateway rejected an invalid token with 401 and
accepted the guest credential far enough to return the expected missing-list
404. The experimental local native router's 404 is therefore not evidence of
a production routing outage. Valid signed-in JWTs and all post-release route
contracts still require authorized release smoke verification.

No calls to the two retiring creation endpoints or three legacy creation RPC
paths were found in the searchable preceding 24-hour log window. This does
not certify dormant installed clients or justify skipping retirement checks.

## Vercel and supported clients

- The existing production domain responds from Vercel. The live main bundle
  is `/assets/index-CftghGdr.js`, SHA-256
  `e3f881f837a625940c1faad17b9a565387aff6f0e0ae63e6ec7f331a414a784b`.
- **Confirmed live-web compatibility dependency:** the profile DNA friend
  picker still queries friends' raw lists and list items and counts those
  rows to decide comparison eligibility. Corrected RLS can reduce that count.
  Another surface's use of aggregate readiness does not fix this picker.
- **Confirmed legacy routing dependency:** the bundle still calls
  `/api/list-by-id/:id` without the completed authenticated Edge path. On the
  production Vercel host, a probe of that URL returned the SPA HTML shell
  with HTTP 200, not the expected list JSON. The completed client correction
  must be released before the security policy cutover; do not restore the
  privileged fallback.
- These findings require sequencing the already-completed reader and client
  corrections, not reopening development or widening permissions.
- The US App Store reports **1.0.9** as current. Live remote configuration is
  also latest **1.0.9**, minimum **1.0.9**. This is not proof of the installed
  binary contents or enforcement in binaries without the update checker.
- Workspace iOS assets contain the same raw-row picker and same-origin
  fallback. That is a warning about those assets, **not proof that the App
  Store/TestFlight binary contains them**. Exact installed-build testing is
  still required.
- Direct OG handling and list-route rewrites are active. Invalid list links
  returned generic metadata. Two approved public-list paths also returned
  generic metadata rather than the expected Want To title; title-specific
  previews are not certified. Observed cache headers were
  `public, max-age=60`.
- No suitable existing user-owned private-list fixture was returned for the
  read-only preview probe. No private fixture was created. Public-to-private
  transitions, authenticated private paths and third-party crawler cache
  expiry remain untested in production.
- Public HTTP evidence does not expose Vercel's deployment-to-commit mapping,
  server-function environment values or available rollback deployments.
  Vercel admin access was not available through the existing workspace
  connections. The owner should confirm these in the existing dashboard
  without clicking Redeploy, Promote or Rollback.

## Recovery readiness

Supabase reports seven completed physical backups, WAL-G enabled, and **PITR
disabled**. The newest backup is November 24 at 09:24 UTC, approximately
21 hours before inspection.

Saved Edge bytes and dependency-complete recovery graphs are available.
No live redeploy, database restore or failover was attempted. A daily backup
is not a lossless just-before-release restore point. Preserve the committed
inverse receipt and prefer the runbook's scoped recovery; do not promise that
a full restore preserves intervening user activity. The committed receipt
cannot exist before the separately approved data commit.

## Exactly what the owner should test

### iPhone: baseline checks now, without modifying data

1. Record iPhone model, iOS version, app version, and build number if visible.
   For TestFlight, record the version/build shown in TestFlight. For an App
   Store install, record the installed version in iPhone Settings → General →
   iPhone Storage → Consumed. Do not treat the workspace's native version as
   proof of what is installed.
2. In the currently supported installed build, use an existing signed-in account.
   Force-quit and reopen. Open My Media and existing Want To/Queue, Currently,
   Finished, Did Not Finish and Favorites lists. Confirm existing titles,
   progress and notes remain visible. Do not restore lists or save changes.
3. Open an existing public list link in Safari and the app. If you already
   have owner/private or collaborator links, open those while signed in and
   record the result. Test a link after force-quitting and again while the
   app is already open. Do not create a list, collaborator or block for this
   test. Mark unavailable fixtures as unavailable, not passed.
4. Open your DNA comparison friend picker. Use an already-accepted friend
   known to have completed DNA and tracked at least ten items. Record whether
   the friend is offered and the displayed eligibility/count. **Do not start
   a comparison**, because that can refresh signals and write its cache.
5. Return screenshots and a short pass/fail/unavailable list with the exact
   version/build. Repeat on any older build you still intend to support.

These establish the current baseline only. A successful picker under today's
broad policies cannot prove it will work after narrowing them. If the installed
binary has the raw-row picker or obsolete private-link path, the release
requires the completed corrected client to be distributed and verified, or
an explicit supported-version decision. Do not raise the remote minimum as
an unapproved workaround.

### WebKit: isolated test on the Mac

In a local copy of this project with the completed changes and existing Node
dependencies, run:

```sh
npm run check:modal-foundation:webkit
```

If dependencies are not installed, use the project's lockfile to install them
first (`npm ci`), then run that command. It installs the WebKit test browser
and runs the existing local fixture; it does not require production secrets
or a live app login. Keep the test unchanged.

Success means exit code zero and the WebKit pass summary covering all 30
layouts and the interaction/focus checks. Return the final terminal summary
and macOS version. If it fails, send the error; do not skip assertions or
replace WebKit with Chromium. This tests modal behavior, not the installed
iPhone binary or the privacy policy cutover.

### Do not test production writes yet

Add, move, visibility toggles, signup, imports, new comparisons and block/
collaborator changes need a later explicit approval and authorized test
accounts. After approval, the release operator must perform these against
the actual released code at the runbook's checkpoints. They are not authorized
by this preflight.

## Outstanding actions and next approval

| Action | Responsible person | Why it remains |
|---|---|---|
| Return installed iOS and WebKit results | Owner on iPhone/Mac | Exact installed artifacts and a functioning WebKit host are not available here. |
| Confirm the existing Vercel production deployment and rollback candidate; inspect list-OG function errors/environment targeting without changing them | Owner in Vercel, or an authorized operator with existing admin access | Public routes do not prove deployment identity/recovery; approved public previews returned generic metadata. No secrets should be copied into chat. |
| Ensure completed compatible readers and client changes are released and verified before policy narrowing | Owner controls frontend/native distribution; release operator verifies active handlers | The currently served web client still has the confirmed legacy dependencies. |
| Approve the first bounded maintenance checkpoint | Owner | Inspection did not authorize any production mutation. |

**Next production approval:** authorize only the frozen Want To foundation
plus write pause in one transaction, followed by the rollback-only data dry
run and return of its operation fingerprint. Specify an agreed maintenance
window and the release operator. This is a production-changing approval even
though the data dry run rolls back.

Do not exercise that approval until the client/recovery stop conditions above
have been resolved or explicitly accepted where the runbook permits. Keep
the data COMMIT, Edge changes, writer retirement/resume, user-controlled
frontend/native release, security cutover and bridge retirement outside that
first approval. The dry-run fingerprint and its data COMMIT require a
separate decision. Never restore the old creation writers into an open app
or reopen broad reads as a compatibility fix.
