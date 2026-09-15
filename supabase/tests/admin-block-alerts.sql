-- Run only against an isolated/local database after
-- 20260915020000_add_private_admin_block_alerts.sql.  This script rolls back
-- all fixtures and DDL. Set two distinct disposable UUID settings first:
--   set app.block_alert_test_blocker = '<uuid>';
--   set app.block_alert_test_blocked = '<uuid>';
begin;

do $$
declare
  p_blocker_id uuid := nullif(current_setting('app.block_alert_test_blocker', true), '')::uuid;
  p_blocked_id uuid := nullif(current_setting('app.block_alert_test_blocked', true), '')::uuid;
  p_acknowledging_admin_id uuid := '00000000-0000-4000-8000-000000000003';
  privilege_name text;
  alert_count integer;
  failed boolean := false;
begin
  if p_blocker_id is null or p_blocked_id is null or p_blocker_id = p_blocked_id then
    raise exception 'Set two distinct disposable app.block_alert_test_* UUID settings';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.admin_block_alerts'::regclass) then
    raise exception 'admin_block_alerts does not have RLS enabled';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_block_alerts'
  ) then
    raise exception 'admin_block_alerts must not have browser RLS policies';
  end if;

  foreach privilege_name in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
    if has_table_privilege('anon', 'public.admin_block_alerts', privilege_name)
       or has_table_privilege('authenticated', 'public.admin_block_alerts', privilege_name) then
      raise exception 'browser role retains % on admin_block_alerts', privilege_name;
    end if;
  end loop;
  if not has_table_privilege('service_role', 'public.admin_block_alerts', 'SELECT')
     or not has_table_privilege('service_role', 'public.admin_block_alerts', 'UPDATE') then
    raise exception 'service_role cannot read or acknowledge admin_block_alerts';
  end if;

  delete from public.user_blocks
  where (user_blocks.blocker_id = p_blocker_id and user_blocks.blocked_id = p_blocked_id)
     or (user_blocks.blocker_id = p_blocked_id and user_blocks.blocked_id = p_blocker_id);

  -- The existing pair-locked BEFORE trigger still runs before the new AFTER
  -- trigger. A rejected self-block must create no alert.
  select count(*) into alert_count from public.admin_block_alerts;
  begin
    insert into public.user_blocks(blocker_id, blocked_id) values (p_blocker_id, p_blocker_id);
  exception when sqlstate '22023' then
    failed := true;
  end;
  if not failed or (select count(*) from public.admin_block_alerts) <> alert_count then
    raise exception 'failed block unexpectedly created an alert';
  end if;

  insert into public.friendships(user_id, friend_id, status)
  values
    (p_blocker_id, p_blocked_id, 'accepted'),
    (p_blocked_id, p_blocker_id, 'accepted');

  insert into public.user_blocks(blocker_id, blocked_id) values (p_blocker_id, p_blocked_id);
  if exists (
    select 1 from public.friendships
    where (user_id = p_blocker_id and friend_id = p_blocked_id)
       or (user_id = p_blocked_id and friend_id = p_blocker_id)
  ) then
    raise exception 'block alert trigger changed the required friendship cleanup ordering';
  end if;
  select count(*) into alert_count
  from public.admin_block_alerts a
  join public.user_blocks b on b.id = a.block_id
  where b.blocker_id = p_blocker_id and b.blocked_id = p_blocked_id;
  if alert_count <> 1 then
    raise exception 'successful block did not create exactly one alert';
  end if;

  -- user_blocks uniqueness rejects a duplicate, and its failed insert cannot
  -- add another source alert.
  failed := false;
  begin
    insert into public.user_blocks(blocker_id, blocked_id) values (p_blocker_id, p_blocked_id);
  exception when unique_violation then
    failed := true;
  end;
  if not failed then
    raise exception 'duplicate block was unexpectedly accepted';
  end if;
  if (select count(*)
      from public.admin_block_alerts a
      join public.user_blocks b on b.id = a.block_id
      where b.blocker_id = p_blocker_id and b.blocked_id = p_blocked_id) <> 1 then
    raise exception 'duplicate block attempt created another alert';
  end if;

  -- Acknowledgement attribution is private, but it must not retain a deleted
  -- administrator identity. Its FK is intentionally SET NULL, independent of
  -- source-block cascade behavior.
  insert into public.users(id) values (p_acknowledging_admin_id);
  update public.admin_block_alerts
  set acknowledged_at = now(),
      acknowledged_by = p_acknowledging_admin_id
  where block_id = (
    select id from public.user_blocks
    where blocker_id = p_blocker_id and blocked_id = p_blocked_id
  );
  delete from public.users where id = p_acknowledging_admin_id;
  if exists (
    select 1 from public.admin_block_alerts a
    join public.user_blocks b on b.id = a.block_id
    where b.blocker_id = p_blocker_id
      and b.blocked_id = p_blocked_id
      and a.acknowledged_by is not null
  ) then
    raise exception 'deleted administrator remained attributed to a block alert';
  end if;

  -- Account deletion already removes matching user_blocks. The FK cascade here
  -- makes that cleanup remove the private alert too.
  delete from public.user_blocks
  where user_blocks.blocker_id = p_blocker_id and user_blocks.blocked_id = p_blocked_id;
  if exists (
    select 1 from public.admin_block_alerts a
    where not exists (select 1 from public.user_blocks b where b.id = a.block_id)
  ) then
    raise exception 'block alert survived source block deletion';
  end if;
end;
$$;

-- Force the AFTER trigger's insert to fail. PostgreSQL must roll the source
-- block back with it, proving no successful-looking block is left unalerted.
create function public.test_force_admin_block_alert_failure()
returns trigger
language plpgsql
as $$
begin
  raise exception 'forced private alert failure';
end;
$$;

create trigger test_force_admin_block_alert_failure
before insert on public.admin_block_alerts
for each row execute function public.test_force_admin_block_alert_failure();

do $$
declare
  p_blocker_id uuid := nullif(current_setting('app.block_alert_test_blocker', true), '')::uuid;
  p_blocked_id uuid := nullif(current_setting('app.block_alert_test_blocked', true), '')::uuid;
  failed boolean := false;
begin
  begin
    insert into public.user_blocks(blocker_id, blocked_id) values (p_blocker_id, p_blocked_id);
  exception when others then
    failed := true;
  end;
  if not failed
     or exists (
       select 1 from public.user_blocks
        where user_blocks.blocker_id = p_blocker_id and user_blocks.blocked_id = p_blocked_id
     ) then
    raise exception 'alert failure did not roll back the source block';
  end if;
end;
$$;

drop trigger test_force_admin_block_alert_failure on public.admin_block_alerts;
drop function public.test_force_admin_block_alert_failure();

rollback;