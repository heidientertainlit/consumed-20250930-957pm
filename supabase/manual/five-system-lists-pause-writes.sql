-- PREPARED ONLY. Install in the SAME transaction as the foundation (see runbook).
-- The pause is the presence of these two triggers, not a client-set flag.
begin;
set local lock_timeout = '5s';

create function list_provisioning_private.pause_list_writes()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, pg_temp as $$
declare
  release_owner name := (select pg_get_userbyid(nspowner) from pg_namespace
                         where nspname = 'list_provisioning_private');
begin
  if session_user = release_owner and current_user = release_owner
     and current_setting('role') = 'none'
     and current_setting('app.system_list_maintenance', true) = 'on' then
    return null;
  end if;
  -- Auth's trusted connection invokes the owner-controlled signup trigger
  -- without a JWT. Let a new signup get its empty lists, not an orphan profile.
  -- No PostgREST/service request or existing-account write uses this path.
  if session_user = 'supabase_auth_admin' and current_user = release_owner
     and tg_relid = 'public.lists'::regclass and tg_op = 'INSERT' then
    return null;
  end if;
  raise exception 'List writes are paused for maintenance; please retry shortly'
    using errcode = '55P03';
end $$;

revoke all on function list_provisioning_private.pause_list_writes()
  from public, anon, authenticated, service_role, authenticator, supabase_auth_admin;
create trigger pause_five_system_list_writes
  before insert or update or delete or truncate on public.lists
  for each statement execute function list_provisioning_private.pause_list_writes();
create trigger pause_five_system_item_writes
  before insert or update or delete or truncate on public.list_items
  for each statement execute function list_provisioning_private.pause_list_writes();
commit;
