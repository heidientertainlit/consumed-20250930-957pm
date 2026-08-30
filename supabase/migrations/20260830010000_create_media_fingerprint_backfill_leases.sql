-- Serializes a user's cold fingerprint-history backfill across simultaneous
-- feed-card score requests. Lease tokens fence stale owners during takeover.
create table if not exists public.media_fingerprint_backfill_leases (
  user_id uuid not null references auth.users(id) on delete cascade,
  fingerprint_version integer not null check (fingerprint_version > 0),
  lease_token uuid not null,
  leased_at timestamptz not null default now(),
  primary key (user_id, fingerprint_version)
);

alter table public.media_fingerprint_backfill_leases enable row level security;
revoke all on table public.media_fingerprint_backfill_leases from public;
revoke all on table public.media_fingerprint_backfill_leases from anon, authenticated;
grant all on table public.media_fingerprint_backfill_leases to service_role;

comment on table public.media_fingerprint_backfill_leases is
  'Service-role-only fenced leases for per-user, per-fingerprint-version history backfills.';