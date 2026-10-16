---
name: Supabase migration history drift
description: Safe deployment rule for this project's divergent local and remote Supabase migration histories.
---

The linked Supabase project does not consider many newer local migration files applied even though their corresponding features are already live. Never run a normal all-migrations database push from the workspace without first checking a dry run.

**Why:** A standard dry run listed many unrelated historical migrations as pending. Replaying them alongside a new change could mutate production outside the current task.

**How to apply:** Use an isolated temporary Supabase workdir containing the new migration plus empty placeholders for versions already recorded remotely. Link it to the existing project and require a dry run that lists only the intended migration before applying it. Do not repair remote migration history speculatively.

Temporary migration workdirs need actual CLI linkage, not just a project-ref file, in this environment.

**Why:** A project-ref-only workdir selected a legacy IPv6 database connection, but the workspace network does not support IPv6. Linking the temporary workdir resolved an IPv4 connection without altering the main project configuration.

**How to apply:** Link the isolated workdir before its dry run. Keep connection material out of logs and source control; never reinterpret a networking failure as permission to bypass migration-scope checks.