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

Use centered popups for the profile safety menu and its Block confirmation,
without changing other app dialogs.

**Why:** The user chose centered popups instead of bottom sheets after navigation
covered the profile menu.

**How to apply:** Keep the centered profile flow modal, with navigation dimmed and
inactive; preserve the existing presentation of unrelated callers.

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

Test expanding search results inside their real owning modal, not only inside
a standalone search panel.

**Why:** Standalone book-series checks passed while the user reported Track
closing on expansion. The panel alone cannot exercise backdrop dismissal or
React event propagation through the owning portal.

**How to apply:** Cover expansion, child selection, portal event isolation,
inside-origin retargeted clicks, and deliberate outside/X closing together.
Distinguish an injected retargeted-click regression test from reproducing the
user's original tap or verifying installed iOS behavior.

Do not attribute recovery during diagnostic hot reload to a functional fix
without evidence.

**Why:** A real Preview trace showed the SVG arrow reaching its toggle,
expanding the list and loading books; the user confirmed that result with a
screenshot. The temporary tracing had not changed interaction behavior.

**How to apply:** Distinguish the confirmed successful attempt from the
unexplained earlier failure. Remove temporary observers, verify executable
behavior is unchanged, and test the actual chevron rather than only its label.
Do not invent a cache, focus, or reload explanation from recovery alone.
