-- Synthetic A/B/C account-deletion fixture.  This test is transaction-scoped
-- and always rolls back.  Run only against an isolated/local database; it
-- refuses to use fixture IDs that already exist.
begin;

do $$
declare
  user_a constant uuid := '00000000-0000-0000-0000-00000000a001';
  user_b constant uuid := '00000000-0000-0000-0000-00000000b001';
  user_c constant uuid := '00000000-0000-0000-0000-00000000c001';
  user_d constant uuid := '00000000-0000-0000-0000-00000000d003';
  pool_id constant uuid := '00000000-0000-0000-0000-00000000d001';
  pool_b_id constant uuid := '00000000-0000-0000-0000-00000000d002';
  list_a constant uuid := '00000000-0000-0000-0000-00000000e001';
  list_b constant uuid := '00000000-0000-0000-0000-00000000e002';
  run_a constant uuid := '00000000-0000-0000-0000-00000000f001';
  run_b constant uuid := '00000000-0000-0000-0000-00000000f002';
  run_published constant uuid := '00000000-0000-0000-0000-00000000f003';
  run_canonical constant uuid := '00000000-0000-0000-0000-00000000f004';
  draft_a_root constant uuid := '00000000-0000-0000-0000-00000000f101';
  draft_b_root constant uuid := '00000000-0000-0000-0000-00000000f102';
  take_a constant uuid := '00000000-0000-0000-0000-00000000f104';
  lock_a constant uuid := '00000000-0000-0000-0000-00000000f201';
  lock_b constant uuid := '00000000-0000-0000-0000-00000000f202';
  session_a constant uuid := '00000000-0000-0000-0000-00000000f301';
  session_b constant uuid := '00000000-0000-0000-0000-00000000f302';
  canonical_media_fixture uuid;
  canonical_plan_id bigint;
  b_rating_before numeric;
  b_list_title_before text;
  b_list_item_title_before text;
  b_post_content_before text;
  b_profile_text_before text;
  b_session_before jsonb;
  b_activity_before bigint;
  b_c_block_count_before integer;
begin
  if exists (
    select 1
    from auth.users
    where id in (user_a, user_b, user_c, user_d)
  ) or exists (
    select 1
    from public.users
    where id in (user_a, user_b, user_c, user_d)
  ) or exists (
    select 1
    from public.pools
    where id in (pool_id, pool_b_id)
  ) or exists (
    select 1
    from public.lists
    where id in (list_a, list_b)
  ) or exists (
    select 1
    from public.admin_room_conversation_runs
    where id in (run_a, run_b, run_published, run_canonical)
  ) or exists (
    select 1
    from public.admin_room_conversation_drafts
    where id in (draft_a_root, draft_b_root, '00000000-0000-0000-0000-00000000f103'::uuid)
  ) or exists (
    select 1
    from public.room_takes
    where id = take_a
  ) or exists (
    select 1
    from public.admin_room_persona_provision_locks
    where token in (lock_a, lock_b)
  ) or exists (
    select 1
    from public.user_sessions
    where id in (session_a, session_b)
  ) then
    raise exception 'fixture UUID already exists; refusing to run';
  end if;

  -- Suppress project-side insert/HTTP triggers while creating local fixtures;
  -- this keeps the test entirely inside the database and emits no provider
  -- events.  All fixture foreign keys are supplied explicitly below.
  execute 'set local session_replication_role = replica';

  insert into auth.users (id, email)
  values
    (user_a, 'account-delete-a@example.invalid'),
    (user_b, 'account-delete-b@example.invalid'),
    (user_c, 'account-delete-c@example.invalid'),
    (user_d, 'account-delete-d@example.invalid');

  insert into public.users (id, email, user_name, display_name)
  values
    (user_a, 'account-delete-a@example.invalid', 'delete_fixture_a', 'Fixture A'),
    (user_b, 'account-delete-b@example.invalid', 'delete_fixture_b', 'Fixture B'),
    (user_c, 'account-delete-c@example.invalid', 'delete_fixture_c', 'Fixture C'),
    (user_d, 'account-delete-d@example.invalid', 'delete_fixture_d', 'Fixture D');

  insert into public.user_sessions (
    id, user_id, session_id, started_at, created_at, client_metadata, page_views
  )
  values
    (
      session_a, user_a, 'delete-fixture-session-a',
      '2026-09-14 00:00:10+00', '2026-09-14 00:00:10+00',
      '{"fixture":"A"}'::jsonb, '{"pages":1}'::jsonb
    ),
    (
      session_b, user_b, 'delete-fixture-session-b',
      '2026-09-14 00:00:20+00', '2026-09-14 00:00:20+00',
      '{"fixture":"B"}'::jsonb, '{"pages":2}'::jsonb
    );

  insert into public.user_blocks (blocker_id, blocked_id)
  values
    (user_a, user_b),
    (user_b, user_a),
    (user_b, user_d);

  insert into public.friendships (user_id, friend_id, status)
  values
    (user_a, user_c, 'accepted'),
    (user_b, user_c, 'accepted');

  insert into public.dna_profiles (user_id, profile_text, label)
  values
    (user_a, 'Fixture A profile', 'A'),
    (user_b, 'Fixture B profile', 'B');

  insert into public.media_ratings (
    user_id, media_external_id, media_external_source, media_title,
    media_type, rating
  )
  values
    (user_a, 'fixture-a', 'fixture', 'Fixture A Media', 'movie', 4),
    (user_b, 'fixture-b', 'fixture', 'Fixture B Media', 'movie', 5);

  insert into public.lists (id, user_id, title, media_type)
  values
    (list_a, user_a, 'Fixture A List', 'movie'),
    (list_b, user_b, 'Fixture B List', 'movie');

  insert into public.list_items (list_id, user_id, title, type)
  values
    (list_a, user_a, 'Fixture A Item', 'movie'),
    (list_b, user_b, 'Fixture B Item', 'movie');

  insert into public.social_posts (user_id, content)
  values
    (user_a, 'Fixture A post'),
    (user_b, 'Fixture B post');

  insert into public.pools (
    id, name, host_id, invite_code, is_public, status
  )
  values
    (pool_id, 'Fixture account deletion room', user_b, 'fixture-delete-room', false, 'open'),
    (pool_b_id, 'Fixture account deletion control room', user_b, 'fixture-delete-control', false, 'open');

  -- Run A is owned by the target and must be removed with its drafts.
  insert into public.admin_room_conversation_runs (
    id, room_id, created_by, topic, status, approved_by, approved_at
  )
  values
    (run_a, pool_id, user_a, 'Fixture A conversation', 'draft', user_b, now());

  insert into public.admin_room_conversation_drafts (
    id, run_id, client_id, participant_id, parent_client_id, body, position
  )
  values
    (draft_a_root, run_a, 'a-root', user_a, null, 'Fixture A draft', 0);

  -- Run B remains, but its target participant draft and approval attribution
  -- must be removed so B's other staged data stays available.
  insert into public.admin_room_conversation_runs (
    id, room_id, created_by, topic, status, approved_by, approved_at
  )
  values
    (run_b, pool_id, user_b, 'Fixture B conversation', 'draft', user_a, now());

  insert into public.admin_room_conversation_drafts (
    id, run_id, client_id, participant_id, parent_client_id, body, position
  )
  values
    (draft_b_root, run_b, 'b-root', user_b, null, 'Fixture B draft', 0),
    ('00000000-0000-0000-0000-00000000f103', run_b, 'a-reply', user_a, 'b-root', 'Fixture A reply', 1);

  -- A published take authored by A leaves a NO ACTION reference from its
  -- staging run. The exact run must be removed before A's normal cascade.
  insert into public.room_takes (id, room_id, user_id, title, body)
  values
    (take_a, pool_id, user_a, 'Fixture A published take', 'Fixture A body');

  insert into public.admin_room_conversation_runs (
    id, room_id, created_by, topic, status, published_take_id, published_at
  )
  values
    (run_published, pool_id, user_b, 'Fixture A published conversation', 'published', take_a, now());

  insert into public.admin_room_persona_provision_locks (room_id, token, created_by)
  values
    (pool_id, lock_a, user_a),
    (pool_b_id, lock_b, user_b);

  -- Immutable canonical-media provenance is retained through account
  -- deletion; only the run's requested_by Auth FK is nulled by the cascade.
  select id into canonical_media_fixture
  from public.canonical_media
  order by id
  limit 1;

  insert into public.canonical_media_backfill_runs (
    id, phase, status, requested_by
  )
  values (run_canonical, 'plan', 'complete', user_a);

  insert into public.canonical_media_backfill_plans (
    run_id, table_name, row_id, user_id, external_source, external_id,
    canonical_media_id
  )
  values (
    run_canonical, 'media_ratings', 'fixture-a-rating', user_a, 'fixture',
    'fixture-a', canonical_media_fixture
  )
  returning id into canonical_plan_id;

  insert into public.canonical_media_backfill_audit (
    run_id, plan_id, table_name, row_id, external_source, external_id,
    canonical_media_id, outcome
  )
  values (
    run_canonical, canonical_plan_id, 'media_ratings', 'fixture-a-rating',
    'fixture', 'fixture-a', canonical_media_fixture, 'planned'
  );

  -- Restore normal trigger behavior before the deletion under test.
  execute 'set local session_replication_role = origin';

  -- Snapshot unrelated B data before deleting A.
  select rating into b_rating_before
  from public.media_ratings
  where user_id = user_b;
  select title into b_list_title_before
  from public.lists
  where id = list_b;
  select title into b_list_item_title_before
  from public.list_items
  where list_id = list_b and user_id = user_b;
  select content into b_post_content_before
  from public.social_posts
  where user_id = user_b;
  select profile_text into b_profile_text_before
  from public.dna_profiles
  where user_id = user_b;
  select to_jsonb(s) into b_session_before
  from public.user_sessions s
  where s.id = session_b and s.user_id = user_b;
  select total_activities into b_activity_before
  from public.user_last_activity
  where user_id = user_b;
  select count(*) into b_c_block_count_before
  from public.user_blocks
  where blocker_id = user_b and blocked_id = user_d;

  execute 'set local role service_role';
  perform public.delete_account_transaction(user_a);
  execute 'set local role none';

  if exists (select 1 from auth.users where id = user_a)
     or exists (select 1 from public.users where id = user_a)
      or exists (select 1 from public.user_sessions where id = session_a or user_id = user_a)
     or exists (select 1 from public.user_blocks where blocker_id = user_a or blocked_id = user_a)
     or exists (select 1 from public.user_last_activity where user_id = user_a)
     or exists (select 1 from public.media_ratings where user_id = user_a)
     or exists (select 1 from public.lists where id = list_a)
     or exists (select 1 from public.social_posts where user_id = user_a)
     or exists (select 1 from public.dna_profiles where user_id = user_a)
     or exists (select 1 from public.admin_room_conversation_runs where id = run_a)
     or exists (select 1 from public.admin_room_conversation_runs where id = run_published)
     or exists (select 1 from public.admin_room_conversation_drafts where id = draft_a_root)
     or exists (select 1 from public.room_takes where id = take_a)
     or exists (select 1 from public.admin_room_persona_provision_locks where created_by = user_a) then
    raise exception 'target A data survived account deletion';
  end if;

  if not exists (select 1 from auth.users where id = user_b)
     or not exists (select 1 from public.users where id = user_b)
     or not exists (select 1 from public.media_ratings where user_id = user_b and rating = b_rating_before)
     or not exists (select 1 from public.lists where id = list_b and title = b_list_title_before)
     or not exists (select 1 from public.list_items where list_id = list_b and user_id = user_b and title = b_list_item_title_before)
     or not exists (select 1 from public.social_posts where user_id = user_b and content = b_post_content_before)
     or not exists (select 1 from public.dna_profiles where user_id = user_b and profile_text = b_profile_text_before)
      or b_session_before is distinct from (select to_jsonb(s) from public.user_sessions s where s.id = session_b and s.user_id = user_b)
     or not exists (select 1 from public.user_last_activity where user_id = user_b and total_activities = b_activity_before)
      or (select count(*) from public.user_blocks where blocker_id = user_b and blocked_id = user_d) <> b_c_block_count_before
      or not exists (select 1 from public.friendships where user_id = user_b and friend_id = user_c and status = 'accepted')
     or not exists (select 1 from public.admin_room_conversation_runs where id = run_b and created_by = user_b and approved_by is null and approved_at is null)
     or not exists (select 1 from public.admin_room_conversation_drafts where run_id = run_b and participant_id = user_b)
     or not exists (select 1 from public.admin_room_persona_provision_locks where created_by = user_b) then
    raise exception 'unrelated B data changed unexpectedly';
  end if;

  if exists (
    select 1
    from public.user_blocks
    where blocker_id = user_b and blocked_id = user_a
  ) or exists (
    select 1
    from public.friendships
    where (user_id = user_b and friend_id = user_a)
       or (user_id = user_a and friend_id = user_c)
  ) or exists (
    select 1
    from public.admin_room_conversation_drafts
    where run_id = run_b and participant_id = user_a
  ) then
    raise exception 'A-to-B relationship/dependent draft survived';
  end if;

   if not exists (
      select 1
      from public.user_blocks
      where blocker_id = user_b and blocked_id = user_d
   ) or not exists (
      select 1
      from public.canonical_media_backfill_runs
      where id = run_canonical and requested_by is null
   ) or not exists (
      select 1
      from public.canonical_media_backfill_plans
      where id = canonical_plan_id and user_id = user_a
   ) or not exists (
      select 1
      from public.canonical_media_backfill_audit
      where run_id = run_canonical and plan_id = canonical_plan_id
   ) then
     raise exception 'independent block or immutable canonical audit retention failed';
   end if;
end;
$$;

select 'PASS: rollback fixture deleted A, preserved B/C/D controls, and retained immutable canonical audit provenance' as result;

rollback;