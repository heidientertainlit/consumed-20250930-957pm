#!/usr/bin/env bash
# Disposable local PostgreSQL ONLY. No project/credential/database URL reads.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT=55449
DATA_DIR="$(mktemp -d /tmp/persona-conversation-pg.XXXXXX)"
SOCKET_DIR="$(mktemp -d /tmp/persona-conversation-sock.XXXXXX)"
trap 'pg_ctl -D "$DATA_DIR" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA_DIR" "$SOCKET_DIR"' EXIT
initdb -D "$DATA_DIR" --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$DATA_DIR" -o "-k '$SOCKET_DIR' -p $PORT -c listen_addresses='' -c fsync=off" start >/dev/null
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U runner -d postgres)
"${PSQL[@]}" <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create table users(id uuid primary key, is_admin boolean default false,is_persona boolean default false,persona_config jsonb);
create table media_provider_aliases(external_source text,external_id text,canonical_media_id uuid,source_verified boolean);
create table social_posts(id uuid primary key default gen_random_uuid(),user_id uuid references users,post_type text,content text,rating numeric,
  media_title text,media_type text,media_creator text,media_external_id text,media_external_source text,canonical_media_id uuid,
  visibility text,likes_count integer,comments_count integer,created_at timestamptz default now());
create table social_post_comments(id bigint generated always as identity primary key,social_post_id uuid references social_posts,
  user_id uuid references users,content text,parent_comment_id bigint references social_post_comments,created_at timestamptz default now());
grant usage on schema public to service_role,anon,authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
insert into users values
('11111111-1111-4111-8111-111111111111',true,false,'{"tone":"unchanged"}'),
('22222222-2222-4222-8222-222222222222',false,true,'{"tone":"reserved","favorite_media":["unchanged"]}'),
('33333333-3333-4333-8333-333333333333',false,true,'{"tone":"warm"}'),
('44444444-4444-4444-8444-444444444444',false,false,'{}');
SQL
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261009000000_persona_social_conversations.sql"
"${PSQL[@]}" <<'SQL'
create function assert_true(ok boolean,label text) returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label; end $$;
create function rejects(sql_text text,label text) returns void language plpgsql as $$
declare failed boolean=false;
begin begin execute sql_text; exception when others then failed=true; end;
perform assert_true(failed,label); end $$;
create function roster() returns uuid[] language sql as $$ select array['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333']::uuid[] $$;
create function messages() returns jsonb language sql as $$ select '[
 {"client_id":"root","participant_id":"22222222-2222-4222-8222-222222222222","parent_client_id":null,"body":"An opening","offset_seconds":0},
 {"client_id":"c1","participant_id":"33333333-3333-4333-8333-333333333333","parent_client_id":"root","body":"A response","offset_seconds":60},
 {"client_id":"c2","participant_id":"22222222-2222-4222-8222-222222222222","parent_client_id":"c1","body":"Returning speaker","offset_seconds":120}]'::jsonb $$;
insert into persona_conversation_runs(id,created_by,topic,participant_ids,opening_author_id,messages)
values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Free topic',roster(),(roster())[1],messages());
select assert_true((select count(*)=0 from social_posts),'generation creates zero public writes');
select rejects('set role anon; select * from persona_conversation_runs','anonymous draft reads denied');
select rejects('set role authenticated; select * from persona_conversation_runs','human draft reads denied');
select rejects($q$set role authenticated; select deliver_persona_conversation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$q$,'human worker invocation denied');
select rejects($q$select manage_persona_conversation('44444444-4444-4444-8444-444444444444','approve','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1)$q$,'non-admin approval denied');
select rejects($q$select manage_persona_conversation('11111111-1111-4111-8111-111111111111','schedule','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,jsonb_build_object('startAt',now()+interval '1 hour'))$q$,'unapproved scheduling denied');
select rejects($q$select validate_persona_conversation(array['22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444']::uuid[],(roster())[1],messages())$q$,'human roster denied');
select rejects($q$select validate_persona_conversation(roster(),(roster())[1],jsonb_set(messages(),'{2,parent_client_id}','"foreign"'))$q$,'foreign reply parent denied');
select rejects($q$select validate_persona_conversation(roster(),(roster())[1],jsonb_set(messages(),'{2,offset_seconds}','60'))$q$,'simultaneous reply denied');
select rejects($q$select validate_persona_conversation(roster(),(roster())[1],jsonb_set(messages(),'{1,public_id}','"123"'))$q$,'forged public mapping denied');
select manage_persona_conversation('11111111-1111-4111-8111-111111111111','approve','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1);
select assert_true((select approved_revision=revision from persona_conversation_runs),'approval is revision-bound');
select manage_persona_conversation('11111111-1111-4111-8111-111111111111','edit','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',2,jsonb_build_object('messages',messages()));
select assert_true((select status='draft' and approved_revision is null from persona_conversation_runs),'editing clears approval');
select rejects($q$select manage_persona_conversation('11111111-1111-4111-8111-111111111111','approve','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',2)$q$,'stale concurrent approval denied');
select manage_persona_conversation('11111111-1111-4111-8111-111111111111','approve','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',3);
select rejects($q$select manage_persona_conversation('11111111-1111-4111-8111-111111111111','schedule','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',4,jsonb_build_object('startAt',now()-interval '1 hour'))$q$,'past schedule denied');
select manage_persona_conversation('11111111-1111-4111-8111-111111111111','schedule','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',4,jsonb_build_object('startAt',now()+interval '1 hour'));
select assert_true(deliver_persona_conversation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->>'status'='not_due','future content not released');
-- Simulate a very delayed scheduler without backdating PUBLIC creations.
update persona_conversation_runs set start_at=now()-interval '1 day';
select assert_true(deliver_persona_conversation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->>'status'='delivered','overdue root released');
select assert_true((select created_at>now()-interval '1 minute' and media_external_id is null and canonical_media_id is null from social_posts),'actual arrival time; free topic remains unlinked');
select assert_true(deliver_persona_conversation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->>'status' in ('paced','not_due'),'delay does not dump overdue replies');
select assert_true((select count(*)=1 from social_posts),'retry never duplicates root');
select manage_persona_conversation('11111111-1111-4111-8111-111111111111','pause','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',5);
update persona_conversation_runs set last_delivered_at=now()-interval '2 minutes',next_attempt_at=now()-interval '1 minute';
select assert_true(deliver_persona_conversation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->>'status'='not_due','pause blocks unreleased reply');
select rejects($q$select manage_persona_conversation('11111111-1111-4111-8111-111111111111','regenerate','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',6,jsonb_build_object('messages',messages()))$q$,'delivered conversation cannot regenerate');
select manage_persona_conversation('11111111-1111-4111-8111-111111111111','schedule','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',6,jsonb_build_object('startAt',now()+interval '1 hour'));
update persona_conversation_runs set start_at=now()-interval '1 day';
SQL
# Real concurrent invocations contend on the same durable lock.
"${PSQL[@]}" -c "select deliver_persona_conversation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')" >/dev/null &
A=$!
"${PSQL[@]}" -c "select deliver_persona_conversation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')" >/dev/null &
B=$!
wait "$A"; wait "$B"
"${PSQL[@]}" <<'SQL'
select assert_true((select count(*)=1 from social_post_comments),'concurrent workers insert one comment');
select assert_true((select comments_count=1 from social_posts),'root count consistent');
update persona_conversation_runs set last_delivered_at=now()-interval '2 minutes',next_attempt_at=now()-interval '1 minute';
select assert_true(deliver_persona_conversation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->>'status'='delivered','nested reply delivered after parent');
select assert_true((select parent_comment_id=(select min(id) from social_post_comments) from social_post_comments order by id desc limit 1),'nested parent mapping is persisted comment ID');
select assert_true((select status='completed' from persona_conversation_runs),'completed delivery status');
select assert_true((select count(*)=2 from social_post_comments),'exact comment count');

insert into media_provider_aliases values ('tmdb','verified-1','55555555-5555-4555-8555-555555555555',true);
insert into persona_conversation_runs(id,created_by,topic,participant_ids,opening_author_id,messages,subject)
values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','Verified title',roster(),(roster())[1],messages(),
'{"title":"Chosen movie","type":"movie","externalId":"verified-1","externalSource":"tmdb","canonicalId":"55555555-5555-4555-8555-555555555555"}');
select manage_persona_conversation('11111111-1111-4111-8111-111111111111','approve','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1);
select manage_persona_conversation('11111111-1111-4111-8111-111111111111','schedule','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',2,jsonb_build_object('startAt',now()+interval '1 hour'));
update persona_conversation_runs set start_at=now()-interval '1 day' where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select deliver_persona_conversation('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select assert_true((select count(*)=1 from social_posts where canonical_media_id='55555555-5555-4555-8555-555555555555' and media_external_id='verified-1' and persona_conversation_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),'Now/media use one exact provider/canonical root');
create function fail_comment() returns trigger language plpgsql as $$ begin raise exception 'fixture temporary failure'; end $$;
create trigger fixture_comment_failure before insert on social_post_comments for each row execute function fail_comment();
update persona_conversation_runs set last_delivered_at=now()-interval '2 minutes',next_attempt_at=now()-interval '1 minute' where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select assert_true(deliver_persona_conversation('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')->>'status'='failed','delivery failure is recorded');
select assert_true((select attempts=1 and last_error is not null and messages->1->>'public_id' is null from persona_conversation_runs where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),'failed public transaction leaves no forged mapping');
select assert_true((select count(*)=2 from social_post_comments),'failed comment insert rolled back');
select assert_true(deliver_persona_conversation('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')->>'status'='not_due','retry backoff enforced');
drop trigger fixture_comment_failure on social_post_comments;
update persona_conversation_runs set next_attempt_at=now()-interval '1 minute' where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select deliver_persona_conversation('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select assert_true((select count(*)=3 from social_post_comments),'retry succeeds once');
select manage_persona_conversation('11111111-1111-4111-8111-111111111111','cancel','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',3);
update persona_conversation_runs set last_delivered_at=now()-interval '2 minutes',next_attempt_at=now()-interval '1 minute' where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select assert_true(deliver_persona_conversation('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')->>'status'='not_due','cancel blocks unreleased nested replies');
insert into persona_conversation_gender values((roster())[1],'nonbinary');
select assert_true((select persona_config->>'tone'='reserved' and persona_config->'favorite_media'='["unchanged"]'::jsonb from users where id=(roster())[1]),'fictional metadata preserves all persona config');
select assert_true((select count(*)=2 from social_posts),'no copied threads or fabricated activity');
-- Existing human interactions share this same root and nested substrate.
insert into social_post_comments(social_post_id,user_id,content,parent_comment_id)
select root_post_id,'44444444-4444-4444-8444-444444444444','A real user joins',
  (select min(id) from social_post_comments where social_post_id=root_post_id)
from persona_conversation_runs where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select assert_true((select comments_count=3 from social_posts where persona_conversation_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'human replies update the same public count');
delete from social_post_comments where user_id='44444444-4444-4444-8444-444444444444';
select assert_true((select comments_count=2 from social_posts where persona_conversation_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'human deletion updates the same public count');
-- Simulate public moderation removing a parent, then the root.
update persona_conversation_runs set status='scheduled',approved_revision=revision,last_delivered_at=now()-interval '2 minutes',next_attempt_at=null where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
delete from social_post_comments where social_post_id=(select root_post_id from persona_conversation_runs where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select assert_true(deliver_persona_conversation('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')->>'status'='failed','deleted public parent is never recreated');
delete from social_posts where persona_conversation_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
update persona_conversation_runs set next_attempt_at=null where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select assert_true(deliver_persona_conversation('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')->>'status'='failed','deleted public root is never recreated');
select assert_true((select count(*)=1 from social_posts),'moderation deletions remain deleted');
SQL
# Two human transactions hold root FK key-share locks at the same time. Scoped
# count locks must remain compatible with those locks (no lock-upgrade deadlock).
"${PSQL[@]}" -c "begin; insert into social_post_comments(social_post_id,user_id,content) select root_post_id,'44444444-4444-4444-8444-444444444444','Concurrent human one' from persona_conversation_runs where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; select pg_sleep(0.05); commit;" >/dev/null &
C=$!
"${PSQL[@]}" -c "begin; insert into social_post_comments(social_post_id,user_id,content) select root_post_id,'44444444-4444-4444-8444-444444444444','Concurrent human two' from persona_conversation_runs where id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; select pg_sleep(0.05); commit;" >/dev/null &
D=$!
wait "$C"; wait "$D"
"${PSQL[@]}" -c "select assert_true((select comments_count=4 from social_posts where persona_conversation_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'concurrent human replies do not deadlock or lose counts');"
echo "PASS: private lifecycle, authorization, concurrency, pacing, retries and shared identity"
