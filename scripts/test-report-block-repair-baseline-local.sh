#!/usr/bin/env bash
# Runs the report/block repair regression baseline against a disposable local
# PostgreSQL cluster. It never reads project URLs, credentials, or app data.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${REPORT_BLOCK_BASELINE_PG_PORT:-55442}"
DATA_DIR="$(mktemp -d /tmp/consumed-report-block-baseline-pg.XXXXXX)"
SOCKET_DIR="$(mktemp -d /tmp/consumed-report-block-baseline-socket.XXXXXX)"
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
expect_fail() {
  local label="$1" sql="$2"
  if "${PSQL[@]}" -c "$sql" >/dev/null 2>&1; then
    fail "$label unexpectedly succeeded"
  fi
  echo "PASS: $label"
}
require_source() {
  local label="$1" needle="$2"
  grep -Fq "$needle" "$ROOT/supabase/functions/social-feed/index.ts" ||
    fail "$label is absent from social-feed source"
  echo "PASS: $label"
}

initdb -D "$DATA_DIR" --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$DATA_DIR" -o "-k '$SOCKET_DIR' -p $PORT -c listen_addresses='' -c fsync=off" start >/dev/null

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

-- This is a minimal, migration-derived local schema. The deletion test below
-- invokes the production migration's function verbatim; no test replacement
-- for deletion behavior is created here.
create table auth.users (
  id uuid primary key,
  email text,
  aud text,
  role text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  user_name text,
  first_name text,
  last_name text,
  display_name text,
  avatar text,
  people_discoverable boolean default true,
  is_persona boolean default false
);
create function public.test_create_user_profile()
returns trigger language plpgsql as $$
begin
  insert into public.users(id, email, user_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'username', new.id::text))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger test_create_user_profile
after insert on auth.users for each row execute function public.test_create_user_profile();

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (user_id, friend_id)
);
create table public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  unique (blocker_id, blocked_id)
);
create table public.dna_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  profile_text text,
  label text,
  is_private boolean default false
);
create table public.user_dna_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  signal_type text not null,
  signal_value text not null,
  strength numeric not null,
  source_count integer not null
);

alter table public.friendships enable row level security;
alter table public.user_blocks enable row level security;
alter table public.dna_profiles enable row level security;
alter table public.user_dna_signals enable row level security;
create policy old_friendships_select on public.friendships for select to authenticated using (true);
create policy old_friendships_delete on public.friendships for delete to authenticated using (true);
create policy old_dna_read_all on public.dna_profiles for select to anon, authenticated using (true);
create policy old_dna_owner_insert on public.dna_profiles for insert to authenticated with check (user_id = auth.uid());
create policy old_dna_owner_update on public.dna_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Authenticated users can view DNA signals" on public.user_dna_signals for select to authenticated using (true);
create policy "Users can view own DNA signals" on public.user_dna_signals for select to authenticated using (user_id = auth.uid());
create policy "Users can insert own DNA signals" on public.user_dna_signals for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update own DNA signals" on public.user_dna_signals for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Service role can manage DNA signals" on public.user_dna_signals for all to service_role using (true) with check (true);
grant select, delete on public.friendships to authenticated;
grant select on public.user_blocks to anon, authenticated;
grant select on public.dna_profiles to anon, authenticated;
grant select, insert, update on public.user_dna_signals to anon, authenticated;
grant all on all tables in schema public to service_role;

-- Direct cleanup targets used by delete_account_transaction.
create table public.prediction_comments (id bigint generated always as identity primary key, user_id text);
create table public.prediction_comment_likes (id bigint generated always as identity primary key, user_id text, comment_id bigint);
create table public.prediction_comment_votes (id bigint generated always as identity primary key, user_id text, comment_id text);
create table public.prediction_likes (id bigint generated always as identity primary key, user_id text);
create table public.social_comment_votes (id bigint generated always as identity primary key, user_id text);
create table public.post_reactions (id uuid primary key default gen_random_uuid(), user_id uuid);
create table public.room_follows (id uuid primary key default gen_random_uuid(), user_id text);
create table public.room_take_votes (id uuid primary key default gen_random_uuid(), user_id uuid);
create table public.media_engagements (id uuid primary key default gen_random_uuid(), user_id uuid);
create table public.media_match_scores (id uuid primary key default gen_random_uuid(), user_id uuid);
create table public.daily_challenge_responses (id uuid primary key default gen_random_uuid(), user_id uuid);
create table public.challenge_scores (id uuid primary key default gen_random_uuid(), user_id text);
create table public.trivia_sessions (id uuid primary key default gen_random_uuid(), user_id uuid);
create table public.user_predictions (id uuid primary key default gen_random_uuid(), user_id uuid);
create table public.user_prediction_stats (id uuid primary key default gen_random_uuid(), user_id uuid);
create table public.persona_post_drafts (id uuid primary key default gen_random_uuid(), persona_user_id uuid);
create table public.scheduled_persona_posts (id uuid primary key default gen_random_uuid(), persona_user_id uuid);
create table public.awards_ballot_completions (id uuid primary key default gen_random_uuid(), user_id text);
create table public.beta_feedback (id uuid primary key default gen_random_uuid(), user_id uuid);
create table public.content_reports (
  id uuid primary key default gen_random_uuid(), reporter_id uuid, reported_user_id uuid
);
create table public.user_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text,
  started_at timestamptz,
  created_at timestamptz,
  client_metadata jsonb,
  page_views jsonb
);
create view public.user_last_activity as
  select user_id, count(*)::bigint as total_activities
  from public.user_sessions group by user_id;
create table public.media_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_external_id text, media_external_source text, media_title text,
  media_type text, rating numeric
);
create table public.lists (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text, media_type text, origin_user_id text
);
create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text, type text
);
create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text, origin_user_id text
);
create table public.pools (
  id uuid primary key, name text, host_id uuid references auth.users(id) on delete cascade,
  invite_code text, is_public boolean, status text
);
create table public.room_takes (
  id uuid primary key,
  room_id uuid references public.pools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text, body text
);
create table public.admin_room_conversation_runs (
  id uuid primary key,
  room_id uuid references public.pools(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  topic text, status text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  published_take_id uuid references public.room_takes(id),
  published_at timestamptz
);
create table public.admin_room_conversation_drafts (
  id uuid primary key,
  run_id uuid not null references public.admin_room_conversation_runs(id) on delete cascade,
  client_id text, participant_id uuid not null references auth.users(id),
  parent_client_id text, body text, position integer
);
create table public.admin_room_persona_provision_locks (
  room_id uuid references public.pools(id) on delete cascade,
  token uuid primary key, created_by uuid not null references auth.users(id)
);
create table public.canonical_media (id uuid primary key);
insert into public.canonical_media values ('00000000-0000-0000-0000-00000000ca01');
create table public.canonical_media_backfill_runs (
  id uuid primary key, phase text, status text,
  requested_by uuid references auth.users(id) on delete set null
);
create table public.canonical_media_backfill_plans (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.canonical_media_backfill_runs(id),
  table_name text, row_id text, user_id uuid, external_source text, external_id text,
  canonical_media_id uuid references public.canonical_media(id)
);
create table public.canonical_media_backfill_audit (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.canonical_media_backfill_runs(id),
  plan_id bigint not null references public.canonical_media_backfill_plans(id),
  table_name text, row_id text, external_source text, external_id text,
  canonical_media_id uuid references public.canonical_media(id), outcome text
);
create table public.prediction_pools (
  id uuid primary key default gen_random_uuid(), origin_user_id text, invited_user_id text
);
create table public.rank_items (
  id uuid primary key default gen_random_uuid(), custom_add_user_id text
);
create table public.ranks (
  id uuid primary key default gen_random_uuid(), origin_user_id text
);

-- The reporting migration addresses these exact production RPC signatures.
create function public.get_dashboard_summary() returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.get_retention_rates() returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.get_engaged_users() returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.get_activation_funnel() returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.get_engagement_depth() returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.get_social_graph_metrics() returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.get_active_users(period text) returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.get_stickiness_ratio() returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.get_churn_metrics(period_days integer) returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.get_session_engagement(period_text text) returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.get_session_frequency(period_days integer) returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.get_points_analytics() returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.get_lists_analytics() returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.get_cross_platform_engagement() returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.get_trending_content() returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.get_dna_clusters() returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.get_completion_rates() returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.get_viral_content() returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.get_creator_influence() returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.get_partnership_summary() returns jsonb language sql as $$ select '{}'::jsonb $$;

insert into auth.users(id, email) values
  ('00000000-0000-0000-0000-000000000001', 'baseline-owner-a@example.invalid'),
  ('00000000-0000-0000-0000-000000000002', 'baseline-owner-b@example.invalid');
SQL

"${PSQL[@]}" -f "$ROOT/supabase/migrations/20260904000000_harden_friendship_mutations_and_search.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20260908000100_restrict_dna_profile_reads_to_friends.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20260911211700_add_user_blocks_owner_select.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20260914000200_restrict_user_dna_signal_reads.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20260914000100_reporting_rpc_grants.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20260914000700_provider_deletion_queue.sql" >/dev/null

assert_eq "authenticated cannot execute account deletion" "f" \
  "$("${PSQL[@]}" -Atqc "select has_function_privilege('authenticated', 'public.delete_account_transaction(uuid)', 'execute')")"
assert_eq "service role can execute account deletion" "t" \
  "$("${PSQL[@]}" -Atqc "select has_function_privilege('service_role', 'public.delete_account_transaction(uuid)', 'execute')")"
expect_fail "authenticated account deletion call is denied" \
  "set role authenticated; select public.delete_account_transaction('00000000-0000-0000-0000-000000000001');"

"${PSQL[@]}" -f "$ROOT/supabase/tests/user-blocks-read-access.sql" >/dev/null
echo "PASS: direct user_blocks RLS fixture"
"${PSQL[@]}" -f "$ROOT/supabase/tests/dna-signals-read-access.sql" >/dev/null
echo "PASS: direct user_dna_signals RLS fixture"
"${PSQL[@]}" -f "$ROOT/supabase/tests/reporting-rpc-grants.sql" >/dev/null
echo "PASS: reporting RPC authorization fixture"
"${PSQL[@]}" -f "$ROOT/supabase/tests/account-deletion-rollback.sql" >/dev/null
echo "PASS: actual deletion function rollback fixture"

# This is intentionally a source-level contract check, not an Edge Runtime
# integration test. See docs/report-block-repair-baseline.md for its limits.
require_source "feed reads blocks in both directions" ".eq('blocker_id', appUser.id)"
require_source "feed reads inverse blocks" ".eq('blocked_id', appUser.id)"
require_source "feed excludes blocked post authors" "query = query.not('user_id', 'in',"
require_source "main feed excludes DNA comparisons" "query = query.neq('post_type', 'dna_compare')"
require_source "direct DNA comparison access is participant scoped" "return post.user_id === appUser.id || friendId === appUser.id;"

echo "All isolated report/block repair baseline tests passed."