-- Source-backed, shared enrichment cache. This table deliberately has no
-- application-user policies: Edge Functions use the service-role client.
create table if not exists public.media_fingerprints (
  external_source text not null check (char_length(external_source) between 1 and 50),
  external_id text not null check (char_length(external_id) between 1 and 200),
  media_type text,
  fingerprint_version integer not null default 1,
  status text not null default 'empty' check (status in ('ready', 'empty', 'failed')),
  source_metadata jsonb not null default '{}'::jsonb,
  fingerprint jsonb not null default '{}'::jsonb,
  error_message text,
  resolved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (external_source, external_id)
);

alter table public.media_fingerprints enable row level security;
revoke all on table public.media_fingerprints from anon, authenticated;
grant all on table public.media_fingerprints to service_role;

comment on table public.media_fingerprints is
  'Service-role-only cache of bounded provider metadata and non-score media fingerprints.';