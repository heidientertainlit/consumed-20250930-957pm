#!/usr/bin/env bash
# Runs solely against a disposable PostgreSQL cluster. It does not read a
# database URL, project configuration, credentials, or application data.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${UGC_FILTER_TEST_PG_PORT:-55440}"
DATA_DIR="$(mktemp -d /tmp/consumed-ugc-filter-pg.XXXXXX)"
SOCKET_DIR="$(mktemp -d /tmp/consumed-ugc-filter-socket.XXXXXX)"
PSQL=(psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U runner -d postgres)

cleanup() {
  pg_ctl -D "$DATA_DIR" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DATA_DIR" "$SOCKET_DIR"
}
trap cleanup EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }
assert_eq() {
  local label="$1" expected="$2" actual="$3"
  [[ "$actual" == "$expected" ]] || fail "$label (expected <$expected>, got <$actual>)"
  echo "PASS: $label"
}
expect_reject() {
  local label="$1" sql="$2"
  local output
  if output=$("${PSQL[@]}" -c "$sql" 2>&1); then
    fail "$label unexpectedly succeeded"
  fi
  [[ "$output" == *"objectionable-content safety filter"* ]] || fail "$label failed for an unexpected reason: $output"
  echo "PASS: $label"
}
expect_length_reject() {
  local label="$1" sql="$2"
  local output
  if output=$("${PSQL[@]}" -c "$sql" 2>&1); then
    fail "$label unexpectedly succeeded"
  fi
  [[ "$output" == *"exceeds the maximum length"* ]] || fail "$label failed for an unexpected reason: $output"
  echo "PASS: $label"
}

initdb -D "$DATA_DIR" --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$DATA_DIR" -o "-k '$SOCKET_DIR' -p $PORT -c listen_addresses='' -c fsync=off" start >/dev/null

"${PSQL[@]}" <<'SQL'
create schema auth;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public, auth to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- These fixtures retain the verified production table/column names for each
-- moderated surface. Broad write policies simulate direct PostgREST access;
-- enforcement must therefore come from the migration trigger, not the client.
create table public.users (id uuid primary key, user_name text, display_name text, first_name text, last_name text, bio text);
create table public.profiles (user_id uuid primary key, username text);
create table public.user_profiles (id bigint generated always as identity primary key, user_id uuid, display_name text, bio text);
create table public.social_posts (id uuid primary key, user_id uuid, content text, media_title text, likes_count integer default 0);
create table public.social_post_comments (id bigint generated always as identity primary key, social_post_id uuid, user_id uuid, content text);
create table public.prediction_comments (id bigint generated always as identity primary key, pool_id text, user_id text, content text);
create table public.rank_comments (id uuid primary key, rank_id uuid, user_id uuid, content text);
create table public.room_takes (id uuid primary key, room_id uuid, user_id uuid, title text, body text, tag text, media_title text);
create table public.room_take_replies (id uuid primary key, take_id uuid, user_id uuid, content text, media_title text);
create table public.reviews (id uuid primary key, user_id uuid, media_title text, review_text text);
create table public.hot_take_passes (id uuid primary key, response text);
create table public.bets (id uuid primary key, prediction text);
create table public.user_predictions (id uuid primary key, prediction text);
create table public.rec_requests (id uuid primary key, context text);
create table public.lists (id uuid primary key, title text);
create table public.list_items (id uuid primary key, notes text, title text);
create table public.user_lists (id uuid primary key, title text, description text);
create table public.user_media (id uuid primary key, notes text, title text);
create table public.ranks (id uuid primary key, title text, description text);
create table public.rank_items (id uuid primary key, notes text, title text);
create table public.strands (id uuid primary key, title text, content text);
create table public.strand_comments (id uuid primary key, content text);
create table public.media_goals (id uuid primary key, title text, description text, goal_description text);
create table public.user_highlights (id uuid primary key, description text, title text);
create table public.pools (id uuid primary key, name text, description text, examples text, series_tag text, partner_name text);
create table public.pool_rounds (id uuid primary key, title text);
create table public.pool_prompts (id uuid primary key, prompt_text text, correct_answer text, options text[], status text default 'draft');
create table public.pool_answers (id uuid primary key, answer text);
create table public.prediction_pools (id text primary key, title text, options jsonb, likes_count integer default 0);
create table public.friend_casts (id uuid primary key, prompt text, target_friend_name text);
create table public.edna_responses (id uuid primary key, answer_text text);
create table public.beta_feedback (id uuid primary key, open_feedback text);

do $$
declare relation_name text;
begin
  foreach relation_name in array array[
    'users','profiles','user_profiles','social_posts','social_post_comments',
    'prediction_comments','rank_comments','room_takes','room_take_replies',
    'reviews','hot_take_passes','bets','user_predictions','rec_requests',
    'lists','list_items','user_lists','user_media','ranks','rank_items',
    'strands','strand_comments','media_goals','user_highlights','pools',
    'pool_rounds','pool_prompts','pool_answers','prediction_pools',
    'friend_casts','edna_responses','beta_feedback'
  ] loop
    execute format('alter table public.%I enable row level security', relation_name);
    execute format('create policy direct_postgrest_fixture on public.%I for all to authenticated using (true) with check (true)', relation_name);
    execute format('grant select, insert, update on public.%I to authenticated', relation_name);
    execute format('grant select, insert, update on public.%I to service_role', relation_name);
  end loop;
end
$$;
SQL

"${PSQL[@]}" -f "$ROOT/supabase/migrations/20260915010000_enforce_objectionable_ugc_text.sql" >/dev/null

assert_eq "one trigger is attached per moderated table" "31" \
  "$("${PSQL[@]}" -Atqc "select count(*) from pg_trigger where tgname like 'enforce_ugc_text_%' and not tgisinternal")"
assert_eq "RLS remains enabled on representative direct-write surface" "t" \
  "$("${PSQL[@]}" -Atqc "select relrowsecurity from pg_class where oid = 'public.social_posts'::regclass")"
assert_eq "filter helper is not anonymously executable" "f" \
  "$("${PSQL[@]}" -Atqc "select has_function_privilege('anon', 'public.assert_ugc_text(text,text,integer)', 'execute')")"
assert_eq "direct writers receive only validator execution" "t" \
  "$("${PSQL[@]}" -Atqc "select has_function_privilege('authenticated', 'public.assert_ugc_text(text,text,integer)', 'execute')")"
assert_eq "trigger function is not directly executable by writers" "f" \
  "$("${PSQL[@]}" -Atqc "select has_function_privilege('authenticated', 'public.enforce_ugc_text_on_write()', 'execute')")"

ACTOR=00000000-0000-0000-0000-000000000001
expect_reject "direct PostgREST-style post insert rejects zero-width-obfuscated severe slur" \
  "set role authenticated; set request.jwt.claim.sub='$ACTOR'; insert into public.social_posts values ('00000000-0000-0000-0000-000000000011','$ACTOR',U&'n\\200Bi\\200Bg\\200Bg\\200Be\\200Br','A permitted catalog title',0);"
expect_reject "profile first name is filtered" \
  "set role authenticated; set request.jwt.claim.sub='$ACTOR'; insert into public.users values ('00000000-0000-0000-0000-000000000010','safe','Safe','b e a n e r','User','Safe bio');"
expect_reject "direct PostgREST-style comment update rejects a direct self-harm threat" \
  "insert into public.social_post_comments(social_post_id,user_id,content) values ('00000000-0000-0000-0000-000000000011','$ACTOR','Initially safe'); set role authenticated; set request.jwt.claim.sub='$ACTOR'; update public.social_post_comments set content='go k i l l yourself' where id=1;"
expect_reject "room reply insert is filtered" \
  "set role authenticated; set request.jwt.claim.sub='$ACTOR'; insert into public.room_take_replies values ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000013','$ACTOR','f a g g o t','catalog title');"
expect_reject "review update is filtered without inspecting its media title" \
  "insert into public.reviews values ('00000000-0000-0000-0000-000000000014','$ACTOR','Fucking Åmål','Thoughtful review'); set role authenticated; set request.jwt.claim.sub='$ACTOR'; update public.reviews set review_text='n1gg3r' where id='00000000-0000-0000-0000-000000000014';"
expect_reject "pool answer insert is filtered" \
  "set role authenticated; set request.jwt.claim.sub='$ACTOR'; insert into public.pool_answers values ('00000000-0000-0000-0000-000000000015','w e t b a c k');"
expect_reject "prompt option array is filtered" \
  "set role authenticated; set request.jwt.claim.sub='$ACTOR'; insert into public.pool_prompts(id,prompt_text,correct_answer,options) values ('00000000-0000-0000-0000-000000000016','Safe prompt','Safe',array['safe','b e a n e r']);"
expect_reject "caller-authored prediction pool option JSON is filtered" \
  "set role authenticated; set request.jwt.claim.sub='$ACTOR'; insert into public.prediction_pools values ('pool-1','Safe',jsonb_build_array('safe','n1gg3r'),0);"
expect_reject "friend-cast prompt is filtered" \
  "set role authenticated; set request.jwt.claim.sub='$ACTOR'; insert into public.friend_casts values ('00000000-0000-0000-0000-000000000021','k i k e');"
expect_reject "service-style friend-cast insert filters off-platform target names" \
  "set role service_role; insert into public.friend_casts values ('00000000-0000-0000-0000-000000000026','Safe prompt','b e a n e r');"
expect_reject "strand comment is filtered" \
  "set role authenticated; set request.jwt.claim.sub='$ACTOR'; insert into public.strand_comments values ('00000000-0000-0000-0000-000000000022','f a g g o t');"
expect_length_reject "field length is bounded on update" \
  "insert into public.ranks values ('00000000-0000-0000-0000-000000000017','Safe rank','Safe'); set role authenticated; set request.jwt.claim.sub='$ACTOR'; update public.ranks set title=repeat('a',281) where id='00000000-0000-0000-0000-000000000017';"
expect_reject "service-style pool insert filters public partner names" \
  "set role service_role; insert into public.pools values ('00000000-0000-0000-0000-000000000028','Safe room','Safe description','Safe examples','Safe series','b e a n e r');"
"${PSQL[@]}" -c "set role service_role; insert into public.pools values ('00000000-0000-0000-0000-000000000027','Safe room','Safe description','Safe examples','Safe series','Safe partner');" >/dev/null
expect_reject "service-style pool update filters public series tags" \
  "set role service_role; update public.pools set series_tag='w e t b a c k' where id='00000000-0000-0000-0000-000000000027';"

"${PSQL[@]}" -c "set role authenticated; set request.jwt.claim.sub='$ACTOR'; insert into public.social_posts values ('00000000-0000-0000-0000-000000000018','$ACTOR','A review of the title Fucking Åmål.','Fucking Åmål',0); insert into public.room_takes values ('00000000-0000-0000-0000-000000000019','00000000-0000-0000-0000-000000000020','$ACTOR','Kill Bill discussion','The film is a classic.','movies','Kill Bill');" >/dev/null
assert_eq "ordinary text and media titles are allowed" "2" \
  "$("${PSQL[@]}" -Atqc "select (select count(*) from public.social_posts) + (select count(*) from public.room_takes)")"

# Existing rows can predate this migration. A counter/status-like update must
# not revalidate unchanged legacy text, while a later edit to that text must.
"${PSQL[@]}" -c "set session_replication_role = replica; insert into public.social_posts values ('00000000-0000-0000-0000-000000000023','$ACTOR','nigger','Legacy title',0); insert into public.prediction_pools values ('legacy-pool',repeat('x',281),jsonb_build_array('safe'),0); set session_replication_role = origin;" >/dev/null
"${PSQL[@]}" -c "set session_replication_role = replica; insert into public.pool_prompts values ('00000000-0000-0000-0000-000000000025','Legacy safe prompt','Safe',array['nigger'],'draft'); set session_replication_role = origin;" >/dev/null
"${PSQL[@]}" -c "set role authenticated; set request.jwt.claim.sub='$ACTOR'; update public.social_posts set likes_count=likes_count+1 where id='00000000-0000-0000-0000-000000000023'; update public.prediction_pools set likes_count=likes_count+1 where id='legacy-pool'; update public.pool_prompts set status='closed' where id='00000000-0000-0000-0000-000000000025';" >/dev/null
assert_eq "unchanged legacy text does not block non-text updates" "1|1" \
  "$("${PSQL[@]}" -Atqc "select (select likes_count from public.social_posts where id='00000000-0000-0000-0000-000000000023') || '|' || (select likes_count from public.prediction_pools where id='legacy-pool')")"
expect_reject "editing legacy objectionable post text is rejected" \
  "set role authenticated; set request.jwt.claim.sub='$ACTOR'; update public.social_posts set content='f a g g o t' where id='00000000-0000-0000-0000-000000000023';"
expect_length_reject "editing legacy overlimit pool title is rejected" \
  "set role authenticated; set request.jwt.claim.sub='$ACTOR'; update public.prediction_pools set title=repeat('y',282) where id='legacy-pool';"
expect_reject "editing legacy prompt options is rejected" \
  "set role authenticated; set request.jwt.claim.sub='$ACTOR'; update public.pool_prompts set options=array['safe','b e a n e r'] where id='00000000-0000-0000-0000-000000000025';"

"${PSQL[@]}" -c "set role authenticated; set request.jwt.claim.sub='$ACTOR'; insert into public.beta_feedback values ('00000000-0000-0000-0000-000000000024','A report quoted nigger verbatim for support');" >/dev/null
assert_eq "support feedback remains unfiltered for abuse reports" "1" \
  "$("${PSQL[@]}" -Atqc "select count(*) from public.beta_feedback")"
echo "All isolated UGC filter migration tests passed."