---
name: Safety release workflow
description: Preserve the existing automatic development-to-release routine when adding safety gates.
---

Preserve the user's existing Replit → GitHub → Vercel workflow and automatic
deployment routine. Do not introduce required feature branches, pull requests,
or additional manual release steps without separate agreement.

**Why:** The user explicitly wants the simplest reliable safety setup, not a
workflow overhaul or changes to application functionality.

**How to apply:** Prepare and verify local testing changes first. Keep existing
build enforcement until the replacement release gate has been proven against
passing, failed, skipped, cancelled, and missing results for the exact commit.

For browser startup failures on Vercel, investigate the build image's native
package support before proposing a different release workflow.

**Why:** Vercel documents an Amazon Linux 2023 build image with additional
packages installable through `dnf`; Playwright's Ubuntu fallback browser may
download successfully but fail before tests start because shared libraries
are absent. A downloaded browser is not evidence that the OS can launch it.

**How to apply:** Check the actual failing build log and current Vercel build-image
documentation. Preserve every test and distinguish a documented dependency
remedy from a fix verified in Vercel. Do not assume Ubuntu dependency-install
commands work on Amazon Linux.
