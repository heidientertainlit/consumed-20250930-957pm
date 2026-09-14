---
name: Provider deletion safety
description: UUID-only deletion scope, staged enablement, and limits of client-only ingestion guards.
---

Deletion suppression applies to the deleted account UUID, never an email ban. A legitimate signup receiving a new UUID remains a new account, even with the same email.

**Why:** The user explicitly distinguished preventing stale provider-record recreation from preventing a person signing up again.

**How to apply:** Keep cleanup jobs and tombstones bound to exact verified UUIDs; do not match deleted accounts by email.

Production provider cleanup requires a separate explicit user approval after the complete disposable target/control release test passes. Implementation and disposable-testing approval is not real-user enablement approval.

**Why:** Provider erasure cannot roll back with the first-party transaction.

**How to apply:** Preserve default-off controls and report unperformed provider tests as blocked, not as passing mocked tests.

Client-side identity checks do not prevent old installed clients from calling providers directly. A proxy alone also does not close a still-public provider ingestion endpoint.

**Why:** Review found legacy direct PostHog capture and native OneSignal identity calls outside app-owned server checks.

**How to apply:** Require provider-side enforcement or verified supported identity controls before claiming complete stale-UUID ingestion prevention; account for native SDK compatibility before enabling enforcement.