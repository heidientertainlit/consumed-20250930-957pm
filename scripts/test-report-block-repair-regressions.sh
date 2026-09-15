#!/usr/bin/env bash
# Runs the complete local report/block repair regression suite against
# disposable PostgreSQL clusters only. It never reads project configuration,
# credentials, application data, or a live database.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${REPORT_BLOCK_MIGRATION_REGRESSION_PG_PORT:-55443}"
DATA_DIR="$(mktemp -d /tmp/consumed-report-block-migration-pg.XXXXXX)"
SOCKET_DIR="$(mktemp -d /tmp/consumed-report-block-migration-socket.XXXXXX)"
LOG_FILE="$DATA_DIR/postgres.log"
PSQL=(psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U runner -d postgres)

cleanup() {
  pg_ctl -D "$DATA_DIR" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DATA_DIR" "$SOCKET_DIR"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  [[ "$actual" == "$expected" ]] || fail "$label (expected <$expected>, got <$actual>)"
  echo "PASS: $label"
}

assert_nonempty() {
  local label="$1" value="$2"
  [[ -n "$value" ]] || fail "$label is empty"
  echo "PASS: $label"
}

query() {
  "${PSQL[@]}" -Atqc "$1"
}

expect_fail() {
  local label="$1" sql="$2"
  if "${PSQL[@]}" -c "$sql" >/dev/null 2>&1; then
    fail "$label unexpectedly succeeded"
  fi
  echo "PASS: $label"
}

required_failures=0
run_required() {
  local label="$1"
  shift
  echo "== $label =="
  set +e
  "$@"
  local status=$?
  set -e
  if (( status != 0 )); then
    echo "FAIL: $label exited with status $status" >&2
    required_failures=1
  fi
}

run_required "npm test" npm test
run_required "npm run check" npm run check
run_required "security migration regressions" bash "$ROOT/scripts/test-security-migrations-local.sh"
run_required "UGC text-filter regressions" bash "$ROOT/scripts/test-ugc-text-filter-local.sh"
run_required "admin block-alert regressions" bash "$ROOT/scripts/test-admin-block-alerts-local.sh"
run_required "report/block SQL baseline regressions" bash "$ROOT/scripts/test-report-block-repair-baseline-local.sh"
run_required "report/block handler baseline mode" node "$ROOT/scripts/test-report-block-flow-local.mjs" baseline
run_required "report/block handler postrepair mode" node "$ROOT/scripts/test-report-block-flow-local.mjs" postrepair

echo "== content_reports migration pre-seed regression =="
initdb -D "$DATA_DIR" --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$DATA_DIR" -o "-k '$SOCKET_DIR' -p $PORT -c listen_addresses='' -c fsync=off" -l "$LOG_FILE" start >/dev/null

"${PSQL[@]}" <<'SQL'
create extension pgcrypto;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  content_type text not null,
  content_id text not null,
  reason text not null check (reason = any (array[
    'spam'::text,
    'harassment'::text,
    'hate_speech'::text,
    'misinformation'::text,
    'inappropriate'::text,
    'spoiler'::text,
    'other'::text
  ])),
  description text,
  reported_user_id uuid,
  status text not null check (status = any (array[
    'pending'::text,
    'reviewed'::text,
    'resolved'::text,
    'dismissed'::text
  ])),
  created_at timestamptz not null default now(),
  constraint content_reports_content_type_check check (content_type = any (array[
    'post'::text,
    'comment'::text,
    'hot_take'::text,
    'list'::text,
    'review'::text
  ]))
);
alter table public.content_reports enable row level security;
grant select, insert, update, delete on public.content_reports to anon, authenticated;
grant all on public.content_reports to service_role;

insert into public.content_reports (
  id, reporter_id, content_type, content_id, reason, description,
  reported_user_id, status, created_at
) values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'post', 'post-1', 'spam', 'seed post', '30000000-0000-4000-8000-000000000001', 'pending', '2026-09-15T00:00:01Z'),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'comment', 'comment-1', 'harassment', 'seed comment', '30000000-0000-4000-8000-000000000002', 'reviewed', '2026-09-15T00:00:02Z'),
  ('10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 'hot_take', 'hot-take-1', 'hate_speech', 'seed hot take', '30000000-0000-4000-8000-000000000003', 'resolved', '2026-09-15T00:00:03Z'),
  ('10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', 'list', 'list-1', 'misinformation', 'seed list', '30000000-0000-4000-8000-000000000004', 'dismissed', '2026-09-15T00:00:04Z'),
  ('10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000005', 'review', 'review-1', 'inappropriate', 'seed review', '30000000-0000-4000-8000-000000000005', 'pending', '2026-09-15T00:00:05Z');
SQL

report_rows() {
  query "select id::text || '|' || reporter_id::text || '|' || content_type || '|' ||
    content_id || '|' || reason || '|' || coalesce(description, '') || '|' ||
    coalesce(reported_user_id::text, '') || '|' || status || '|' ||
    created_at::text from public.content_reports order by id"
}

policy_catalog() {
  query "select coalesce(
    string_agg(
      policyname || ':' || cmd || ':' || coalesce(array_to_string(roles, ','), '') ||
      ':' || coalesce(qual, '') || ':' || coalesce(with_check, ''),
      '|' order by policyname
    ),
    '<none>'
  ) from pg_policies where schemaname = 'public' and tablename = 'content_reports'"
}

acl_catalog() {
  query "select coalesce(array_to_string(relacl, '|'), '<null>')
    from pg_class where oid = 'public.content_reports'::regclass"
}

constraint_definition() {
  query "select pg_get_constraintdef(oid, true)
    from pg_constraint
    where conrelid = 'public.content_reports'::regclass
      and conname = 'content_reports_content_type_check'"
}

rows_before="$(report_rows)"
rls_before="$(query "select relrowsecurity from pg_class where oid = 'public.content_reports'::regclass")"
policies_before="$(policy_catalog)"
acl_before="$(acl_catalog)"
privileges_before="$(query "select
  has_table_privilege('anon', 'public.content_reports', 'select'),
  has_table_privilege('authenticated', 'public.content_reports', 'insert'),
  has_table_privilege('service_role', 'public.content_reports', 'delete')")"
constraint_before="$(constraint_definition)"

assert_eq "pre-seeded report row count" "5" "$(printf '%s\n' "$rows_before" | grep -c .)"
assert_eq "content_reports RLS is enabled before migration" "t" "$rls_before"
assert_eq "content_reports policy catalog is empty before migration" "<none>" "$policies_before"
assert_nonempty "content_reports ACL exists before migration" "$acl_before"
assert_eq "content_reports role ACL checks before migration" "t|t|t" "$privileges_before"
for legacy_type in post comment hot_take list review; do
  [[ "$constraint_before" == *"'$legacy_type'::text"* ]] ||
    fail "pre-migration CHECK is missing legacy type $legacy_type"
done
echo "PASS: pre-migration CHECK contains all five verified legacy types"

"${PSQL[@]}" -f "$ROOT/supabase/migrations/20260916010000_allow_user_content_reports.sql" >/dev/null

rows_after="$(report_rows)"
rls_after="$(query "select relrowsecurity from pg_class where oid = 'public.content_reports'::regclass")"
policies_after="$(policy_catalog)"
acl_after="$(acl_catalog)"
privileges_after="$(query "select
  has_table_privilege('anon', 'public.content_reports', 'select'),
  has_table_privilege('authenticated', 'public.content_reports', 'insert'),
  has_table_privilege('service_role', 'public.content_reports', 'delete')")"
constraint_after="$(constraint_definition)"

assert_eq "pre-seeded report rows are unchanged after migration" "$rows_before" "$rows_after"
assert_eq "content_reports RLS remains enabled after migration" "$rls_before" "$rls_after"
assert_eq "content_reports policy catalog is unchanged after migration" "$policies_before" "$policies_after"
assert_eq "content_reports ACL is unchanged after migration" "$acl_before" "$acl_after"
assert_eq "content_reports role ACL checks are unchanged after migration" "$privileges_before" "$privileges_after"
for content_type in post comment hot_take list review user; do
  [[ "$constraint_after" == *"'$content_type'::text"* ]] ||
    fail "post-migration CHECK is missing content type $content_type"
done
echo "PASS: post-migration CHECK contains user plus all five verified legacy types"

"${PSQL[@]}" -c "insert into public.content_reports (
  reporter_id, content_type, content_id, reason, status
) values (
  '20000000-0000-4000-8000-000000000006', 'user', '30000000-0000-4000-8000-000000000006', 'other', 'pending'
);" >/dev/null
assert_eq "post-migration user report insert succeeds" "6" "$(query "select count(*) from public.content_reports")"
expect_fail "post-migration invalid content type remains rejected" \
  "insert into public.content_reports (reporter_id, content_type, content_id, reason, status)
   values ('20000000-0000-4000-8000-000000000007', 'profile', 'invalid', 'other', 'pending');"

if (( required_failures != 0 )); then
  fail "one or more required regression commands failed"
fi

echo "All report/block repair regressions passed."