-- PREPARED ONLY. Never run without a reviewed manifest and separate approval.
-- Run foundation first. No rows/items/relationships are deleted or recreated.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- Lock app profiles first, matching the signup trigger's lock order.
lock table public.users in share row exclusive mode;
lock table public.lists in share row exclusive mode;
lock table public.list_items in share row exclusive mode;

-- Supply ONLY individually verified misclassified system records. Empty by default.
-- Review every title across ALL five system lists, not just Want To.
create temporary table approved_system_list_repairs(
  list_id uuid primary key, expected_user_id uuid not null, expected_title text not null
) on commit drop;
-- INSERT INTO approved_system_list_repairs VALUES (... reviewed IDs ...);

create temporary table approved_system_list_operations(fingerprint text not null) on commit drop;
-- INSERT INTO approved_system_list_operations VALUES (... reviewed dry-run operation fingerprint ...);

-- These are verification fingerprints/identity receipts, not copies of user content.
create temporary table system_list_preflight on commit drop as
select id,user_id,title,is_default,updated_at,
  md5((to_jsonb(l)-'updated_at')::text) as prior_fingerprint,
  md5((to_jsonb(l)-array['title','is_default','updated_at'])::text) as stable_fingerprint
from public.lists l;
create temporary table system_item_preflight on commit drop as
select count(*) item_count, md5(coalesce(string_agg(to_jsonb(i)::text,'' order by id),'')) fingerprint
from public.list_items i;
create temporary table system_relationship_preflight(
  relation regclass primary key, fingerprint text
) on commit drop;
do $$
declare rel regclass; fingerprint text;
begin
  for rel in select relation from (
    select distinct conrelid::regclass as relation from pg_constraint
      where contype='f' and confrelid in('public.lists'::regclass,'public.list_items'::regclass)
        and conrelid<>'public.list_items'::regclass
    union
    select to_regclass('public.'||name) from unnest(array[
      'social_posts','notifications','canonical_media_backfill_plans'
    ]) name where to_regclass('public.'||name) is not null
  ) candidates order by relation::text
  loop
    execute format('lock table %s in share mode',rel);
    execute format('select md5(coalesce(string_agg(to_jsonb(r)::text,'''' order by to_jsonb(r)::text),'''')) from %s r',rel) into fingerprint;
    insert into system_relationship_preflight values(rel,fingerprint);
  end loop;
end $$;
select set_config('app.system_list_maintenance','on',true);
do $$
declare r record; u record; after_fingerprint text;
begin
  -- Obsolete per-media/system definitions are not silently accepted as a sixth
  -- destination or demoted by name alone. Review them before any data repair.
  if exists(select 1 from public.lists where is_default=true and
    (title is null or not title=any(array['Currently','Want To','Queue','Finished','Did Not Finish','Favorites']))) then
    raise exception 'SYSTEM_LIST_REVIEW_REQUIRED: unsupported historical system destination';
  end if;
  for r in select * from approved_system_list_repairs loop
    if not exists(select 1 from public.lists where id=r.list_id and user_id=r.expected_user_id
      and title=r.expected_title)
      or not r.expected_title = any(array['Currently','Want To','Finished','Did Not Finish','Favorites'])
      or exists(select 1 from public.lists where user_id=r.expected_user_id and title=r.expected_title and is_default=true and id<>r.list_id) then
      raise exception 'Reviewed classification repair no longer matches: %',r.list_id;
    end if;
    update public.lists set is_default=true where id=r.list_id and is_default is not true;
  end loop;
  -- Existing dual system destinations: only EMPTY Queue rows may be retired.
  -- Keep their UUIDs/share IDs and all relationships; do not invent a lossy merge.
  for r in select q.* from public.lists q where q.title='Queue' and q.is_default=true
    and exists(select 1 from public.lists w where w.user_id=q.user_id and w.title='Want To' and w.is_default=true)
  loop
    if exists(select 1 from public.list_items where list_id=r.id)
      or exists(select 1 from public.list_collaborators where list_id=r.id) then
      raise exception 'SYSTEM_LIST_MERGE_REVIEW_REQUIRED: %',r.id;
    end if;
    update public.lists set is_default=false where id=r.id;
  end loop;
  for u in select id from public.users order by id loop
    -- This separately approved script runs as the private routine's owner.
    -- The public RPC has no administrative exception.
    perform list_provisioning_private.ensure_system_lists_for_owner(u.id);
  end loop;
  if exists(select 1 from public.lists where title='Queue' and is_default=true) then
    raise exception 'Queue system lists remain';
  end if;
  if exists(select 1 from public.users account_row where
    (select count(*) from public.lists l where l.user_id=account_row.id and l.is_default=true
      and l.title=any(array['Currently','Want To','Finished','Did Not Finish','Favorites']))<>5) then
    raise exception 'Incomplete standard-list reconciliation';
  end if;
  if exists(select 1 from system_list_preflight b left join public.lists a using(id)
    where a.id is null or md5((to_jsonb(a)-array['title','is_default','updated_at'])::text) is distinct from b.stable_fingerprint) then
    raise exception 'Existing list identity, ownership, privacy or other metadata changed';
  end if;
  if (select (count(*),md5(coalesce(string_agg(to_jsonb(i)::text,'' order by id),'')))
      from public.list_items i)
    is distinct from (select (item_count,fingerprint) from system_item_preflight) then
    raise exception 'Saved item content or association changed';
  end if;
  for r in select * from system_relationship_preflight loop
    execute format('select md5(coalesce(string_agg(to_jsonb(t)::text,'''' order by to_jsonb(t)::text),'''')) from %s t',r.relation)
      into after_fingerprint;
    if after_fingerprint is distinct from r.fingerprint then
      raise exception 'Dependent relationship changed: %',r.relation;
    end if;
  end loop;
end $$;

create temporary table system_list_inverse_receipt on commit drop as
select a.id as list_id,a.user_id,a.title as migrated_title,a.is_default as migrated_is_default,
  a.share_id,b.id is null as inserted,b.title as prior_title,b.is_default as prior_is_default,
  b.updated_at as prior_updated_at,b.prior_fingerprint,md5(to_jsonb(a)::text) as migrated_fingerprint
from public.lists a left join system_list_preflight b using(id)
where b.id is null or (a.title,a.is_default) is distinct from (b.title,b.is_default);
-- The fingerprint intentionally omits fresh UUIDs for inserts; their actual IDs
-- appear in the inverse receipt. Reuse the dry-run fingerprint on the commit run.
create temporary table actual_system_list_operations on commit drop as
select md5(coalesce(string_agg(jsonb_build_array(user_id,case when not inserted then list_id end,
   inserted,prior_title,prior_is_default,migrated_title,migrated_is_default,prior_fingerprint)::text,
   '|' order by user_id,migrated_title,inserted,case when not inserted then list_id end),'')) as fingerprint
from system_list_inverse_receipt;
do $$
begin
  if exists(select 1 from approved_system_list_operations) then
    if (select count(*) from pg_catalog.pg_trigger
        where (tgrelid,tgname) in (('public.lists'::regclass,'pause_five_system_list_writes'),
                                  ('public.list_items'::regclass,'pause_five_system_item_writes'))
          and tgenabled in ('O','A')
          and tgfoid = 'list_provisioning_private.pause_list_writes()'::regprocedure) <> 2 then
      raise exception 'SYSTEM_LIST_RELEASE_REQUIRES_WRITE_PAUSE';
    end if;
    if (select count(*) from approved_system_list_operations) <> 1
          or (select fingerprint from approved_system_list_operations)
             is distinct from (select fingerprint from actual_system_list_operations) then
      raise exception 'SYSTEM_LIST_MANIFEST_CHANGED: rerun the rollback-only review';
    end if;
  end if;
end $$;
select fingerprint as operation_fingerprint from actual_system_list_operations;
-- Retain this receipt from the SUCCESSFUL COMMIT run, not the dry-run UUIDs.
select coalesce(jsonb_agg(to_jsonb(r) order by list_id),'[]'::jsonb) as system_list_rollback_receipt
from system_list_inverse_receipt r;
-- Until production approval, this file deliberately ends in ROLLBACK.
-- Approved execution must explicitly replace this with COMMIT after reviewing assertions/receipt.
rollback;
