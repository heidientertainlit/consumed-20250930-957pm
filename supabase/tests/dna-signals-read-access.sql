begin;

do $$
declare
  viewer_id uuid := '00000000-0000-0000-0000-000000000201';
  friend_id uuid := '00000000-0000-0000-0000-000000000202';
  stranger_id uuid := '00000000-0000-0000-0000-000000000203';
  visible_rows bigint;
  insert_policy_count integer;
  update_policy_count integer;
  service_policy_exists boolean;
begin
  -- Every fixture is synthetic and transaction-local.  The final ROLLBACK
  -- leaves real member, signal, friendship, and block rows untouched.
  execute 'set local role none';
  insert into auth.users
    (id, email, aud, role, created_at, updated_at, email_confirmed_at, raw_user_meta_data)
  values
    (viewer_id, 'rls-signal-viewer-201@example.invalid', 'authenticated', 'authenticated', now(), now(), now(), '{"username":"rls_signal_viewer_201"}'::jsonb);
  insert into auth.users
    (id, email, aud, role, created_at, updated_at, email_confirmed_at, raw_user_meta_data)
  values
    (friend_id, 'rls-signal-friend-202@example.invalid', 'authenticated', 'authenticated', now(), now(), now(), '{"username":"rls_signal_friend_202"}'::jsonb);
  insert into auth.users
    (id, email, aud, role, created_at, updated_at, email_confirmed_at, raw_user_meta_data)
  values
    (stranger_id, 'rls-signal-stranger-203@example.invalid', 'authenticated', 'authenticated', now(), now(), now(), '{"username":"rls_signal_stranger_203"}'::jsonb);

  -- handle_new_user() creates the public rows used by the foreign key. Use the
  -- service role for fixture setup so RLS cannot partially suppress synthetic
  -- rows; this role is never used to model member reads below.
  execute 'set local role service_role';
  update public.users
  set user_name = case id
        when viewer_id then 'rls_signal_viewer_201'
        when friend_id then 'rls_signal_friend_202'
        else 'rls_signal_stranger_203'
      end
  where id in (viewer_id, friend_id, stranger_id);

  insert into public.user_dna_signals
    (id, user_id, signal_type, signal_value, strength, source_count)
  values
    ('00000000-0000-0000-0000-000000000211', viewer_id, 'genre', 'Owner', 1, 1),
    ('00000000-0000-0000-0000-000000000212', friend_id, 'genre', 'Friend', 1, 1),
    ('00000000-0000-0000-0000-000000000213', stranger_id, 'genre', 'Stranger', 1, 1);

  -- Exercise both accepted relationship directions before adding blocks.
  insert into public.friendships (user_id, friend_id, status)
  values
    (friend_id, viewer_id, 'accepted'),
    (viewer_id, stranger_id, 'accepted');

  if not exists (
    select 1
    from pg_catalog.pg_policy
    where polrelid = 'public.user_dna_signals'::regclass
      and polname = 'user_dna_signals_authenticated_self_or_unblocked_friend'
      and polcmd = 'r'
      and polpermissive = true
  ) or not exists (
    select 1
    from pg_catalog.pg_policy
    where polrelid = 'public.user_dna_signals'::regclass
      and polname = 'user_dna_signals_anonymous_reads_denied'
      and polcmd = 'r'
      and polpermissive = false
  ) or exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'user_dna_signals'
      and policyname = 'Authenticated users can view DNA signals'
  ) then
    raise exception 'raw DNA signal SELECT policies are not restricted';
  end if;

  select count(*) filter (where cmd in ('INSERT', 'ALL')),
         count(*) filter (where cmd in ('UPDATE', 'ALL'))
    into insert_policy_count, update_policy_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'user_dna_signals';

  select exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'user_dna_signals'
      and policyname = 'Service role can manage DNA signals'
      and cmd = 'ALL'
  )
  into service_policy_exists;

  if insert_policy_count = 0
     or update_policy_count = 0
     or not service_policy_exists then
    raise exception 'signal write/service policies were not retained';
  end if;

  perform set_config('request.jwt.claim.sub', viewer_id::text, true);
  execute 'set local role authenticated';

  select count(*) into visible_rows
  from public.user_dna_signals
  where user_id in (viewer_id, friend_id, stranger_id);
  if visible_rows <> 3 then
    raise exception 'owner and accepted unblocked friends should be visible before blocking, saw % rows', visible_rows;
  end if;

  -- The block trigger removes the accepted friendships. Re-add synthetic
  -- accepted rows so the helper itself, not only the trigger, is exercised.
  execute 'set local role service_role';
  insert into public.user_blocks (blocker_id, blocked_id)
  values (friend_id, viewer_id), (viewer_id, stranger_id);
  insert into public.friendships (user_id, friend_id, status)
  values (friend_id, viewer_id, 'accepted'), (viewer_id, stranger_id, 'accepted');

  perform set_config('request.jwt.claim.sub', viewer_id::text, true);
  execute 'set local role authenticated';
  select count(*) into visible_rows
  from public.user_dna_signals
  where user_id in (viewer_id, friend_id, stranger_id);
  if visible_rows <> 1
     or not exists (select 1 from public.user_dna_signals where user_id = viewer_id) then
    raise exception 'both block directions must hide accepted-friend raw signals, saw % rows', visible_rows;
  end if;

  execute 'set local role none';
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
  select count(*) into visible_rows
  from public.user_dna_signals
  where user_id in (viewer_id, friend_id, stranger_id);
  if visible_rows <> 0 then
    raise exception 'anonymous callers must not see raw DNA signals, saw % rows', visible_rows;
  end if;

  -- Service-role scoring/extraction remains able to read and write signals.
  execute 'set local role none';
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role service_role';
  insert into public.user_dna_signals
    (id, user_id, signal_type, signal_value, strength, source_count)
  values
    ('00000000-0000-0000-0000-000000000214', viewer_id, 'service', 'write', 1, 1);

  select count(*) into visible_rows
  from public.user_dna_signals
  where user_id in (viewer_id, friend_id, stranger_id);
  if visible_rows <> 4 then
    raise exception 'service role signal read/write path changed, saw % rows', visible_rows;
  end if;

  execute 'set local role none';
end;
$$;

rollback;