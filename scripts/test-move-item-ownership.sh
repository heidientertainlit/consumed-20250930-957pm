#!/usr/bin/env bash
# Exercises the move RPC in a disposable PostgreSQL cluster. No project
# database configuration, URL, or credentials are read.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SNAPSHOT="${1:-}"
MIGRATION="$ROOT/supabase/migrations/20260828030000_repair_media_history_idempotency.sql"
PORT="${MOVE_OWNERSHIP_TEST_PG_PORT:-55440}"
DATA_DIR="$(mktemp -d /tmp/consumed-move-pg.XXXXXX)"
SOCKET_DIR="$(mktemp -d /tmp/consumed-move-socket.XXXXXX)"
FUNCTION_SQL="$(mktemp /tmp/consumed-move-function.XXXXXX.sql)"
LOG_FILE="$DATA_DIR/postgres.log"
PSQL=(psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U runner -d postgres)

cleanup() {
  pg_ctl -D "$DATA_DIR" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DATA_DIR" "$SOCKET_DIR" "$FUNCTION_SQL"
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

if [[ -n "$SNAPSHOT" ]]; then
  [[ -r "$SNAPSHOT" ]] || fail "JSON snapshot is not readable: $SNAPSHOT"
  jq -er '
    if type == "array" and length == 1 and (.[0].definition | type == "string")
    then .[0].definition
    else error("expected an array containing one object with a definition string")
    end
  ' "$SNAPSHOT" >"$FUNCTION_SQL" || fail "invalid function JSON snapshot: $SNAPSHOT"
else
  [[ -r "$MIGRATION" ]] || fail "migration is not readable: $MIGRATION"
  awk '
    /^create or replace function public\.move_list_item_with_completion\(/ { copy = 1 }
    copy { print }
    copy && /^\$\$;[[:space:]]*$/ { exit }
  ' "$MIGRATION" >"$FUNCTION_SQL"
fi

grep -Eiq '^create or replace function public\.move_list_item_with_completion' "$FUNCTION_SQL" \
  || fail "move_list_item_with_completion definition was not extracted"

initdb -D "$DATA_DIR" --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$DATA_DIR" \
  -o "-k '$SOCKET_DIR' -p $PORT -c listen_addresses='' -c fsync=off" \
  -l "$LOG_FILE" start >/dev/null

"${PSQL[@]}" <<'SQL'
create schema auth;
create role anon nologin;
create role authenticated nologin;
create role rpc_definer nologin;
grant usage on schema public, auth to anon, authenticated, rpc_definer;

create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- This table exists only to satisfy the receipt foreign key. Neither callers
-- nor the function owner receive read access to it.
create table public.users (id uuid primary key);
create table public.lists (
  id uuid primary key,
  user_id uuid not null references public.users(id),
  name text not null
);
create table public.list_items (
  id uuid primary key,
  user_id uuid not null references public.users(id),
  list_id uuid not null references public.lists(id),
  title text not null,
  external_id text,
  external_source text,
  progress integer not null default 0,
  progress_mode text not null default 'percent',
  completed_at timestamptz
);
create table public.media_move_request_receipts (
  user_id uuid not null references public.users(id),
  client_event_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, client_event_id)
);

alter table public.lists enable row level security;
create policy lists_owner_only on public.lists
  for select using (user_id = auth.uid());
grant select on public.lists to authenticated, rpc_definer;
grant select, update, delete on public.list_items to rpc_definer;
grant select, insert on public.media_move_request_receipts to rpc_definer;

insert into public.users(id) values
  ('10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002');
insert into public.lists(id,user_id,name) values
  ('11000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Owner source'),
  ('11000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Owner target'),
  ('22000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','Other source'),
  ('22000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Other target');
SQL

# Install exactly the extracted definition, then impose the production-facing
# execution boundary independently of any grants present in a JSON snapshot.
"${PSQL[@]}" -f "$FUNCTION_SQL" >/dev/null
"${PSQL[@]}" <<'SQL'
alter function public.move_list_item_with_completion(uuid, uuid, boolean, uuid)
  owner to rpc_definer;
revoke all on function public.move_list_item_with_completion(uuid, uuid, boolean, uuid)
  from public, anon;
grant execute on function public.move_list_item_with_completion(uuid, uuid, boolean, uuid)
  to authenticated;
SQL

U1=10000000-0000-0000-0000-000000000001
U2=20000000-0000-0000-0000-000000000002
L1=11000000-0000-0000-0000-000000000001
L2=11000000-0000-0000-0000-000000000002
L3=22000000-0000-0000-0000-000000000001
L4=22000000-0000-0000-0000-000000000002

assert_eq "execute is limited to authenticated and the definer owner" "f|f|t|t" \
  "$(query "select has_function_privilege('public','public.move_list_item_with_completion(uuid,uuid,boolean,uuid)','execute'), has_function_privilege('anon','public.move_list_item_with_completion(uuid,uuid,boolean,uuid)','execute'), has_function_privilege('authenticated','public.move_list_item_with_completion(uuid,uuid,boolean,uuid)','execute'), has_function_privilege('rpc_definer','public.move_list_item_with_completion(uuid,uuid,boolean,uuid)','execute')")"
assert_eq "lists RLS exposes only the caller's lists" "2" \
  "$(query "set role authenticated; set request.jwt.claim.sub='$U1'; select count(*) from public.lists")"
expect_fail "synthetic users table remains unreadable" \
  "set role authenticated; set request.jwt.claim.sub='$U1'; select * from public.users;"

query "insert into public.list_items values
 ('30000000-0000-0000-0000-000000000001','$U1','$L1','Owned move','owned-1','synthetic',45,'percent',null)" >/dev/null
query "set role authenticated; set request.jwt.claim.sub='$U1'; select public.move_list_item_with_completion('30000000-0000-0000-0000-000000000001','$L2',false,null)" >/dev/null
assert_eq "own item moves successfully and resets progress" "$L2|0|percent" \
  "$(query "select list_id::text||'|'||progress||'|'||progress_mode from public.list_items where id='30000000-0000-0000-0000-000000000001'")"

query "insert into public.list_items values
 ('30000000-0000-0000-0000-000000000002','$U1','$L1','Retry move','owned-2','synthetic',12,'percent',null)" >/dev/null
RETRY_ONE="$(query "set role authenticated; set request.jwt.claim.sub='$U1'; select public.move_list_item_with_completion('30000000-0000-0000-0000-000000000002','$L2',false,'40000000-0000-0000-0000-000000000001')")"
RETRY_TWO="$(query "set role authenticated; set request.jwt.claim.sub='$U1'; select public.move_list_item_with_completion('30000000-0000-0000-0000-000000000002','$L2',false,'40000000-0000-0000-0000-000000000001')")"
assert_eq "event retry returns the original idempotent response" "$RETRY_ONE" "$RETRY_TWO"
assert_eq "event retry stores exactly one receipt" "1" \
  "$(query "select count(*) from public.media_move_request_receipts where user_id='$U1' and client_event_id='40000000-0000-0000-0000-000000000001'")"

query "insert into public.list_items values
 ('30000000-0000-0000-0000-000000000003','$U1','$L1','Finish move','owned-3','synthetic',60,'percent',null)" >/dev/null
query "set role authenticated; set request.jwt.claim.sub='$U1'; select public.move_list_item_with_completion('30000000-0000-0000-0000-000000000003','$L2',true,null)" >/dev/null
assert_eq "finished move records completion" "$L2|100|percent|true" \
  "$(query "select list_id::text||'|'||progress||'|'||progress_mode||'|'||(completed_at is not null) from public.list_items where id='30000000-0000-0000-0000-000000000003'")"

query "insert into public.list_items values
 ('30000000-0000-0000-0000-000000000004','$U1','$L2','Already there','owned-4','synthetic',33,'percent',null)" >/dev/null
assert_eq "already-in-target is reported without mutation" "true|33" \
  "$(query "set role authenticated; set request.jwt.claim.sub='$U1'; select (r->>'already_in_target')||'|'||(r->'data'->>'progress') from (select public.move_list_item_with_completion('30000000-0000-0000-0000-000000000004','$L2',true,null) r) s")"

query "insert into public.list_items values
 ('30000000-0000-0000-0000-000000000005','$U1','$L1','Duplicate source','same-media','synthetic',5,'percent',null),
 ('30000000-0000-0000-0000-000000000006','$U1','$L2','Duplicate target','same-media','synthetic',9,'percent',null)" >/dev/null
DUPLICATE_RESULT="$(query "set role authenticated; set request.jwt.claim.sub='$U1'; select public.move_list_item_with_completion('30000000-0000-0000-0000-000000000005','$L2',true,null)->>'deleted'")"
assert_eq "duplicate target removes source and completes existing target" "true|0|100|true" \
  "$DUPLICATE_RESULT|$(query "select count(*)||'|'||(select progress from public.list_items where id='30000000-0000-0000-0000-000000000006')||'|'||(select completed_at is not null from public.list_items where id='30000000-0000-0000-0000-000000000006') from public.list_items where id='30000000-0000-0000-0000-000000000005'")"

query "insert into public.list_items values
 ('30000000-0000-0000-0000-000000000007','$U2','$L3','Other source','other-1','synthetic',27,'percent',null),
 ('30000000-0000-0000-0000-000000000008','$U1','$L1','Foreign target attempt','owned-8','synthetic',18,'percent',null)" >/dev/null
expect_fail "another user's source item is rejected" \
  "set role authenticated; set request.jwt.claim.sub='$U1'; select public.move_list_item_with_completion('30000000-0000-0000-0000-000000000007','$L2',false,null);"
assert_eq "rejected foreign source remains unchanged" "$L3|27" \
  "$(query "select list_id::text||'|'||progress from public.list_items where id='30000000-0000-0000-0000-000000000007'")"
expect_fail "another user's target list is rejected" \
  "set role authenticated; set request.jwt.claim.sub='$U1'; select public.move_list_item_with_completion('30000000-0000-0000-0000-000000000008','$L4',false,null);"
assert_eq "rejected foreign target leaves source unchanged" "$L1|18" \
  "$(query "select list_id::text||'|'||progress from public.list_items where id='30000000-0000-0000-0000-000000000008'")"

expect_fail "anonymous execution is denied" \
  "set role anon; select public.move_list_item_with_completion('30000000-0000-0000-0000-000000000004','$L2',false,null);"
expect_fail "authenticated execution with null auth.uid is denied" \
  "set role authenticated; select public.move_list_item_with_completion('30000000-0000-0000-0000-000000000004','$L2',false,null);"

echo "All isolated local move-item ownership tests passed."