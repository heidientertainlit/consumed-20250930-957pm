#!/usr/bin/env bash
# Runs solely against a disposable PostgreSQL 16 cluster. It does not read a
# database URL, project configuration, credentials, or application data.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${ADMIN_BLOCK_ALERT_TEST_PG_PORT:-55441}"
DATA_DIR="$(mktemp -d /tmp/consumed-admin-block-alerts-pg.XXXXXX)"
SOCKET_DIR="$(mktemp -d /tmp/consumed-admin-block-alerts-socket.XXXXXX)"
PSQL=(psql -X -v ON_ERROR_STOP=1 -h "$SOCKET_DIR" -p "$PORT" -U runner -d postgres)
BLOCKER_ID="00000000-0000-4000-8000-000000000001"
BLOCKED_ID="00000000-0000-4000-8000-000000000002"

cleanup() {
  pg_ctl -D "$DATA_DIR" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DATA_DIR" "$SOCKET_DIR"
}
trap cleanup EXIT

initdb -D "$DATA_DIR" --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$DATA_DIR" -o "-k '$SOCKET_DIR' -p $PORT -c listen_addresses='' -c fsync=off" start >/dev/null

"${PSQL[@]}" <<'SQL'
create extension pgcrypto;
create schema auth;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public, auth to anon, authenticated, service_role;

-- Minimal verified production shapes needed by the pair-lock migration and
-- the alert migration. No application data or external connection is used.
create table public.users (
  id uuid primary key,
  user_name text,
  first_name text,
  last_name text,
  display_name text,
  avatar text,
  people_discoverable boolean default true,
  is_persona boolean default false
);
create table public.dna_profiles (user_id uuid, is_private boolean default false);
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  friend_id uuid not null,
  status text not null,
  created_at timestamptz not null default now(),
  unique (user_id, friend_id)
);
create table public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamptz default now(),
  unique (blocker_id, blocked_id)
);
alter table public.friendships enable row level security;
alter table public.user_blocks enable row level security;
grant select, delete on public.friendships to authenticated;
grant all on public.friendships, public.user_blocks, public.users, public.dna_profiles to service_role;
SQL

"${PSQL[@]}" -f "$ROOT/supabase/migrations/20260904000000_harden_friendship_mutations_and_search.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20260915020000_add_private_admin_block_alerts.sql" >/dev/null

"${PSQL[@]}" <<SQL
set app.block_alert_test_blocker = '$BLOCKER_ID';
set app.block_alert_test_blocked = '$BLOCKED_ID';
\i $ROOT/supabase/tests/admin-block-alerts.sql
SQL

echo "All isolated admin block-alert migration tests passed."