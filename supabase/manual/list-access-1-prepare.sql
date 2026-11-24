-- Approval-gated. Apply only to an independently verified target. Does not change reads or existing rows.
begin;
set local lock_timeout = '5s';

do $$
begin
  if exists (
    select 1 from pg_class where oid in (
      'public.lists'::regclass, 'public.friendships'::regclass,
      'public.list_collaborators'::regclass, 'public.user_blocks'::regclass
    ) and relrowsecurity and (relforcerowsecurity or not pg_has_role(current_user, relowner, 'USAGE'))
  ) and not exists (select 1 from pg_roles where rolname = current_user and (rolsuper or rolbypassrls)) then
    raise exception 'The release role cannot safely evaluate list access';
  end if;
end;
$$;

create schema list_access_private;
revoke all on schema list_access_private from public, anon, authenticated, service_role;

create function list_access_private.can_read_list(p_list_id uuid, p_viewer_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.lists l
    where l.id = p_list_id and (
      l.user_id = p_viewer_id or (
        not exists (
          select 1 from public.user_blocks b
          where (b.blocker_id = p_viewer_id and b.blocked_id = l.user_id)
             or (b.blocker_id = l.user_id and b.blocked_id = p_viewer_id)
        )
        and (
          (l.is_private is false and l.visibility = 'public')
          or (p_viewer_id is not null and l.user_id is not null and (
            exists (
              select 1 from public.list_collaborators c
              where c.list_id = l.id and c.user_id = p_viewer_id
            )
            or (
              l.is_private is false and l.visibility = 'friends' and exists (
                select 1 from public.friendships f where f.status = 'accepted'
                and ((f.user_id = p_viewer_id and f.friend_id = l.user_id)
                  or (f.user_id = l.user_id and f.friend_id = p_viewer_id))
              )
            )
          ))
        )
      )
    )
  );
$$;
revoke all on function list_access_private.can_read_list(uuid, uuid) from public, anon, authenticated, service_role;
-- The policy binds its function by OID and its viewer to auth.uid(); API roles
-- have no USAGE on the private schema and cannot choose the predicate's viewer.
grant execute on function list_access_private.can_read_list(uuid, uuid) to anon, authenticated;

create function public.list_read_rollout_ids(p_viewer_id uuid, p_list_ids uuid[], p_audience text)
returns setof uuid
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if coalesce(cardinality(p_list_ids), 0) > 100
     or p_audience is null or p_audience <> all (array['any','public','friend']) then
    raise exception 'Invalid list authorization scope' using errcode = '22023';
  end if;
  return query
    select l.id from public.lists l
    where l.id = any(p_list_ids)
      and list_access_private.can_read_list(l.id, p_viewer_id)
      and (
        p_audience = 'any'
        or (l.is_private is false and l.visibility = 'public')
        or (p_audience = 'friend' and l.is_private is false and l.visibility = 'friends')
      )
      and (p_audience <> 'friend' or exists (
        select 1 from public.friendships f where f.status = 'accepted'
        and ((f.user_id = p_viewer_id and f.friend_id = l.user_id)
          or (f.user_id = l.user_id and f.friend_id = p_viewer_id))
      ));
end;
$$;
revoke all on function public.list_read_rollout_ids(uuid, uuid[], text) from public, anon, authenticated;
grant execute on function public.list_read_rollout_ids(uuid, uuid[], text) to service_role;

create function list_access_private.sync_legacy_list_toggle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and old.user_id = auth.uid()
     and new.user_id = old.user_id
     and new.is_private is distinct from old.is_private
     and new.visibility is not distinct from old.visibility then
    -- Do not widen friends-only or unknown audiences when older clients toggle.
    if old.visibility in ('public','private') then
      if new.is_private is true then
        new.visibility := 'private';
      elsif old.is_private is true and new.is_private is false then
        new.visibility := 'public';
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function list_access_private.sync_legacy_list_toggle() from public, anon, authenticated, service_role;
create trigger sync_legacy_list_toggle before update of is_private on public.lists
  for each row execute function list_access_private.sync_legacy_list_toggle();

do $$
begin
  if exists (
    select 1 from pg_namespace n
    cross join lateral aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a
    where n.nspname = 'list_access_private' and a.grantee <> n.nspowner
  ) or exists (
    select 1 from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'public.list_read_rollout_ids(uuid,uuid[],text)'::regprocedure
      and a.grantee <> p.proowner
      and (a.grantee <> 'service_role'::regrole or a.is_grantable)
  ) or has_schema_privilege('anon', 'list_access_private', 'USAGE')
     or has_schema_privilege('authenticated', 'list_access_private', 'USAGE')
     or has_function_privilege('anon', 'public.list_read_rollout_ids(uuid,uuid[],text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.list_read_rollout_ids(uuid,uuid[],text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.list_read_rollout_ids(uuid,uuid[],text)', 'EXECUTE') then
    raise exception 'Unexpected list access grants';
  end if;
end;
$$;
notify pgrst, 'reload schema';
commit;
