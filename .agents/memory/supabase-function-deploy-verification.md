---
name: Supabase function deploy verification
description: How to verify that a reported Edge Function deployment actually replaced the active bundle.
---

Treat bulk or parallel Supabase Edge Function deployment output as provisional until each critical function's active version or bundle hash changes.

**Why:** A bulk deployment reported success while one intended function remained on its previous active bundle, leaving old behavior live.

**How to apply:** For regression-critical deployments, compare `supabase functions list` version, update time, and bundle hash before and after. Explicitly redeploy any unchanged target and verify it again.