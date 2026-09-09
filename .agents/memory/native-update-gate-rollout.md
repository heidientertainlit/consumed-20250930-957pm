---
name: Native update gate rollout
description: Release-order constraint for remotely enforcing minimum supported native app versions.
---

The first iOS release containing the remote update checker must set its minimum supported version no higher than that release. Clients released before the checker cannot see or enforce remote update policy.

**Why:** Remote update enforcement only works after the checking code is installed. Raising the minimum before users receive the bootstrap release creates a false expectation that older binaries can be forced to update.

**How to apply:** Ship and establish adoption of the checker-bearing release first. For a later release, raise `latest_version` for a soft prompt, and raise `minimum_supported_version` only when blocking older checker-bearing clients is intentional.