-- Run after the base migration in a disposable database, or inside an explicit
-- BEGIN/ROLLBACK against the live schema. Never commit these verification writes.
create temporary table spoiler_verification on commit drop as
select li.id,li.user_id from public.list_items li join public.lists l on l.id=li.list_id
where lower(trim(l.title))='finished' and li.user_id=l.user_id and
lower(replace(replace(li.media_type,' ','_'),'-','_')) in ('tv','tv_show','tv_shows','tv_series','series','television')
and coalesce(li.canonical_media_id::text,li.external_source || ':' || li.external_id) is not null
limit 1;
do $$begin
  if not exists(select 1 from spoiler_verification) then raise exception 'No eligible TV fixture'; end if;
end$$;
grant select on spoiler_verification to authenticated;
select set_config('request.jwt.claim.sub',(select user_id::text from spoiler_verification),true);
set local role authenticated;
do $test$
declare v_item uuid; v_scope uuid; v_retry uuid;
begin
  select id into v_item from pg_temp.spoiler_verification;
  v_scope := public.save_finished_tv_scope(v_item,98763,2,'Verification episode',null,'Spoiler verification.',true);
  if not exists(select 1 from public.finished_tv_scopes s join public.social_posts p on p.id=s.post_id
    where s.id=v_scope and s.contains_spoilers and p.contains_spoilers and p.post_type='thought')
  then raise exception 'Reaction-only spoiler flag lost'; end if;
  v_retry := public.save_finished_tv_scope(v_item,98763,2,'Verification episode',4.5,'Spoiler verification.',true);
  if v_retry <> v_scope or not exists(select 1 from public.finished_tv_scopes s join public.social_posts p on p.id=s.post_id
    where s.id=v_scope and s.contains_spoilers and p.contains_spoilers and p.rating=4.5)
  then raise exception 'Rated spoiler or retry failed'; end if;
  -- Scope-only and rating-only updates must not expose an existing spoiler.
  perform public.save_finished_tv_scope(v_item,98763,2,'Verification episode',null,null,false);
  perform public.save_finished_tv_scope(v_item,98763,2,'Verification episode',4.5,null,false);
  if not exists(select 1 from public.finished_tv_scopes s join public.social_posts p on p.id=s.post_id
    where s.id=v_scope and s.contains_spoilers and p.contains_spoilers)
  then raise exception 'Omitted reaction cleared spoiler protection'; end if;
  perform public.save_finished_tv_scope(v_item,98763,2,'Verification episode',4.5,'Non-spoiler verification.',false);
  if not exists(select 1 from public.finished_tv_scopes s join public.social_posts p on p.id=s.post_id
    where s.id=v_scope and not s.contains_spoilers and not p.contains_spoilers)
  then raise exception 'Explicit spoiler toggle off failed'; end if;
  -- Existing clients keep their original six-argument call.
  perform public.save_finished_tv_scope(v_item,98764,null,null,null,null);
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000000',true);
  begin
    perform public.save_finished_tv_scope(v_item,98763,2,null,null,'Foreign write',true);
    raise exception 'Foreign spoiler write accepted';
  exception when insufficient_privilege then null; end;
end $test$;
reset role;
