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

Verify production function-log access before pausing cron or replacing functions when log inspection is a release requirement.

**Why:** Management API log inspection returned HTTP 410 during a release preflight even though function metadata and rollback downloads worked. Deployment access does not establish access to production logs.

**How to apply:** Establish a working read-only log-inspection path first. If the approval requires log verification and access fails, stop before production changes rather than deploying without the required verification.

Supabase's supported Management API log endpoint is `/analytics/endpoints/logs`, with ClickHouse queries against the unified `logs` table. This project's working source filter is `source`; nested attributes use `log_attributes` map keys.

**Why:** Supabase retired `logs.all` in September 2026; its HTTP 410 does not mean project logs are unavailable. The replacement exposes both function request/status records and runtime/error events.

**How to apply:** Correlate `function_edge_logs` and `function_logs` by function/execution IDs and deployed version, using bounded time windows. Check HTTP status and query errors before interpreting empty results.

Verify downloaded deployment dependencies from normalized runtime imports, not raw TypeScript imports.

**Why:** Downloaded bundles correctly omit type-only dependencies. Traversing every source-level import produced a false missing-dependency failure even though the active runtime implementation matched.

**How to apply:** Erase TypeScript types before traversing and comparing dependencies. A missing type-only file is not a deployment defect; missing or mismatched runtime source is.

Bundle isolated downloaded sources before executing local baseline tests.

**Why:** Direct Node/tsx imports of extracted TypeScript outside the project's package boundary exposed CommonJS export behavior, causing a false missing-export failure. Bundling restored the module's real exports.

**How to apply:** For executable comparisons against downloaded baseline code, use an ESM bundle and mocked dependencies; do not interpret a direct-import packaging error as a deployed-code defect.