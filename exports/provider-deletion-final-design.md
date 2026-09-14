# Section 3B provider-deletion design (final, design only)

**No implementation, configuration change, provider call, secret request, or
production cleanup is authorized by this document.** This is the smallest safe
design that preserves the required blast radius and accurately describes what
the provider APIs can and cannot prove.

## Scope and invariant

The production inventory identifies three relevant processors:

* **PostHog:** the Supabase UUID is the current `distinct_id`; deletion must
  use the mapped PostHog person UUID (`id`), not `distinct_id`.
* **Customer.io:** the Supabase UUID is the Customer.io customer `id`.
* **OneSignal:** the Supabase UUID is OneSignal `external_id`.

The endpoint accepts no target. The server verifies the Supabase session/access
token and derives exactly one `deleted_user_id = auth.uid()`. It rejects route
or query selectors, client-supplied IDs, arrays, emails, filters, cohorts,
wildcards, provider aliases, and unknown body fields. A user cannot name
another account. A stale or revoked session cannot invoke the endpoint.

First-party deletion and queue creation are one explicit, serializable
transaction:

1. Lock the exact authenticated user row and verify `auth.uid()` again.
2. Capture any trusted local provider linkage and record the deletion boundary.
3. Delete first-party rows using `WHERE user_id = deleted_user_id` and
   row-count/cross-user assertions. Stop on an assertion failure.
4. Insert exactly three durable jobs (one each for PostHog, Customer.io, and
   OneSignal), keyed by this immutable `deleted_user_id`, in that same
   transaction.
5. Commit. Only after commit may workers make provider requests.

A provider outage, unavailable key, mapping timeout, or ambiguous provider
mapping **must not roll back or block the first-party transaction**. It blocks
only the affected provider job and alerts an operator. Queue insertion is the
committed proof that this exact authenticated deletion authorized later work;
an additional operation table is not required. An operation ID may be a
correlation field on the job rows.

After deletion, every server identify/track/notification path must check the
deleted-user marker before ingesting data. Revoke sessions, prevent sign-in
and account recreation for that UUID, and stop client/provider login calls.
Stale clients must not be able to submit late events. Never recycle the UUID.
PostHog late events or a recreated person invalidate a claim of final
historical completion; they are an alert, not a reason to broaden a delete.

## Minimal queue and shared control ledger

Use one append-only/immutably targeted `provider_deletion_jobs` table:

```text
job_id, deleted_user_id, provider,
provider_identifier_kind, provider_identifier,
state, mapping_state, attempts, lease_until, next_attempt_at,
last_http_status, failure_class, created_at, accepted_at, completed_at
```

* `deleted_user_id` is the exact verified Supabase UUID and is never supplied
  by a worker message or client.
* There is one unique row per `(deleted_user_id, provider)`. The three rows are
  inserted atomically with the first-party deletion.
* Customer.io's provider identifier is the exact UUID and OneSignal's is the
  exact UUID, captured from trusted application linkage. They contain no email
  or alias.
* The PostHog row starts as `mapping_pending` with no destructive provider ID.
  The worker may perform one read-only lookup using **only** this exact
  `deleted_user_id` as the known `distinct_id`. It can transition once,
  compare-and-set, to one immutable verified `posthog_person_uuid`. It may
  never replace that ID, search by email, enumerate persons, choose a nearest
  match, or widen to `distinct_ids`.
* An unresolved row is a mapping task, not an actionable delete. If mapping
  merges/contains another Consumed UUID, returns multiple persons, changes
  between attempts, or is otherwise ambiguous, set only that provider row to
  `blocked` and alert. Do not alter local deletion or the other two jobs.
* There are no arrays, selectors, email/content fields, credentials, provider
  response bodies, or generic provider IDs in this table. A provider
  response's extra identifier is not copied into the row.

Use a shared, atomic `provider_control_ledger` (or equivalent) for the manual
kill switch, per-provider circuit state, leases, and rolling counters. Every
worker and every provider uses the same ledger; counters cannot be bypassed by
concurrency. Recommended starting limits, configurable rather than hardcoded:
**5 distinct accounts per rolling hour and 15 destructive calls per rolling
hour across all providers/workers, counting retries**. An optional emergency
daily cap may start at 20 accounts/60 destructive calls per day. Operators may
adjust limits only after observing the disposable test. A closed switch or
open circuit blocks provider work, never first-party deletion.

Worker states need only distinguish `queued`, `mapping_pending`,
`in_flight`, `accepted_pending`, `completed`, `retryable_failure`, `blocked`,
and `permanent_failure`. A lease is claimed atomically; duplicate delivery
reuses the same row and exact target. Retry transport failures, 408, 429, and
bounded transient 5xx with exponential backoff and `Retry-After`; count every
destructive retry. Do not retry malformed responses, mapping mismatch, bad
credentials, or ordinary 4xx. No worker can accept a target selector.

## Provider operations and exact uncertainty

### PostHog

**Read-only mapping:** query the project persons API with the exact
`distinct_id=<deleted_user_id>` solely to map. Require exactly one person, a
single person `id`, and confirmation that the person contains precisely the
expected Consumed UUID. If its identity also merges another Consumed UUID,
block/alert the PostHog row only. On success, save only that immutable person
UUID and use it on every repeat.

**Documented singular request (preferred and only allowed request):**

```text
DELETE https://app.posthog.com/api/projects/{project_id}/persons/{person_uuid}?delete_events=true&delete_recordings=true
Authorization: Bearer <personal_api_key>
```

Use the project’s configured regional host (the current status example uses
`https://us.posthog.com`). The request has no body, arrays, or selector.
`delete_events=true` requests historical event deletion and
`delete_recordings=true` requests irreversible recording crypto-shredding.
The personal API key must have the current persons write permission
(`person:write`) for the project.

**Important unresolved API conflict:** the current PostHog privacy page shows
the singular `DELETE /persons/{person_uuid}` example but links to a persons API
`POST .../persons/bulk_delete/` operation. The latter requires `ids` or
`distinct_ids` arrays plus flags and returns bulk counts. Section 3B forbids
bulk APIs, and this design forbids even a one-element-array exception. There is
no fallback to that endpoint.

Before enabling anything, confirm in a disposable project that the singular
operation is currently supported, authorized, and queues the requested event
and recording work. If its response cannot prove the request was accepted for
the exact person, or if it cannot be tied to the exact historical-deletion
status below, **disable PostHog cleanup alone**. Local deletion, and
independent Customer.io/OneSignal jobs, continue.

Historical completion is not the initial response. Poll only:

```text
GET https://us.posthog.com/api/projects/{project_id}/persons/deletion_status/?person_uuid={person_uuid}&status=pending
GET https://us.posthog.com/api/projects/{project_id}/persons/deletion_status/?person_uuid={person_uuid}&status=completed
Authorization: Bearer <personal_api_key>
```

Require exactly one record for the immutable person UUID, `status=completed`,
and non-null `delete_verified_at`. Otherwise remain `accepted_pending` or
`blocked`; never claim historical completion. PostHog says deletion is
asynchronous and concerns events captured before the request. If the person is
recreated or late events appear, stop claiming completion and alert.

### OneSignal

Use only the exact external-ID path:

```text
DELETE https://api.onesignal.com/apps/{app_id}/users/by/external_id/{external_id}
Authorization: Key <app-scoped_app_api_key>
```

The path is `/users/by/{alias_label}/{alias_id}` with literal
`alias_label=external_id`; URL-encode the exact UUID. No body, email, custom
alias, segment, export, subscription selector, or organization key. The
official API returns `202` and asynchronously deletes the user, aliases,
properties, subscriptions, and devices.

OneSignal documents no per-user deletion-status endpoint. Thus `202` is
`accepted_pending`, not completion. If approved as a verification experiment,
poll the exact external-ID view-user path:

```text
GET https://api.onesignal.com/apps/{app_id}/users/by/external_id/{external_id}
Authorization: Key <app-scoped_app_api_key>
```

After a prior `202`, repeated bounded `404` results can be labeled
**observed absent**. This proves only that the exact live external ID was not
read back at that time; it does not prove all backups, archives, or provider
retention copies were erased. Do not label it provider-confirmed purge.

Retry 429 only after `Retry-After`; retry bounded 503/backoff. A 400/401/409
fails or blocks. A timeout is ambiguous: exact read-back first, then retry the
same exact request only within the lease/budget. A 404 is not blindly treated
as success; after an accepted request it may be treated as observed absence
only under the approved read-back rule.

### Customer.io

Use the exact customer ID, never email or `cio_id`:

```text
DELETE https://track.customer.io/api/v1/customers/{identifier}
Authorization: Basic base64(site_id:track_api_key)
```

Use `https://track-eu.customer.io` for an EU workspace. The Track API uses
Site ID as username and Track API key as password; region must be configured,
not guessed. The documented result is HTTP `200` with `{}`. That is
**documented deletion accepted/API completion**, not a claim about backup,
message-delivery history, or internal retention. Customer.io says a later
update can recreate the person; the server must prevent updates after local
deletion.

If an approved App API credential and documented exact-ID read is available,
optionally query the customer with `id_type=id` (for example the exact
`GET /v1/customers/{customer_id}/attributes`, `activities`, or `messages`
resources on `https://api.customer.io`/`api-eu.customer.io`). A 404 or empty
result can distinguish current-profile/activity visibility where that
resource’s contract supports it; it cannot turn the Track `200` into proof
that historical events, delivery logs, or backups were purged. Report profile
absence and historical-event status separately. Do not require this optional
read to complete first-party deletion.

Do not substitute suppression or unsubscribe. Suppression is a separate
`POST /api/v1/customers/{identifier}/suppress` behavior that deletes and
suppresses the exact identifier, and is irreversible until unsuppressed; use
only after a separate product decision. Normal unsubscribe retains a profile
and is not erasure.

## Completion rules and unknowns

The local completion assertion is the committed transaction, not provider
success. The overall receipt must distinguish:

* **First party:** committed exact-user deletion.
* **PostHog:** `completed` only after exact status, exact person UUID, and
  non-null `delete_verified_at`; otherwise pending/blocked. If the singular
  API cannot establish this relationship, PostHog remains disabled.
* **OneSignal:** `accepted_pending`; optionally `observed_absent` after exact
  external-ID readback 404. Neither proves all backups/retention erased.
* **Customer.io:** documented exact-ID HTTP `200 {}` accepted; optional reads
  may separately show current-profile absence. No documented per-customer purge
  status exists.

Unknowns requiring provider/product confirmation are the live availability and
response of PostHog’s singular endpoint, whether it creates the exact status
record, OneSignal’s lack of a completion API, Customer.io historical-event
semantics, all provider backup/retention behavior, and what to do if any
provider person contains another Consumed UUID. None permits a broader request.

## Disposable negative-control gate

Use disposable **User A** and **User B**, both linked to all applicable
providers, with separate provider IDs, events, subscriptions/devices,
Customer.io attributes, and first-party profiles/content. Give B a realistic
friend edge to C and a block edge to D. Give A an A-B friend edge.

Delete A using only A’s authenticated session. A’s local/provider records are
checked according to the rules above. B’s auth/profile/activity/lists/ratings,
social content/DNA, PostHog person/events, OneSignal identity/subscriptions,
and Customer.io data must remain unchanged. The A-B edge may disappear because
it is the relationship involving the deleted A; that is expected and is not a
B mutation. B-C and B-D must remain, proving unrelated relationship data was
not selected by a broad delete. Test mapping ambiguity, provider outage,
timeouts, 429/503, duplicate workers, kill switch, circuit thresholds, and
late-ingestion rejection with the same B controls.

## Keys and approval prerequisites (no secrets now)

After explicit approval, the backend would need only the minimum scoped
credentials: PostHog project/region plus a personal key with `person:write`;
OneSignal app ID plus an app-scoped App API key; Customer.io workspace region,
Site ID, and Track API key; and, only if optional read-back is approved, a
Customer.io App API bearer token with exact customer-read scopes. Supabase
server-side token verification/RPC access uses the existing controlled backend
path. No credentials have been requested or installed.

Official sources: [PostHog deletion](https://posthog.com/docs/privacy/data-storage#data-deletion),
[PostHog persons API](https://posthog.com/docs/api/persons#post-api-projects-project_id-persons-bulk_delete),
[OneSignal delete](https://documentation.onesignal.com/reference/delete-user),
[OneSignal view](https://documentation.onesignal.com/reference/view-user),
[OneSignal keys](https://documentation.onesignal.com/docs/en/keys-and-ids),
[Customer.io Track](https://docs.customer.io/integrations/api/track/),
[Customer.io delete](https://docs.customer.io/integrations/api/track/tag/track-customers/delete/),
and [Customer.io suppress](https://docs.customer.io/integrations/api/track/tag/track-customers/suppress/).

This file makes no code, database, configuration, provider, or user-data
changes. It is a design pending explicit 3B approval.