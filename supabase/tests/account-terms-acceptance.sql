-- Run in a transaction in a non-production test role.  The two existing
-- auth.users rows are used only as temporary foreign-key subjects; every
-- acceptance write is rolled back and no auth users are created.
begin;

do $$
declare
  acceptance_oid oid;
  policy_qual text;
  policy_cmd text;
  owner_id uuid;
  other_id uuid;
  visible_rows integer;
  returned_version text;
  returned_at timestamptz;
begin
  if to_regclass('public.account_terms_acceptances') is null then
    raise exception 'account_terms_acceptances table is missing';
  end if;

  if not (select rowsecurity
          from pg_catalog.pg_tables
          where schemaname = 'public'
            and tablename = 'account_terms_acceptances') then
    raise exception 'account_terms_acceptances must have RLS enabled';
  end if;

  if not has_table_privilege(
    'authenticated',
    'public.account_terms_acceptances',
    'SELECT'
  ) then
    raise exception 'authenticated must be able to read own acceptance';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.account_terms_acceptances',
    'INSERT'
  ) or has_table_privilege(
    'authenticated',
    'public.account_terms_acceptances',
    'UPDATE'
  ) or has_table_privilege(
    'authenticated',
    'public.account_terms_acceptances',
    'DELETE'
  ) then
    raise exception 'authenticated must not write account acceptance rows directly';
  end if;

  select cmd, qual
    into policy_cmd, policy_qual
    from pg_catalog.pg_policies
   where schemaname = 'public'
     and tablename = 'account_terms_acceptances'
     and policyname = 'account_terms_acceptances_owner_select';
  if policy_cmd <> 'SELECT' or lower(coalesce(policy_qual, '')) not like '%auth.uid()%' then
    raise exception 'acceptance read policy must be a SELECT policy scoped to auth.uid()';
  end if;

  select p.oid
    into acceptance_oid
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'accept_current_terms'
     and pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_terms_version text';
  if acceptance_oid is null then
    raise exception 'accept_current_terms(text) RPC is missing';
  end if;

  if not pg_catalog.has_function_privilege(
    'authenticated',
    acceptance_oid,
    'EXECUTE'
  ) then
    raise exception 'authenticated must be able to execute the acceptance RPC';
  end if;

  select first_user.id, second_user.id
    into owner_id, other_id
    from (
      select id, row_number() over (order by created_at, id) as row_number
        from auth.users
    ) as first_user
    join (
      select id, row_number() over (order by created_at, id) as row_number
        from auth.users
    ) as second_user
      on second_user.row_number = 2
   where first_user.row_number = 1;
  if owner_id is null or other_id is null then
    raise exception 'owner-isolation test requires two existing auth.users rows';
  end if;

  -- Seed only temporary acceptance state for existing subjects. The enclosing
  -- rollback restores any prior rows exactly.
  delete from public.account_terms_acceptances
   where user_id in (owner_id, other_id);
  insert into public.account_terms_acceptances (user_id, terms_version, accepted_at)
  values (owner_id, '2026-09-13', transaction_timestamp());

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  execute 'set local role authenticated';
  select count(*) into visible_rows
    from public.account_terms_acceptances;
  if visible_rows <> 1 then
    raise exception 'owner should read exactly one acceptance row, saw %', visible_rows;
  end if;

  perform set_config('request.jwt.claim.sub', other_id::text, true);
  select count(*) into visible_rows
    from public.account_terms_acceptances;
  if visible_rows <> 0 then
    raise exception 'different authenticated user should read zero acceptance rows, saw %', visible_rows;
  end if;

  begin
    execute format(
      'insert into public.account_terms_acceptances (user_id, terms_version) values (%L, %L)',
      owner_id,
      '2026-09-13'
    );
    raise exception 'authenticated direct INSERT unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  begin
    execute format(
      'update public.account_terms_acceptances set terms_version = %L where user_id = %L',
      '2026-09-12',
      owner_id
    );
    raise exception 'authenticated direct UPDATE unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  execute 'set local role anon';
  begin
    execute 'select * from public.accept_current_terms(''2026-09-13'')';
    raise exception 'anon acceptance RPC unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  execute 'set local role authenticated';
  begin
    execute 'select * from public.accept_current_terms(''2026-09-12'')';
    raise exception 'invalid terms version unexpectedly succeeded';
  exception
    when sqlstate '22023' then null;
  end;

  select a.terms_version, a.accepted_at
    into returned_version, returned_at
    from public.accept_current_terms('2026-09-13') as a;
  if returned_version <> '2026-09-13'
     or returned_at is null
     or returned_at <> transaction_timestamp() then
    raise exception
      'acceptance RPC did not return the server current version/timestamp: % / %',
      returned_version,
      returned_at;
  end if;

  execute 'reset role';
end;
$$;

rollback;