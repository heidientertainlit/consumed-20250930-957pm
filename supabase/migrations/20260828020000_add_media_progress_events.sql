-- Progress history is append-only and is written through the RPCs below.  A
-- snapshot on list_items remains for backwards-compatible list rendering.
alter table public.list_items
  add column if not exists completed_at timestamptz;

create index if not exists list_items_user_completed_at_idx
  on public.list_items (user_id, completed_at desc)
  where completed_at is not null;

create table if not exists public.media_progress_events (
  id uuid primary key default gen_random_uuid(),
  -- Keep history when an item is removed because it was duplicated in another list.
  list_item_id uuid references public.list_items(id) on delete set null,
  user_id uuid not null references public.users(id) on delete cascade,
  event_type text not null check (event_type in ('progress_updated', 'completed')),
  previous_progress integer check (previous_progress is null or previous_progress >= 0),
  previous_total integer check (previous_total is null or previous_total >= 0),
  progress integer not null check (progress >= 0),
  total integer check (total is null or total >= 0),
  progress_mode text not null check (progress_mode in ('percent', 'page', 'episode', 'track')),
  media_type text,
  media_title text,
  media_external_id text,
  media_external_source text,
  occurred_at timestamptz not null default now(),
  -- Clients should reuse this UUID when retrying a request.
  client_event_id uuid,
  created_at timestamptz not null default now(),
  check (progress_mode <> 'percent' or progress <= 100)
);

create unique index if not exists media_progress_events_user_client_event_idx
  on public.media_progress_events (user_id, client_event_id)
  where client_event_id is not null;

create index if not exists media_progress_events_user_occurred_at_idx
  on public.media_progress_events (user_id, occurred_at desc);

create index if not exists media_progress_events_user_identity_idx
  on public.media_progress_events (user_id, media_external_source, media_external_id);

alter table public.media_progress_events enable row level security;
revoke all on public.media_progress_events from anon, authenticated;
grant select on public.media_progress_events to authenticated;

drop policy if exists "Users can read their own media progress events" on public.media_progress_events;
create policy "Users can read their own media progress events"
  on public.media_progress_events for select to authenticated
  using (user_id = auth.uid());

create or replace function public.record_list_item_progress(
  p_item_id uuid,
  p_progress integer,
  p_total integer default null,
  p_progress_mode text default null,
  p_client_event_id uuid default null
)
returns public.list_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.list_items;
  v_mode text;
  v_previous_progress integer;
  v_previous_total integer;
begin
  if p_client_event_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(auth.uid()::text || ':' || p_client_event_id::text, 0)
    );
  end if;

  select * into v_item
  from public.list_items
  where id = p_item_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'List item not found' using errcode = 'P0002';
  end if;

  -- A retry must not overwrite a newer progress update. The partial unique
  -- index makes this check and the eventual insert safe under concurrency.
  if p_client_event_id is not null and exists (
    select 1
    from public.media_progress_events
    where user_id = auth.uid() and client_event_id = p_client_event_id
  ) then
    return v_item;
  end if;

  v_mode := coalesce(p_progress_mode, v_item.progress_mode, 'percent');
  if v_mode not in ('percent', 'page', 'episode', 'track')
     or p_progress < 0
     or (v_mode = 'percent' and p_progress > 100)
     or (p_total is not null and p_total < 0) then
    raise exception 'Invalid progress values' using errcode = '22023';
  end if;

  v_previous_progress := v_item.progress;
  v_previous_total := v_item.total;
  update public.list_items
  set progress = p_progress,
      total = coalesce(p_total, v_item.total),
      progress_mode = v_mode
  where id = v_item.id
  returning * into v_item;

  insert into public.media_progress_events (
    list_item_id, user_id, event_type, previous_progress, previous_total, progress, total, progress_mode,
    media_type, media_title, media_external_id, media_external_source, client_event_id
  )
  values (
    v_item.id, v_item.user_id, 'progress_updated', v_previous_progress, v_previous_total,
    v_item.progress, v_item.total, v_item.progress_mode,
    v_item.media_type, v_item.title, v_item.external_id, v_item.external_source, p_client_event_id
  )
  on conflict (user_id, client_event_id) where client_event_id is not null do nothing;

  return v_item;
end;
$$;

create or replace function public.move_list_item_with_completion(
  p_item_id uuid,
  p_target_list_id uuid,
  p_mark_completed boolean default false,
  p_client_event_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.list_items;
  v_duplicate public.list_items;
  v_result public.list_items;
begin
  select * into v_item
  from public.list_items
  where id = p_item_id and user_id = auth.uid()
  for update;
  if not found then
    raise exception 'List item not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.lists where id = p_target_list_id and user_id = auth.uid()
  ) then
    raise exception 'Target list not found' using errcode = 'P0002';
  end if;

  if v_item.list_id = p_target_list_id then
    return jsonb_build_object('already_in_target', true, 'data', to_jsonb(v_item));
  end if;

  select * into v_duplicate
  from public.list_items
  where list_id = p_target_list_id
    and user_id = auth.uid()
    and external_id is not distinct from v_item.external_id
    and external_source is not distinct from v_item.external_source
  limit 1
  for update;

  if found then
    if p_mark_completed then
      update public.list_items
      set progress = 100, progress_mode = 'percent', completed_at = coalesce(completed_at, now())
      where id = v_duplicate.id
      returning * into v_result;
    end if;

    delete from public.list_items where id = v_item.id;
    return jsonb_build_object('deleted', true, 'message', 'Duplicate removed, item exists in target list');
  end if;

  update public.list_items
  set list_id = p_target_list_id,
      progress = case when p_mark_completed then 100 else 0 end,
      progress_mode = 'percent',
      completed_at = case when p_mark_completed then coalesce(completed_at, now()) else completed_at end
  where id = v_item.id
  returning * into v_result;

  return jsonb_build_object('data', to_jsonb(v_result));
end;
$$;

-- Completion belongs in the database so imports, admin tools, and direct
-- updates receive the same authoritative history as the Edge Function.
create or replace function public.prepare_list_item_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_is_finished boolean;
begin
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
    -- Never permit a Finished item to lose its completion timestamp.  This
    -- also covers direct UPDATE list_id calls that do not use an Edge Function.
    new.completed_at := coalesce(new.completed_at, case when tg_op = 'UPDATE' then old.completed_at end, now());
    if tg_op = 'INSERT' or old.list_id is distinct from new.list_id then
      new.progress := 100;
      new.progress_mode := 'percent';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.record_list_item_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.completed_at is not null
     and (tg_op = 'INSERT' or old.completed_at is null) then
    insert into public.media_progress_events (
      list_item_id, user_id, event_type, previous_progress, previous_total,
      progress, total, progress_mode, media_type, media_title,
      media_external_id, media_external_source, occurred_at
    )
    values (
      new.id, new.user_id, 'completed',
      case when tg_op = 'INSERT' then null else old.progress end,
      case when tg_op = 'INSERT' then null else old.total end,
      new.progress, new.total, new.progress_mode, new.media_type, new.title,
      new.external_id, new.external_source, new.completed_at
    );
  end if;
  return new;
end;
$$;

drop trigger if exists prepare_list_item_completion_on_write on public.list_items;
create trigger prepare_list_item_completion_on_write
  before insert or update on public.list_items
  for each row execute function public.prepare_list_item_completion();

drop trigger if exists record_list_item_completion_on_write on public.list_items;
create trigger record_list_item_completion_on_write
  after insert or update on public.list_items
  for each row execute function public.record_list_item_completion();

revoke all on function public.record_list_item_progress(uuid, integer, integer, text, uuid) from public, anon;
revoke all on function public.move_list_item_with_completion(uuid, uuid, boolean, uuid) from public, anon;
revoke all on function public.prepare_list_item_completion() from public, anon, authenticated;
revoke all on function public.record_list_item_completion() from public, anon, authenticated;
grant execute on function public.record_list_item_progress(uuid, integer, integer, text, uuid) to authenticated;
grant execute on function public.move_list_item_with_completion(uuid, uuid, boolean, uuid) to authenticated;