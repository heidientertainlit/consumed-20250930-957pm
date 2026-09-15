-- Private operational alerts for completed user blocks.  The alert deliberately
-- stores only its source block row: it must not become another public identity
-- or moderation-data surface.
create table public.admin_block_alerts (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null unique references public.user_blocks(id) on delete cascade,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.users(id) on delete set null,
  constraint admin_block_alerts_acknowledgement_consistency check (
    (acknowledged_at is null and acknowledged_by is null)
    or acknowledged_at is not null
  )
);

comment on table public.admin_block_alerts is
  'Private service-only operational alerts emitted for successful user blocks.';

alter table public.admin_block_alerts enable row level security;

-- There are intentionally no RLS policies.  Browser roles cannot read, create,
-- acknowledge, or otherwise probe block events; the Edge Function uses the
-- service role only after authoritative users.is_admin authorization.
revoke all on table public.admin_block_alerts from public, anon, authenticated;
grant select, insert, update on table public.admin_block_alerts to service_role;

create function public.create_admin_block_alert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  -- This is an AFTER trigger, so the pair-locked friendship cleanup and all
  -- user_blocks constraints have succeeded first.  A failure here aborts the
  -- same transaction and cannot leave an alert for an unsuccessful block.
  insert into public.admin_block_alerts (block_id)
  values (new.id)
  on conflict (block_id) do nothing;

  return new;
end;
$$;

revoke all on function public.create_admin_block_alert() from public, anon, authenticated;

create trigger create_admin_block_alert_after_insert
after insert on public.user_blocks
for each row execute function public.create_admin_block_alert();

notify pgrst, 'reload schema';