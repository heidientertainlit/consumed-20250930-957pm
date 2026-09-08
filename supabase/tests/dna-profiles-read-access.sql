begin;

do $$
declare
  viewer_id uuid := '00000000-0000-0000-0000-000000000101';
  friend_id uuid := '00000000-0000-0000-0000-000000000102';
  stranger_id uuid := '00000000-0000-0000-0000-000000000103';
  visible_rows bigint;
  helper_oid oid;
  helper_settings text[];
  helper_definition text;
  insert_policy_count integer;
  update_policy_count integer;
begin
  -- These transaction-local fixtures never persist.  They deliberately do not
  -- inspect or modify an existing member's relationship or DNA data.
  insert into public.users (id, user_name, email)
  values
    (viewer_id, 'rls_dna_viewer_101', 'rls-dna-viewer-101@example.invalid'),
    (friend_id, 'rls_dna_friend_102', 'rls-dna-friend-102@example.invalid'),
    (stranger_id, 'rls_dna_stranger_103', 'rls-dna-stranger-103@example.invalid');

  insert into public.dna_profiles (user_id, profile_text, label)
  values
    (viewer_id, 'Synthetic owner profile', 'Owner'),
    (friend_id, 'Synthetic friend profile', 'Friend'),
    (stranger_id, 'Synthetic stranger profile', 'Stranger');

  -- Only one accepted direction is needed: access must work regardless of
  -- which side originally owns the accepted friendship row.
  insert into public.friendships (user_id, friend_id, status)
  values (friend_id, viewer_id, 'accepted');

  select p.oid, p.proconfig, pg_catalog.pg_get_functiondef(p.oid)
  into helper_oid, helper_settings, helper_definition
  from pg_catalog.pg_proc as p
  join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'can_read_dna_profile'
    and p.proargtypes = '2950'::oidvector;

  if helper_oid is null
     or not (select p.prosecdef from pg_catalog.pg_proc as p where p.oid = helper_oid)
     or not ('search_path=pg_catalog, public' = any (coalesce(helper_settings, array[]::text[])))
     or lower(helper_definition) not like '%auth.uid()%'
     or lower(helper_definition) like '%p_viewer%' then
    raise exception 'dna profile access helper is not a fixed-path auth.uid() SECURITY DEFINER function';
  end if;

  if pg_catalog.has_function_privilege('anon', helper_oid, 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', helper_oid, 'EXECUTE') then
    raise exception 'dna profile access helper has unexpected EXECUTE grants';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policy
    where polrelid = 'public.dna_profiles'::regclass
      and polname = 'dna_profiles_authenticated_self_or_unblocked_friend'
      and polcmd = 'r'
      and polpermissive = false
  ) or not exists (
    select 1
    from pg_catalog.pg_policy
    where polrelid = 'public.dna_profiles'::regclass
      and polname = 'dna_profiles_anonymous_reads_denied'
      and polcmd = 'r'
      and polpermissive = false
  ) then
    raise exception 'dna_profiles restrictive SELECT policies are missing';
  end if;

  select count(*) filter (where cmd = 'INSERT')
       , count(*) filter (where cmd = 'UPDATE')
  into insert_policy_count, update_policy_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'dna_profiles';

  if insert_policy_count = 0 or update_policy_count = 0 then
    raise exception 'dna_profiles owner INSERT/UPDATE policies were not retained';
  end if;

  perform set_config('request.jwt.claim.sub', viewer_id::text, true);
  execute 'set local role authenticated';

  select count(*) into visible_rows
  from public.dna_profiles
  where user_id in (viewer_id, friend_id, stranger_id);
  if visible_rows <> 2 then
    raise exception 'authenticated viewer should see only own and accepted-friend DNA profiles, saw % rows', visible_rows;
  end if;

  execute 'set local role none';
  insert into public.user_blocks (blocker_id, blocked_id)
  values (friend_id, viewer_id);
  -- The block trigger removes prior friendships. Re-add a synthetic accepted
  -- row under the test owner so this assertion exercises the helper's own
  -- bidirectional block predicate rather than only the trigger side effect.
  insert into public.friendships (user_id, friend_id, status)
  values (friend_id, viewer_id, 'accepted');
  perform set_config('request.jwt.claim.sub', viewer_id::text, true);
  execute 'set local role authenticated';

  select count(*) into visible_rows
  from public.dna_profiles
  where user_id = friend_id;
  if visible_rows <> 0 then
    raise exception 'a bidirectional block must hide an accepted friend DNA profile';
  end if;

  execute 'set local role none';
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role service_role';

  select count(*) into visible_rows
  from public.dna_profiles
  where user_id in (viewer_id, friend_id, stranger_id);
  if visible_rows <> 3 then
    raise exception 'service_role must remain unaffected by dna_profiles RLS, saw % rows', visible_rows;
  end if;

  execute 'set local role none';
  execute 'set local role anon';

  select count(*) into visible_rows
  from public.dna_profiles
  where user_id in (viewer_id, friend_id, stranger_id);
  if visible_rows <> 0 then
    raise exception 'anonymous callers must not see DNA profiles';
  end if;

  execute 'set local role none';
end;
$$;

rollback;
