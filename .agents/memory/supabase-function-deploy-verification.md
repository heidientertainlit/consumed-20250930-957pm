---
name: Supabase function deploy verification
description: How to verify that a reported Edge Function deployment actually replaced the active bundle.
---

Treat bulk or parallel Supabase Edge Function deployment output as provisional until each critical function's active version or bundle hash changes.

**Why:** A bulk deployment reported success while one intended function remained on its previous active bundle, leaving old behavior live.

**How to apply:** For regression-critical deployments, compare `supabase functions list` version, update time, and bundle hash before and after. Explicitly redeploy any unchanged target and verify it again. For compatibility repairs, also compare the active entrypoint with the tested local code and verify that unrelated function versions and database security definitions/grants remain unchanged; local tests alone do not establish what is running.

Keep production deploy workflows manual and separate from the main Project/startup workflow.

**Why:** Putting one-shot Supabase deploy commands in the Project workflow caused every function to deploy automatically when the development workspace started; one function expected a migration that production did not yet have and returned HTTP 500.

**How to apply:** The Project workflow should start only development services. Before deploying an Edge Function that references a new column, verify the production migration has already been applied or deploy the previous schema-compatible function.

The Management API function-body response can be an ESZIP archive, not a plain TypeScript file.

**Why:** Feeding the downloaded body directly into a source transformer fails on the archive header and cannot verify the deployed entrypoint.

**How to apply:** Extract the relevant module before source comparison; account for TypeScript transpilation when comparing it with workspace code.