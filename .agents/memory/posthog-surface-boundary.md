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
Test expired-policy refresh separately: fresh-policy recovery passed while
the deliberately expired-policy fixture did not resume recording.