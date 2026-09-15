---
name: Portable npm lockfile
description: Prevent Replit-internal package URLs from breaking npm installs outside Replit.
---

Keep committed npm lockfiles free of `package-firewall.replit.*` resolved URLs, including `.local` and `.internal`. Use public `https://registry.npmjs.org/` tarball URLs while preserving locked versions and integrity hashes.

**Why:** Replit's transparent package proxy can write internal tarball addresses into the lockfile. Those addresses resolve inside Replit but fail during clean Mac/Capacitor installs.

**How to apply:** After any dependency operation in Replit, scan the lockfile for the internal hostname before delivery. If found, normalize only the registry prefix and verify with a public-registry `npm ci --dry-run` plus the normal build.

Also compare existing optional dependency entries after targeted lockfile updates.

**Why:** An isolated npm 11 update pruned existing optional packages even though their declarations were unchanged. A successful install alone did not prove those optional capabilities were preserved.

**How to apply:** Preserve unrelated locked versions and optional capabilities, inspect dependency-tree changes, and run a fresh install against the final lockfile rather than relying on an earlier candidate's successful install.