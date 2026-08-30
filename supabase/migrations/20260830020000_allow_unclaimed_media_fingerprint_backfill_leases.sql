-- Completed continuation batches leave an unclaimed cursor row behind so a
-- later score request can claim and continue the user's bounded backfill.
alter table public.media_fingerprint_backfill_leases
  alter column lease_token drop not null;

revoke all on table public.media_fingerprint_backfill_leases from public;
revoke all on table public.media_fingerprint_backfill_leases from anon, authenticated;
grant all on table public.media_fingerprint_backfill_leases to service_role;

comment on column public.media_fingerprint_backfill_leases.lease_token is
  'Nullable per-request fencing token; NULL means the persistent continuation is unclaimed.';