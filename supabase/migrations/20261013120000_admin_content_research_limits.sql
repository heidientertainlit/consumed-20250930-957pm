-- Operational counters only; no research history or personal recommendation data.
create table if not exists public.admin_content_research_limits (
  admin_id uuid not null,
  action text not null check (action in ('search', 'trending', 'generate')),
  window_start timestamptz not null,
  requests integer not null,
  primary key (admin_id, action)
);
alter table public.admin_content_research_limits enable row level security;
revoke all on public.admin_content_research_limits from public, anon, authenticated;

create or replace function public.consume_admin_content_research_limit(p_admin_id uuid, p_action text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare n integer; cap integer;
begin
  if p_action not in ('search', 'trending', 'generate') then return false; end if;
  if not exists (select 1 from public.users where id = p_admin_id and is_admin = true) then return false; end if;
  cap := case when p_action = 'generate' then 10 when p_action = 'trending' then 20 else 60 end;
  insert into public.admin_content_research_limits as l (admin_id, action, window_start, requests)
  values (p_admin_id, p_action, date_trunc('hour', now()), 1)
  on conflict (admin_id, action) do update
  set requests = case when l.window_start < date_trunc('hour', now()) then 1 else l.requests + 1 end,
      window_start = date_trunc('hour', now())
  returning requests into n;
  return n <= cap;
end;
$$;
revoke all on function public.consume_admin_content_research_limit(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_admin_content_research_limit(uuid, text) to service_role;
