#!/usr/bin/env bash
# Runs only against a disposable local PostgreSQL cluster; no project database
# configuration, URLs, or credentials are read.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${SECURITY_TEST_PG_PORT:-55439}"
DATA_DIR="$(mktemp -d /tmp/consumed-security-pg.XXXXXX)"
SOCKET_DIR="$(mktemp -d /tmp/consumed-security-socket.XXXXXX)"
LOG_FILE="$DATA_DIR/postgres.log"
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
query() { "${PSQL[@]}" -Atqc "$1"; }
expect_fail() {
  local label="$1" sql="$2"
  if "${PSQL[@]}" -c "$sql" >/dev/null 2>&1; then
    fail "$label unexpectedly succeeded"
  fi
  echo "PASS: $label"
}

initdb -D "$DATA_DIR" --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$DATA_DIR" -o "-k '$SOCKET_DIR' -p $PORT -c listen_addresses='' -c fsync=off" -l "$LOG_FILE" start >/dev/null

"${PSQL[@]}" <<'SQL'
create extension pgcrypto;
create schema auth;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public, auth to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table auth.users (id uuid primary key);
create table public.users (
  id uuid primary key references auth.users(id),
  email text unique, user_name text unique, first_name text, last_name text,
  display_name text, avatar text, people_discoverable boolean default true,
  is_persona boolean default false
);
create table public.dna_profiles (
  id uuid primary key default gen_random_uuid(), user_id uuid unique references auth.users(id),
  profile_text text, is_private boolean default false, favorite_genres text[]
);
create table public.friendships (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id),
  friend_id uuid references auth.users(id), status text default 'pending',
  created_at timestamp default now(), unique(user_id, friend_id)
);
create table public.user_blocks (
  id uuid primary key default gen_random_uuid(), blocker_id uuid references auth.users(id),
  blocked_id uuid references auth.users(id), unique(blocker_id, blocked_id)
);

alter table public.friendships enable row level security;
alter table public.dna_profiles enable row level security;
-- Representative pre-hardening policies: broad mutation and read access.
create policy old_friendships_all on public.friendships for all to authenticated using (true) with check (true);
create policy old_friendships_select on public.friendships for select to authenticated using (true);
create policy old_friendships_delete on public.friendships for delete to authenticated using (true);
create policy old_dna_read_all on public.dna_profiles for select to anon, authenticated using (true);
create policy old_dna_owner_write on public.dna_profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.friendships to anon, authenticated, service_role;
grant select on public.dna_profiles to anon, authenticated, service_role;

insert into auth.users values
 ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000003'), ('00000000-0000-0000-0000-000000000004'),
 ('00000000-0000-0000-0000-000000000005'), ('00000000-0000-0000-0000-000000000006');
insert into public.users(id,email,user_name,first_name,last_name,display_name,people_discoverable,is_persona) values
 ('00000000-0000-0000-0000-000000000001','a@x.test','alice','Alice','Actor','Alice',true,false),
 ('00000000-0000-0000-0000-000000000002','b@x.test','bobby','Bobby','Public','Bobby',true,false),
 ('00000000-0000-0000-0000-000000000003','c@x.test','boptout','Bob','Optout','Bob',false,false),
 ('00000000-0000-0000-0000-000000000004','d@x.test','bobprivatefriend','Bea','Private','Bea',false,false),
 ('00000000-0000-0000-0000-000000000005','e@x.test','bblocked','Ben','Blocked','Ben',true,false),
 ('00000000-0000-0000-0000-000000000006','f@x.test','bpersona','Bev','Persona','Bev',true,true);
insert into public.dna_profiles(user_id,profile_text,is_private) values
 ('00000000-0000-0000-0000-000000000001','A profile',false),
 ('00000000-0000-0000-0000-000000000002','B profile',false),
 ('00000000-0000-0000-0000-000000000003','C private profile',true),
 ('00000000-0000-0000-0000-000000000004','D private profile',true),
 ('00000000-0000-0000-0000-000000000005','E profile',false);
insert into public.friendships(user_id,friend_id,status) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','accepted'),
 ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','accepted');
insert into public.user_blocks(blocker_id,blocked_id) values
 ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000005');
SQL

"${PSQL[@]}" -f "$ROOT/supabase/migrations/20260904000000_harden_friendship_mutations_and_search.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20260908000100_restrict_dna_profile_reads_to_friends.sql" >/dev/null

A=00000000-0000-0000-0000-000000000001
B=00000000-0000-0000-0000-000000000002
C=00000000-0000-0000-0000-000000000003
D=00000000-0000-0000-0000-000000000004
E=00000000-0000-0000-0000-000000000005

assert_eq "broad friendship mutation policy removed" "0" "$(query "select count(*) from pg_policies where schemaname='public' and tablename='friendships' and cmd='ALL'")"
assert_eq "authenticated insert grant revoked" "f" "$(query "select has_table_privilege('authenticated','public.friendships','insert')")"
assert_eq "authenticated update grant revoked" "f" "$(query "select has_table_privilege('authenticated','public.friendships','update')")"
assert_eq "only service can execute transitions" "f|t" "$(query "select has_function_privilege('authenticated','public.transition_friendship(text,uuid,uuid)','execute'), has_function_privilege('service_role','public.transition_friendship(text,uuid,uuid)','execute')")"
expect_fail "authenticated direct friendship insert denied" "set role authenticated; set request.jwt.claim.sub='$A'; insert into public.friendships(user_id,friend_id,status) values ('$A','$B','pending');"
expect_fail "authenticated direct friendship update denied" "set role authenticated; set request.jwt.claim.sub='$A'; update public.friendships set status='accepted' where false;"

assert_eq "search excludes opt-out, block, persona but includes accepted private friend" "$B|$D" \
  "$(query "select string_agg(id::text,'|' order by id) from public.search_friendship_users('$A','bo',20)")"
assert_eq "search escapes wildcard input rather than broadening" "0" \
  "$(query "select count(*) from public.search_friendship_users('$A','%_',20)")"

assert_eq "DNA reads allow only self and accepted unblocked friend" "$A|$D" \
  "$(query "set role authenticated; set request.jwt.claim.sub='$A'; select string_agg(user_id::text,'|' order by user_id) from public.dna_profiles")"
assert_eq "anonymous DNA reads are rowless" "0" "$(query "set role anon; select count(*) from public.dna_profiles")"

assert_eq "service send succeeds" "sent" "$(query "set role service_role; select public.transition_friendship('send','$A','$B')->>'outcome'")"
expect_fail "duplicate send is denied" "set role service_role; select public.transition_friendship('send','$A','$B');"
expect_fail "reciprocal pending send is denied" "set role service_role; select public.transition_friendship('send','$B','$A');"
expect_fail "private target cannot receive request" "set role service_role; select public.transition_friendship('send','$A','$C');"
expect_fail "opted-out target cannot receive request" "set role service_role; select public.transition_friendship('send','$A','$D');"
assert_eq "recipient acceptance succeeds" "accepted" "$(query "set role service_role; select public.transition_friendship('accept','$B','$A')->>'outcome'")"
assert_eq "acceptance creates reciprocal accepted rows" "2" "$(query "select count(*) from public.friendships where status='accepted' and ((user_id='$A' and friend_id='$B') or (user_id='$B' and friend_id='$A'))")"

query "insert into public.user_blocks(blocker_id,blocked_id) values ('$A','$D')" >/dev/null
assert_eq "block deletes both accepted friendship directions" "0" "$(query "select count(*) from public.friendships where (user_id='$A' and friend_id='$D') or (user_id='$D' and friend_id='$A')")"
assert_eq "blocked friend loses DNA read access" "$A|$B" "$(query "set role authenticated; set request.jwt.claim.sub='$A'; select string_agg(user_id::text,'|' order by user_id) from public.dna_profiles")"

# Separate client sessions exercise the pair advisory lock.  The first session
# deliberately retains its transaction lock while the reciprocal request waits.
query "update public.users set people_discoverable=true where id='$C'; update public.dna_profiles set is_private=false where user_id='$C'" >/dev/null
query "delete from public.friendships where (user_id='$A' and friend_id='$C') or (user_id='$C' and friend_id='$A')" >/dev/null
("${PSQL[@]}" -c "begin; set role service_role; select public.transition_friendship('send','$A','$C'); select pg_sleep(1); commit;" >/tmp/security-concurrent-send-1.out 2>&1) &
P1=$!
sleep 0.15
("${PSQL[@]}" -c "set role service_role; select public.transition_friendship('send','$C','$A');" >/tmp/security-concurrent-send-2.out 2>&1) &
P2=$!
wait "$P1"
if wait "$P2"; then fail "concurrent reciprocal send unexpectedly succeeded"; fi
assert_eq "concurrent reciprocal sends leave one pending row" "1" "$(query "select count(*) from public.friendships where status='pending' and ((user_id='$A' and friend_id='$C') or (user_id='$C' and friend_id='$A'))")"
echo "PASS: concurrent reciprocal send is serialized"

# Send first, then block in another session.  The block trigger waits on the
# same advisory lock and removes the request before both transactions commit.
query "delete from public.friendships where (user_id='$B' and friend_id='$E') or (user_id='$E' and friend_id='$B'); delete from public.user_blocks where (blocker_id='$B' and blocked_id='$E') or (blocker_id='$E' and blocked_id='$B')" >/dev/null
("${PSQL[@]}" -c "begin; set role service_role; select public.transition_friendship('send','$B','$E'); select pg_sleep(1); commit;" >/tmp/security-concurrent-block-send.out 2>&1) &
P3=$!
sleep 0.15
("${PSQL[@]}" -c "insert into public.user_blocks(blocker_id,blocked_id) values ('$B','$E');" >/tmp/security-concurrent-block.out 2>&1) &
P4=$!
wait "$P3"; wait "$P4"
assert_eq "concurrent block removes racing request" "0" "$(query "select count(*) from public.friendships where (user_id='$B' and friend_id='$E') or (user_id='$E' and friend_id='$B')")"
assert_eq "concurrent block is recorded" "1" "$(query "select count(*) from public.user_blocks where blocker_id='$B' and blocked_id='$E'")"
echo "PASS: concurrent block versus send is serialized"
echo "All isolated local security migration tests passed."