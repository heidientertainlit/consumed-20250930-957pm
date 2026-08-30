---
name: Supabase migration history drift
description: Safe deployment rule for this project's divergent local and remote Supabase migration histories.
---

The linked Supabase project does not consider many newer local migration files applied even though their corresponding features are already live. Never run a normal all-migrations database push from the workspace without first checking a dry run.

**Why:** A standard dry run listed many unrelated historical migrations as pending. Replaying them alongside a new change could mutate production outside the current task.

**How to apply:** Use an isolated temporary Supabase workdir containing the new migration plus empty placeholders for versions already recorded remotely. Link it to the existing project and require a dry run that lists only the intended migration before applying it. Do not repair remote migration history speculatively.