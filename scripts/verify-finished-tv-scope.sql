-- Run only against a disposable PostgreSQL fixture database, never the app.
\set ON_ERROR_STOP on
create role anon;
create role authenticated;
create schema auth;
grant usage on schema auth to authenticated;
create function auth.uid() returns uuid language sql stable as
  $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.users(id uuid primary key);
create table public.lists(id uuid primary key,user_id uuid,title text);
create table public.list_items(
  id uuid primary key,user_id uuid,list_id uuid,title text,media_type text,
  canonical_media_id uuid,external_id text,external_source text,creator text,image_url text,
  season_number integer,episode_number integer,episode_title text
);
create table public.social_posts(
  id uuid primary key default gen_random_uuid(),user_id uuid,content text,post_type text,rating numeric,
  media_title text,media_type text,media_creator text,image_url text,media_external_id text,media_external_source text,
  canonical_media_id uuid,media_season_number integer,media_episode_number integer,media_episode_title text,
  visibility text,contains_spoilers boolean
);
\ir ../supabase/migrations/20261110230000_finished_tv_scopes.sql
insert into users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
insert into lists values ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001','Finished');
insert into list_items(id,user_id,list_id,title,media_type,external_id,external_source)
  values ('00000000-0000-0000-0000-000000000100','00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010','Fixture TV','tv','fixture','tmdb');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
set role authenticated;
select save_finished_tv_scope('00000000-0000-0000-0000-000000000100',2);
select save_finished_tv_scope('00000000-0000-0000-0000-000000000100',4,2,'Episode two',4.5,'A real reaction.');
select save_finished_tv_scope('00000000-0000-0000-0000-000000000100',4,2,'Episode two',4.5,'A real reaction.');
select save_finished_tv_scope('00000000-0000-0000-0000-000000000100',4,2,'Episode two',4.5);
do $$begin
  if (select count(*) from finished_tv_scopes) <> 2 then raise exception 'Lost season history or duplicated retry'; end if;
end$$;
reset role;
do $$begin
  if (select count(*) from social_posts) <> 1 then raise exception 'Duplicated social post'; end if;
  if not exists(select 1 from social_posts where media_season_number=4 and media_episode_number=2 and rating=4.5)
    then raise exception 'Lost post scope'; end if;
  if not exists(select 1 from social_posts where content='A real reaction.') then raise exception 'Omitted reaction erased prior text'; end if;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
set role authenticated;
do $$begin
  if exists(select 1 from finished_tv_scopes) then raise exception 'Foreign completion readable'; end if;
  begin
    perform save_finished_tv_scope('00000000-0000-0000-0000-000000000100',3);
    raise exception 'Foreign item writable';
  exception when insufficient_privilege then null; end;
end$$;
select set_config('request.jwt.claim.sub','',false);
do $$begin
  begin
    perform save_finished_tv_scope('00000000-0000-0000-0000-000000000100',3);
    raise exception 'Anonymous write allowed';
  exception when insufficient_privilege then null; end;
end$$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
set role authenticated;
do $$begin
  begin
    perform save_finished_tv_scope('00000000-0000-0000-0000-000000000100',-1);
    raise exception 'Negative season allowed';
  exception when invalid_parameter_value then null; end;
  begin
    perform save_finished_tv_scope('00000000-0000-0000-0000-000000000100',4,0);
    raise exception 'Invalid episode allowed';
  exception when invalid_parameter_value then null; end;
end$$;
reset role;
-- A rejected public post must roll back the completion and list metadata too.
alter table social_posts add constraint fixture_rejected_content check(content <> 'REJECT');
do $$declare v_season integer; begin
  select season_number into v_season from list_items limit 1;
  begin
    perform save_finished_tv_scope('00000000-0000-0000-0000-000000000100',7,1,null,null,'REJECT');
    raise exception 'Invalid content accepted';
  exception when check_violation then null; end;
  if exists(select 1 from finished_tv_scopes where season_number=7) then raise exception 'Partial completion committed'; end if;
  if (select season_number from list_items limit 1) is distinct from v_season then raise exception 'Partial list change committed'; end if;
end$$;
select 'Finished TV scope tests passed' as result;
