-- Consumer-only cache and spend guard. No changes to canonical media, search,
-- personal recommendations, fingerprints, or private Recommendation Lab tables.
-- Prepared locally; applying this migration requires separate owner approval.
create table public.media_similarity_entries (
  kind text not null check (kind in ('result','profile')),
  cache_key text not null check (char_length(cache_key) between 1 and 600),
  media_type text not null check (media_type in ('movie','tv','book','music','podcast','youtube')),
  payload jsonb not null default '{}' check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 262144),
  refreshed_at timestamptz,
  refresh_after timestamptz,
  retry_after timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  actor uuid,
  budget_day date,
  reservation numeric(12,6) not null default 0 check (reservation >= 0),
  updated_at timestamptz not null default now(),
  primary key (kind, cache_key)
);
create index media_similarity_pool_idx on public.media_similarity_entries (media_type, updated_at desc) where kind = 'profile';
create index media_similarity_actor_idx on public.media_similarity_entries (actor, updated_at desc) where kind = 'result';
create table public.media_similarity_daily_spend (
  day date primary key,
  spent numeric(12,6) not null default 0 check (spent >= 0),
  reserved numeric(12,6) not null default 0 check (reserved >= 0)
);
alter table public.media_similarity_entries enable row level security;
alter table public.media_similarity_daily_spend enable row level security;
revoke all on public.media_similarity_entries, public.media_similarity_daily_spend from public, anon, authenticated, service_role;

-- No browser grants. Only the independently authenticated Edge Function can
-- claim leases, store verified results/profiles, or settle reservations.
create function public.media_similarity_store(p_action text, p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  r public.media_similarity_entries;
  budget public.media_similarity_daily_spend;
  k text := p_payload->>'key';
  today date := (now() at time zone 'UTC')::date;
  cap numeric := 1; -- USD/day for this feature, not an additional per-user cap.
  charge numeric;
  result_items jsonb;
  acceptable boolean;
begin
  if p_action = 'pool' then
    return coalesce((
      select jsonb_agg(candidate.payload) from
      unnest(array['movie','tv','book','music','podcast','youtube']) t(media_type)
      cross join lateral (
        select e.payload from public.media_similarity_entries e
        where e.kind='profile' and e.media_type=t.media_type
          and e.refresh_after > now()
        order by e.updated_at desc limit 8
      ) candidate
    ), '[]'::jsonb);
  end if;
  if k is null or char_length(k) not between 1 and 600 then
    raise exception 'Invalid cache key';
  end if;
  if p_action = 'profile' then
    select * into r from public.media_similarity_entries
      where kind='profile' and cache_key=k and refresh_after > now();
    return case when found then r.payload else null end;
  elsif p_action = 'save_profile' then
    if p_payload->'work'->>'source_verified' is distinct from 'true'
      or not coalesce(p_payload->'work'->>'status' in ('verified','profiled','embedded'),false) then
      raise exception 'A verified work profile is required';
    end if;
    insert into public.media_similarity_entries(kind,cache_key,media_type,payload,refreshed_at,refresh_after)
      values ('profile',k,p_payload->'identity'->>'type',p_payload->'work',now(),now()+interval '90 days')
      on conflict (kind,cache_key) do update set payload=excluded.payload,
        refreshed_at=excluded.refreshed_at,refresh_after=excluded.refresh_after,updated_at=now();
    return '{}'::jsonb;
  elsif p_action = 'read' then
    select * into r from public.media_similarity_entries where kind='result' and cache_key=k;
    return jsonb_build_object('items',coalesce(r.payload->'items','[]'::jsonb),
      'fresh',coalesce(r.refresh_after > now(),false));
  elsif p_action = 'claim' then
    insert into public.media_similarity_entries(kind,cache_key,media_type)
      values ('result',k,p_payload->'identity'->>'type') on conflict do nothing;
    select * into r from public.media_similarity_entries where kind='result' and cache_key=k for update;
    if r.refresh_after > now() or r.retry_after > now() then return '{}'::jsonb; end if;
    if r.lease_until > now() then return '{"preparing":true}'::jsonb; end if;
    if (select count(*) from public.media_similarity_entries
        where kind='result' and actor=(p_payload->>'actor')::uuid
          and updated_at >= date_trunc('day',now())) >= 10 then return '{}'::jsonb; end if;
    -- An abandoned/expired worker may have been billed. Charge its full
    -- reservation conservatively before allowing a new worker.
    if r.reservation > 0 then
      update public.media_similarity_daily_spend
        set reserved=greatest(0,reserved-r.reservation),spent=spent+r.reservation
        where day=r.budget_day;
      update public.media_similarity_entries set reservation=0 where kind='result' and cache_key=k;
    end if;
    insert into public.media_similarity_daily_spend(day) values (today) on conflict do nothing;
    select * into budget from public.media_similarity_daily_spend where day=today for update;
    if budget.spent+budget.reserved+0.25 > cap then return '{}'::jsonb; end if;
    update public.media_similarity_daily_spend set reserved=reserved+0.25 where day=today;
    update public.media_similarity_entries set lease_token=gen_random_uuid(),
      lease_until=now()+interval '5 minutes',actor=(p_payload->>'actor')::uuid,
      budget_day=today,reservation=0.25,updated_at=now()
      where kind='result' and cache_key=k returning * into r;
    return jsonb_build_object('token',r.lease_token);
  elsif p_action = 'finish' then
    select * into r from public.media_similarity_entries where kind='result' and cache_key=k for update;
    if not found or r.lease_token is distinct from (p_payload->>'token')::uuid then
      return '{"superseded":true}'::jsonb;
    end if;
    charge := (p_payload->>'cost')::numeric;
    if charge is null or charge < 0 or charge > r.reservation then raise exception 'Invalid cost settlement'; end if;
    result_items := p_payload->'items';
    if jsonb_typeof(result_items) is distinct from 'array' or jsonb_array_length(result_items) > 8 then
      raise exception 'Invalid result cards';
    end if;
    -- Do not replace useful stale results with an empty or depleted batch.
    acceptable := jsonb_array_length(result_items) >= greatest(2,least(4,jsonb_array_length(coalesce(r.payload->'items','[]'::jsonb))));
    update public.media_similarity_daily_spend set reserved=greatest(0,reserved-r.reservation),
      spent=spent+charge where day=r.budget_day;
    update public.media_similarity_entries set
      payload=case when acceptable then jsonb_build_object('items',result_items) else payload end,
      refreshed_at=case when acceptable then now() else refreshed_at end,
      refresh_after=case when acceptable then now()+interval '7 days' else refresh_after end,
      retry_after=case when acceptable then null else now()+interval '6 hours' end,
      lease_token=null,lease_until=null,reservation=0,updated_at=now()
      where kind='result' and cache_key=k;
    return jsonb_build_object('published',acceptable);
  end if;
  raise exception 'Unsupported similarity store action';
end;
$$;
revoke all on function public.media_similarity_store(text,jsonb) from public, anon, authenticated;
grant execute on function public.media_similarity_store(text,jsonb) to service_role;
