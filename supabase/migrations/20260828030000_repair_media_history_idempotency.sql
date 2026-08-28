-- Repair for the already-deployed media history migration. Move receipts make
-- client retries durable even after the source item was deleted as a duplicate.
create table if not exists public.media_move_request_receipts (
  user_id uuid not null references public.users(id) on delete cascade,
  client_event_id uuid not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, client_event_id)
);

alter table public.media_move_request_receipts enable row level security;
revoke all on public.media_move_request_receipts from anon, authenticated;

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
  v_effective_total integer;
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

  if p_client_event_id is not null and exists (
    select 1 from public.media_progress_events
    where user_id = auth.uid() and client_event_id = p_client_event_id
  ) then
    return v_item;
  end if;

  v_mode := coalesce(p_progress_mode, v_item.progress_mode, 'percent');
  v_effective_total := coalesce(p_total, v_item.total);
  if v_mode not in ('percent', 'page', 'episode', 'track')
     or p_progress < 0
     or (v_mode = 'percent' and p_progress > 100)
     or (p_total is not null and p_total < 0)
     -- TV stores episode progress with season number in total, so episode mode
     -- deliberately has no progress-vs-total comparison.
     or (v_mode in ('page', 'track') and v_effective_total > 0 and p_progress > v_effective_total) then
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
    list_item_id, user_id, event_type, previous_progress, previous_total,
    progress, total, progress_mode, media_type, media_title,
    media_external_id, media_external_source, client_event_id
  )
  values (
    v_item.id, v_item.user_id, 'progress_updated', v_previous_progress, v_previous_total,
    v_item.progress, v_item.total, v_item.progress_mode, v_item.media_type, v_item.title,
    v_item.external_id, v_item.external_source, p_client_event_id
  );
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
  v_response jsonb;
begin
  if p_client_event_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(auth.uid()::text || ':move:' || p_client_event_id::text, 0)
    );
    select result into v_response
    from public.media_move_request_receipts
    where user_id = auth.uid() and client_event_id = p_client_event_id;
    if found then
      return v_response;
    end if;
  end if;

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
    v_response := jsonb_build_object('already_in_target', true, 'data', to_jsonb(v_item));
  else
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
        where id = v_duplicate.id;
      end if;
      delete from public.list_items where id = v_item.id;
      v_response := jsonb_build_object('deleted', true, 'message', 'Duplicate removed, item exists in target list');
    else
      update public.list_items
      set list_id = p_target_list_id,
          progress = case when p_mark_completed then 100 else 0 end,
          progress_mode = 'percent',
          completed_at = case when p_mark_completed then coalesce(completed_at, now()) else completed_at end
      where id = v_item.id
      returning * into v_result;
      v_response := jsonb_build_object('data', to_jsonb(v_result));
    end if;
  end if;

  if p_client_event_id is not null then
    insert into public.media_move_request_receipts (user_id, client_event_id, result)
    values (auth.uid(), p_client_event_id, v_response);
  end if;
  return v_response;
end;
$$;

revoke all on function public.record_list_item_progress(uuid, integer, integer, text, uuid) from public, anon;
revoke all on function public.move_list_item_with_completion(uuid, uuid, boolean, uuid) from public, anon;
grant execute on function public.record_list_item_progress(uuid, integer, integer, text, uuid) to authenticated;
grant execute on function public.move_list_item_with_completion(uuid, uuid, boolean, uuid) to authenticated;