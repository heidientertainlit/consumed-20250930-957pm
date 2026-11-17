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
The user subsequently confirmed successful Vercel Preview and Production builds
after native dependency installation, without moving browser checks out of
Vercel. This verifies the narrower approach in those build environments, not
repeat-run reliability or complete application behavior.

**How to apply:** Check the actual failing build log and current Vercel build-image
documentation. Preserve every test and distinguish a documented dependency
remedy from a fix verified in Vercel. Do not assume Ubuntu dependency-install
commands work on Amazon Linux.

Vercel build-log retrieval can truncate individual records at 4,096 characters,
even when querying raw build events.

**Why:** The Vercel agent observed the same diagnostic record truncated at that
boundary through both CLI logs and the raw API, with no continuation record.

**How to apply:** When remote-only failures require structured diagnostics,
keep each record short and independently numbered, and put the failing phase
and final state first. Do not rely on a large JSON line or on files from a
failed build being downloadable.
