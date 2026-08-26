---
name: Canonical profile identity
description: Security and onboarding rules for confirming names and usernames across OAuth and email signup.
---

Resolve canonical profile identity before routing: silently accept complete email-signup identity, send incomplete OAuth identity to one setup step, and never treat lookup failures as incompleteness. Established profiles must not repeat setup or DNA.

**Why:** Competing checks and blanket reconfirmation caused redirect loops and duplicate forms; OAuth still needs an app-specific handle, while verification can delay otherwise-complete email identity.

**How to apply:** Keep confirmation server-managed, username uniqueness case-insensitive, and confirmed handles immutable. Correctable conflicts go to editable setup; transport/database failures show retry.