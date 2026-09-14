# PostHog Section 1 cutover checklist

**Status: staged guest-gateway verification only.** `posthog-capture` is
deployed alone at active version 1 with `verify_jwt = false`; no other
function/frontend/migration was deployed, no capture token was rotated, and no
provider cleanup was enabled. The existing server-only `POSTHOG_API_KEY`
fallback remains in use until the replacement token is separately staged.
Frontend rollout remains off.

## Before any token rotation

- [ ] Review the Edge gateway, Edge producer, SQL migration, and focused tests.
- [x] Test migrations 007 then 008 in one rolled-back production transaction:
  the real deletion routine removed fixture A, recorded one tombstone and
  exactly three provider jobs, and preserved fixture B. No schema or fixture
  persisted and no provider HTTP request committed.
- [ ] Install migration 007 through the isolated migration path before any
  producer that requires its tombstone table. Keep cleanup controls disabled.
  Migration 007 supplies the tombstone and atomic provider-job infrastructure;
  migration 008 requires it and changes the database analytics producer.
  Neither migration deletes historical PostHog people or events.
- [ ] Store the already approved database-webhook secret in Supabase Vault as
  `analytics_webhook_secret` and set the identical value as the
  `ANALYTICS_WEBHOOK_SECRET` Edge secret. Do not print either value or put it
  in source.
- [ ] Set the Supabase Edge secrets/configuration needed by
  `posthog-capture`: `POSTHOG_GUEST_HMAC_SECRET` (new high-entropy secret
  generated through the approved secrets flow), `SUPABASE_SERVICE_ROLE_KEY`
  (the existing project Edge secret), and `POSTHOG_CAPTURE_HOST`. During
  staged rotation `POSTHOG_CAPTURE_TOKEN` is primary and existing
  `POSTHOG_API_KEY` is an explicit server-only fallback; remove the fallback
  after confirmation. `VITE_SUPABASE_URL` is the only client target input and
  must be the exact project URL, never localhost and never a provider token.
- [x] Provision `POSTHOG_GUEST_HMAC_SECRET` through approved secret management
  and deploy it to the dormant `posthog-capture` function. The value is never
  logged, printed, committed, or included in client bundles. Deployed
  metadata returned HTTP 200 and showed the intended project configuration;
  no secret value is recorded here.
- [ ] Keep `VITE_POSTHOG_CONTROLLED_INGESTION` unset/`false` until the Edge
  endpoint and disposable capture matrix pass. Off preserves the existing
  `VITE_POSTHOG_KEY` legacy PostHog path so this staged change does not silently
  turn analytics off; the rotated server capture token must never be added to
  Vite configuration. Enable the flag only in the reviewed frontend release.
- [ ] Configure `POSTHOG_ALLOWED_ORIGINS` explicitly with the deployed app,
  marketing, approved preview, and native origins. The current
  `REPLIT_DEV_DOMAIN` is added as one explicit `https://` origin when present;
  arbitrary Origin reflection and `*` are prohibited.
- [ ] Confirm the Supabase project is the intended
  `mahpgcogwpawvviapqza` project. Do not use a management token from another
  workspace and do not request a service-role secret through client config.
- [x] Verify deployed metadata through the Supabase Management API: status
  `ACTIVE`, version `1`, `verify_jwt=false`, and metadata
  `ezbr_sha256`
  `a237094d4b1b0e4a273d789eb0705638a82d85761cd58c71632a9a7f402472cf`.
  The Management API ESZIP body was downloaded with `--use-api`; extracted
  deployed source matched the workspace handler/index/policy/provider-guard
  files. (The raw ESZIP body hash is separately recorded in the test report.)

## Website impact

- With `VITE_POSTHOG_CONTROLLED_INGESTION=true`, the web SDK initializes with
  a hardcoded non-provider placeholder and sends single events to the absolute
  Supabase Edge `/functions/v1/posthog-capture` path; it never embeds a real
  capture token. With the flag unset/false, it intentionally preserves the
  existing `VITE_POSTHOG_KEY` legacy path until the reviewed rollout.
- Autocapture remains enabled; pageleave is a manual authenticated
  `fetch(..., { keepalive: true })` event because sendBeacon cannot carry auth
  headers. Batching, feature-flag/decide
  proxying, arbitrary PostHog paths, and client-side person/deletion APIs are
  intentionally unavailable.
- Authenticated events use the UUID derived from the verified Supabase session
  and the live `public.users` row. Deleted/missing/unknown account status
  fails closed. Guests receive a server-issued signed opaque token in the
  non-account `guest:` namespace.
- Live guest-gateway verification passed: issuance `200`, exact synthetic
  event `200`, and PostHog project `294186` readback count `1` for the exact
  derived guest ID. Invalid bearer `401`, top-level spoof selector `400`,
  `/batch` `404`, and disallowed CORS had no allow-origin header. This does
  not prove authenticated capture: `deleted_account_tombstones` is absent,
  so live-account requests intentionally fail closed with `503` pending
  migration 007.
- Existing browser clients released before this change still call PostHog
  directly with the old public token and are **unsafe until cutover**.

## Database producer compatibility order

- First install migration 007 with cleanup disabled. Only then deploy and
  test the reviewed `track-analytics` bundle before applying migration 008.
  The trusted-secret parser accepts both the
  old top-level `distinct_id` and new `user_id` envelope during this narrow
  transition, but always resolves the candidate against the live
  `public.users` row; bearer/browser callers cannot use either field.
- Run old-producer and new-producer compatibility fixtures. Only after that
  evidence may migration 008 replace the current trigger producer with
  the `user_id` envelope. Migration 008 requires 007 and does
  not recreate its tombstone schema.

## Current iOS build impact

- No native auth, OneSignal, or iOS SDK code is changed in this lane.
- The current installed iOS build still contains its old direct analytics
  behavior until a replacement app build is shipped. After same-project token
  rotation, that old build's analytics is expected to stop by design; this is
  independent of Supabase authentication and must not be described as an auth
  outage.
- A new native build must point its web runtime at the exact Supabase project
  URL in `VITE_SUPABASE_URL` and pass disposable guest,
  authenticated, sign-out, and deleted-account tests before release.
- Old installed builds cannot be made safe retroactively. The minimum-app
  retirement/update gate remains a separate release decision.

## Exact rollback plan if analytics stop flowing

1. Do **not** restore the old token to client bundles and do **not** attempt a
   second rotation. Same-project PostHog rotation invalidates the old token
   immediately, so rollback to that credential is not available.
2. Pause any provider-cleanup rollout/flags (they remain disabled in this
   lane), keep first-party writes operating, and preserve the Edge gateway.
3. Check gateway 401/404/503/502 rates, exact secret-name presence, the Vault
   to Edge webhook-secret match, `public.users`/tombstone lookup availability,
   and the PostHog capture response without logging payloads or credentials.
4. Forward-fix the Edge gateway/producer with the still-current replacement
   token or corrected configuration, run the focused negative-control tests,
   and redeploy the Edge path. There is no claim of a reversible
   old-token rollback.
5. Keep rotation cleanup paused until a new-token disposable capture,
   authenticated identity, guest identity, deleted-account rejection, and
   database-producer verification all pass.

## Marketing site versus app verification

`www.consumedapp.com` source is not in this workspace, so the marketing
portion remains **blocked, not assumed**. A bounded public inspection on
2026-09-14 fetched the HTML (2,551 bytes) and its hashed bundle
`/assets/index-CMW48Bu3.js` (921,589 bytes). The bundle was found to
initialize the installed PostHog SDK directly against
`https://us.i.posthog.com` with `capture_pageleave: true` and a public `phc_`
token. Its keyed SHA-256 matched the currently configured app public token
without exposing either value. This is a concrete direct-provider finding, not
an absence claim. Before rotation an owner must provide the actual deployed
marketing source/configuration owner approval and move it to an approved
  controlled path. A separate project would be a new proposal, not part of
  this approved same-project migration.
The required artifact is this bounded, redacted snippet (not a request to
publish anything):

```text
GET https://www.consumedapp.com/ (status, final URL, Content-Security-Policy)
first-party/external <script src="..."> and module import URLs
network/API host lines containing posthog, /capture, /e, /decide, or /batch
keyed fingerprint(public project token) = <hash only, never raw value>
same PostHog project as app.consumedapp.com? yes/no/unknown
```

Record only:

- script/API host names and whether they point at PostHog directly or a
  controlled gateway;
- a keyed hash/fingerprint of any public project token for comparison (never
  print or store the raw public key);
- whether it uses the same PostHog project as `app.consumedapp.com`.

If marketing uses the same project and still calls PostHog directly, rotation
will break marketing analytics and the current bundle remains an uncontrolled
client identity/provider path. The gated plan is to move marketing to the
approved controlled gateway before rotation; a vague
“marketing should be checked” statement is not sufficient. Verification for
the app is a separate disposable event matrix: guest pageview/autocapture,
authenticated identified event, sign-out guest event, DB-trigger event, and
negative tests for batch/identity spoofing.

## Explicit hold points

- No historical PostHog event/person deletion.
- No provider-cleanup flags, queue enablement, or provider cleanup requests.
- No nativeauth JWT/OneSignal work in this lane.
- No frontend rollout, other-function deployment, migration application, or
  token rotation until review, migration rollback evidence, current iOS impact
  review, and marketing-source comparison are complete. The guest gateway
  alone is not a rotation approval.
