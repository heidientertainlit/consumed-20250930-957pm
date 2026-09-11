-- Run against the deployed project or an isolated database after the
-- user_blocks owner-read migration. This transaction always rolls back and
-- never creates a persistent block.
begin;

do $$
declare
  owner_a uuid := (select id from auth.users order by id limit 1);
  owner_b uuid := (select id from auth.users order by id offset 1 limit 1);
  visible_rows integer;
  denied boolean := false;
begin
  if owner_a is null or owner_b is null or owner_a = owner_b then
    raise exception 'verification requires two existing auth users';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policy
    where polrelid = 'public.user_blocks'::regclass
      and polname = 'user_blocks_authenticated_owner_select'
      and polcmd = 'r'
      and exists (
        select 1
        from unnest(polroles) as policy_role
        where policy_role::regrole::name = 'authenticated'
      )
      and pg_get_expr(polqual, polrelid) = '(blocker_id = auth.uid())'
  ) then
    raise exception 'owner-only authenticated user_blocks SELECT policy is missing';
  end if;

  -- Fixtures are transaction-local and are removed by the final ROLLBACK.
  execute 'set local role none';
  insert into public.user_blocks (blocker_id, blocked_id)
  values (owner_a, owner_b), (owner_b, owner_a);

  perform set_config('request.jwt.claim.sub', owner_a::text, true);
  execute 'set local role authenticated';
  select count(*) into visible_rows from public.user_blocks;
  if visible_rows <> 1
     or (select count(*) from public.user_blocks where blocker_id = owner_a) <> 1
     or (select count(*) from public.user_blocks where blocker_id = owner_b) <> 0 then
    raise exception 'owner A saw % rows or the wrong blocker rows', visible_rows;
  end if;

  begin
    insert into public.user_blocks (blocker_id, blocked_id)
    values (owner_a, owner_a);
  exception when others then
    denied := true;
  end;
  if not denied then
    raise exception 'authenticated caller was allowed to write user_blocks directly';
  end if;

  execute 'set local role none';
  perform set_config('request.jwt.claim.sub', owner_b::text, true);
  execute 'set local role authenticated';
  select count(*) into visible_rows from public.user_blocks;
  if visible_rows <> 1
     or (select count(*) from public.user_blocks where blocker_id = owner_b) <> 1
     or (select count(*) from public.user_blocks where blocker_id = owner_a) <> 0 then
    raise exception 'owner B saw % rows or the wrong blocker rows', visible_rows;
  end if;

  execute 'set local role none';
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
  select count(*) into visible_rows from public.user_blocks;
  if visible_rows <> 0 then
    raise exception 'anonymous caller saw % user_blocks rows', visible_rows;
  end if;
end;
$$;

rollback;