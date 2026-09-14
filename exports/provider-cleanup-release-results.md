# Section 3B provider-cleanup release results

**Status: BLOCKED for real-user enablement.** This report is implementation and
disposable-test evidence only. No real provider deletion was enabled, no
production user was selected, and no provider-delete request was sent.

**Deployment status:** These changes are in the workspace only. The new migration
was exercised inside a rolled-back transaction, not installed. No new worker or
changed provider producer was deployed. The complete provider-linked A/B test has
not run; this is an interim report, not a passed release gate.

**Final project checks:** 171 automated tests passed and the production build
passed. Passing local tests does not establish live provider erasure.

## Implemented controls

**PASS — authenticated single-user boundary.** `delete-account` derives the
target only from the verified Supabase access-token subject. It rejects query
selectors and every non-empty request body, including arrays, IDs, emails,
filters, aliases, and bulk shapes. The worker is service-role-only and also
rejects query/body targets.

**PASS — atomic first-party/queue boundary.** Migration
`20260914000700_provider_deletion_queue.sql` preserves the runtime-safe
`delete_account_transaction` body from 00600, adds the immutable
`public.deleted_account_tombstones(user_id uuid primary key, deleted_at
timestamptz)`, and inserts exactly one immutable-targeted job for each of
PostHog, Customer.io, and OneSignal in that same transaction. Queue and
tombstone tables are not client-readable/writable.

**PASS — target safety.** Jobs are unique on `(deleted_user_id, provider)`.
Customer.io and OneSignal receive only the exact verified Supabase UUID.
PostHog starts without a destructive ID and can transition only once to one
verified person UUID. Immutable triggers reject retargeting, replacement, and
deletion. Ambiguous or merged PostHog identity responses block only that job.

**PASS — provider request scope.** Adapters build only the singular PostHog
person deletion, exact OneSignal `external_id` path, and exact Customer.io
customer-ID path. There is no bulk endpoint, array selector, email lookup,
segment, cohort, wildcard, or provider response-body storage.

**BLOCKED — legacy late-ingestion boundary.** Current-session setup now
invalidates in-flight A -> B identity work on every auth-subject transition,
and the current app checks the exact live `public.users` row before enabling
PostHog capture or native OneSignal login. However, the browser still has a
public PostHog capture key and released native clients can still call
OneSignal login directly; those old binaries cannot be retroactively forced
through the new server guard. Provider cleanup therefore remains blocked
until server-enforced PostHog/OneSignal ingestion is deployed or the
approved client-version retirement gate proves those clients cannot recreate
deleted identities.

**PASS — controls.** The shared SQL control ledger has a manual kill switch,
per-provider state, single-job just-in-time claims, rotating lease-owner UUIDs,
and compare-and-swap checks on mapping, reservation, pre-dispatch guard, and
result writes. Every reservation is one append-only timestamped
`provider_deletion_attempts` row keyed by `(job_id, lease_token)`. Limits count
the true last-hour event stream, including retries, and use `count(distinct
deleted_user_id)` for the global account cap; no fixed epoch or mutable
per-account counter can undercount a boundary-crossing request. A worker
processes one leased job at a time, keeping the two-minute lease ahead of the
15-second provider timeout. The pre-dispatch guard rechecks ownership,
provider/global controls, and final real-approval state. A switch cannot
cancel bytes already sent, but a switch activated before the guard blocks
dispatch. Real cleanup is disabled by default. Disposable mode requires the
server-only exact UUID allowlist and cannot accept a client ID.

**PASS — retry/completion semantics.** 408, 429, timeouts, and bounded 5xx
responses retry with bounded backoff/`Retry-After`, capped at fifteen claims or
24 hours from queue creation. Ordinary 4xx responses, invalid
credentials/configuration, malformed mappings, and ambiguous readbacks fail
closed. PostHog historical completion requires the exact person UUID,
`completed`, and a valid non-null `delete_verified_at`. OneSignal 202 is
accepted-pending; three bounded exact readback 404s are required before
observed absence. Customer.io requires the documented exact-ID `200 {}` body,
not merely a status code.

## Executed tests

**PASS — local provider policy/adapters harness (7 tests).** The runnable
Node test `supabase/functions/_shared/provider-deletion.test.ts` passed:

* exact singular URL construction for all three providers and no bulk
  PostHog parameters;
* exact-one PostHog mapping and fail-closed ambiguity/conflicting UUID cases;
* exact PostHog historical-status proof requiring `person_uuid` and a valid
  verification timestamp;
* invalid IDs/regions, malformed status, 408/429/5xx retry classification,
  ordinary 4xx permanence, exact Customer.io `200 {}` parsing, and backoff;
* kill-switch and shared request-circuit behavior, including retries;
* disposable allowlist and no-target request enforcement.
* injected lease-guard/fetch-spy proof that a denied guard sends zero requests
  and two concurrent guarded dispatches send once.

**PASS — syntax checks.** The worker and delete-account Edge Function bundles
compile with esbuild, and the provider policy tests pass. These are local
checks, not evidence of a deployed bundle.

**PASS — client identity-transition harness (2 tests).** The runnable
`client/src/lib/provider-identity-transition.test.ts` uses a deferred fake
OneSignal login to prove that an in-flight A login is invalidated, cleaned up
inside the same serialized chain, and cannot run again after B's transition;
the queued login also rechecks the current auth subject before calling the
provider. This is helper behavior coverage, not evidence against an old
installed/native client.

The current combined local command
`npx tsx --test client/src/lib/provider-identity-transition.test.ts
supabase/functions/_shared/*.test.ts` passed 124 tests with zero failures.
These are mocked/local tests and include no provider credentials or real
provider data.

**PASS — live rollback SQL verification.** The migration and
`supabase/tests/provider-deletion-queue.sql` were submitted together to the
actual Supabase project through the secured database-query management API
inside one outer transaction. The fixture passed and the transaction was
rolled back. It covered one-job-per-provider uniqueness, rotating lease tokens,
stale-worker CAS rejection, retryable 429, permanent 401, accepted-pending
202, three bounded OneSignal absence readbacks, kill switch and pre-dispatch
guard, a five-distinct-user versus sixth-user rolling boundary with five
requests at 59 minutes before the edge, fifteen reservations including
retries, append-only attempt uniqueness, and duplicate claims plus rejected
attempt-ledger mutation. A follow-up read
confirmed all four new queue/control/attempt relations and functions are
absent, proving no migration persisted.

**PASS — two-session queue contention.** Two independent secured
database-query sessions claimed the same queued negative-control job
concurrently. Exactly one returned the row (`in_flight`, attempt 1); the other
returned zero rows. A separate advisory-lock probe also returned
`acquired=false` for the contending session. The queue schema was removed
afterward and the account-deletion function was restored to 00600.

## Disposable User A / User B gate

**PARTIAL PASS — provider-only disposable worker gate; release remains
blocked.** After preflight, a temporary service-only probe created two fresh
Auth A/B users with synthetic fixture metadata and exact UUIDs recorded in
mode-0600 ephemeral manifests (`/tmp/provider-cleanup-auth-manifest` and
`/tmp/provider-cleanup-fixture-manifest`; values are not copied into this
report). The same exact Auth UUIDs were used for Customer.io and OneSignal
fixtures. This did **not** call `delete_account_transaction`: the Auth users
were still-live disposable users and the tombstone/job rows were manually
seeded for the worker run. No `public.users` rows, app content, relationships,
or first-party tables were seeded or snapshotted, so this is not a full
first-party account-deletion gate. A temporary worker ran the actual queue
claim → reserve → pre-dispatch guard → provider request → CAS result path;
deletion was not issued by an independent script.

* Customer.io A returned the documented `200 {}` and the worker marked A
  `completed`. B's job was queued and untouched while A ran. The Track API
  `GET` returned 404 for both A and B, but that endpoint is not a supported
  profile/history readback with these Track credentials; the 404 is **not**
  interpreted as absence. Thus the evidence proves A's worker DELETE response
  contract and queue isolation, not A/B profile or history absence. A
  documented Customer.io App API customer-read credential is still required:
  the approved exact-ID read resources are `GET
  /v1/customers/{customer_id}/attributes`, `activities`, or `messages` on
  `https://api.customer.io` (or `api-eu.customer.io`), using the App API
  credential and its documented read permission. No App API read credential
  was present in the inspected secret names. Even that read would prove only
  current profile/activity visibility, not historical-event or backup purge.
* OneSignal A returned `202`; the worker performed three exact-ID `404`
  readbacks and marked A `observed_absent`. B returned `200` while A was
  processed and B's queue row remained untouched. B was cleaned only after
  this negative-control capture, using the same worker path.
* Alias-only OneSignal users were used: no phone, email, fabricated device
  token, subscription, or notification was sent. The SDK test-device/device
  subscription gate is therefore **BLOCKED**, not passed.
* Both provider fixtures and both Auth users were removed after the capture;
  final exact readbacks were 404 for both providers and the Auth-user count
  was zero. The temporary probe/worker functions and disposable secrets were
  deleted/unset, and no queue tables remained.

The full three-provider/account gate is **BLOCKED** because PostHog preflight
cannot read a person with the supplied personal key, no real first-party app
content/relationships/historical PostHog events were created, and the
Customer.io profile/history readback remains unavailable. Live timeout/429/503,
ambiguous PostHog mapping, and late-ingestion tests remain blocked; local
policy tests are not substituted for those cases.

## Remote Supabase secret-name inspection

**PASS — names inspected without values.** A management `GET
/v1/projects/mahpgcogwpawvviapqza/secrets` was executed using the secured
`SUPABASE_ACCESS_TOKEN`. Only names were emitted. The remote project currently
contains:

* Customer.io: `CUSTOMERIO_SITE_ID`, `CUSTOMERIO_TRACK_API_KEY`,
  `NEW_USER_CIO_WEBHOOK_SECRET`, `NOTIFY_EMAIL`;
* OneSignal: `ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY`,
  `ONESIGNAL_REST_API_KEY`;
* PostHog ingestion: `POSTHOG_API_KEY`, `ANALYTICS_WEBHOOK_SECRET`.

**PASS/BLOCKED — scoped preflight, without secret values.** The new
`POSTHOG_PERSONAL_API_KEY` was read only from the Replit secret environment.
Against `https://us.posthog.com` project `294186`, synthetic nonexistent-UUID
persons and deletion-status GETs returned HTTP 403 with sanitized
`code=permission_denied` and detail naming `person:read`. The earlier
synthetic singular DELETE also returned HTTP 403, but its detail was not
captured; because no further destructive probe was authorized, its missing
scope is recorded as **unknown**, not asserted to be `person:write`.
`GET /api/projects/294186/` returned HTTP 403 with
`code=permission_denied`; its detail did not name `project:list` and is
recorded as scope-unspecified (the expected project-list restriction is not
being used to request broader access). A harmless `select 1` HogQL query
returned 200. Documented key metadata endpoints did not expose
`person:write` (`/api/api-keys/` 404 and `/api/personal_api_keys/` 403), so no
person write permission can be claimed. No real PostHog record was returned
or deleted.

`POSTHOG_API_KEY` remains the existing capture/ingestion credential and was
not reused or relabeled. The remote secret-name inventory still does not
contain a PostHog personal-key or project-ID name; the worker therefore fails
closed for PostHog.

OneSignal's existing app ID and server key were proven against exact fresh
alias-only A/B users through the worker: A's 202 plus three exact 404
readbacks reached `observed_absent`; no device/subscription permission was
claimed. Customer.io Track credentials were proven for the US endpoint in the
temporary disposable run, but `CUSTOMERIO_REGION=us` was temporary and was
unset afterward; the worker remains blocked until that region is explicitly
configured in the approved deployment.

No secret values were requested, printed, committed, or placed in logs. A
disposable provider project and A/B fixtures are also required.

## Analytics ingress compatibility hold

**REVIEWED — strict header name is compatible, value match remains a release
check.** The local `track-analytics` guard reads
`ANALYTICS_WEBHOOK_SECRET`; that exact secret name is present in the live
project's management metadata. The live `public.notify_posthog` function still
posts to the exact `track-analytics` URL with the exact `x-analytics-key`
header, so the guard preserves the existing SQL producer contract and adds no
new gateway. The live function source uses its existing stored literal behind
`webhook_secret`, while the management inspection intentionally returned names
only; therefore the literal-to-edge-secret value match cannot be claimed from
metadata alone. Do not rotate either side or deploy the stricter function until
the reviewer approves a safe authenticated compatibility check.

## Release decision

**DO NOT enable `PROVIDER_DELETION_ENABLED` for real users.** The migration
was applied only during two temporary disposable verification windows with
all real-mode flags false, then the queue tables/functions were removed and
the 00600 account-deletion function was restored. The worker and probe
functions were deleted and disposable secrets unset. Keep provider control
rows disabled and keep the server-only disposable allowlist absent. Real mode
additionally requires both the
`PROVIDER_DELETION_ENABLED` and separate `PROVIDER_DELETION_REAL_APPROVAL`
server flags plus the database `real_cleanup_approved` switch. No provider
call is authorized by this report; the calls recorded above were disposable
only.

## Final disposable-installation cleanup proof

**PASS — temporary installation fully removed.** Final read-only checks showed
`provider_deletion_jobs`, `provider_deletion_attempts`,
`provider_control_ledger`, and `deleted_account_tombstones` absent;
`provider_deletion_reserve_attempt(uuid,uuid,boolean)` absent; and only
the pre-existing `delete_account_transaction(uuid)` remains present among the
inspected queue/account identifiers. The migration-history latest row
remains `20260914000600`. Function inventory contains no temporary
`provider-cleanup-*` or `provider-deletion-worker` deployment, and secret-name
inspection contains no temporary probe/worker/region names. The temporary
00600-compatible account-deletion function was restored.

The temporary queue contained only the manually seeded disposable A/B
tombstone/job rows for each verification window; `delete_account_transaction`
was never called and no production/live-user queue job existed. The Auth probe was coded to
create exactly two fixture users; their exact-ID final count is zero and no
`public.users` rows were created by that probe. A global before/after Auth
population snapshot was not taken, so this is not a claim about unrelated
pre-existing Auth users.

The workspace implementation remains retained: the provider-deletion
migration, worker, shared adapters/tests, and SQL fixture are still present;
only the temporary probe source was removed. No real-enabled worker was left
deployed, and real-mode flags/control were never enabled.

## Release blocker — late ingestion and direct public SDKs

**BLOCKER — complete late-ingestion prevention is not yet enforced.** The
current producer guards check the exact live `public.users` row immediately
before a server-side provider request, and the deletion queue/tombstone work
can reject later database-triggered events. They cannot retract a request that
already crossed the provider boundary, stop an old installed/native client
from calling a provider directly, or selectively reject an arbitrary deleted
UUID at PostHog while the old public project token remains accepted. This is a
release blocker, not a documentation caveat: the disposable A/B gate must
prove the delete-versus-late-event behavior, and the approved production
control must be live before real-user deletion is enabled.

PostHog's official capture API
(https://posthog.com/docs/api/capture) documents the `/i/v0/e` and `/batch`
routes as public POST endpoints authenticated with the project token. Its
event-ingestion filter
(https://posthog.com/docs/data/event-filtering) can drop by `distinct_id`, but
the documented limit is one project filter with at most 20 conditions; it is
not a dynamic tombstone lookup. PostHog's reverse-proxy documentation
(https://posthog.com/docs/advanced/proxy) describes routing/ad-blocker
coverage, not revoking the old direct project-token path. Therefore a proxy
alone is not claimed as a solution. The smallest enforceable options still
require review: retire/restrict the old project token and move all supported
clients to a controlled ingress, or use an approved provider-side
filtering/control that can enforce the deleted-ID set. No gateway or provider
setting was added here.

PostHog's official custom-transformation documentation
(https://posthog.com/docs/cdp/transformations/customizing-transformations.md)
does provide a per-event `return null` drop operation, but it explicitly says
transformations receive only `event` and `project`, cannot access person
profiles, and cannot make external HTTP calls or access external services.
Consequently a Hog transformation can drop a statically configured UUID (or
the documented small filter set), but cannot consult the live Supabase
tombstone table per event. No tested PostHog configuration in this review
enforces an arbitrary, changing deleted-UUID set.

The configured `POSTHOG_PERSONAL_API_KEY` was used only for read-only
metadata probes against US project `294186`: project metadata,
`hog_functions`, and transformation-template reads all returned HTTP 403.
No real event/person data was requested or printed, and project/plugin rights
were not assumed. The provider-side transformation/filter option therefore
remains unverified and cannot be called a tested solution.

OneSignal's official Identity Verification documentation says the feature is
currently beta, must first be enabled by OneSignal support and then toggled
under Settings → Keys & IDs, and requires server-generated ES256 JWTs. It
currently supports native Android SDK 5.9.0+ and iOS SDK 5.3.0+; wrapper SDK
support is documented as coming soon. The current app uses the Cordova
plugin's one-argument `login(externalId)` API, so enabling the OneSignal
toggle now would require an approved plugin/native SDK and token lifecycle
release. The installed Cordova 5.3.1 package embeds Android OneSignal SDK
5.6.1 and iOS OneSignalXCFramework 5.4.1; Android is below the documented
5.9.0 minimum, and the bridge has no JWT login argument despite the iOS
native version meeting the numeric floor. Existing installed clients would
therefore be incompatible with provider enforcement. The minimum gated
release needs a supported bridge/native SDK with JWT login, an approved
server JWT lifecycle, and an enforced minimum app version; no toggle was
enabled here. See:
https://documentation.onesignal.com/docs/en/identity-verification