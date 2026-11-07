insert into public.media_provider_aliases values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','openlibrary','/works/OL1W'),
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','googlebooks','verified-alias'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','googlebooks','different-work');

-- Same owner across Currently/Favorites/Want To, plus foreign-user and
-- same-title/different-work controls. The third membership is legacy, no canonical ID.
insert into public.list_items(id,user_id,list_id,canonical_media_id,external_source,external_id,media_type,title) values
 ('10000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','01000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','openlibrary','/works/OL1W','book','Same Title'),
 ('10000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','01000000-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','googlebooks','verified-alias','book','Same Title'),
 ('10000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','01000000-0000-0000-0000-000000000003',null,'googlebooks','verified-alias','book','Same Title'),
 ('10000000-0000-0000-0000-000000000004','22222222-2222-2222-2222-222222222222',null,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','openlibrary','/works/OL1W','book','Same Title'),
 ('10000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111',null,'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','googlebooks','different-work','book','Same Title'),
 ('10000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111',null,null,'tmdb','123','movie','Legacy'),
 ('10000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111',null,null,'tmdb','123','tv','Legacy'),
 ('10000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111',null,null,null,null,'book','Unidentifiable');

insert into public.social_posts values
 ('20000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',null,null,'book','Owner review'),
 ('20000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',null,'googlebooks','verified-alias','Book','Legacy review'),
 ('20000000-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',null,null,'book','Other user review'),
 ('20000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',null,null,'book','Different work');
insert into public.social_post_comments(user_id,post_id) values
 ('22222222-2222-2222-2222-222222222222','20000000-0000-0000-0000-000000000001'),
 ('11111111-1111-1111-1111-111111111111','20000000-0000-0000-0000-000000000003');
insert into public.media_ratings(user_id,canonical_media_id,media_external_source,media_external_id,media_type,rating) values
 ('11111111-1111-1111-1111-111111111111',null,'googlebooks','verified-alias','book',3.5),
 ('22222222-2222-2222-2222-222222222222','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',null,null,'book',4),
 ('11111111-1111-1111-1111-111111111111','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',null,null,'book',2);
insert into public.media_progress_events(user_id,list_item_id,canonical_media_id,event_type,progress,progress_mode) values
 ('11111111-1111-1111-1111-111111111111','10000000-0000-0000-0000-000000000001',null,'progress_updated',20,'percent'),
 ('11111111-1111-1111-1111-111111111111',null,'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','progress_updated',30,'percent'),
 ('22222222-2222-2222-2222-222222222222','10000000-0000-0000-0000-000000000004','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','progress_updated',40,'percent');
insert into public.media_history_log values ('10000000-0000-0000-0000-000000000001');
insert into public.media_tag_links values ('10000000-0000-0000-0000-000000000002');
insert into public.media_import_rows values ('10000000-0000-0000-0000-000000000001',1);

select pg_temp.assert(not has_function_privilege('anon','public.delete_own_library_media(uuid)','execute'),'anonymous callers cannot execute');
select pg_temp.assert(has_function_privilege('authenticated','public.delete_own_library_media(uuid)','execute'),'authenticated callers can execute');
select set_config('request.jwt.claim.sub','','false');
do $$ begin
  perform public.delete_own_library_media('10000000-0000-0000-0000-000000000001');
  raise exception 'Anonymous deletion succeeded';
exception when insufficient_privilege then null; end $$;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
do $$ begin
  perform public.delete_own_library_media('10000000-0000-0000-0000-000000000004');
  raise exception 'Foreign-user deletion succeeded';
exception when no_data_found then null; end $$;
do $$ begin
  perform public.delete_own_library_media('10000000-0000-0000-0000-000000000099');
  raise exception 'Missing anchor succeeded';
exception when no_data_found then null; end $$;
do $$ begin
  perform public.delete_own_library_media('10000000-0000-0000-0000-000000000008');
  raise exception 'Unidentifiable media was deleted';
exception when raise_exception then
  if sqlerrm <> 'This item is missing the identity needed for safe deletion.' then raise; end if;
end $$;

-- Inject a late failure: the earlier post/comment deletion must roll back.
create function public.test_reject_rating_delete() returns trigger language plpgsql as $$
begin raise exception 'fixture rating failure'; end;
$$;
create trigger test_rating_failure before delete on public.media_ratings
for each statement execute function public.test_reject_rating_delete();
do $$ begin
  perform public.delete_own_library_media('10000000-0000-0000-0000-000000000001');
  raise exception 'Expected atomic failure';
exception when raise_exception then
  if sqlerrm <> 'fixture rating failure' then raise; end if;
end $$;
select pg_temp.assert((select count(*)=4 from public.social_posts),'failed delete restored posts');
select pg_temp.assert((select count(*)=2 from public.social_post_comments),'failed delete restored comments');
select pg_temp.assert((select count(*)=8 from public.list_items),'failed delete retained all memberships');
select pg_temp.assert((select count(*)=3 from public.media_ratings),'failed delete retained ratings');
drop trigger test_rating_failure on public.media_ratings;
drop function public.test_reject_rating_delete();

-- Exercise the real migration function as the unprivileged authenticated role,
-- which has no direct table grants.
set role authenticated;
select public.delete_own_library_media('10000000-0000-0000-0000-000000000001');
reset role;
select pg_temp.assert((select count(*)=5 from public.list_items),'all three memberships removed');
select pg_temp.assert((select count(*)=2 from public.social_posts),'canonical and legacy reviews removed');
select pg_temp.assert((select count(*)=2 from public.media_ratings),'only owner target rating removed');
select pg_temp.assert((select count(*)=1 from public.media_progress_events),'target progress removed including detached events');
select pg_temp.assert((select count(*)=1 from public.social_post_comments),'only comments on deleted posts cascade');
select pg_temp.assert((select count(*)=0 from public.media_history_log),'tracking history cascades');
select pg_temp.assert((select count(*)=0 from public.media_tag_links),'library tags cascade');
select pg_temp.assert((select list_item_id is null and media_rating_id is null from public.media_import_rows),'import provenance stays detached');
select pg_temp.assert(exists(select 1 from public.list_items where id='10000000-0000-0000-0000-000000000004'),'other owner membership remains');
select pg_temp.assert(exists(select 1 from public.list_items where id='10000000-0000-0000-0000-000000000005'),'same-title different work remains');
select pg_temp.assert(exists(select 1 from public.social_posts where id='20000000-0000-0000-0000-000000000003'),'other owner review remains');
select pg_temp.assert(exists(select 1 from public.social_posts where id='20000000-0000-0000-0000-000000000004'),'different work review remains');
select pg_temp.assert((select count(*)=3 from public.media_provider_aliases),'shared provider aliases remain');

-- Provider-only legacy identity must not delete the same numeric TV ID.
set role authenticated;
select public.delete_own_library_media('10000000-0000-0000-0000-000000000006');
reset role;
select pg_temp.assert(not exists(select 1 from public.list_items where id='10000000-0000-0000-0000-000000000006'),'legacy movie removed');
select pg_temp.assert(exists(select 1 from public.list_items where id='10000000-0000-0000-0000-000000000007'),'same-ID TV control remains');
select 'PASS: local deletion, owner boundaries, alias matching, cascade controls, and atomic rollback' as result;

-- A simulated external analytics trigger fails loudly if the live-schema
-- verification fixture accidentally leaves it enabled while inserting rows.
create function public.test_posthog_guard() returns trigger language plpgsql as $$
begin raise exception 'fixture emitted an external analytics event'; end;
$$;
create trigger posthog_list_items after insert or update on public.list_items
  for each row execute function public.test_posthog_guard();
