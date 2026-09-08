#!/usr/bin/env bash
# Replays the captured production ranks/rank_items RLS policies in a disposable
# PostgreSQL cluster. No project database configuration or credentials are read.
set -euo pipefail

SNAPSHOT="${1:-/tmp/rank-live-policies.json}"
PORT="${RANK_ACCESS_TEST_PG_PORT:-55441}"
DATA_DIR="$(mktemp -d /tmp/consumed-rank-pg.XXXXXX)"
SOCKET_DIR="$(mktemp -d /tmp/consumed-rank-socket.XXXXXX)"
POLICY_SQL="$(mktemp /tmp/consumed-rank-policies.XXXXXX.sql)"
LOG_FILE="$DATA_DIR/postgres.log"
PSQL=(psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U runner -d postgres)
FAILURES=0

cleanup() {
  pg_ctl -D "$DATA_DIR" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DATA_DIR" "$SOCKET_DIR" "$POLICY_SQL"
}
trap cleanup EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }
record_failure() { echo "FAIL: $*" >&2; FAILURES=$((FAILURES + 1)); }
query() { "${PSQL[@]}" -Atqc "$1"; }
assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "PASS: $label"
  else
    record_failure "$label (expected <$expected>, got <$actual>)"
  fi
}
expect_denied() {
  local label="$1" sql="$2"
  if "${PSQL[@]}" -c "$sql" >/dev/null 2>&1; then
    record_failure "$label unexpectedly succeeded"
  else
    echo "PASS: $label"
  fi
}

[[ -r "$SNAPSHOT" ]] || fail "policy JSON snapshot is not readable: $SNAPSHOT"
command -v jq >/dev/null || fail "jq is required"
for command in initdb pg_ctl psql; do
  command -v "$command" >/dev/null || fail "$command is required"
done

# Reject incomplete or differently shaped captures rather than silently testing
# hand-written approximations. SQL is emitted directly from pg_policies fields.
jq -e '
  [ .[] | select(.schemaname == "public" and
                  (.tablename == "ranks" or .tablename == "rank_items")) ] as $p
  | ($p | length) == 10
    and ([$p[].tablename] | map(select(. == "ranks")) | length) == 5
    and ([$p[].tablename] | map(select(. == "rank_items")) | length) == 5
    and all($p[];
      (.policyname | type == "string") and
      (.permissive == "PERMISSIVE" or .permissive == "RESTRICTIVE") and
      (.roles | type == "string") and
      (.cmd == "ALL" or .cmd == "SELECT" or .cmd == "INSERT" or
       .cmd == "UPDATE" or .cmd == "DELETE") and
      (.qual == null or (.qual | type == "string")) and
      (.with_check == null or (.with_check | type == "string")))
' "$SNAPSHOT" >/dev/null || fail "snapshot does not contain the expected 10 live ranks/rank_items policies"

jq -r '
  def ident: "\"" + gsub("\""; "\"\"") + "\"";
  def role_list:
    sub("^\\{"; "") | sub("\\}$"; "") | split(",")
    | map(if . == "public" then "public" else ident end) | join(", ");
  .[]
  | select(.schemaname == "public" and
           (.tablename == "ranks" or .tablename == "rank_items"))
  | "create policy \(.policyname | ident) on \(.schemaname | ident).\(.tablename | ident) as \(.permissive) for \(.cmd) to \(.roles | role_list)"
    + (if .qual == null then "" else " using (" + .qual + ")" end)
    + (if .with_check == null then "" else " with check (" + .with_check + ")" end)
    + ";"
' "$SNAPSHOT" >"$POLICY_SQL"

initdb -D "$DATA_DIR" --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$DATA_DIR" \
  -o "-k '$SOCKET_DIR' -p $PORT -c listen_addresses='' -c fsync=off" \
  -l "$LOG_FILE" start >/dev/null

"${PSQL[@]}" <<'SQL'
create schema auth;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
grant usage on schema public, auth to anon, authenticated, service_role;

create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create function auth.jwt() returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'role', nullif(current_setting('request.jwt.claim.role', true), '')
  )
$$;

create table public.users (id uuid primary key);
create table public.ranks (
  id uuid primary key,
  user_id uuid not null references public.users(id),
  name text not null,
  visibility text not null,
  sort_order integer not null default 0
);
create table public.rank_items (
  id uuid primary key,
  rank_id uuid not null references public.ranks(id),
  user_id uuid not null references public.users(id),
  title text not null,
  position integer not null default 0
);

alter table public.ranks enable row level security;
alter table public.rank_items enable row level security;
grant select, insert, update, delete on public.ranks, public.rank_items
  to anon, authenticated, service_role;

insert into public.users(id) values
  ('10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002');
insert into public.ranks(id,user_id,name,visibility,sort_order) values
  ('11000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Owner private','private',1),
  ('11000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Owner public','public',2),
  ('11000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Owner disposable','private',3),
  ('22000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','Attacker source','private',1);
insert into public.rank_items(id,rank_id,user_id,title,position) values
  ('31000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Private item',1),
  ('31000000-0000-0000-0000-000000000002','11000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Public item',1),
  ('32000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','Attacker item',1);
SQL

"${PSQL[@]}" -f "$POLICY_SQL" >/dev/null

U1=10000000-0000-0000-0000-000000000001
U2=20000000-0000-0000-0000-000000000002
PRIVATE_RANK=11000000-0000-0000-0000-000000000001
PUBLIC_RANK=11000000-0000-0000-0000-000000000002
OTHER_RANK=22000000-0000-0000-0000-000000000001

assert_eq "all 10 captured policies were installed" "10" \
  "$(query "select count(*) from pg_policies where schemaname='public' and tablename in ('ranks','rank_items')")"
assert_eq "owner reads private and public ranks" "2" \
  "$(query "set role authenticated; set request.jwt.claim.sub='$U1'; select count(*) from ranks where id in ('$PRIVATE_RANK','$PUBLIC_RANK')")"
assert_eq "owner reads private and public items" "2" \
  "$(query "set role authenticated; set request.jwt.claim.sub='$U1'; select count(*) from rank_items where id in ('31000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000002')")"
assert_eq "stranger cannot read private rank" "0" \
  "$(query "set role authenticated; set request.jwt.claim.sub='$U2'; select count(*) from ranks where id='$PRIVATE_RANK'")"
assert_eq "stranger cannot read private rank item" "0" \
  "$(query "set role authenticated; set request.jwt.claim.sub='$U2'; select count(*) from rank_items where rank_id='$PRIVATE_RANK'")"
assert_eq "guest cannot read private rank or item" "0|0" \
  "$(query "set role anon; select (select count(*) from ranks where id='$PRIVATE_RANK')||'|'||(select count(*) from rank_items where rank_id='$PRIVATE_RANK')")"
assert_eq "stranger can read public rank and item" "1|1" \
  "$(query "set role authenticated; set request.jwt.claim.sub='$U2'; select (select count(*) from ranks where id='$PUBLIC_RANK')||'|'||(select count(*) from rank_items where rank_id='$PUBLIC_RANK')")"
assert_eq "guest can read public rank and item" "1|1" \
  "$(query "set role anon; select (select count(*) from ranks where id='$PUBLIC_RANK')||'|'||(select count(*) from rank_items where rank_id='$PUBLIC_RANK')")"

assert_eq "owner can reorder own rank" "17" \
  "$(query "set role authenticated; set request.jwt.claim.sub='$U1'; update ranks set sort_order=17 where id='$PRIVATE_RANK' returning sort_order")"
assert_eq "owner can reorder own rank item" "19" \
  "$(query "set role authenticated; set request.jwt.claim.sub='$U1'; update rank_items set position=19 where id='31000000-0000-0000-0000-000000000001' returning position")"
assert_eq "owner can delete own rank" "1" \
  "$(query "set role authenticated; set request.jwt.claim.sub='$U1'; with d as (delete from ranks where id='11000000-0000-0000-0000-000000000003' returning *) select count(*) from d")"
assert_eq "nonowner cannot edit or delete another user's rank" "0|0" \
  "$(query "set role authenticated; set request.jwt.claim.sub='$U2'; with u as (update ranks set sort_order=99 where id='$PRIVATE_RANK' returning *), d as (delete from ranks where id='$PRIVATE_RANK' returning *) select (select count(*) from u)||'|'||(select count(*) from d)")"
assert_eq "nonowner cannot edit or delete another user's item" "0|0" \
  "$(query "set role authenticated; set request.jwt.claim.sub='$U2'; with u as (update rank_items set position=99 where id='31000000-0000-0000-0000-000000000002' returning *), d as (delete from rank_items where id='31000000-0000-0000-0000-000000000002' returning *) select (select count(*) from u)||'|'||(select count(*) from d)")"
expect_denied "authenticated/default application role cannot read users table" \
  "set role authenticated; set request.jwt.claim.sub='$U1'; select * from public.users;"
expect_denied "guest role cannot read users table" \
  "set role anon; select * from public.users;"

# Public-rank community additions are intentionally reported separately: the
# live INSERT policy allows users to add their own item to a public rank.
assert_eq "KNOWN INTENDED BEHAVIOR: community addition to public rank succeeds" "1" \
  "$(query "set role authenticated; set request.jwt.claim.sub='$U2'; insert into rank_items(id,rank_id,user_id,title,position) values ('32000000-0000-0000-0000-000000000002','$PUBLIC_RANK','$U2','Community item',2) returning 1")"

# These are mandatory isolation assertions. Inspect via the cluster owner after
# each attempted write so RLS cannot hide a successful exploit from the proof.
if "${PSQL[@]}" -c "set role authenticated; set request.jwt.claim.sub='$U2'; insert into rank_items(id,rank_id,user_id,title,position) values ('32000000-0000-0000-0000-000000000003','$PRIVATE_RANK','$U2','Injected private item',3);" >/dev/null 2>&1; then
  proof="$(query "select '1 row, rank_id='||rank_id::text||', user_id='||user_id::text from rank_items where id='32000000-0000-0000-0000-000000000003'")"
  if [[ -n "$proof" ]]; then
    record_failure "PRIVATE ISOLATION: attacker-owned INSERT into victim private rank succeeded ($proof)"
  else
    echo "PASS: attacker-owned INSERT into victim private rank created no row"
  fi
else
  echo "PASS: attacker-owned INSERT into victim private rank was denied"
fi

if "${PSQL[@]}" -c "set role authenticated; set request.jwt.claim.sub='$U2'; update rank_items set rank_id='$PRIVATE_RANK' where id='32000000-0000-0000-0000-000000000001';" >/dev/null 2>&1; then
  proof="$(query "select 'rank_id='||rank_id::text||', user_id='||user_id::text from rank_items where id='32000000-0000-0000-0000-000000000001'")"
  if [[ "$proof" == "rank_id=$PRIVATE_RANK, user_id=$U2" ]]; then
    record_failure "PRIVATE ISOLATION: attacker moved own item into victim private rank ($proof)"
  else
    echo "PASS: moving own item into victim private rank changed no row ($proof)"
  fi
else
  echo "PASS: moving own item into victim private rank was denied"
fi

if (( FAILURES > 0 )); then
  echo "Rank access policy harness failed with $FAILURES violation(s)." >&2
  exit 1
fi
echo "All isolated local rank access tests passed."