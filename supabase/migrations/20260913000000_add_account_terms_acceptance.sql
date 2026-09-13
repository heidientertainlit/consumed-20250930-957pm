-- Keep legal acceptance separate from the user profile.  The client can read
-- its own row, but the only write path is the server-owned RPC below.
begin;

create table if not exists public.account_terms_acceptances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default timezone('utc', now()),
  constraint account_terms_acceptances_terms_version_not_blank
    check (btrim(terms_version) <> '')
);

alter table public.account_terms_acceptances enable row level security;

revoke all on table public.account_terms_acceptances from anon, authenticated;
grant select on table public.account_terms_acceptances to authenticated;

drop policy if exists "account_terms_acceptances_owner_select"
  on public.account_terms_acceptances;
create policy "account_terms_acceptances_owner_select"
  on public.account_terms_acceptances
  for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.accept_current_terms(p_terms_version text)
returns table (terms_version text, accepted_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required to accept the Terms of Service';
  end if;

  -- This value is intentionally validated on the server.  A client supplied
  -- version must never be treated as proof that the current terms were shown.
  if p_terms_version is distinct from '2026-09-13' then
    raise exception using
      errcode = '22023',
      message = 'The requested terms version is not current';
  end if;

  insert into public.account_terms_acceptances (user_id, terms_version, accepted_at)
  values (v_user_id, '2026-09-13', timezone('utc', now()))
  on conflict (user_id) do update
    set terms_version = excluded.terms_version,
        accepted_at = excluded.accepted_at;

  return query
    select a.terms_version, a.accepted_at
    from public.account_terms_acceptances as a
    where a.user_id = v_user_id;
end;
$$;

revoke all on function public.accept_current_terms(text) from public, anon, authenticated;
grant execute on function public.accept_current_terms(text) to authenticated;

commit;