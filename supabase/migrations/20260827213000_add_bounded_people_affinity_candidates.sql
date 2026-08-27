-- Maintain the 10-item eligibility input incrementally so Match pagination
-- never aggregates the global list_items table at request time.
create table if not exists public.people_affinity_eligibility (
  user_id uuid primary key references public.users(id) on delete cascade,
  tracked_items integer not null default 0 check (tracked_items >= 0),
  updated_at timestamptz not null default now()
);

insert into public.people_affinity_eligibility (user_id, tracked_items, updated_at)
select li.user_id, count(*)::integer, now()
from public.list_items li
where li.user_id is not null
group by li.user_id
on conflict (user_id) do update
set tracked_items = excluded.tracked_items,
    updated_at = excluded.updated_at;

create index if not exists people_affinity_eligibility_ready_idx
  on public.people_affinity_eligibility(tracked_items, user_id)
  where tracked_items >= 10;

alter table public.people_affinity_eligibility enable row level security;
revoke all on public.people_affinity_eligibility from anon, authenticated;

create or replace function public.sync_people_affinity_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.user_id is not null then
      insert into public.people_affinity_eligibility(user_id, tracked_items, updated_at)
      values (new.user_id, 1, now())
      on conflict (user_id) do update
      set tracked_items = public.people_affinity_eligibility.tracked_items + 1,
          updated_at = now();
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.user_id is not null then
      update public.people_affinity_eligibility
      set tracked_items = greatest(0, tracked_items - 1),
          updated_at = now()
      where user_id = old.user_id;
    end if;
    return old;
  end if;

  if old.user_id is distinct from new.user_id then
    if old.user_id is not null then
      update public.people_affinity_eligibility
      set tracked_items = greatest(0, tracked_items - 1),
          updated_at = now()
      where user_id = old.user_id;
    end if;
    if new.user_id is not null then
      insert into public.people_affinity_eligibility(user_id, tracked_items, updated_at)
      values (new.user_id, 1, now())
      on conflict (user_id) do update
      set tracked_items = public.people_affinity_eligibility.tracked_items + 1,
          updated_at = now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_people_affinity_eligibility_on_list_items on public.list_items;
create trigger sync_people_affinity_eligibility_on_list_items
after insert or delete or update of user_id on public.list_items
for each row execute function public.sync_people_affinity_eligibility();

revoke all on function public.sync_people_affinity_eligibility() from public, anon, authenticated;

-- Bounded, stable candidate pagination for People Matches. The edge function
-- remains responsible for scoring; the database owns eligibility and privacy.
create or replace function public.get_people_affinity_candidates(
  p_user_id uuid,
  p_after_friend boolean default null,
  p_after_id uuid default null,
  p_limit integer default 25
)
returns table (
  id uuid,
  user_name text,
  display_name text,
  first_name text,
  last_name text,
  avatar text,
  profile_label text,
  profile_tagline text,
  is_friend boolean,
  tracked_items bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with accepted_friends as (
    select distinct case when f.user_id = p_user_id then f.friend_id else f.user_id end as friend_id
    from public.friendships f
    where f.status = 'accepted'
      and (f.user_id = p_user_id or f.friend_id = p_user_id)
  ),
  blocked_users as (
    select case when b.blocker_id = p_user_id then b.blocked_id else b.blocker_id end as blocked_id
    from public.user_blocks b
    where b.blocker_id = p_user_id or b.blocked_id = p_user_id
  ),
  candidates as (
    select
      u.id,
      u.user_name,
      u.display_name,
      u.first_name,
      u.last_name,
      u.avatar,
      dp.label as profile_label,
      dp.tagline as profile_tagline,
      (af.friend_id is not null) as is_friend,
      eligibility.tracked_items::bigint
    from public.users u
    join public.dna_profiles dp on dp.user_id = u.id
    join public.people_affinity_eligibility eligibility
      on eligibility.user_id = u.id and eligibility.tracked_items >= 10
    left join accepted_friends af on af.friend_id = u.id
    where u.id <> p_user_id
      and coalesce(u.is_persona, false) = false
      and (af.friend_id is not null or coalesce(u.people_discoverable, true) = true)
      and not exists (select 1 from blocked_users bu where bu.blocked_id = u.id)
      and (coalesce(dp.is_private, false) = false or af.friend_id is not null)
  )
  select c.*
  from candidates c
  where p_after_id is null
     or (p_after_friend = true and c.is_friend = false)
     or (c.is_friend = p_after_friend and c.id > p_after_id)
  order by c.is_friend desc, c.id
  limit least(greatest(coalesce(p_limit, 25), 1), 51);
$$;

revoke all on function public.get_people_affinity_candidates(uuid, boolean, uuid, integer) from public, anon, authenticated;
grant execute on function public.get_people_affinity_candidates(uuid, boolean, uuid, integer) to service_role;