# Replay-prototype validation results

**Status: NO-GO — local gateway prototype only; do not activate or release.**  
**Recorded:** 2026-09-14

## Fresh local Chromium results

Final repository checks: `npm test` passed **226/226**; the production build
passed; `git diff --check` passed. These do not override the failing browser
preservation gate below. The normal app login preview also rendered correctly.

`./node_modules/.bin/tsx scripts/validate-replay-prototype.mjs` was run against
the actual full `posthog-js` distributions using `/repl/tools/bin/chromium`.
The fixture uses only `consumedapp.test` and `www.consumedapp.test`; it is not
a published-origin check.

Before adding the consent-transition probe, the local gateway path passed:

| SDK | Legacy items | Gateway-forwarded items | Actual snapshots | Local rrweb proof |
| --- | ---: | ---: | ---: | --- |
| 1.352.0 | 10 | 10 | 2 | 26 rrweb entries; type-2 full snapshot |
| 1.430.3 | 8 | 8 | 2 | 24 rrweb entries; type-2 full snapshot |

Those runs used the stock SDK and exercised clicks, explicit pageview, test logger,
pagehide/unload, actual `/e/` and `/s/` requests, masking, fixed recorder
asset routing, opaque lease removal, and did not forward the local credential
sentinel. The harness now also compares normalized event URL metadata,
autocapture element metadata, and relevant event properties while excluding
random IDs/timing and the local-host variant.
The earlier comparison was coarse and is not a full event-property parity
proof. The strengthened suite must finish successfully before that claim is made.

## Current failing gate

The strengthened fresh run adds a real SDK `opt_out_capturing()` no-event probe
followed by `opt_in_capturing()` and a fresh controlled lease epoch. It fails
for SDK 1.352.0 on the **controlled** path:

```text
no actual SDK $snapshot after opt-in recovery
```

Ordinary events recover and forward (`$pageview`, `optin_recovered`,
`$autocapture`, `test_logger`, and `$pageleave`); the recorder is not running
after the consent transition. Therefore the prior local snapshot result is
useful baseline evidence but is not full consent-lifecycle parity and must not
be used for approval.

The harness explicitly asserts that `optout_blocked` is absent, that
`optin_recovered` returns after opt-in, that stock `$autocapture` exists, that
the real event URL preserves `utm_source=replay-fixture`, and that rejected or
unapproved gateway requests are recorded as failures.

The strengthened run stops at the 1.352.0 failure. A complete strengthened
1.430.3 consent/property-comparison result is therefore still outstanding;
its earlier basic replay result must not be substituted.

## Validation matrix

| Requested evidence | Final status |
| --- | --- |
| Full SDK/basic replay transport for both versions | Local synthetic baseline passed; not live playback |
| Consent recovery with replay | **FAIL** on controlled 1.352.0 |
| Complete before/after event and autocapture property parity | **Not passed**; strengthened run stops at replay failure |
| Actual PostHog playback | **Blocked**; recordings read scope missing |
| consumedapp.com and www.consumedapp.com | **Not verified**; only local .test host fixtures |
| App/iOS webview behavior | **Not verified** on a device or released binary |
| Pageleave/unload | Local Chromium basic path exercised; background/iOS/offline coverage incomplete |
| Credential exclusion | Local synthetic lease stripping, snapshot/network sentinel and config-leak tests passed; full live audit incomplete |
| Account switching/logout | Client late-context and retry tests passed; server epoch revocation for already-stamped queues is unwired |
| Deletion during buffered/in-flight uploads | In-memory gateway barrier tests passed; real authenticated deletion/provider processing not validated |
| No direct PostHog capture | Local fixture routing checked; actual app, marketing/GTM and native audit incomplete |

The current adapter can drop captures while authorization is pending or
expired. Its five-minute lease has no separate upload grace, and integration
of server epoch revocation with SDK queues remains unfinished. These are
preservation/security blockers, not approved tradeoffs.

## Asset regeneration

The 1.430.3 fixture artifact is regenerated from its exact public npm archive
only when absent, after verification against npm’s version-specific SRI digest.
See `scripts/README-replay-prototype-validation.md`. This is a local test cache
only and adds no production dependency.

## Unclosed evidence gaps

- No PostHog product playback was verified. The available key receives `403`
  because it lacks `session_recording:read`; local rrweb structure is not
  playback proof.
- No live provider capture/playback, production capture token, real identity,
  durable ledger/deletion barrier, or published origin was used. Read-only
  permission probes used the existing administrative key without exposing it:
  missing scopes were `project:read` and `session_recording:read`.
- No iOS device or webview evidence exists.
- The fixture’s local synthetic first-party authentication is not production
  authentication.

Keep the full SDK and current direct integrations unchanged. No flag activation,
deployment, provider configuration, token use, or cleanup is authorized by
this report.