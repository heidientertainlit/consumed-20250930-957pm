begin;

do $$
declare
  actual_columns text[];
  function_oid oid;
  function_settings text[];
  secured_definition text;
  setter_oid oid;
  setter_settings text[];
  user_column record;
  test_admin_id uuid;
  test_non_admin_id uuid;
  visible_rows bigint;
begin
  select array_agg(c.column_name order by c.ordinal_position)
  into actual_columns
  from information_schema.columns as c
  where c.table_schema = 'public'
    and c.table_name = 'public_user_profiles';

  if actual_columns is distinct from array[
    'id', 'user_name', 'display_name', 'avatar', 'first_name', 'last_name'
  ]::text[] then
    raise exception 'public_user_profiles exposes unexpected columns: %', actual_columns;
  end if;

  if not pg_catalog.has_table_privilege('anon', 'public.public_user_profiles', 'SELECT')
     or not pg_catalog.has_table_privilege('authenticated', 'public.public_user_profiles', 'SELECT') then
    raise exception 'public_user_profiles SELECT grants are missing';
  end if;

  select array_agg(c.column_name order by c.ordinal_position)
  into actual_columns
  from information_schema.columns as c
  where c.table_schema = 'public'
    and c.table_name = 'admin_user_profiles';

  if actual_columns is distinct from array[
    'id', 'email', 'user_name', 'display_name', 'avatar', 'first_name',
    'last_name', 'is_admin', 'is_persona', 'persona_config', 'created_at',
    'people_discoverable'
  ]::text[] then
    raise exception 'admin_user_profiles exposes unexpected columns: %', actual_columns;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'admin_user_profiles'
      and 'security_barrier=true' = any (coalesce(c.reloptions, array[]::text[]))
  ) then
    raise exception 'admin_user_profiles must be a security-barrier view';
  end if;

  select pg_catalog.pg_get_viewdef('public.admin_user_profiles'::regclass, true)
  into secured_definition;

  if lower(secured_definition) not like '%auth.uid()%'
     or lower(secured_definition) not like '%requesting_user.is_admin is true%' then
    raise exception 'admin_user_profiles is not gated by auth.uid() and users.is_admin';
  end if;

  select p.oid, p.proconfig
  into function_oid, function_settings
  from pg_catalog.pg_proc as p
  join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_my_account_profile'
    and p.pronargs = 0;

  if function_oid is null then
    raise exception 'get_my_account_profile() is missing';
  end if;

  if not (
    select p.prosecdef
    from pg_catalog.pg_proc as p
    where p.oid = function_oid
  ) then
    raise exception 'get_my_account_profile() must be SECURITY DEFINER';
  end if;

  if not ('search_path=pg_catalog, public' = any (coalesce(function_settings, array[]::text[]))) then
    raise exception 'get_my_account_profile() has an unsafe search_path';
  end if;

  select pg_catalog.pg_get_functiondef(function_oid)
  into secured_definition;

  if lower(secured_definition) not like '%u.id = auth.uid()%' then
    raise exception 'get_my_account_profile() is not owner-scoped through auth.uid()';
  end if;

  if pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE')
     or not pg_catalog.has_function_privilege('service_role', function_oid, 'EXECUTE') then
    raise exception 'get_my_account_profile() has unexpected EXECUTE privileges';
  end if;

  select p.oid, p.proconfig
  into setter_oid, setter_settings
  from pg_catalog.pg_proc as p
  join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'set_my_clash_opt_out'
    and p.pronargs = 1
    and p.proargtypes = '16'::oidvector
    and p.prorettype = 'void'::regtype;

  if setter_oid is null or (
    select count(*)
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'set_my_clash_opt_out'
  ) <> 1 then
    raise exception 'set_my_clash_opt_out(boolean) must be the only setter signature';
  end if;

  if not (
    select p.prosecdef
    from pg_catalog.pg_proc as p
    where p.oid = setter_oid
  ) then
    raise exception 'set_my_clash_opt_out(boolean) must be SECURITY DEFINER';
  end if;

  if not ('search_path=pg_catalog, public' = any (coalesce(setter_settings, array[]::text[]))) then
    raise exception 'set_my_clash_opt_out(boolean) has an unsafe search_path';
  end if;

  select pg_catalog.pg_get_functiondef(setter_oid)
  into secured_definition;

  if lower(secured_definition) not like '%update public.users%'
     or lower(secured_definition) not like '%set clash_opt_out = p_opt_out%'
     or lower(secured_definition) not like '%where id = auth.uid()%'
     or lower(secured_definition) like '%returning%' then
    raise exception 'set_my_clash_opt_out(boolean) is not a rowless auth.uid()-scoped update';
  end if;

  if pg_catalog.has_function_privilege('anon', setter_oid, 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', setter_oid, 'EXECUTE')
     or not pg_catalog.has_function_privilege('service_role', setter_oid, 'EXECUTE') then
    raise exception 'set_my_clash_opt_out(boolean) has unexpected EXECUTE privileges';
  end if;

  foreach secured_definition in array array[
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
  ] loop
    if pg_catalog.has_table_privilege('anon', 'public.users', secured_definition)
       or pg_catalog.has_table_privilege('authenticated', 'public.users', secured_definition) then
      raise exception 'a client role has table-level % on public.users', secured_definition;
    end if;
  end loop;

  for user_column in
    select a.attname
    from pg_catalog.pg_attribute as a
    where a.attrelid = 'public.users'::regclass
      and a.attnum > 0
      and not a.attisdropped
  loop
    if user_column.attname = any (array[
      'id', 'user_name', 'display_name', 'avatar', 'first_name', 'last_name'
    ]::text[]) then
      if not pg_catalog.has_column_privilege('anon', 'public.users', user_column.attname, 'SELECT')
         or not pg_catalog.has_column_privilege('authenticated', 'public.users', user_column.attname, 'SELECT') then
        raise exception 'legacy identity SELECT grant is missing for public.users.%', user_column.attname;
      end if;
    elsif pg_catalog.has_column_privilege('anon', 'public.users', user_column.attname, 'SELECT')
       or pg_catalog.has_column_privilege('authenticated', 'public.users', user_column.attname, 'SELECT') then
      raise exception 'a client role can read non-allowlisted public.users.%', user_column.attname;
    end if;
  end loop;

  if exists (
    select 1
    from pg_catalog.pg_class as c
    cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, '{}'::aclitem[])) as acl
    where c.oid = 'public.users'::regclass
      and acl.grantee = 0
  ) then
    raise exception 'PUBLIC retains table access to public.users';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policy
    where polrelid = 'public.users'::regclass
      and polname = 'Enable read access for all users'
  ) or not exists (
    select 1
    from pg_catalog.pg_policy
    where polrelid = 'public.users'::regclass
      and polname = 'Temporary legacy public identity read'
  ) then
    raise exception 'public.users compatibility policies are incorrect';
  end if;

  if pg_catalog.has_table_privilege('anon', 'public.admin_user_profiles', 'SELECT')
     or not pg_catalog.has_table_privilege('authenticated', 'public.admin_user_profiles', 'SELECT') then
    raise exception 'admin_user_profiles has unexpected SELECT privileges';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class as c
    cross join lateral pg_catalog.aclexplode(coalesce(c.relacl, '{}'::aclitem[])) as acl
    where c.oid = 'public.admin_user_profiles'::regclass
      and acl.grantee = 0
      and acl.privilege_type = 'SELECT'
  ) then
    raise exception 'PUBLIC must not have SELECT on admin_user_profiles';
  end if;

  -- This safely exercises the view as authenticated without returning any
  -- account data. It is skipped in empty fixtures; use a disposable admin and
  -- non-admin account in an isolated production probe when either is absent.
  select u.id
  into test_non_admin_id
  from public.users as u
  where coalesce(u.is_admin, false) = false
  limit 1;

  select u.id
  into test_admin_id
  from public.users as u
  where u.is_admin is true
  limit 1;

  if test_non_admin_id is not null and test_admin_id is not null then
    perform set_config('request.jwt.claim.sub', test_non_admin_id::text, true);
    execute 'set local role authenticated';
    select count(*) into visible_rows from public.admin_user_profiles;
    if visible_rows <> 0 then
      raise exception 'non-admin authenticated caller can read admin_user_profiles';
    end if;

    execute 'set local role none';
    perform set_config('request.jwt.claim.sub', test_admin_id::text, true);
    execute 'set local role authenticated';
    select count(*) into visible_rows from public.admin_user_profiles;
    if visible_rows = 0 then
      raise exception 'admin authenticated caller cannot read admin_user_profiles';
    end if;
    execute 'set local role none';
  end if;
end;
$$;

rollback;
