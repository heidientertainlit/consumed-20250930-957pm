# PostHog Section 1 implementation and test results

**Decision: guest gateway verified; production release remains blocked.**
`posthog-capture` alone is deployed at active version 1 with
`verify_jwt=false`; no other function/frontend/migration, token rotation, or
provider cleanup was deployed/enabled.

## Implemented controls

- **PASS — Supabase Edge-owned ingress.**
  `supabase/functions/posthog-capture` is configured `verify_jwt = false` and
  authenticates its own Supabase bearer session or signed guest token. It
  exposes only the function root, `/e`, `/capture`, and `/guest`; `/batch`,
  `/decide`, deletion paths, unknown paths, arrays, and oversized bodies are
  rejected. It uses the project Edge `SUPABASE_SERVICE_ROLE_KEY` to verify
  sessions and live account rows. `POSTHOG_CAPTURE_TOKEN` is primary; the
  Edge function documents existing `POSTHOG_API_KEY` as a server-only legacy
  fallback until staged rotation.
- **PASS — SDK token boundary.** `client/src/lib/posthog.ts` no longer reads
  a replacement capture token. Its `VITE_POSTHOG_CONTROLLED_INGESTION` flag
  defaults off so the existing `VITE_POSTHOG_KEY` legacy path preserves
  analytics until staged rollout; when enabled, its absolute target is
  `VITE_SUPABASE_URL/functions/v1/posthog-capture` with no localhost fallback.
  Controlled mode disables compression/batching and provider
  feature-flag/decide requests, and sends pageleave through manual
  authenticated `fetch(..., { keepalive: true })`, not sendBeacon.
- **PASS — async identity generation guards.** Controlled client callbacks
  bind the expected auth UUID and generation before/after session refresh and
  capture/identify; auth refresh, logout, account-switch, and stale
  identify callbacks cannot silently downgrade to guest or label a later
  account. Failed guest issuance clears its cached promise, signed expiry
  renews the token, and one 401 retry is bounded without auth downgrade.
- **PASS — authenticated identity derivation.** The Edge gateway and
  `track-analytics` authenticate the Supabase bearer subject, query the exact
  authoritative `public.users` row, and check the immutable
  `deleted_account_tombstones` row immediately before sending. Missing or
  erroring account/tombstone state fails closed. Client `distinct_id`,
  `user_id`, aliases, groups, and nested equivalents cannot choose identity.
- **PASS — guest boundary.** The Edge gateway issues a signed, opaque,
  server-random guest cookie/session token and derives a non-account
  `guest:<sha256>` namespace. Guest `$identify`, `$create_alias`, and
  `$merge_dangerously` events are rejected. No client UUID becomes a guest
  identity.
- **PASS — deployed guest smoke/readback.** Management metadata GET returned
  `ACTIVE`, version `1`, `verify_jwt=false`; the ESZIP body downloaded via
  `--use-api` extracted to source matching the workspace Edge files. The raw
  ESZIP body SHA-256 was
  `8fc5795cebba59b27afce342872209e557078fce14a77275aaae72bc45de0a11`;
  metadata `ezbr_sha256` was
  `a237094d4b1b0e4a273d789eb0705638a82d85761cd58c71632a9a7f402472cf`.
  Guest issuance was `200`, the exact synthetic event was `200`, and a
  read-only PostHog project `294186` query filtered to the exact derived guest
  ID returned count `1`. The token itself was never printed.
- **PASS — producer envelope.** The shared policy accepts exactly one event,
  properties, optional timestamp, and (only for the authenticated database
  producer) one UUID. It recursively strips identity/transport overrides
  while preserving ordinary event properties and verified server email.
  `track-analytics` supports the trusted webhook header and authenticated
  client path without trusting body identity.
- **PASS — database producer hardening.** Migration
  `20260914000800_posthog_controlled_ingestion.sql` removes the literal
  trigger webhook secret, reads it from Vault, sends `user_id` rather than a
  client-shaped `distinct_id`, and records deletion tombstones atomically
  with the existing Auth deletion trigger. The trusted producer parser
  temporarily accepts the old `distinct_id` envelope for ordering safety,
  while bearer/browser callers still cannot send identity fields. It contains no PostHog
  person/event deletion and no provider-cleanup enablement.

## Executed local checks

- **PASS — shared capture policy:** 7 tests, 7 passed, 0 failed, including
  trusted old-producer `distinct_id` compatibility and public-caller rejection.
- **PASS — Edge HTTP integration:** 5 tests, 5 passed, 0 failed, including
  real Request/Response guest issuance, authenticated capture, bounded gzip
  decoding/decompression-bomb rejection, CORS/path rejection, and provider
  payload assertions.
- **PASS — Edge bundle syntax:** `posthog-capture` and `track-analytics`
  bundled with esbuild.
- **PASS — client bundle syntax:** `client/src/lib/posthog.ts` bundled with
  esbuild. The full application build is owned by the main agent.
- **PASS — client authorization unit checks:** deferred authenticated A→B
  generation invalidation and expired/failed guest-token retry-state tests
  passed.
- **PASS — combined focused run:** 14 tests, 14 passed, 0 failed.
- **PASS — repository test command:** `npm test` completed with 197 tests,
  197 passed, 0 failed.

## Blocked/review-required checks

- **PASS — scoped live negative controls:** invalid bearer `401`, top-level
  spoof identity `400`, `/batch` path `404`, and disallowed CORS preflight
  `204` with no allow-origin header. No token or provider credential was
  emitted.
- **BLOCKED — authenticated capture:** `deleted_account_tombstones` and the
  007 queue tables are absent in the target database. Authenticated/live-user
  requests therefore intentionally fail closed with `503`; no identified
  event was claimed and no real Auth fixture was created.
- **PASS — Edge secret provisioning gate:** deployed metadata GET returned
  200 with the target `SUPABASE_URL`, service-role configuration, and existing
  `POSTHOG_API_KEY` fallback configuration; the newly generated
  `POSTHOG_GUEST_HMAC_SECRET` was provisioned without exposing its value.
  `POSTHOG_CAPTURE_TOKEN` rotation remains future work.
- **BLOCKED — current iOS build:** the submitted/current IPA was not inspected
  in this lane. Old direct clients remain unsafe until the controlled path and
  minimum-version retirement plan are approved.
- **BLOCKED — marketing verification/cutover:** a bounded public fetch found
  the deployed HTML and one 921,589-byte hashed bundle. The bundle initializes
  PostHog directly at `https://us.i.posthog.com` with `capture_pageleave: true`
  and a public `phc_` token. Its keyed SHA-256 matched the currently
  configured app public token without printing either value. Marketing source
  ownership/configuration is outside this workspace; it must be moved to an
  approved controlled path or separate project before rotation.
- **PARTIAL — installed SDK browser proof:** a local Chromium interception
  harness used the installed `posthog-js` 1.352.0 with controlled rollout
  enabled. It observed the SDK `$opt_in` `/e/` route, manual controlled
  `browser_sdk_fixture` capture, manual keepalive `$pageleave`, and post-logout
  guest capture; all requests were uncompressed and targeted the local
  Edge-shaped endpoint. The harness used disposable guest/auth fixtures, not
  target-project Supabase credentials, so live bearer refresh, live tombstone
  denial, and provider forwarding remain release-gated.
- **PASS — migration safety flow (transaction rolled back):** in one
  Management API SQL transaction, 007 then 008 were applied to a disposable
  fixture, A was deleted through `delete_account_transaction`, and the
  transaction was rolled back. Before rollback the exact checks were:
  tombstone A `1`, provider jobs A `3` (`posthog/customer_io/onesignal` each
  `1`), Auth A `0`, and unchanged fixture B `1`. After rollback all three
  queue tables were absent and fixture rows were `0`; no migration was left
  applied and no provider HTTP was enabled.
- **BLOCKED — full repository typecheck:** existing unrelated errors remain in
  Capacitor/plugin/admin page files. Focused new bundles and tests passed; no
  new error was reported for the changed gateway, policy, producer, or client
  module.

## Release boundary

Do not roll out the frontend, deploy other functions, apply migrations, rotate
the token, enable provider cleanup, or claim rollback-to-old-token capability
from this report. Same-project
rotation invalidates the old token immediately; if a post-rotation failure
occurs, pause cleanup and forward-fix the server path with the replacement
token. Historical PostHog data/persons remain untouched.
