# Recommendation lab: storage foundation only

This documents the original storage-only checkpoint. The subsequent bounded
end-to-end checkpoint is documented in
[recommendation-lab-checkpoint.md](recommendation-lab-checkpoint.md); its private
service worker supersedes the original draft-only write restriction without
granting direct browser writes or connecting consumer recommendations.

## Scope

Migration `20261016010000` adds `vector` in `extensions`, two public tables
(`recommendation_lab_items`, `recommendation_lab_runs`), three lab-only
functions, two read policies, and a run-list index. It installs no triggers,
jobs, model clients, preparation, candidate generation, ranking, feedback writer,
Edge Functions, UI, or consumer connection.

All production relations are untouched. Informational `existing_canonical_id`
and `created_by` UUIDs intentionally have no production foreign keys: adding such
keys would install triggers on existing referenced tables. The sole foreign key
is between the two new tables.

Source facts, profiles and three nullable 256-dimensional embeddings share the
items table. Model, dimensions and input hash are mandatory when any vector is
stored. A future model change must use a new representation/profile version;
never compare vectors from different model/input versions.

## Admin authorization and storage

Only `authenticated` can call the lab RPCs. Each privileged operation checks
`auth.uid()` against authoritative `public.users.is_admin`, excludes personas,
and fails closed for absent users. JWT metadata cannot grant admin access.
All SECURITY DEFINER functions have a fixed `pg_catalog` search path and
qualified table names. Guest and service-role direct access is not granted.

Human admins can SELECT the tables through RLS. They cannot directly INSERT,
UPDATE, DELETE, TRUNCATE, or create policies/triggers on them. The only enabled
write is:

```ts
supabase.rpc("recommendation_lab_create_draft", {
  p_label: "My comparison",
  p_configuration: {}
});
```

This creates an empty draft owned by the authenticated admin. It accepts no
source record, generated result, spend amount, or caller identity.

`recommendation_lab_foundation_status` reports counts and disabled capabilities.
`recommendation_lab_is_admin` is the shared policy check. No caller can submit SQL
or select a production write destination through these functions.

There is no UI or new HTTP Edge Function at this stage. Supabase's existing RPC
API validates session tokens; the gateway configuration of existing functions
is unchanged.

## Explicitly deferred

Before model calls can be introduced, implement an atomic experiment-wide
reservation/settlement operation enforcing the $15 hard ceiling across concurrent
runs, retry accounting, and resumable preparation. Cost columns are inert storage,
not a claim that spending enforcement is already implemented.

Similarly, evaluations/results are bounded JSON storage only. Later writes need
targeted transactional updates, validation, immutable comparison snapshots, and
exact run/configuration/candidate attribution.

Production canonical aliases/fingerprints may later be read as evidence. Do not
invoke enrichment/search helpers that write production records as a side effect.

## Apply and verification

The app uses external Supabase project `mahpgcogwpawvviapqza`. Its migration
history diverges from the workspace; never run an unrestricted database push.

`scripts/verify-recommendation-lab-foundation.mjs` uses the existing management
credential without printing it. Modes:

- `preflight`: confirms project identity, expected absence, and records hashes of
  current recommendation source files and existing Edge Function metadata.
- `test`: applies the migration in a repeatable-read transaction, tests real
  database roles/RLS, draft creation/validation, denial paths, vector storage and
  provenance, and guarded rollback; the entire transaction is rolled back.
- `apply`: uses an isolated CLI workdir and placeholders for recorded migrations;
  checks that dry-run proposes only this migration, then applies this exact SQL
  plus its single migration-history record in a verified transaction. Existing
  public table data and schema are fingerprinted before/after within that same
  repeatable-read transaction. A mismatch aborts everything.
- `verify`: checks empty lab tables, pgvector, permissions, policies, function
  definitions, and unchanged existing Edge Function metadata/source hashes.

The apply/test write modes are explicit operations, not run on app startup or as
part of the consumer build. Evidence files live under `/tmp` and contain only
schema/data digests and test outcomes, not user data or secrets.

## Rollback

Stop before adding any new dependencies on this foundation. Run
`supabase/operations/recommendation-lab-foundation.rollback.sql` with authorized
database access. It refuses to run if either table contains lab data, drops only
the lab functions/tables (which removes their policies/indexes), and removes only
its own migration-history record.

If lab data exists later, export it and get explicit deletion approval first.
Never use `CASCADE` to bypass dependency checks. The script is transactional.

The extension was absent before this change. It can separately be removed with
`DROP EXTENSION vector RESTRICT` after checking nobody else has started using it.
The default rollback retains it to avoid breaking future consumers.
