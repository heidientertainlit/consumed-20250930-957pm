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