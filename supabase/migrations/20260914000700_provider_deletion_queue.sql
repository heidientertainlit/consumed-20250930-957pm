-- Section 3B provider-deletion queue and controls.
--
-- Provider cleanup is intentionally disabled by default.  The queue is written
-- by the existing authenticated delete transaction, but only a server-only
-- worker can read/claim jobs or make provider requests.  No provider
-- credentials, response bodies, email addresses, aliases, or selectors are
-- stored here.

create table if not exists public.deleted_account_tombstones (
  user_id uuid primary key,
  deleted_at timestamptz not null default now()
);

create table if not exists public.provider_deletion_jobs (
  job_id uuid primary key default gen_random_uuid(),
  deleted_user_id uuid not null,
  provider text not null check (provider in ('posthog', 'customer_io', 'onesignal')),
  provider_identifier_kind text not null check (
    provider_identifier_kind in ('posthog_person_uuid', 'customer_id', 'external_id')
  ),
  provider_identifier text,
  state text not null default 'queued' check (
    state in (
      'queued',
      'mapping_pending',
      'in_flight',
      'accepted_pending',
      'completed',
      'observed_absent',
      'retryable_failure',
      'blocked',
      'permanent_failure'
    )
  ),
  mapping_state text not null check (
    mapping_state in ('not_required', 'mapping_pending', 'verified', 'ambiguous', 'unavailable')
  ),
  attempts integer not null default 0 check (attempts >= 0),
  lease_until timestamptz,
  lease_token uuid,
  readback_misses integer not null default 0 check (readback_misses >= 0),
  next_attempt_at timestamptz not null default now(),
  last_http_status integer check (last_http_status is null or last_http_status between 100 and 599),
  failure_class text check (failure_class is null or failure_class ~ '^[a-z][a-z0-9_]{0,63}$'),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  constraint provider_deletion_jobs_one_provider_per_user
    unique (deleted_user_id, provider),
  constraint provider_deletion_jobs_identifier_shape check (
    (provider = 'posthog'
      and provider_identifier_kind = 'posthog_person_uuid'
      and (
        (provider_identifier is null
          and mapping_state in ('mapping_pending', 'ambiguous', 'unavailable'))
        or (provider_identifier is not null
          and mapping_state = 'verified'
          and provider_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
      ))
    or (provider = 'customer_io'
      and provider_identifier_kind = 'customer_id'
      and provider_identifier is not null
      and provider_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
    or (provider = 'onesignal'
      and provider_identifier_kind = 'external_id'
      and provider_identifier is not null
      and provider_identifier ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
  ),
  constraint provider_deletion_jobs_mapping_shape check (
    (provider = 'posthog' and mapping_state in ('mapping_pending', 'verified', 'ambiguous', 'unavailable'))
    or (provider <> 'posthog' and mapping_state = 'not_required')
  )
);

create index if not exists provider_deletion_jobs_ready_idx
  on public.provider_deletion_jobs (state, next_attempt_at, created_at);

-- Every destructive reservation is an append-only event. Rolling limits query
-- this timestamped ledger instead of fixed hourly counters, so requests that
-- straddle an hour boundary and retries are counted exactly once each.
create table if not exists public.provider_deletion_attempts (
  attempt_id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  lease_token uuid not null,
  deleted_user_id uuid not null,
  provider text not null check (
    provider in ('posthog', 'customer_io', 'onesignal')
  ),
  reserved_at timestamptz not null default now(),
  constraint provider_deletion_attempts_job_fk
    foreign key (job_id) references public.provider_deletion_jobs(job_id),
  constraint provider_deletion_attempts_tombstone_fk
    foreign key (deleted_user_id)
    references public.deleted_account_tombstones(user_id),
  constraint provider_deletion_attempts_one_reservation_per_lease
    unique (job_id, lease_token)
);

create index if not exists provider_deletion_attempts_recent_idx
  on public.provider_deletion_attempts (reserved_at, deleted_user_id);
create index if not exists provider_deletion_attempts_provider_recent_idx
  on public.provider_deletion_attempts (provider, reserved_at);

create or replace function public.provider_deletion_attempts_append_only()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'provider deletion attempts are append-only';
end;
$$;

drop trigger if exists provider_deletion_attempts_append_only
  on public.provider_deletion_attempts;
create trigger provider_deletion_attempts_append_only
before update or delete on public.provider_deletion_attempts
for each row execute function public.provider_deletion_attempts_append_only();

create or replace function public.deleted_account_tombstones_immutable()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'deleted account tombstones are immutable';
end;
$$;

drop trigger if exists deleted_account_tombstones_immutable
  on public.deleted_account_tombstones;
create trigger deleted_account_tombstones_immutable
before update or delete on public.deleted_account_tombstones
for each row execute function public.deleted_account_tombstones_immutable();

create or replace function public.provider_deletion_jobs_no_delete()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'provider deletion jobs are append-only';
end;
$$;

drop trigger if exists provider_deletion_jobs_no_delete
  on public.provider_deletion_jobs;
create trigger provider_deletion_jobs_no_delete
before delete on public.provider_deletion_jobs
for each row execute function public.provider_deletion_jobs_no_delete();

create table if not exists public.provider_control_ledger (
  control_key text primary key,
  scope text not null check (scope in ('global', 'provider')),
  provider text check (provider is null or provider in ('posthog', 'customer_io', 'onesignal')),
  kill_switch boolean not null default false,
  provider_enabled boolean not null default false,
  circuit_open boolean not null default false,
  real_cleanup_approved boolean not null default false,
  max_distinct_accounts integer not null default 5 check (max_distinct_accounts > 0),
  max_destructive_requests integer not null default 15 check (max_destructive_requests > 0),
  constraint provider_control_ledger_scope_shape check (
    (scope = 'global' and control_key = 'global' and provider is null)
    or (scope = 'provider'
      and control_key = 'provider:' || provider
      and provider is not null)
  )
);

insert into public.provider_control_ledger (
  control_key, scope, provider, provider_enabled, kill_switch,
  max_distinct_accounts, max_destructive_requests
)
values
  ('global', 'global', null, false, false, 5, 15),
  ('provider:posthog', 'provider', 'posthog', false, false, 5, 15),
  ('provider:customer_io', 'provider', 'customer_io', false, false, 5, 15),
  ('provider:onesignal', 'provider', 'onesignal', false, false, 5, 15)
on conflict (control_key) do nothing;

create or replace function public.provider_deletion_jobs_immutable_target()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.deleted_user_id is distinct from new.deleted_user_id
     or old.provider is distinct from new.provider
     or old.provider_identifier_kind is distinct from new.provider_identifier_kind then
    raise exception 'provider deletion target is immutable';
  end if;

  if old.provider_identifier is not null
     and old.provider_identifier is distinct from new.provider_identifier then
    raise exception 'verified provider mapping is immutable';
  end if;

  if old.mapping_state = 'verified'
     and new.mapping_state is distinct from old.mapping_state then
    raise exception 'verified provider mapping state is immutable';
  end if;

  if old.provider <> 'posthog'
     and old.provider_identifier is distinct from new.provider_identifier then
    raise exception 'provider identifier is immutable';
  end if;

  if old.provider = 'posthog'
     and old.provider_identifier is null
     and new.provider_identifier is not null
     and (
       new.mapping_state <> 'verified'
       or new.provider_identifier !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     ) then
    raise exception 'unverified PostHog mapping';
  end if;

  return new;
end;
$$;

drop trigger if exists provider_deletion_jobs_immutable_target
  on public.provider_deletion_jobs;
create trigger provider_deletion_jobs_immutable_target
before update on public.provider_deletion_jobs
for each row execute function public.provider_deletion_jobs_immutable_target();

alter table public.deleted_account_tombstones enable row level security;
alter table public.provider_deletion_jobs enable row level security;
alter table public.provider_control_ledger enable row level security;
alter table public.provider_deletion_attempts enable row level security;

revoke all on table public.deleted_account_tombstones from public, anon, authenticated;
revoke all on table public.provider_deletion_jobs from public, anon, authenticated;
revoke all on table public.provider_control_ledger from public, anon, authenticated;
revoke all on table public.provider_deletion_attempts from public, anon, authenticated;
grant all on table public.deleted_account_tombstones to service_role;
grant all on table public.provider_deletion_jobs to service_role;
grant all on table public.provider_control_ledger to service_role;
grant all on table public.provider_deletion_attempts to service_role;

-- Atomically claim work.  There is no target argument: a worker receives only
-- the oldest ready rows, and server-side disposable mode filters its exact
-- allowlist before calling this function.
create or replace function public.provider_deletion_claim_jobs(p_limit integer default 1)
returns setof public.provider_deletion_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_limit is null or p_limit <> 1 then
    raise exception 'Provider deletion claims must be just-in-time single-job claims';
  end if;

  update public.provider_deletion_jobs
  set state = case
        when attempts >= 15 or created_at < now() - interval '24 hours'
          then 'permanent_failure'
        else 'retryable_failure'
      end,
      lease_until = null,
      lease_token = null,
      failure_class = case
        when attempts >= 15 or created_at < now() - interval '24 hours'
          then 'retry_exhausted'
        else failure_class
      end,
      next_attempt_at = now()
  where state = 'in_flight'
    and lease_until is not null
    and lease_until < now();

  update public.provider_deletion_jobs
  set state = 'permanent_failure',
      lease_until = null,
      lease_token = null,
      failure_class = 'retry_exhausted',
      next_attempt_at = now()
  where state in (
      'queued', 'mapping_pending', 'retryable_failure', 'accepted_pending'
    )
    and (attempts >= 15 or created_at < now() - interval '24 hours');

  return query
  with candidates as (
    select job_id
    from public.provider_deletion_jobs
    where state in (
      'queued', 'mapping_pending', 'retryable_failure', 'accepted_pending'
    )
      and exists (
        select 1
        from public.deleted_account_tombstones tombstones
        where tombstones.user_id = provider_deletion_jobs.deleted_user_id
      )
      and attempts < 15
      and created_at >= now() - interval '24 hours'
      and next_attempt_at <= now()
    order by created_at, job_id
    for update skip locked
    limit p_limit
  ),
  claimed as (
    update public.provider_deletion_jobs jobs
    set state = 'in_flight',
        lease_until = now() + interval '2 minutes',
        lease_token = gen_random_uuid(),
        attempts = jobs.attempts + 1
    from candidates
    where jobs.job_id = candidates.job_id
    returning jobs.*
  )
  select * from claimed;
end;
$$;

-- The disposable worker may narrow work to IDs from its server-only allowlist.
-- This is an internal claim primitive, not a client-facing target endpoint.
create or replace function public.provider_deletion_claim_job(p_job_id uuid)
returns setof public.provider_deletion_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_job_id is null then
    return;
  end if;

  update public.provider_deletion_jobs
  set state = case
        when attempts >= 15 or created_at < now() - interval '24 hours'
          then 'permanent_failure'
        else 'retryable_failure'
      end,
      lease_until = null,
      lease_token = null,
      failure_class = case
        when attempts >= 15 or created_at < now() - interval '24 hours'
          then 'retry_exhausted'
        else failure_class
      end,
      next_attempt_at = now()
  where job_id = p_job_id
    and state = 'in_flight'
    and lease_until is not null
    and lease_until < now();

  update public.provider_deletion_jobs
  set state = 'permanent_failure',
      lease_until = null,
      lease_token = null,
      failure_class = 'retry_exhausted',
      next_attempt_at = now()
  where job_id = p_job_id
    and state in (
      'queued', 'mapping_pending', 'retryable_failure', 'accepted_pending'
    )
    and (attempts >= 15 or created_at < now() - interval '24 hours');

  return query
  with candidate as (
    select job_id
    from public.provider_deletion_jobs
    where job_id = p_job_id
      and state in (
        'queued', 'mapping_pending', 'retryable_failure', 'accepted_pending'
      )
      and exists (
        select 1
        from public.deleted_account_tombstones tombstones
        where tombstones.user_id = provider_deletion_jobs.deleted_user_id
      )
      and attempts < 15
      and created_at >= now() - interval '24 hours'
      and next_attempt_at <= now()
    for update skip locked
  ),
  claimed as (
    update public.provider_deletion_jobs jobs
    set state = 'in_flight',
        lease_until = now() + interval '2 minutes',
        lease_token = gen_random_uuid(),
        attempts = jobs.attempts + 1
    from candidate
    where jobs.job_id = candidate.job_id
    returning jobs.*
  )
  select * from claimed;
end;
$$;

drop function if exists public.provider_deletion_set_posthog_mapping(uuid, text);

-- Mapping is the only allowed target transition. A non-PostHog row never
-- enters this function, a verified mapping can never be replaced, and a stale
-- worker lease cannot commit a mapping.
create or replace function public.provider_deletion_set_posthog_mapping(
  p_job_id uuid,
  p_lease_token uuid,
  p_person_uuid text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  changed integer;
begin
  if p_job_id is null
     or p_lease_token is null
     or p_person_uuid is null
     or p_person_uuid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Invalid PostHog mapping';
  end if;

  update public.provider_deletion_jobs
  set provider_identifier = p_person_uuid,
      mapping_state = 'verified'
  where job_id = p_job_id
    and provider = 'posthog'
    and provider_identifier is null
    and mapping_state = 'mapping_pending'
    and state = 'in_flight'
    and lease_token = p_lease_token
    and lease_until > now();

  get diagnostics changed = row_count;
  if changed = 1 then
    return true;
  end if;

  return exists (
    select 1
    from public.provider_deletion_jobs
    where job_id = p_job_id
      and provider = 'posthog'
      and mapping_state = 'verified'
       and provider_identifier = p_person_uuid
       and state = 'in_flight'
       and lease_token = p_lease_token
       and lease_until > now()
  );
end;
$$;

drop function if exists public.provider_deletion_reserve_attempt(uuid);

-- Reserve immediately before a destructive provider call. The global control
-- row is locked first, followed by the job and provider rows, so concurrent
-- workers cannot bypass the kill switch or rolling limits. The lease token is
-- a compare-and-swap owner, not merely an advisory identifier.
create or replace function public.provider_deletion_reserve_attempt(
  p_job_id uuid,
  p_lease_token uuid,
  p_real_mode boolean default false
)
returns table (reserved boolean, reason text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_job public.provider_deletion_jobs%rowtype;
  global_control public.provider_control_ledger%rowtype;
  provider_control public.provider_control_ledger%rowtype;
  global_requests integer;
  global_accounts integer;
  provider_requests integer;
  inserted_attempt integer;
begin
  if p_job_id is null or p_lease_token is null then
    return query select false, 'invalid_job';
    return;
  end if;

  -- Every reservation serializes on the global control row first. The
  -- timestamped append-only ledger is the source of truth for rolling limits.
  select *
  into global_control
  from public.provider_control_ledger
  where control_key = 'global'
  for update;

  if global_control.control_key is null then
    return query select false, 'control_unavailable';
    return;
  end if;

  if global_control.kill_switch then
    return query select false, 'kill_switch';
    return;
  end if;

  if p_real_mode and global_control.real_cleanup_approved is not true then
    return query select false, 'real_cleanup_not_approved';
    return;
  end if;

  if global_control.circuit_open then
    return query select false, 'global_circuit_open';
    return;
  end if;

  select *
  into target_job
  from public.provider_deletion_jobs
  where job_id = p_job_id
  for update;

  if not found
     or target_job.state <> 'in_flight'
     or target_job.lease_token <> p_lease_token
     or target_job.lease_until <= now() then
    return query select false, 'job_not_in_flight';
    return;
  end if;

  if not exists (
    select 1
    from public.deleted_account_tombstones
    where user_id = target_job.deleted_user_id
  ) then
    return query select false, 'missing_tombstone';
    return;
  end if;

  select *
  into provider_control
  from public.provider_control_ledger
  where control_key = 'provider:' || target_job.provider
  for update;

  if provider_control.control_key is null then
    return query select false, 'control_unavailable';
    return;
  end if;

  if provider_control.provider_enabled is not true then
    return query select false, 'provider_disabled';
    return;
  end if;

  if provider_control.circuit_open then
    return query select false, 'provider_circuit_open';
    return;
  end if;

  if exists (
    select 1
    from public.provider_deletion_attempts
    where job_id = target_job.job_id
      and lease_token = p_lease_token
  ) then
    return query select true, 'already_reserved';
    return;
  end if;

  select count(*)
  into global_requests
  from public.provider_deletion_attempts
  where reserved_at > now() - interval '1 hour';

  select count(distinct deleted_user_id)
  into global_accounts
  from public.provider_deletion_attempts
  where reserved_at > now() - interval '1 hour';

  if global_requests >= global_control.max_destructive_requests then
    update public.provider_control_ledger
    set circuit_open = true
    where control_key = 'global';
    return query select false, 'global_request_limit';
    return;
  end if;

  select count(*)
  into provider_requests
  from public.provider_deletion_attempts
  where provider = target_job.provider
    and reserved_at > now() - interval '1 hour';

  if provider_requests >= provider_control.max_destructive_requests then
    update public.provider_control_ledger
    set circuit_open = true
    where control_key = 'provider:' || target_job.provider;
    return query select false, 'provider_request_limit';
    return;
  end if;

  if not exists (
    select 1
    from public.provider_deletion_attempts
    where deleted_user_id = target_job.deleted_user_id
      and reserved_at > now() - interval '1 hour'
  ) and global_accounts >= global_control.max_distinct_accounts then
    update public.provider_control_ledger
    set circuit_open = true
    where control_key = 'global';
    return query select false, 'global_account_limit';
    return;
  end if;

  insert into public.provider_deletion_attempts (
    job_id, lease_token, deleted_user_id, provider
  )
  values (
    target_job.job_id,
    p_lease_token,
    target_job.deleted_user_id,
    target_job.provider
  )
  on conflict (job_id, lease_token) do nothing;
  get diagnostics inserted_attempt = row_count;

  if inserted_attempt = 0 then
    return query select true, 'already_reserved';
  end if;
  return query select true, 'reserved';
end;
$$;

drop function if exists public.provider_deletion_before_dispatch(uuid, uuid, boolean);

-- Recheck ownership and controls immediately before an HTTP DELETE. A kill
-- switch cannot cancel bytes already sent, but a switch activated after the
-- reservation and before this guard prevents dispatch.
create or replace function public.provider_deletion_before_dispatch(
  p_job_id uuid,
  p_lease_token uuid,
  p_real_mode boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_job public.provider_deletion_jobs%rowtype;
  global_control public.provider_control_ledger%rowtype;
  provider_control public.provider_control_ledger%rowtype;
begin
  select * into global_control
  from public.provider_control_ledger
  where control_key = 'global'
  for update;

  if global_control.control_key is null then
    return false;
  end if;

  select *
  into target_job
  from public.provider_deletion_jobs
  where job_id = p_job_id
  for update;

  if not found
     or target_job.state <> 'in_flight'
     or target_job.lease_token <> p_lease_token
     or target_job.lease_until <= now() then
    return false;
  end if;

  select * into provider_control
  from public.provider_control_ledger
  where control_key = 'provider:' || target_job.provider
  for update;

  if provider_control.control_key is null
     or global_control.kill_switch
     or global_control.circuit_open
     or provider_control.provider_enabled is not true
     or provider_control.circuit_open
     or (p_real_mode and global_control.real_cleanup_approved is not true) then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.provider_deletion_real_mode_approved()
returns boolean
language sql
security definer
set search_path = pg_catalog, public
as $$
  select real_cleanup_approved
  from public.provider_control_ledger
  where control_key = 'global';
$$;

-- Workers report only bounded status values.  Target columns are absent from
-- this API so a result update cannot retarget a job. The lease token and
-- unexpired lease form a compare-and-swap owner check.
drop function if exists public.provider_deletion_record_job(
  uuid, text, text, integer, text, timestamptz, boolean
);
create or replace function public.provider_deletion_record_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_state text,
  p_mapping_state text default null,
  p_last_http_status integer default null,
  p_failure_class text default null,
  p_next_attempt_at timestamptz default null,
  p_accepted boolean default false,
  p_readback_miss boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  changed integer;
begin
  if p_job_id is null or p_lease_token is null then
    raise exception 'Provider deletion lease is required';
  end if;
  if p_state not in (
    'queued', 'mapping_pending', 'accepted_pending', 'completed',
    'observed_absent', 'retryable_failure', 'blocked', 'permanent_failure'
  ) then
    raise exception 'Invalid provider deletion state';
  end if;
  if p_mapping_state is not null and p_mapping_state not in (
    'not_required', 'mapping_pending', 'verified', 'ambiguous', 'unavailable'
  ) then
    raise exception 'Invalid provider deletion mapping state';
  end if;
  if p_last_http_status is not null
     and (p_last_http_status < 100 or p_last_http_status > 599) then
    raise exception 'Invalid provider deletion status';
  end if;
  if p_failure_class is not null
     and p_failure_class !~ '^[a-z][a-z0-9_]{0,63}$' then
    raise exception 'Invalid provider deletion failure class';
  end if;

  update public.provider_deletion_jobs
  set state = p_state,
      mapping_state = coalesce(p_mapping_state, mapping_state),
       lease_until = null,
       lease_token = null,
       readback_misses = case
         when p_readback_miss then readback_misses + 1
         else readback_misses
       end,
      last_http_status = p_last_http_status,
      failure_class = p_failure_class,
      next_attempt_at = case
        when p_state in ('completed', 'observed_absent', 'blocked', 'permanent_failure')
          then now()
        else coalesce(p_next_attempt_at, now())
      end,
      accepted_at = case
        when p_accepted then coalesce(accepted_at, now())
        else accepted_at
      end,
      completed_at = case
        when p_state in ('completed', 'observed_absent') then coalesce(completed_at, now())
        else completed_at
      end
  where job_id = p_job_id
    and state = 'in_flight'
    and lease_token = p_lease_token
    and lease_until > now()
    and (
      p_state <> 'observed_absent'
      or readback_misses + case when p_readback_miss then 1 else 0 end >= 3
    );

  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.provider_deletion_claim_jobs(integer)
  from public, anon, authenticated;
revoke all on function public.provider_deletion_claim_job(uuid)
  from public, anon, authenticated;
revoke all on function public.provider_deletion_set_posthog_mapping(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.provider_deletion_reserve_attempt(uuid, uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.provider_deletion_record_job(
  uuid, uuid, text, text, integer, text, timestamptz, boolean, boolean
) from public, anon, authenticated;
revoke all on function public.provider_deletion_before_dispatch(uuid, uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.provider_deletion_real_mode_approved()
  from public, anon, authenticated;
grant execute on function public.provider_deletion_claim_jobs(integer) to service_role;
grant execute on function public.provider_deletion_claim_job(uuid) to service_role;
grant execute on function public.provider_deletion_set_posthog_mapping(uuid, uuid, text) to service_role;
grant execute on function public.provider_deletion_reserve_attempt(uuid, uuid, boolean) to service_role;
grant execute on function public.provider_deletion_record_job(
  uuid, uuid, text, text, integer, text, timestamptz, boolean, boolean
) to service_role;
grant execute on function public.provider_deletion_before_dispatch(uuid, uuid, boolean) to service_role;
grant execute on function public.provider_deletion_real_mode_approved() to service_role;

-- Replace only the final, runtime-safe account transaction from 00600.  The
-- existing first-party cleanup remains unchanged; the tombstone and exactly
-- three jobs are committed with it before Auth is deleted.
create or replace function public.delete_account_transaction(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_auth_user uuid;
  deleted_auth_users integer;
  queued_jobs integer;
begin
  if p_user_id is null then
    raise exception 'A user ID is required';
  end if;

  select id
  into target_auth_user
  from auth.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'Account was not found';
  end if;

  if exists (
    select 1 from public.deleted_account_tombstones where user_id = p_user_id
  ) then
    raise exception 'Account has already been deleted';
  end if;

  delete from public.prediction_comment_likes
  where user_id::text = p_user_id::text
     or comment_id in (
       select id
       from public.prediction_comments
       where user_id::text = p_user_id::text
     );

  delete from public.prediction_comment_votes
  where user_id::text = p_user_id::text
     or comment_id::text in (
       select id::text
       from public.prediction_comments
       where user_id::text = p_user_id::text
     );

  delete from public.prediction_comments
  where user_id::text = p_user_id::text;

  delete from public.prediction_likes
  where user_id::text = p_user_id::text;

  delete from public.social_comment_votes
  where user_id::text = p_user_id::text;

  delete from public.post_reactions
  where user_id = p_user_id;

  delete from public.room_follows
  where user_id::text = p_user_id::text;

  delete from public.room_take_votes
  where user_id = p_user_id;

  delete from public.media_engagements
  where user_id = p_user_id;

  delete from public.media_match_scores
  where user_id = p_user_id;

  delete from public.daily_challenge_responses
  where user_id = p_user_id;

  delete from public.challenge_scores
  where user_id::text = p_user_id::text;

  delete from public.trivia_sessions
  where user_id = p_user_id;

  delete from public.user_predictions
  where user_id = p_user_id;

  delete from public.user_prediction_stats
  where user_id = p_user_id;

  delete from public.persona_post_drafts
  where persona_user_id = p_user_id;

  delete from public.scheduled_persona_posts
  where persona_user_id = p_user_id;

  delete from public.awards_ballot_completions
  where user_id::text = p_user_id::text;

  delete from public.beta_feedback
  where user_id = p_user_id;

  delete from public.content_reports
  where reporter_id = p_user_id
     or reported_user_id = p_user_id;

  delete from public.user_blocks
  where blocker_id = p_user_id
     or blocked_id = p_user_id;

  -- user_last_activity is a GROUP BY view, not a writable table. Remove its
  -- session source rows; list_items and social_posts disappear through their
  -- Auth cascades below.
  delete from public.user_sessions
  where user_id = p_user_id;

  update public.admin_room_conversation_runs
  set approved_by = null,
      approved_at = null
  where created_by = p_user_id
     or approved_by = p_user_id
     or published_take_id in (
       select id
       from public.room_takes
       where user_id = p_user_id
     )
     or exists (
       select 1
       from public.admin_room_conversation_drafts
       where run_id = admin_room_conversation_runs.id
         and participant_id = p_user_id
     );

  delete from public.admin_room_conversation_drafts
  where participant_id = p_user_id;

  delete from public.admin_room_conversation_runs
  where created_by = p_user_id
     or published_take_id in (
       select id
       from public.room_takes
       where user_id = p_user_id
     );

  delete from public.admin_room_persona_provision_locks
  where created_by = p_user_id;

  -- canonical_media_backfill_plans and canonical_media_backfill_audit are
  -- immutable provenance records.  Their historical UUID snapshot is retained.
  update public.lists
  set origin_user_id = null
  where origin_user_id = p_user_id::text;

  update public.prediction_pools
  set origin_user_id = case
        when origin_user_id = p_user_id::text then null
        else origin_user_id
      end,
      invited_user_id = case
        when invited_user_id = p_user_id::text then null
        else invited_user_id
      end
  where origin_user_id = p_user_id::text
     or invited_user_id = p_user_id::text;

  update public.rank_items
  set custom_add_user_id = null
  where custom_add_user_id = p_user_id::text;

  update public.ranks
  set origin_user_id = null
  where origin_user_id = p_user_id::text;

  update public.social_posts
  set origin_user_id = null
  where origin_user_id = p_user_id::text;

  -- This boundary is the only server-side marker for stale UUID ingestion.
  insert into public.deleted_account_tombstones (user_id)
  values (p_user_id);

  insert into public.provider_deletion_jobs (
    deleted_user_id, provider, provider_identifier_kind,
    provider_identifier, state, mapping_state
  )
  values
    (p_user_id, 'posthog', 'posthog_person_uuid', null, 'mapping_pending', 'mapping_pending'),
    (p_user_id, 'customer_io', 'customer_id', p_user_id::text, 'queued', 'not_required'),
    (p_user_id, 'onesignal', 'external_id', p_user_id::text, 'queued', 'not_required');

  select count(*)
  into queued_jobs
  from public.provider_deletion_jobs
  where deleted_user_id = p_user_id;
  if queued_jobs <> 3 then
    raise exception 'Provider deletion queue assertion failed';
  end if;

  delete from auth.users
  where id = p_user_id;

  get diagnostics deleted_auth_users = row_count;
  if deleted_auth_users <> 1 then
    raise exception 'Account deletion affected % Auth users', deleted_auth_users;
  end if;
end;
$$;

revoke all on function public.delete_account_transaction(uuid)
from public, anon, authenticated;
grant execute on function public.delete_account_transaction(uuid) to service_role;