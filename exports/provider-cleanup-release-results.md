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

**Limited two-session lock probe — not queue contention proof.** Two independent secured database-query
sessions contended on an advisory lock; while the holder
transaction slept, the probe's `pg_try_advisory_xact_lock` returned
`acquired=false`. The queue implementation uses row locks, so this does not
prove simultaneous queue claims/reservations. Sequential CAS tests and an
injected concurrent dispatch test passed; a real two-session queue contention
test remains outstanding. No queue schema was persisted by the probe.

## Disposable User A / User B gate

**BLOCKED — not simulated as live.** The approved gate still requires a real
disposable User A and negative-control User B, both linked to all applicable
providers, with first-party fixtures/content, PostHog persons/events,
OneSignal users/subscriptions/devices, and Customer.io profiles/data.
Required proof remains outstanding for:

1. A local account and all first-party data are deleted while B, B–C, and B–D
   controls remain unchanged (A–B relationship removal is expected).
2. A targets only A's verified PostHog person and historical events.
3. A targets only A's exact OneSignal external ID and subscriptions/devices.
4. A targets only A's exact Customer.io customer ID/data.
5. Kill switch, circuit threshold, duplicate delivery, ambiguous PostHog
   mapping, outage, timeout, 429, 503, and late-ingestion rejection are
   exercised against the live disposable provider fixtures.

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

**BLOCKED — provider-delete scope/configuration is not yet proven.**
`POSTHOG_API_KEY` is the existing capture/ingestion credential and must not be
reused or relabeled as the required personal key with current `person:write`
permission. No `POSTHOG_PERSONAL_API_KEY` or PostHog project-id configuration
name is present in the remote name inventory. The worker therefore fails
closed for PostHog.

OneSignal has an existing App ID and runtime server key names, but the
app-scoped destructive-delete permission has not been confirmed from the
secret name alone. The worker can use the existing server-only runtime key
after that scope is independently confirmed; it never accepts a client key.
Customer.io has the Track credentials, but no `CUSTOMERIO_REGION` name is
present. The worker intentionally does not guess US versus EU and remains
blocked until the region is explicitly configured.

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
has not been deployed; only the rollback-scoped validation above was run.
Keep provider control rows disabled and keep the server-only disposable
allowlist absent until the reviewer permits the isolated migration and the
live A/B gate is run. Real mode additionally requires both the
`PROVIDER_DELETION_ENABLED` and separate `PROVIDER_DELETION_REAL_APPROVAL`
server flags plus the database `real_cleanup_approved` switch. No provider
call is authorized by this report.

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

OneSignal's official Identity Verification documentation says the feature is
currently beta, must first be enabled by OneSignal support and then toggled
under Settings → Keys & IDs, and requires server-generated ES256 JWTs. It
currently supports native Android SDK 5.9.0+ and iOS SDK 5.3.0+; wrapper SDK
support is documented as coming soon. The current app uses the Cordova
plugin's one-argument `login(externalId)` API, so enabling the OneSignal
toggle now would require an approved plugin/native SDK and token lifecycle
release. Research indicates the setting is feasible without changing the
current app today only as a future approval/release item; it must not be
enabled for this build. See:
https://documentation.onesignal.com/docs/en/identity-verification