---
name: Portable npm lockfile
description: Prevent Replit-internal package URLs from breaking npm installs outside Replit.
---

Keep committed npm lockfiles free of `package-firewall.replit.local` resolved URLs. Use public `https://registry.npmjs.org/` tarball URLs while preserving locked versions and integrity hashes.

**Why:** Replit's transparent package proxy can write internal tarball addresses into the lockfile. Those addresses resolve inside Replit but fail during clean Mac/Capacitor installs.

**How to apply:** After any dependency operation in Replit, scan the lockfile for the internal hostname before delivery. If found, normalize only the registry prefix and verify with a public-registry `npm ci --dry-run` plus the normal build.