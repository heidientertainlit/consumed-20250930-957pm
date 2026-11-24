-- PREPARED ONLY. Use the exact receipt from the approved, committed data run.
-- Keep the write pause enabled. This reverses list data, not the security fix
-- or the corrected signup trigger. A rollback is not permission to reopen writes.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
lock table public.users in share row exclusive mode;
lock table public.lists in share row exclusive mode;
lock table public.list_items in share row exclusive mode;

create temporary table system_list_rollback_input(receipt jsonb not null) on commit drop;
-- INSERT INTO system_list_rollback_input VALUES (... exact committed receipt JSON ...);

create temporary table system_list_revert on commit drop as
select r.* from system_list_rollback_input i
cross join lateral jsonb_to_recordset(i.receipt) as r(
  list_id uuid, user_id uuid, migrated_title text, migrated_is_default boolean,
  share_id text, inserted boolean, prior_title text, prior_is_default boolean,
  prior_updated_at timestamp, prior_fingerprint text, migrated_fingerprint text
);
alter table system_list_revert add primary key(list_id);

select set_config('app.system_list_maintenance','on',true);
do $$
declare
  rel regclass;
  has_new_reference boolean;
begin
  if (select count(*) from system_list_rollback_input) <> 1
     or not exists(select 1 from system_list_revert)
     or (select count(*) from pg_catalog.pg_trigger
         where (tgrelid,tgname) in (('public.lists'::regclass,'pause_five_system_list_writes'),
                                   ('public.list_items'::regclass,'pause_five_system_item_writes'))
           and tgenabled in ('O','A')
           and tgfoid = 'list_provisioning_private.pause_list_writes()'::regprocedure) <> 2 then
    raise exception 'SYSTEM_LIST_ROLLBACK_REQUIRES_RECEIPT_AND_WRITE_PAUSE';
  end if;
  if exists (
    select 1 from system_list_revert r left join public.lists l on l.id=r.list_id
    where r.inserted is null or l.id is null or l.user_id is distinct from r.user_id
       or l.title is distinct from r.migrated_title
       or l.is_default is distinct from r.migrated_is_default
       or l.share_id is distinct from r.share_id
       or md5(to_jsonb(l)::text) is distinct from r.migrated_fingerprint
       or (r.inserted and (r.prior_title is not null or r.prior_is_default is not null or r.prior_fingerprint is not null
                           or r.migrated_title <> all(array['Currently','Want To','Finished','Did Not Finish','Favorites'])
                           or r.migrated_is_default is not true))
       or (not r.inserted and r.prior_fingerprint is null)
  ) then
    raise exception 'SYSTEM_LIST_ROLLBACK_DRIFT: a receipt row no longer matches';
  end if;

  -- Refuse to delete newly created rows with any saved items, FK dependencies
  -- or known soft/JSON references. Hold the same relations until commit.
  for rel in
    select relation from (
      select distinct conrelid::regclass as relation from pg_catalog.pg_constraint
        where contype='f' and confrelid in ('public.lists'::regclass,'public.list_items'::regclass)
      union select 'public.list_items'::regclass
      union select to_regclass('public.'||name)
        from unnest(array['social_posts','notifications','canonical_media_backfill_plans']) name
        where to_regclass('public.'||name) is not null
    ) candidates order by relation::text
  loop
    execute format('lock table %s in share mode',rel);
    execute format(
      'select exists(select 1 from %s t cross join pg_temp.system_list_revert r
       where r.inserted and (strpos(to_jsonb(t)::text,r.list_id::text)>0
         or (nullif(r.share_id,'''') is not null and strpos(to_jsonb(t)::text,r.share_id)>0)))',rel)
      into has_new_reference;
    if has_new_reference then
      raise exception 'SYSTEM_LIST_ROLLBACK_REFERENCES: dependent data in %',rel;
    end if;
  end loop;
  delete from public.lists l using system_list_revert r where l.id=r.list_id and r.inserted;
  update public.lists l set title=r.prior_title,is_default=r.prior_is_default
    from system_list_revert r where l.id=r.list_id and not r.inserted;

  -- The existing update timestamp trigger still records this new write.
  if exists (
    select 1 from system_list_revert r left join public.lists l on l.id=r.list_id
    where (r.inserted and l.id is not null)
       or (not r.inserted and md5((to_jsonb(l)-'updated_at')::text) is distinct from r.prior_fingerprint)
  ) then
    raise exception 'SYSTEM_LIST_ROLLBACK_RESULT_MISMATCH';
  end if;
end $$;
select count(*) filter(where inserted) as empty_new_lists_removed,
       count(*) filter(where not inserted) as existing_lists_restored
from system_list_revert;
-- A committed inverse is a separately approved action.
rollback;
