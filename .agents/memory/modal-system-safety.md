---
name: Shared modal rollout safety
description: Staged modal adoption, portal lifecycle hazards, and older iOS background-interaction requirements.
---

Adopt the shared modal policy in tested flow groups; do not turn on a global
layer change or migrate custom/retired overlays without review.

**Why:** The user approved a shared foundation first, preserving existing
styling, form data, behavior and the working Finished-media follow-up, with
review before remaining dialogs/custom overlays or any production/native release.

**How to apply:** Keep portal ownership, nested confirmation order and floating
controls together. Verify real save/cancel/retry and continuation flows, not
only isolated dialog visibility. See the project documentation for rollout scope.

Do not move or unregister live modal portal hosts for transient ref changes.

**Why:** Radix/Vaul can clear and restore composed refs during a single commit.
Treating that as a new opening can place a parent above a nested confirmation;
moving a host during pointerdown can cancel the click and lose pointer capture.

**How to apply:** Preserve logical ancestry and stable host lifetimes. Include
real drawer taps and nested cancellation in regression checks.

Background blocking cannot depend only on native inert support.

**Why:** The project's older iOS compatibility range includes WKWebView versions
without native inert; successful Chromium focus checks do not establish that
background navigation is disabled there.

**How to apply:** Test a no-native-inert fallback and restore existing background
state/listeners after the last modal closes. Actual native keyboard verification
still follows the separate iOS keyboard constraints.
