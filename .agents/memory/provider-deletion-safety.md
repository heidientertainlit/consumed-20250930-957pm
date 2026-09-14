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

Do not use a 404 from a write-only or unsupported provider endpoint as proof of deletion.

**Why:** Customer.io Track API GET returned 404 for both an existing disposable control and a deletion target. Only a supported read API with verified permissions can establish profile/activity absence or unchanged control data.

**How to apply:** Separate successful deletion-request evidence from verified erasure. Likewise, manually seeded worker jobs prove worker behavior, not the authenticated first-party-deletion-to-provider flow; reserve full release PASS for the actual integrated target/control test.

For native identity-verification work, verify the pinned release's public headers and callback lifetime contract rather than assuming the latest documentation applies to the installed wrapper.

**Why:** Review found documented lifecycle methods absent from released iOS headers, a non-escaping token-refresh completion incompatible with a deferred JavaScript callback, and edits in generated Cordova sources that synchronization would erase.

**How to apply:** Keep bridge changes in reproducible source, distinguish interface checks from native compilation/device proof, and leave enforcement off when compatibility is unproven.

PostHog migration must preserve session replay and full behavioral analytics on both the app and marketing website; event-only capture and custom click tracking are not acceptable substitutes.

**Why:** The user explicitly rejected disabling recording, deleting existing recordings, or degrading analytics during the security migration.

**How to apply:** Keep the full SDK; validate event and replay transport, configuration, unload delivery and identity transitions together. Standard reverse-proxy support does not establish custom deletion enforcement.

Further controlled-capture/replay migration work requires renewed user authorization; preserve the existing production analytics path and retain the isolated prototype without expanding it.

**Why:** After the NO-GO result, the user explicitly withdrew implementation authorization and required evidence about the actual released iOS binary before further migration work.

**How to apply:** Limit the next investigation to read-only release/artifact/existing-telemetry evidence. Do not interpret audit access as permission to publish, activate capture controls, rotate tokens, change recording settings, enable cleanup, or perform deletion tests.