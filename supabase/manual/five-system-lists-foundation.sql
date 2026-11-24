-- PREPARED ONLY. Requires separate production approval. No automatic migration hook.
-- Existing lists schema/UUIDs/API identifiers are retained.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.protect_standard_system_lists()
returns trigger language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
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
revoke all on function public.protect_standard_system_lists() from public, anon, authenticated, service_role;
drop trigger if exists protect_standard_system_lists on public.lists;
create trigger protect_standard_system_lists before insert or update or delete on public.lists
for each row execute function public.protect_standard_system_lists();

-- One implementation, with two separately authorized entrypoints. This schema
-- is not exposed to the API. Do not reuse an unexpectedly owned or shared schema.
create schema if not exists list_provisioning_private;
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_namespace n
    where n.nspname = 'list_provisioning_private'
      and (n.nspowner <> current_user::regrole or exists (
        select 1 from pg_catalog.aclexplode(coalesce(n.nspacl, pg_catalog.acldefault('n', n.nspowner))) a
        where a.grantee <> n.nspowner
      ))
  ) then
    raise exception 'Unexpected ownership or grants on list_provisioning_private';
  end if;
end $$;

create or replace function list_provisioning_private.ensure_system_lists_for_owner(p_user_id uuid)
returns setof public.lists language plpgsql security invoker
set search_path = pg_catalog, pg_temp as $$
declare
  wanted text;
  found_list public.lists;
  legacy_list public.lists;
begin
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
        do nothing returning * into found_list;
        -- A fresh signup never needs UPDATE permission during the write pause.
        -- A racing insert can already have supplied the UUID; reuse that row.
        if not found then
          select * into strict found_list from public.lists
            where user_id=p_user_id and title=wanted and is_default=true for update;
        end if;
      end if;
    end if;
    return next found_list;
    found_list := null;
    legacy_list := null;
  end loop;
end $$;
revoke all on function list_provisioning_private.ensure_system_lists_for_owner(uuid)
  from public, anon, authenticated, service_role, authenticator, supabase_auth_admin;

-- The public signature stays unchanged. Authorization requires the PostgREST
-- session, its selected database role, and the corresponding verified JWT
-- claims. There is no trigger-depth, maintenance, or SQL-admin exception here.
create or replace function public.ensure_standard_system_lists(p_user_id uuid)
returns setof public.lists language plpgsql security definer
set search_path = pg_catalog, pg_temp as $$
begin
  if p_user_id is null or session_user <> 'authenticator' or not coalesce((
    (current_setting('role') = 'authenticated' and auth.role() = 'authenticated' and auth.uid() = p_user_id)
    or (current_setting('role') = 'service_role' and auth.role() = 'service_role')
  ), false) then
    raise exception 'Not authorized to restore system lists' using errcode='42501';
  end if;
  return query select * from list_provisioning_private.ensure_system_lists_for_owner(p_user_id);
end $$;
revoke all on function public.ensure_standard_system_lists(uuid) from public, anon;
grant execute on function public.ensure_standard_system_lists(uuid) to authenticated, service_role;

-- Signups have no end-user JWT. Only this owner-controlled trigger entrypoint
-- may provision on signup; it accepts no caller-supplied account ID.
create or replace function list_provisioning_private.create_default_system_lists()
returns trigger language plpgsql security definer
set search_path = pg_catalog, pg_temp as $$
begin
  if tg_relid <> 'public.users'::regclass or tg_when <> 'AFTER' or tg_level <> 'ROW' or tg_op <> 'INSERT' then
    raise exception 'Standard-list signup trigger attached to an unexpected operation';
  end if;
  perform list_provisioning_private.ensure_system_lists_for_owner(new.id);
  return new;
end $$;
revoke all on function list_provisioning_private.create_default_system_lists()
  from public, anon, authenticated, service_role, authenticator, supabase_auth_admin;

-- Check full ACLs, including default grants, before activating either path.
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
    where (
      (p.pronamespace = 'list_provisioning_private'::regnamespace
        and p.proname in ('ensure_system_lists_for_owner', 'create_default_system_lists')
        and a.grantee <> p.proowner)
      or (p.oid = 'public.ensure_standard_system_lists(uuid)'::regprocedure
        and a.grantee <> p.proowner
        and (a.grantee not in ('authenticated'::regrole, 'service_role'::regrole) or a.is_grantable))
    )
  ) then
    raise exception 'Unexpected list provisioning function grants';
  end if;
end $$;
-- Remove BOTH competing signup triggers before installing the one corrected path.
drop trigger if exists create_default_lists_trigger on public.users;
drop trigger if exists create_lists_trigger on public.users;
create trigger create_default_lists_trigger after insert on public.users
for each row execute function list_provisioning_private.create_default_system_lists();
-- No CASCADE: unknown dependencies abort the transaction for review.
drop function if exists public.create_default_system_lists();
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
