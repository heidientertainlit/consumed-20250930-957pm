# Released iOS/PostHog impact report

> Update, 2026-09-14: a user-supplied archive now verifies packaged version
> 1.0.6/build 23. See `released-ios-1.0.6-build-23-static-audit.md`.
> Its bundled PostHog singleton is not initialized by app code, and the
> workspace-configured capture token was not found. The earlier
> direct-capture/token-rotation expectations below are conditional historical
> analysis and must not be applied to that archive. Migration remains paused.

## Scope and status

This is a source-and-release-artifact review only. It does not inspect
production user data or claim to verify live configuration. No controlled
PostHog rollout, provider-token rotation, OneSignal cleanup enablement, or
minimum-version enforcement is recorded as enabled in the current workspace
release material.

The central release distinction is:

- **Source version:** the checked-in iOS project is configured as
  `MARKETING_VERSION = 1.0.7` and `CURRENT_PROJECT_VERSION = 25`
  (`ios/App/App.xcodeproj/project.pbxproj`).
- **Released version:** **unknown**. No signed IPA, `.xcarchive`, TestFlight
  export, or equivalent released bundle is available in this workspace.

The historical App Store-labelled tag is not sufficient to identify the
installed binary: its label says Version 1 / Build 10, while the native source
recorded at that point says marketing version `1.0` / build `8`. That mismatch
must not be silently resolved by treating the current source value
(`1.0.7 (25)`) as the released App Store value.

## Current source behavior

### Native update gate

The update checker is present in the current source at
`client/src/components/app-update-gate.tsx`. It runs only on iOS, reads the
first-party `app_version_config` row, and compares the installed Capacitor
version with the configured latest/minimum versions. The configuration
migration is
`supabase/migrations/20260909010000_add_native_app_version_config.sql`; its
source seed is `1.0.7` for both latest and minimum.

Historical release sources predate this checker. A binary that does not contain
the checker cannot be forced to show an update screen by changing a remote
row. The first checker-bearing release must therefore ship and gain adoption
before a later release raises the enforced minimum.

### PostHog

The current source uses `posthog-js` with full SDK autocapture and does not
disable session recording in `client/src/lib/posthog.ts`. The controlled
ingestion path is opt-in through
`VITE_POSTHOG_CONTROLLED_INGESTION=true`. The checked-in default/documented
state keeps that path off and preserves the direct legacy path to
`https://us.i.posthog.com` using the public Vite token, with SDK batching.

The controlled gateway source currently handles single event capture and guest
authorization. It is not evidence of a replay-preserving production cutover:
replay `/s/` traffic, recorder assets/configuration, large/compressed replay
payloads, unload/beacon behavior, partial batches, and offline retry behavior
still require the validation described in
`exports/posthog-replay-preserving-architecture.md` and
`exports/posthog-cutover-checklist.md`.

### OneSignal

Current source checks the exact live first-party account row before native
OneSignal login and serializes identity transitions. That is a property of a
replacement client, not of already-installed binaries. The release-results
record (`exports/provider-cleanup-release-results.md`) correctly keeps
real-user provider cleanup blocked because old native clients can still call
the provider directly and cannot be retroactively routed through the new
check.

## Post-rotation user experience: proven versus inferred

### Proven from source/release records

1. An already-installed pre-cutover client continues to execute its embedded
   direct PostHog path; it has no server gateway fallback.
2. A pre-checker iOS binary has no remote update-gate UI and cannot be forced
   to update by the version-configuration row.
3. The current source's controlled path is not enabled merely because the
   gateway code exists. Enabling it requires the explicit build-time Vite flag
   and a replacement web/native bundle.
4. OneSignal's new live-account check cannot protect an old binary that still
   contains the old direct provider behavior.

### Expected, but not runtime-verified against the exact released bundle

If the same PostHog project token is rotated while an old direct-capture binary
remains installed, its PostHog requests using the old public token are expected
to be rejected or cease producing provider-side analytics. The app has no
source-level user-facing “analytics unavailable” screen; the likely user
experience is continued normal app use with missing analytics, not an
automatic update prompt. This is an architectural consequence of the direct
provider path and token invalidation, not a claim that an exact App Store
binary was exercised.

For a deleted account, the current replacement client is designed to stop
capture/provider identity setup after the live-row check. An old client may
continue attempting direct PostHog capture and/or OneSignal identity calls
until it is retired or otherwise prevented from running. Whether any
particular late request is accepted, rejected, or already buffered cannot be
claimed without the exact released binary and a controlled runtime test.

## Required release evidence and decision

Before describing the released iOS impact as verified, obtain the actual
released artifact or authoritative store/TestFlight metadata containing:

- `CFBundleShortVersionString` and `CFBundleVersion`;
- the exact web bundle and build-time analytics configuration;
- the signed artifact or immutable artifact hash; and
- the release channel/date (App Store, TestFlight, or internal distribution).

Until that evidence exists, report **source = 1.0.7 (25); released =
unknown**. Do not state that old users will receive the update gate, that
controlled PostHog ingestion is active, or that deleted-user provider
suppression is enforced for existing installs.