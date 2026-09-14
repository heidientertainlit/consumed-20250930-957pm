---
name: PostHog surface labeling boundaries
description: SDK snapshot exceptions and separation from the paused ingestion migration.
---

Do not rely on `register()` alone to label recording snapshots. The inspected PostHog SDKs (1.352.0 and 1.430.3) take only the persisted distinct ID in their `$snapshot` property path, not all superproperties. A composed `before_send` hook can label the outgoing envelope.

**Why:** The SDK's general superproperty documentation sounds broader than the snapshot implementation. Envelope metadata also does not establish that PostHog indexes those fields as recording-level filters.

**How to apply:** Preserve prior privacy/consent hooks and null results. Verify outgoing events with isolated SDK tests; distinguish envelope coverage from recording UI behavior. Keep raw rrweb content and recording settings unchanged.

Client metadata work does not authorize the paused ingestion migration or deployment of unrelated staged changes.

**Why:** The user authorized surface labeling independently, while explicitly keeping transport, credentials, replay settings, cleanup, and migration unchanged.

**How to apply:** Review the actual release diff before any later publishing request. Do not infer backend event origins or an installed native binary's behavior from current client source.

Do not describe native labeling as metadata-only until the shipped archive's
SDK initialization and call sites are verified.

**Why:** The inspected released iOS archive bundled PostHog without initializing
it. A later source build can therefore introduce active collection even when
the immediate patch only concerns labels or remote-configuration compatibility.

**How to apply:** Explicitly disclose native initialization, identity fields,
event categories, and project-controlled replay before building. SDK presence
alone is not proof of prior collection, and local browser tests are not
physical-device release evidence.

Prove replay recovery separately from event capture and remote-config loading.

**Why:** With the inspected SDK, the app's opt-out/reset/opt-in sequence can
clear recording configuration even though ordinary capture resumes. A plain
SDK control recorded with the same local configuration while the app wrapper
did not.

**How to apply:** Use the actual wrapper and real recorder, include a plain-SDK
control, and require snapshots after lifecycle transitions. Do not treat a
successful config request, opt-in, or custom event as replay evidence.

Check SDK compatibility against the distributed module actually imported by
the app, not only the readable library source or snippet bundle.

**Why:** PostHog's readable source exposed a remote-config loader field whose
name was mangled in both published module and snippet bundles. A source-only
review incorrectly suggested that field could be called at runtime.

**How to apply:** Avoid readable private-field adapters and guessed minified
names. Exercise the production module entry in local real-recorder tests.
When retaining SDK project policy across identity resets, preserve its original
expiry and settings only—never user/session state or sampling decisions.
Expiry diagnostics must separate successful config-script loading from
script-error/JSON-fallback behavior.

**Why:** The failed expiry fixture forced config.js to return 404. SDK 1.352.0
leaves that failed tag unmarked, then waits on its already-failed load event
during refresh. Plain SDK and wrapper both reproduced the stall; successful
script loading allowed expiry recovery. Ordinary capture continued.

**How to apply:** Do not classify that fixture as proof that normal expiry
always breaks replay. Compare plain SDK, successful script, and failed-script
fallback controls; retain the distinction between a conditional SDK loader bug
and app identity-policy restoration.

Upgrade comparisons must expire policy beyond each tested SDK's actual TTL
and compare native SDK reset with the app's policy-restoration helper separately.

**Why:** A ten-minute fixture is expired for 1.352.0 but fresh for 1.433.3
(one-hour TTL). Re-registering policy after reset changes the newer SDK's
refresh path. Native reset recovered in isolated app-wrapper tests without
that registration, including delayed responses across opt-out and account
switching. Recording success alone does not prove expired policy was refreshed.

**How to apply:** Keep the approved assessment separate from implementing an
upgrade. Remove the old compatibility helper atomically with the SDK upgrade,
not while 1.352.0 remains installed. Do not add the external-script preparation
workaround. Review changed collection defaults before native rollout:
Meta-cookie attribution conflicts with the current non-advertising-identifier
description unless those reads are prevented or the intended collection is
explicitly reconciled. Web-vitals attribution defaults apply only when
project/client configuration enables web-vitals collection.

Do not describe `save_campaign_params: false` as removing all attribution or
advertising identifiers.

**Why:** It prevents new campaign persistence and the newer SDK's Meta-cookie
reads, but session-entry/initial attribution can still be reconstructed from
URLs. Referrers, existing local/server properties, and query strings remain.
Consumed's first-party referral rewards are independent of SDK campaigns.

**How to apply:** Separate cookie-read prevention from URL sanitization and
historical data handling. Check which property family a report uses before
claiming its attribution is unaffected. Keep new web-vitals attribution
explicitly off if preserving the older metric detail; do not override the
project's web-vitals enablement or metric allowlist.