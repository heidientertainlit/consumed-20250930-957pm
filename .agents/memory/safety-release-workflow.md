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
