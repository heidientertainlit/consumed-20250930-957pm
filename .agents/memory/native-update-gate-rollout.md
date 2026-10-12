---
name: Native update gate rollout
description: Release-order constraint for remotely enforcing minimum supported native app versions.
---

The first iOS release containing the remote update checker must set its minimum supported version no higher than that release. Clients released before the checker cannot see or enforce remote update policy.

**Why:** Remote update enforcement only works after the checking code is installed. Raising the minimum before users receive the bootstrap release creates a false expectation that older binaries can be forced to update.

**How to apply:** Ship and establish adoption of the checker-bearing release first. For a later release, raise `latest_version` for a soft prompt, and raise `minimum_supported_version` only when blocking older checker-bearing clients is intentional.

Automatic update discovery must be a one-time setup, not something the user must remember to build in or configure for each new release.

**Why:** The user explicitly said, “I don't want to have to remember to build that in with every new version,” and asked for verified findings rather than guesses.

**How to apply:** Check the existing checker and live configuration first. Automate discovery of published App Store versions and synchronization of the remote settings; distinguish verified live facts from assumptions about what shipped inside an archived native release.

The user selected “Require the update before they can continue” for automatic new App Store releases, rather than dismissible reminders.

**Why:** The user explicitly chose mandatory updates after being told that they block access for older checker-equipped apps.

**How to apply:** Preserve automatic mandatory-update policy for compatible public iOS releases. Do not silently switch it back to reminders or introduce per-release manual version-setting work.