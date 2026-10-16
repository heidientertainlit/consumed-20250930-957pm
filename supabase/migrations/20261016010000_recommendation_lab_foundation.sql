-- Isolated storage only. No production-table DML, enrichment, models or ranking.
-- Deliberately no foreign keys to production tables (and no new triggers there).
create extension if not exists vector with schema extensions;

create table public.recommendation_lab_items (
  id uuid primary key default gen_random_uuid(),
  external_source text not null check (external_source ~ '^[a-z][a-z0-9_]{0,49}$'),
  external_id text not null check (char_length(external_id) between 1 and 200),
  media_type text not null check (media_type in ('movie','tv','book','music','podcast','youtube','game')),
  title text not null check (char_length(btrim(title)) between 1 and 500),
  -- Informational reference only: preparation must never create canonical rows.
  existing_canonical_id uuid,
  source_verified boolean not null default false,
  destination_path text check (
    destination_path is null or
    (destination_path ~ '^/media/[a-z]+/[a-z0-9_]+/.+' and destination_path !~ '[?#[:cntrl:]]')
  ),
  source_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(source_metadata) = 'object'),
  verification jsonb not null default '{}'::jsonb check (jsonb_typeof(verification) = 'object'),
  profile_version integer not null default 1 check (profile_version > 0),
  profile jsonb not null default '{}'::jsonb check (jsonb_typeof(profile) = 'object'),
  profile_evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(profile_evidence) = 'object'),
  embedding_model text,
  embedding_dimensions integer check (embedding_dimensions = 256),
  embedding_input_hash text check (embedding_input_hash ~ '^[a-f0-9]{64}$'),
  appeal_embedding extensions.vector(256),
  tone_style_embedding extensions.vector(256),
  subject_theme_embedding extensions.vector(256),
  status text not null default 'unprepared' check (status in ('unprepared','verified','profiled','embedded','unavailable','failed')),
  error_message text check (char_length(error_message) <= 1000),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (external_source, external_id, profile_version),
  constraint recommendation_lab_embedding_provenance check (
    (appeal_embedding is null and tone_style_embedding is null and subject_theme_embedding is null)
    or
    (char_length(btrim(embedding_model)) > 0 and embedding_model is not null
      and embedding_dimensions is not null and embedding_input_hash is not null)
  )
);

create table public.recommendation_lab_runs (
  id uuid primary key default gen_random_uuid(),
  experiment_key text not null default 'initial' check (char_length(experiment_key) between 1 and 100),
  label text not null check (char_length(btrim(label)) between 1 and 160),
  source_item_id uuid references public.recommendation_lab_items(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','preparing','ready','running','complete','failed','paused')),
  configuration jsonb not null default '{}'::jsonb check (
    jsonb_typeof(configuration) = 'object' and octet_length(configuration::text) <= 16384
  ),
  -- Bounded, versioned snapshots; no generator is connected to these fields.
  results jsonb not null default '{}'::jsonb check (
    jsonb_typeof(results) = 'object' and octet_length(results::text) <= 2097152
  ),
  diagnostics jsonb not null default '{}'::jsonb check (
    jsonb_typeof(diagnostics) = 'object' and octet_length(diagnostics::text) <= 1048576
  ),
  evaluations jsonb not null default '{}'::jsonb check (
    jsonb_typeof(evaluations) = 'object' and octet_length(evaluations::text) <= 262144
  ),
  progress jsonb not null default '{}'::jsonb check (jsonb_typeof(progress) = 'object'),
  model_reserved_usd numeric(12,6) not null default 0 check (model_reserved_usd >= 0),
  model_spent_usd numeric(12,6) not null default 0 check (model_spent_usd >= 0),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recommendation_lab_runs_created_idx on public.recommendation_lab_runs (created_at desc, id);

comment on table public.recommendation_lab_items is
  'Private experiment storage. No production backfill, identity writes, enrichment or embedding jobs are installed.';
comment on table public.recommendation_lab_runs is
  'Private experiment snapshots. Foundation exposes draft creation only; no preparation, ranking, spend reservation or feedback mutation yet.';

alter table public.recommendation_lab_items enable row level security;
alter table public.recommendation_lab_runs enable row level security;
revoke all on public.recommendation_lab_items, public.recommendation_lab_runs from public, anon, authenticated, service_role;

-- Uses the session subject, not JWT-provided admin flags. No service-key bypass.
-- Fixed search path and qualified relations prevent object-shadowing attacks.
create function public.recommendation_lab_is_admin()
returns boolean language sql stable security definer set search_path = pg_catalog
as $$
  select auth.uid() is not null and exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.is_admin is true
      and coalesce(u.is_persona, false) is false
  );
$$;
revoke all on function public.recommendation_lab_is_admin() from public, anon, authenticated, service_role;
grant execute on function public.recommendation_lab_is_admin() to authenticated;

create policy recommendation_lab_items_admin_read on public.recommendation_lab_items
  for select to authenticated using ((select public.recommendation_lab_is_admin()));
create policy recommendation_lab_runs_admin_read on public.recommendation_lab_runs
  for select to authenticated using ((select public.recommendation_lab_is_admin()));
grant select on public.recommendation_lab_items, public.recommendation_lab_runs to authenticated;

-- No browser/service direct writes. This single, narrow RPC can only create an
-- empty draft and cannot accept results, source identities, costs or an actor ID.
create function public.recommendation_lab_create_draft(
  p_label text,
  p_configuration jsonb default '{}'::jsonb
)
returns public.recommendation_lab_runs language plpgsql security definer set search_path = pg_catalog
as $$
declare
  result public.recommendation_lab_runs;
begin
  if not public.recommendation_lab_is_admin() then
    raise exception 'A human admin session is required' using errcode = '42501';
  end if;
  if p_label is null or char_length(btrim(p_label)) not between 1 and 160 then
    raise exception 'Label must contain 1 to 160 characters' using errcode = '22023';
  end if;
  if p_configuration is null or jsonb_typeof(p_configuration) <> 'object'
      or octet_length(p_configuration::text) > 16384 then
    raise exception 'Configuration must be a JSON object of at most 16 KiB' using errcode = '22023';
  end if;
  insert into public.recommendation_lab_runs (label, configuration, created_by)
    values (btrim(p_label), p_configuration, auth.uid())
    returning * into result;
  return result;
end;
$$;
revoke all on function public.recommendation_lab_create_draft(text,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.recommendation_lab_create_draft(text,jsonb) to authenticated;

create function public.recommendation_lab_foundation_status()
returns jsonb language plpgsql security definer set search_path = pg_catalog
as $$
begin
  if not public.recommendation_lab_is_admin() then
    raise exception 'A human admin session is required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'stage', 'storage_foundation',
    'item_count', (select count(*) from public.recommendation_lab_items),
    'run_count', (select count(*) from public.recommendation_lab_runs),
    'preparation_enabled', false,
    'embedding_generation_enabled', false,
    'ranking_enabled', false,
    'consumer_connected', false
  );
end;
$$;
revoke all on function public.recommendation_lab_foundation_status() from public, anon, authenticated, service_role;
grant execute on function public.recommendation_lab_foundation_status() to authenticated;
