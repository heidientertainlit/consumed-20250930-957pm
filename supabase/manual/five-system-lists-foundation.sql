-- PREPARED ONLY. Requires separate production approval. No automatic migration hook.
-- Existing lists schema/UUIDs/API identifiers are retained.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.protect_standard_system_lists()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  maintenance boolean := current_setting('app.system_list_maintenance', true) = 'on'
    and current_setting('role') in ('none','postgres','supabase_admin')
    and (session_user in ('postgres','supabase_admin')
      or exists(select 1 from pg_roles where rolname = session_user and rolsuper));
begin
  if coalesce(maintenance, false) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'DELETE' then
    -- Account deletion's Auth FK cascade must still work. Only the actual
    -- removal of the parent Auth row authorizes this, not a client-set flag.
    if not exists(select 1 from auth.users where id=old.user_id) then return old; end if;
    if old.is_default or old.title=any(array['Currently','Want To','Finished','Did Not Finish','Favorites']) then
      raise exception 'Permanent or unreviewed standard lists cannot be deleted' using errcode='23514';
    end if;
    return old;
  end if;
  if (tg_op='INSERT' or new.title is distinct from old.title)
    and new.title=any(array['Currently','Want To','Finished','Did Not Finish','Favorites'])
    and new.is_default is distinct from true then
    raise exception 'Standard lists must be classified as system lists' using errcode='23514';
  end if;
  if tg_op='UPDATE' and old.is_default is not true
    and old.title=any(array['Currently','Want To','Finished','Did Not Finish','Favorites'])
    and (new.title is distinct from old.title or new.is_default is distinct from old.is_default) then
    raise exception 'SYSTEM_LIST_REVIEW_REQUIRED: classification requires reviewed migration' using errcode='23514';
  end if;
  if tg_op = 'UPDATE' and old.is_default then
    if new.id is distinct from old.id or new.user_id is distinct from old.user_id or new.is_default is distinct from true
      or (new.title is distinct from old.title and not (old.title='Queue' and new.title='Want To')) then
      raise exception 'Permanent system list identity cannot be changed' using errcode='23514';
    end if;
  end if;
  if new.is_default and not coalesce(new.title = any(array[
    'Currently','Want To','Finished','Did Not Finish','Favorites'
  ]), false) then
    raise exception 'Invalid system list title; use Want To, not Queue' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function public.protect_standard_system_lists() from public, anon, authenticated;
drop trigger if exists protect_standard_system_lists on public.lists;
create trigger protect_standard_system_lists before insert or update or delete on public.lists
for each row execute function public.protect_standard_system_lists();

create or replace function public.ensure_standard_system_lists(p_user_id uuid)
returns setof public.lists language plpgsql security definer
set search_path = pg_catalog, public as $$
declare
  wanted text;
  found_list public.lists;
  legacy_list public.lists;
begin
  if p_user_id is null or not coalesce((
    auth.uid() = p_user_id or auth.role() = 'service_role'
    -- Auth signup has no end-user JWT. Only trusted database triggers may
    -- reach this branch; client roles must not have CREATE/TRIGGER privileges.
    or (pg_trigger_depth() > 0 and exists(select 1 from auth.users where id=p_user_id))
    or (current_setting('role') in ('none','postgres','supabase_admin')
      and (session_user in ('postgres','supabase_admin')
        or exists(select 1 from pg_roles where rolname=session_user and rolsuper)))
  ), false) then raise exception 'Not authorized to restore system lists' using errcode='42501'; end if;
  if not exists(select 1 from public.users where id=p_user_id) then
    raise exception 'App account must exist before restoring system lists';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('standard-lists:' || p_user_id::text,0));
  foreach wanted in array array['Currently','Want To','Finished','Did Not Finish','Favorites'] loop
    select * into found_list from public.lists
    where user_id=p_user_id and title=wanted and is_default=true for update;
    if not found then
      -- A title is not proof that a historical custom list was a system list.
      if exists(select 1 from public.lists where user_id=p_user_id and title=wanted and is_default is not true) then
        raise exception 'SYSTEM_LIST_REVIEW_REQUIRED: % has a historical non-system row',wanted;
      end if;
      if wanted='Want To' then
        select * into legacy_list from public.lists
        where user_id=p_user_id and title='Queue' and is_default=true for update;
        if found then
          update public.lists set title='Want To' where id=legacy_list.id returning * into found_list;
        end if;
      end if;
      if found_list.id is null then
        insert into public.lists(user_id,title,is_default,is_private)
        values(p_user_id,wanted,true,false)
        on conflict (user_id,title) where is_default=true
        do update set title=excluded.title returning * into found_list;
      end if;
    end if;
    return next found_list;
    found_list := null;
    legacy_list := null;
  end loop;
end $$;
revoke all on function public.ensure_standard_system_lists(uuid) from public, anon;
grant execute on function public.ensure_standard_system_lists(uuid) to authenticated, service_role;

-- Keep the existing trigger function name, replace its obsolete contents.
create or replace function public.create_default_system_lists()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public as $$
begin
  if tg_table_schema <> 'public' or tg_table_name <> 'users' or tg_op <> 'INSERT' then
    raise exception 'Standard-list signup trigger attached to an unexpected operation';
  end if;
  perform public.ensure_standard_system_lists(new.id);
  return new;
end $$;
revoke all on function public.create_default_system_lists() from public, anon, authenticated, service_role;
-- Remove BOTH competing signup triggers before installing the one corrected path.
drop trigger if exists create_default_lists_trigger on public.users;
drop trigger if exists create_lists_trigger on public.users;
create trigger create_default_lists_trigger after insert on public.users
for each row execute function public.create_default_system_lists();
-- No CASCADE: unknown dependencies abort the transaction for review.
drop function if exists public.create_default_lists_for_user();
drop function if exists public.create_default_lists();

-- Retain the old RPC signature only as an explicit no-write retirement shim.
-- Caller/traffic approval is still required before this package is released.
-- Do not leave the arbitrary-title INSERT body callable behind the new guard.
create or replace function public.create_list(
  p_creator_id uuid, p_title text, p_description text default '',
  p_is_default boolean default false, p_is_pinned boolean default false,
  p_is_private boolean default false, p_primary_type text default 'general',
  p_visibility text default 'private'
)
returns void language plpgsql set search_path = pg_catalog, public as $$
begin
  raise exception 'LIST_CREATION_RETIRED: use the standard-list restoration endpoint'
    using errcode='0A000';
end $$;
revoke all on function public.create_list(uuid,text,text,boolean,boolean,boolean,text,text)
  from public, anon, authenticated, service_role;
notify pgrst, 'reload schema';
commit;
