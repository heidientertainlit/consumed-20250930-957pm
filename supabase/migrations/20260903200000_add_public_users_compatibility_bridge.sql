-- Transitional, least-privilege client access for the canonical public.users
-- table. Keep public.users in place for foreign keys and trusted writes while
-- browser clients move to the projections and RPC below.

create or replace view public.public_user_profiles
with (security_barrier = true)
as
select
  u.id,
  u.user_name,
  u.display_name,
  u.avatar,
  u.first_name,
  u.last_name
from public.users as u;

revoke all privileges on table public.public_user_profiles
from public, anon, authenticated;

grant select on table public.public_user_profiles
to anon, authenticated;

drop function if exists public.get_my_account_profile();

create function public.get_my_account_profile()
returns table (
  id uuid,
  email text,
  user_name text,
  display_name text,
  avatar text,
  first_name text,
  last_name text,
  identity_confirmed_at timestamptz,
  clash_opt_out boolean,
  people_discoverable boolean,
  is_admin boolean,
  is_persona boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    u.id,
    u.email,
    u.user_name,
    u.display_name,
    u.avatar,
    u.first_name,
    u.last_name,
    u.identity_confirmed_at,
    u.clash_opt_out,
    u.people_discoverable,
    u.is_admin,
    u.is_persona
  from public.users as u
  where u.id = auth.uid();
$$;

revoke all privileges on function public.get_my_account_profile()
from public, anon, authenticated;

grant execute on function public.get_my_account_profile()
to authenticated, service_role;

drop function if exists public.set_my_clash_opt_out(boolean);

create function public.set_my_clash_opt_out(p_opt_out boolean)
returns void
language sql
volatile
security definer
set search_path = pg_catalog, public
as $$
  update public.users
  set clash_opt_out = p_opt_out
  where id = auth.uid();
$$;

revoke all privileges on function public.set_my_clash_opt_out(boolean)
from public, anon, authenticated;

grant execute on function public.set_my_clash_opt_out(boolean)
to authenticated, service_role;

-- This view remains filterable through PostgREST for the existing admin UI.
-- Its owner evaluates the base-table query, but every result is gated using
-- the caller's JWT identity and the canonical users.is_admin flag.
create or replace view public.admin_user_profiles
with (security_barrier = true)
as
select
  u.id,
  u.email,
  u.user_name,
  u.display_name,
  u.avatar,
  u.first_name,
  u.last_name,
  u.is_admin,
  u.is_persona,
  u.persona_config,
  u.created_at,
  u.people_discoverable
from public.users as u
where exists (
  select 1
  from public.users as requesting_user
  where requesting_user.id = auth.uid()
    and requesting_user.is_admin is true
);

revoke all privileges on table public.admin_user_profiles
from public, anon, authenticated;

grant select on table public.admin_user_profiles
to authenticated;

-- Preserve a narrow compatibility window for legacy browser queries. RLS
-- decides which rows are visible; these column grants make sensitive columns
-- inaccessible even though this temporary policy permits identity-row reads.
revoke all privileges on table public.users
from public, anon, authenticated;

-- Table-level revokes do not remove historical column-level ACLs. Clear every
-- column privilege that can be granted before adding back the narrow legacy
-- SELECT allowlist below. Do not include service_role or postgres here.
do $$
declare
  user_column record;
begin
  for user_column in
    select a.attname
    from pg_catalog.pg_attribute as a
    where a.attrelid = 'public.users'::regclass
      and a.attnum > 0
      and not a.attisdropped
  loop
    execute format(
      'revoke select (%1$I), insert (%1$I), update (%1$I), references (%1$I) on table public.users from public, anon, authenticated',
      user_column.attname
    );
  end loop;
end;
$$;

grant select (
  id,
  user_name,
  display_name,
  avatar,
  first_name,
  last_name
) on table public.users
to anon, authenticated;

drop policy if exists "Enable read access for all users" on public.users;
drop policy if exists "Temporary legacy public identity read" on public.users;

create policy "Temporary legacy public identity read"
on public.users
for select
to anon, authenticated
using (true);

comment on policy "Temporary legacy public identity read" on public.users is
  'Temporary compatibility policy: column grants restrict clients to public identity fields. Remove this policy and the public.users compatibility grant after the app rollout.';

notify pgrst, 'reload schema';
