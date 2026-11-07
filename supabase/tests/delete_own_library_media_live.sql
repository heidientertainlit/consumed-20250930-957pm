-- Run ONLY via the explicit verify-delete-own-library-media-live.mjs
-- rollback-only command after separate production approval.
-- The runner replaces __MARKER__ with a fresh UUID before submission.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '25s';

do $fixture$
declare
  v_owner uuid;
  v_other uuid;
  v_currently uuid;
  v_favorites uuid;
  v_other_list uuid;
  v_anchor uuid;
  v_second uuid;
  v_control uuid;
  v_foreign uuid;
  v_source text := 'deletion_fixture';
  v_id text := '__MARKER__';
begin
  select u.id, lc.id, lf.id into v_owner, v_currently, v_favorites
  from public.users u
  join auth.users a on a.id = u.id
  join public.lists lc on lc.user_id = u.id and lc.title = 'Currently'
  join public.lists lf on lf.user_id = u.id and lf.title = 'Favorites'
  order by u.id limit 1;
  select u.id, l.id into v_other, v_other_list
  from public.users u
  join auth.users a on a.id = u.id
  join public.lists l on l.user_id = u.id and l.title = 'Currently'
  where u.id <> v_owner
  order by u.id limit 1;
  if v_owner is null or v_other is null then
    raise exception 'Two disposable fixture owners with system lists are required.';
  end if;

  -- This single analytics trigger sends an external HTTP request on INSERT.
  -- Take a brief write lock, suppress it ONLY for fixture creation, then
  -- restore it before running the real deletion. On any error the transaction
  -- rolls back the trigger state as well as every fixture.
  if (select tgenabled from pg_catalog.pg_trigger
      where tgrelid='public.list_items'::regclass
        and tgname='posthog_list_items') <> 'O' then
    raise exception 'Expected analytics trigger is not enabled; stop.';
  end if;
  execute 'alter table public.list_items disable trigger posthog_list_items';

  insert into public.list_items(user_id,list_id,title,media_type,external_source,external_id)
    values(v_owner,v_currently,'Delete verification fixture','book',v_source,v_id)
    returning id into v_anchor;
  insert into public.list_items(user_id,list_id,title,media_type,external_source,external_id)
    values(v_owner,v_favorites,'Delete verification fixture','book',v_source,v_id)
    returning id into v_second;
  insert into public.list_items(user_id,list_id,title,media_type,external_source,external_id)
    values(v_owner,v_currently,'Delete verification fixture','book',v_source,v_id||'-control')
    returning id into v_control;
  insert into public.list_items(user_id,list_id,title,media_type,external_source,external_id)
    values(v_other,v_other_list,'Delete verification fixture','book',v_source,v_id)
    returning id into v_foreign;

  execute 'alter table public.list_items enable trigger posthog_list_items';
  if (select tgenabled from pg_catalog.pg_trigger
      where tgrelid='public.list_items'::regclass
        and tgname='posthog_list_items') <> 'O' then
    raise exception 'Analytics trigger was not restored.';
  end if;

  insert into public.social_posts(user_id,post_type,content,media_title,media_type,
      media_external_source,media_external_id)
    values(v_owner::text,'review','Verification fixture','Delete verification fixture','book',v_source,v_id),
          (v_other::text,'review','Independent fixture','Delete verification fixture','book',v_source,v_id),
          (v_owner::text,'review','Unrelated fixture','Delete verification fixture','book',v_source,v_id||'-control');
  insert into public.media_ratings(user_id,media_title,media_type,media_external_source,
      media_external_id,rating)
    values(v_owner,'Delete verification fixture','book',v_source,v_id,3),
          (v_other,'Delete verification fixture','book',v_source,v_id,4),
          (v_owner,'Delete verification fixture','book',v_source,v_id||'-control',5);
  insert into public.media_progress_events(user_id,list_item_id,event_type,progress,progress_mode,
      media_type,media_external_source,media_external_id)
    values(v_owner,v_anchor,'progress_updated',20,'percent','book',v_source,v_id),
          (v_owner,null,'progress_updated',30,'percent','book',v_source,v_id),
          (v_other,v_foreign,'progress_updated',40,'percent','book',v_source,v_id);
  perform pg_catalog.set_config('delete_verify.owner',v_owner::text,true);
  perform pg_catalog.set_config('delete_verify.anchor',v_anchor::text,true);
  perform pg_catalog.set_config('delete_verify.second',v_second::text,true);
  perform pg_catalog.set_config('delete_verify.control',v_control::text,true);
  perform pg_catalog.set_config('delete_verify.foreign',v_foreign::text,true);
end;
$fixture$;

-- The function must reject foreign items even when supplied a valid ID.
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub',current_setting('delete_verify.owner'),true);
do $deny$
begin
  begin
    perform public.delete_own_library_media(current_setting('delete_verify.foreign')::uuid);
    raise exception 'Foreign delete unexpectedly succeeded';
  exception when no_data_found then null;
  end;
end;
$deny$;
select public.delete_own_library_media(current_setting('delete_verify.anchor')::uuid) as deletion_result;
reset role;

do $assert$
declare
  v_source text := 'deletion_fixture';
  v_id text := '__MARKER__';
  v_owner uuid := current_setting('delete_verify.owner')::uuid;
  v_other uuid;
begin
  select user_id into v_other from public.list_items
    where id = current_setting('delete_verify.foreign')::uuid;
  if v_other is null
    or exists(select 1 from public.list_items where id in (
      current_setting('delete_verify.anchor')::uuid, current_setting('delete_verify.second')::uuid))
    or not exists(select 1 from public.list_items
      where id = current_setting('delete_verify.control')::uuid)
    or not exists(select 1 from public.list_items
      where id = current_setting('delete_verify.foreign')::uuid)
    or exists(select 1 from public.social_posts
      where user_id=v_owner::text and media_external_source=v_source and media_external_id=v_id)
    or not exists(select 1 from public.social_posts
      where user_id=v_other::text and media_external_source=v_source and media_external_id=v_id)
    or not exists(select 1 from public.social_posts
      where user_id=v_owner::text and media_external_source=v_source and media_external_id=v_id||'-control')
    or exists(select 1 from public.media_ratings
      where user_id=v_owner and media_external_source=v_source and media_external_id=v_id)
    or not exists(select 1 from public.media_ratings
      where user_id=v_other and media_external_source=v_source and media_external_id=v_id)
    or not exists(select 1 from public.media_ratings
      where user_id=v_owner and media_external_source=v_source and media_external_id=v_id||'-control')
    or exists(select 1 from public.media_progress_events
      where user_id=v_owner and media_external_source=v_source and media_external_id=v_id)
    or not exists(select 1 from public.media_progress_events
      where user_id=v_other and media_external_source=v_source and media_external_id=v_id)
  then
    raise exception 'Live deletion or independent control relationship did not match.';
  end if;
end;
$assert$;
select jsonb_build_object('passed',true,'owner_rejected_foreign',true,
  'target_memberships_removed',2,'unrelated_controls_preserved',true,
  'transaction_rolled_back',true) as deletion_verification;
rollback;
