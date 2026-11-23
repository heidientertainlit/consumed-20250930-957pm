-- PREPARED ONLY. Never run without a reviewed manifest and separate approval.
-- Run foundation first. No rows/items/relationships are deleted or recreated.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
lock table public.lists in share row exclusive mode;
lock table public.list_items in share row exclusive mode;

-- Supply ONLY individually verified misclassified system records. Empty by default.
-- Review every title across ALL five system lists, not just Want To.
create temporary table approved_system_list_repairs(
  list_id uuid primary key, expected_user_id uuid not null, expected_title text not null
) on commit drop;
-- INSERT INTO approved_system_list_repairs VALUES (... reviewed IDs ...);

-- These are verification fingerprints/identity receipts, not copies of user content.
create temporary table system_list_preflight on commit drop as
select id,user_id,title,is_default,updated_at from public.lists;
create temporary table system_item_preflight on commit drop as
select count(*) item_count, md5(coalesce(string_agg(to_jsonb(i)::text,'' order by id),'')) fingerprint
from public.list_items i;
create temporary table system_relationship_preflight(
  relation regclass primary key, fingerprint text
) on commit drop;
do $$
declare rel regclass; fingerprint text;
begin
  for rel in
    select distinct conrelid::regclass from pg_constraint
      where contype='f' and confrelid in('public.lists'::regclass,'public.list_items'::regclass)
        and conrelid<>'public.list_items'::regclass
    union
    select to_regclass('public.'||name) from unnest(array[
      'social_posts','notifications','canonical_media_backfill_plans'
    ]) name where to_regclass('public.'||name) is not null
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
    perform public.ensure_standard_system_lists(u.id);
  end loop;
  if exists(select 1 from public.lists where title='Queue' and is_default=true) then
    raise exception 'Queue system lists remain';
  end if;
  if exists(select 1 from system_list_preflight b left join public.lists a using(id)
    where a.id is null or a.user_id is distinct from b.user_id) then
    raise exception 'List identity/ownership changed';
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
-- Capture this metadata-only inverse receipt securely before COMMIT; never commit PII/data exports.
select b.*,a.title as migrated_title,a.is_default as migrated_is_default
from system_list_preflight b join public.lists a using(id)
where (a.title,a.is_default) is distinct from (b.title,b.is_default);
-- Until production approval, this file deliberately ends in ROLLBACK.
-- Approved execution must explicitly replace this with COMMIT after reviewing assertions/receipt.
rollback;
