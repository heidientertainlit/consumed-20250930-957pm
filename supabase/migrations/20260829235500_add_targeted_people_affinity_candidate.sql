create or replace function public.get_people_affinity_candidate(
  p_user_id uuid,
  p_candidate_id uuid
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
  with accepted_friend as (
    select true as is_friend
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.user_id = p_user_id and f.friend_id = p_candidate_id)
        or (f.user_id = p_candidate_id and f.friend_id = p_user_id)
      )
    limit 1
  )
  select
    u.id,
    u.user_name,
    u.display_name,
    u.first_name,
    u.last_name,
    u.avatar,
    dp.label as profile_label,
    dp.tagline as profile_tagline,
    coalesce(af.is_friend, false) as is_friend,
    eligibility.tracked_items::bigint
  from public.users u
  join public.dna_profiles dp on dp.user_id = u.id
  join public.people_affinity_eligibility eligibility
    on eligibility.user_id = u.id and eligibility.tracked_items >= 10
  left join accepted_friend af on true
  where u.id = p_candidate_id
    and u.id <> p_user_id
    and coalesce(u.is_persona, false) = false
    and (coalesce(af.is_friend, false) or coalesce(u.people_discoverable, true) = true)
    and (coalesce(dp.is_private, false) = false or coalesce(af.is_friend, false))
    and not exists (
      select 1
      from public.user_blocks b
      where (b.blocker_id = p_user_id and b.blocked_id = p_candidate_id)
         or (b.blocker_id = p_candidate_id and b.blocked_id = p_user_id)
    );
$$;

revoke all on function public.get_people_affinity_candidate(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_people_affinity_candidate(uuid, uuid) to service_role;