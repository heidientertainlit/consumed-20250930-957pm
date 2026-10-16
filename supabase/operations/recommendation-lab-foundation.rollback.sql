-- Destructive only to lab additions. Stops if any lab data exists: export it
-- and obtain explicit approval before removing it. Never use CASCADE.
begin;
set local lock_timeout = '3s';
do $$
begin
  if to_regclass('public.recommendation_lab_items') is not null then
    if exists (select 1 from public.recommendation_lab_items) then
      raise exception 'Lab items exist. Export and obtain approval before deleting experiment data.';
    end if;
  end if;
  if to_regclass('public.recommendation_lab_runs') is not null then
    if exists (select 1 from public.recommendation_lab_runs) then
      raise exception 'Lab runs exist. Export and obtain approval before deleting experiment data.';
    end if;
  end if;
end;
$$;
drop function if exists public.recommendation_lab_foundation_status();
drop function if exists public.recommendation_lab_create_draft(text,jsonb);
drop table if exists public.recommendation_lab_runs;
drop table if exists public.recommendation_lab_items;
drop function if exists public.recommendation_lab_is_admin();
-- Remove ONLY this migration's bookkeeping record, never repair other history.
delete from supabase_migrations.schema_migrations where version = '20261016010000';
commit;

-- vector was absent at preflight. It is intentionally retained by this script
-- in case another feature starts using it. To remove it too, after confirming
-- nobody else now uses it, separately run: DROP EXTENSION vector RESTRICT;
-- RESTRICT fails safely if another object depends on it.
