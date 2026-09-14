# iOS surface-labeling release check

Use the existing authorized build configuration. Do not enable the paused
PostHog migration, rotate keys, or change capture/recording settings.

## Release blocker found in local validation

**Do not treat the current source as a replay-safe release candidate yet.**
The focused `node scripts/validate-posthog-release.mjs` check confirms normal
capture recovery and configuration loading, but fails replay recovery:
the existing wrapper's opt-out/reset/opt-in sequence clears persisted recording
configuration. All three app scenarios (browser, iPhone browser, simulated
Capacitor iOS) fail to start recording. A plain-SDK control using the identical
local recording configuration starts automatically and emits real rrweb data.

The scoped change removed the three remote-config suppression flags and fixed
the stale account-setup marker. It did not add configuration-restoration logic,
change recording settings, or rewrite auth/reset behavior to resolve this
newly demonstrated blocker. No iOS assets were prepared.

## Native collection warning — read before building

A successful `prepare:ios` run includes an initialized PostHog JavaScript SDK
in the packaged Capacitor app: the command requires the existing build key,
and shared client startup calls the initializer. Released **1.0.6 (23)** had
the SDK bundled but uninitialized. This is therefore **not a metadata-only
change relative to that released binary**.

Once the account/lifecycle capture gate allows it, the candidate enables:

- Account identification: account UUID, email, name/display name, username,
  and the existing `is_internal` classification.
- Navigation: route pageviews and pageleave, plus SDK URL/referrer,
  browser/OS/device, viewport, anonymous/device and session identifiers.
- Automatic interaction capture, including eligible DOM element metadata/text
  under the SDK/project privacy rules.
- Media tracking: media type, destination list, and whether a rating exists.
- Play: rank/poll/pool/item/moment IDs, responses, stars, points, correctness,
  challenge type, and whether a take exists. The featured DNA answer itself
  is included; rank comment text and take text are not explicit event fields.
- Friend casting: description length, whether a friend account exists, and
  celebrity name.
- Sign-in/sign-out events.
- Session replay **if enabled by the existing remote project configuration**:
  DOM content and interaction snapshots. SDK defaults mask input values, but
  do not globally mask ordinary displayed text. Remote masking, sampling,
  console and network-recording behavior must not be inferred from this list.

Removing remote-config suppression allows the project's configuration to load;
it does not itself change project recording settings. No new event callers or
recording settings were added in this release-baseline adjustment. Separate
first-party/server analytics already present in build 23 are not this new
direct client collection path.

The capture gate is account/lifecycle authorization, **not optional analytics
consent**. Signed-out guest capture is allowed after auth resolution. A
successful packaging check is not physical-device evidence or approval of
the newly active native collection.

## Build and copy current assets

```sh
npm run prepare:ios
```

This runs the normal web build and `cap copy ios`, then compares every built
file with its packaged copy. It stops before copying if the existing PostHog
build key is missing, controlled ingestion is enabled, or expected labeling
code is absent. It never prints the key or modifies environment settings.

This replaces generated web assets with the latest application source, not
just the labeling changes. Review all intended release changes normally.
The command does not change the native version/build, sync native dependencies,
create a signed archive, publish the website, or submit to App Store Connect.

## Required physical-iPhone check before submission

Use the actual candidate installed from the newly prepared native project.
Under the existing privacy/account rules, verify a pageview, a custom event,
and a real autocaptured interaction have:

```text
surface: ios_app
platform: ios
```

Verify browser usage, including Safari on that same iPhone, instead has:

```text
surface: web_app
platform: web
```

Confirm capture remains blocked when account authorization blocks it, resumes
after a temporary account lookup failure resolves, and labels survive an
ordinary sign-out/sign-in or SDK reset. Verify recording configuration loads
and replay recovers across these transitions when project settings enable it.

The isolated SDK tests are not physical-device evidence. A generated web bundle
is not an installed or signed native release. Do not mark the device check
complete until the candidate binary itself has been tested.

Backend-generated events remain separate; no origin labels are inferred for them.