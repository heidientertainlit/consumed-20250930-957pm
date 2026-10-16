-- Non-destructive checkpoint rollback: disable the private worker while keeping
-- prepared works, costs, frozen comparisons and feedback available for export.
-- Disable/remove ONLY the new admin-recommendation-lab Edge Function and remove
-- its admin UI route separately. Do not redeploy any consumer function.
begin;
set local lock_timeout='3s';
drop function if exists public.recommendation_lab_worker(text,uuid,jsonb);
delete from supabase_migrations.schema_migrations where version='20261016020000';
commit;
-- The original two-table foundation remains. Its full rollback intentionally
-- refuses nonempty tables. Obtain explicit deletion approval before removing
-- any experiment data; never use CASCADE.
