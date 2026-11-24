-- Only after every active reader uses corrected RLS and scoped host checks pass.
begin;
set local lock_timeout = '5s';
do $$
begin
  if exists (
    select 1 from pg_policies where schemaname = 'public'
      and policyname in ('Allow public read lists', 'Allow public read list items')
  ) or (
    select count(*) from pg_policies where schemaname = 'public' and cmd = 'SELECT' and
      (tablename, policyname) in (('lists', 'final_lists_select'), ('list_items', 'final_items_select'))
      and qual like '%list_access_private.can_read_list%'
  ) <> 2 then
    raise exception 'Corrected list policies are not active';
  end if;
end;
$$;
drop function public.list_read_rollout_ids(uuid, uuid[], text);
notify pgrst, 'reload schema';
commit;
