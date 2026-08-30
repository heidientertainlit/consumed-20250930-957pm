-- Three-phase, service-role-only historical backfill. Catalog resolution never
-- touches activity rows; plans are immutable; apply consumes a completed plan.
-- Ignore canonical-link-only updates in the existing completion trigger. Without
-- this guard, linking an old row already sitting in a Finished list could stamp
-- completed_at and append a false completion event.
create or replace function public.prepare_list_item_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_is_finished boolean;
begin
  if tg_op = 'UPDATE'
     and old.list_id is not distinct from new.list_id
     and old.completed_at is not distinct from new.completed_at then
    return new;
  end if;

  select exists (
    select 1
    from public.lists l
    where l.id = new.list_id
      and l.user_id = new.user_id
      and l.is_default = true
      and lower(trim(l.title)) like '%finished%'
      and lower(trim(l.title)) not like '%not finish%'
  ) into v_target_is_finished;

  if v_target_is_finished then
    new.completed_at := coalesce(
      new.completed_at,
      case when tg_op = 'UPDATE' then old.completed_at end,
      now()
    );
    if tg_op = 'INSERT' or old.list_id is distinct from new.list_id then
      new.progress := 100;
      new.progress_mode := 'percent';
    end if;
  end if;
  return new;
end;
$$;

create table if not exists public.canonical_media_backfill_runs (
  id uuid primary key default gen_random_uuid(),
  phase text not null check (phase in ('catalog', 'plan', 'apply')),
  status text not null default 'running' check (status in ('running', 'paused', 'complete', 'failed')),
  parent_run_id uuid references public.canonical_media_backfill_runs(id),
  requested_by uuid references auth.users(id) on delete set null,
  cursor_source text, cursor_id text, processed_tuples integer not null default 0,
  linked_rows integer not null default 0, conflict_rows integer not null default 0,
  unresolved_tuples integer not null default 0, error_message text,
  started_at timestamptz not null default now(), finished_at timestamptz
);
create table if not exists public.canonical_media_backfill_plans (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.canonical_media_backfill_runs(id) on delete restrict,
  table_name text not null check (table_name in ('media_ratings','list_items','social_posts','media_match_scores','media_fingerprints','media_progress_events')),
  row_id text not null, user_id uuid, list_id uuid,
  external_source text not null, external_id text not null,
  canonical_media_id uuid not null references public.canonical_media(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (run_id, table_name, row_id)
);
create table if not exists public.canonical_media_backfill_audit (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.canonical_media_backfill_runs(id) on delete restrict,
  plan_id bigint references public.canonical_media_backfill_plans(id) on delete restrict,
  table_name text, row_id text, external_source text not null, external_id text not null,
  canonical_media_id uuid references public.canonical_media(id) on delete restrict,
  outcome text not null check (outcome in ('catalog_resolved','unresolved','planned','linked','conflict','skipped','error')),
  details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.canonical_media_backfill_lease (
  singleton boolean primary key default true check (singleton), lease_token uuid not null,
  fence bigint not null, leased_until timestamptz not null, updated_at timestamptz not null default now()
);
create index if not exists canonical_media_backfill_plans_run_idx on public.canonical_media_backfill_plans(run_id, id);
create index if not exists canonical_media_backfill_audit_run_idx on public.canonical_media_backfill_audit(run_id, id);
alter table public.canonical_media_backfill_runs enable row level security;
alter table public.canonical_media_backfill_plans enable row level security;
alter table public.canonical_media_backfill_audit enable row level security;
alter table public.canonical_media_backfill_lease enable row level security;
revoke all on public.canonical_media_backfill_runs, public.canonical_media_backfill_plans, public.canonical_media_backfill_audit, public.canonical_media_backfill_lease from public, anon, authenticated;
grant all on public.canonical_media_backfill_runs, public.canonical_media_backfill_plans, public.canonical_media_backfill_audit, public.canonical_media_backfill_lease to service_role;
grant usage, select on sequence public.canonical_media_backfill_plans_id_seq, public.canonical_media_backfill_audit_id_seq to service_role;

create or replace function public.prevent_canonical_media_backfill_log_mutation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  raise exception 'canonical media backfill plans and audit records are immutable' using errcode='55000';
end $$;
drop trigger if exists prevent_canonical_media_backfill_plan_mutation on public.canonical_media_backfill_plans;
create trigger prevent_canonical_media_backfill_plan_mutation
before update or delete on public.canonical_media_backfill_plans
for each statement execute function public.prevent_canonical_media_backfill_log_mutation();
drop trigger if exists prevent_canonical_media_backfill_audit_mutation on public.canonical_media_backfill_audit;
create trigger prevent_canonical_media_backfill_audit_mutation
before update or delete on public.canonical_media_backfill_audit
for each statement execute function public.prevent_canonical_media_backfill_log_mutation();

create or replace function public.claim_canonical_media_backfill_lease(p_lease_token uuid, p_ttl_seconds integer default 120)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare v_fence bigint; begin
  if p_ttl_seconds not between 15 and 600 then raise exception 'invalid lease ttl' using errcode='22023'; end if;
  insert into canonical_media_backfill_lease(singleton,lease_token,fence,leased_until) values(true,p_lease_token,1,clock_timestamp()+make_interval(secs=>p_ttl_seconds))
  on conflict(singleton) do update set lease_token=excluded.lease_token,fence=canonical_media_backfill_lease.fence+1,leased_until=excluded.leased_until,updated_at=clock_timestamp()
  where canonical_media_backfill_lease.leased_until < clock_timestamp() or canonical_media_backfill_lease.lease_token=excluded.lease_token returning fence into v_fence;
  return v_fence;
end $$;
create or replace function public.heartbeat_canonical_media_backfill_lease(p_lease_token uuid,p_fence bigint,p_ttl_seconds integer default 120)
returns boolean language sql security definer set search_path=public,pg_temp as $$
 update canonical_media_backfill_lease set leased_until=clock_timestamp()+make_interval(secs=>greatest(15,least(p_ttl_seconds,600))),updated_at=clock_timestamp()
 where singleton and lease_token=p_lease_token and fence=p_fence and leased_until>=clock_timestamp() returning true $$;
create or replace function public.release_canonical_media_backfill_lease(p_lease_token uuid,p_fence bigint)
returns boolean language sql security definer set search_path=public,pg_temp as $$
 update canonical_media_backfill_lease set leased_until=clock_timestamp(),updated_at=clock_timestamp()
 where singleton and lease_token=p_lease_token and fence=p_fence returning true $$;

-- Only returns still-unlinked historical tuples. Its display fields are never
-- identity evidence; phase 1 supplies them solely to the provider resolver.
create or replace function public.list_canonical_media_backfill_candidates(p_after_source text default null,p_after_id text default null,p_limit integer default 50)
returns table(external_source text,external_id text,media_type text,title text,creator text)
language sql stable security definer set search_path=public,pg_temp as $$
 with rows as (
  select media_external_source s,media_external_id i,media_type,media_title title,null::text creator from media_ratings where canonical_media_id is null
  union all select external_source,external_id,coalesce(media_type,type),title,creator from list_items where canonical_media_id is null
  union all select media_external_source,media_external_id,media_type,media_title,media_creator from social_posts where canonical_media_id is null
  union all select external_source,external_id,media_type,null::text,null::text from media_match_scores where canonical_media_id is null
  union all select external_source,external_id,media_type,source_metadata->>'title',source_metadata->>'creator' from media_fingerprints where canonical_media_id is null
  union all select media_external_source,media_external_id,media_type,media_title,null::text from media_progress_events where canonical_media_id is null
 ), grouped as (
  select lower(trim(s)) s,trim(i) i,max(media_type) filter(where media_type is not null) media_type,max(title) filter(where title is not null) title,max(creator) filter(where creator is not null) creator
  from rows where nullif(trim(s),'') is not null and nullif(trim(i),'') is not null group by lower(trim(s)),trim(i)
 ) select s,i,media_type,title,creator from grouped where p_after_source is null or (s,i)>(p_after_source,coalesce(p_after_id,''))
 order by s,i limit greatest(1,least(p_limit,100)) $$;

-- Phase 2: aliases only. This creates immutable per-row snapshots and no
-- historical UPDATE occurs here.
create or replace function public.plan_canonical_media_backfill_tuple(p_run_id uuid,p_lease_token uuid,p_fence bigint,p_external_source text,p_external_id text,p_canonical_media_id uuid)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_source text:=lower(trim(p_external_source)); v_id text:=trim(p_external_id); v_count integer; begin
 perform 1 from canonical_media_backfill_lease
 where singleton and lease_token=p_lease_token and fence=p_fence and leased_until>=clock_timestamp()
 for update;
 if not found then raise exception 'lease lost' using errcode='55000'; end if;
 if not exists(select 1 from canonical_media_backfill_runs where id=p_run_id and phase='plan' and status='running') then raise exception 'plan run inactive' using errcode='55000'; end if;
 insert into canonical_media_backfill_plans(run_id,table_name,row_id,user_id,list_id,external_source,external_id,canonical_media_id)
 select p_run_id,'media_ratings',id::text,user_id,null,v_source,v_id,p_canonical_media_id from media_ratings where canonical_media_id is null and lower(trim(media_external_source))=v_source and trim(media_external_id)=v_id
 union all select p_run_id,'list_items',id::text,user_id,list_id,v_source,v_id,p_canonical_media_id from list_items where canonical_media_id is null and lower(trim(external_source))=v_source and trim(external_id)=v_id
 union all select p_run_id,'social_posts',id::text,user_id,null,v_source,v_id,p_canonical_media_id from social_posts where canonical_media_id is null and lower(trim(media_external_source))=v_source and trim(media_external_id)=v_id
 union all select p_run_id,'media_match_scores',id::text,user_id,null,v_source,v_id,p_canonical_media_id from media_match_scores where canonical_media_id is null and lower(trim(external_source))=v_source and trim(external_id)=v_id
 union all select p_run_id,'media_fingerprints',concat(external_source,':',external_id),null,null,v_source,v_id,p_canonical_media_id from media_fingerprints where canonical_media_id is null and lower(trim(external_source))=v_source and trim(external_id)=v_id
 union all select p_run_id,'media_progress_events',id::text,user_id,null,v_source,v_id,p_canonical_media_id from media_progress_events where canonical_media_id is null and lower(trim(media_external_source))=v_source and trim(media_external_id)=v_id;
 get diagnostics v_count=row_count;
 insert into canonical_media_backfill_audit(run_id,plan_id,table_name,row_id,external_source,external_id,canonical_media_id,outcome,details)
 select p_run_id,id,table_name,row_id,v_source,v_id,p_canonical_media_id,'planned','{"immutable_plan":true}' from canonical_media_backfill_plans where run_id=p_run_id and external_source=v_source and external_id=v_id;
 return v_count;
end $$;

-- Phase 3 is one plan row per transaction. It locks the activity row, checks
-- every immutable predicate and alias again, and catches unique conflicts.
create or replace function public.apply_canonical_media_backfill_plan_row(p_run_id uuid,p_plan_id bigint,p_lease_token uuid,p_fence bigint)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare p canonical_media_backfill_plans%rowtype; v_updated integer:=0; v_plan_run_id uuid; begin
 perform 1 from canonical_media_backfill_lease
 where singleton and lease_token=p_lease_token and fence=p_fence and leased_until>=clock_timestamp()
 for update;
 if not found then raise exception 'lease lost' using errcode='55000'; end if;
 select parent_run_id into v_plan_run_id
 from canonical_media_backfill_runs
 where id=p_run_id and phase='apply' and status='running'
 for update;
 if not found or v_plan_run_id is null then raise exception 'apply run inactive' using errcode='55000'; end if;
 select * into p from canonical_media_backfill_plans where id=p_plan_id and run_id=v_plan_run_id;
 if not found then raise exception 'plan row does not belong to apply run plan' using errcode='55000'; end if;
 if not exists(select 1 from media_provider_aliases where external_source=p.external_source and external_id=p.external_id and canonical_media_id=p.canonical_media_id) then
  insert into canonical_media_backfill_audit(run_id,plan_id,table_name,row_id,external_source,external_id,canonical_media_id,outcome,details) values(p_run_id,p.id,p.table_name,p.row_id,p.external_source,p.external_id,p.canonical_media_id,'skipped','{"reason":"planned alias changed"}'); return 'skipped'; end if;
 begin
  if p.table_name='media_ratings' then update media_ratings set canonical_media_id=p.canonical_media_id where id=p.row_id::integer and user_id is not distinct from p.user_id and canonical_media_id is null and lower(trim(media_external_source))=p.external_source and trim(media_external_id)=p.external_id;
  elsif p.table_name='list_items' then update list_items set canonical_media_id=p.canonical_media_id where id=p.row_id::uuid and user_id is not distinct from p.user_id and list_id is not distinct from p.list_id and canonical_media_id is null and lower(trim(external_source))=p.external_source and trim(external_id)=p.external_id;
  elsif p.table_name='social_posts' then update social_posts set canonical_media_id=p.canonical_media_id where id=p.row_id::uuid and user_id is not distinct from p.user_id and canonical_media_id is null and lower(trim(media_external_source))=p.external_source and trim(media_external_id)=p.external_id;
  elsif p.table_name='media_match_scores' then update media_match_scores set canonical_media_id=p.canonical_media_id where id=p.row_id::uuid and user_id is not distinct from p.user_id and canonical_media_id is null and lower(trim(external_source))=p.external_source and trim(external_id)=p.external_id;
  elsif p.table_name='media_fingerprints' then update media_fingerprints set canonical_media_id=p.canonical_media_id where concat(external_source,':',external_id)=p.row_id and canonical_media_id is null and lower(trim(external_source))=p.external_source and trim(external_id)=p.external_id;
  else update media_progress_events set canonical_media_id=p.canonical_media_id where id=p.row_id::uuid and user_id is not distinct from p.user_id and canonical_media_id is null and lower(trim(media_external_source))=p.external_source and trim(media_external_id)=p.external_id; end if;
  get diagnostics v_updated=row_count;
 exception when unique_violation then
  insert into canonical_media_backfill_audit(run_id,plan_id,table_name,row_id,external_source,external_id,canonical_media_id,outcome,details) values(p_run_id,p.id,p.table_name,p.row_id,p.external_source,p.external_id,p.canonical_media_id,'conflict','{"reason":"concurrent unique constraint conflict; row untouched"}'); return 'conflict';
 end;
 if v_updated > 0 then insert into canonical_media_backfill_audit(run_id,plan_id,table_name,row_id,external_source,external_id,canonical_media_id,outcome,details) values(p_run_id,p.id,p.table_name,p.row_id,p.external_source,p.external_id,p.canonical_media_id,'linked','{"verified":"tuple, owner/list snapshot, null link, and alias; only canonical_media_id assigned"}'); return 'linked'; end if;
 insert into canonical_media_backfill_audit(run_id,plan_id,table_name,row_id,external_source,external_id,canonical_media_id,outcome,details) values(p_run_id,p.id,p.table_name,p.row_id,p.external_source,p.external_id,p.canonical_media_id,'skipped','{"reason":"historical row changed or was already linked"}'); return 'skipped';
end $$;

revoke all on function public.prevent_canonical_media_backfill_log_mutation(),public.claim_canonical_media_backfill_lease(uuid,integer),public.heartbeat_canonical_media_backfill_lease(uuid,bigint,integer),public.release_canonical_media_backfill_lease(uuid,bigint),public.list_canonical_media_backfill_candidates(text,text,integer),public.plan_canonical_media_backfill_tuple(uuid,uuid,bigint,text,text,uuid),public.apply_canonical_media_backfill_plan_row(uuid,bigint,uuid,bigint) from public,anon,authenticated;
grant execute on function public.claim_canonical_media_backfill_lease(uuid,integer),public.heartbeat_canonical_media_backfill_lease(uuid,bigint,integer),public.release_canonical_media_backfill_lease(uuid,bigint),public.list_canonical_media_backfill_candidates(text,text,integer),public.plan_canonical_media_backfill_tuple(uuid,uuid,bigint,text,text,uuid),public.apply_canonical_media_backfill_plan_row(uuid,bigint,uuid,bigint) to service_role;