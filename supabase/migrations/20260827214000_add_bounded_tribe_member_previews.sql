-- Return only privacy-safe counts and capped previews. This prevents the Tribe
-- edge function from materializing an unbounded membership population.
create or replace function public.get_people_tribe_member_previews(
  p_user_id uuid,
  p_tribe_ids uuid[]
)
returns table (
  tribe_id uuid,
  member_count bigint,
  members jsonb
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
  visible_members as (
    select
      m.tribe_id,
      m.user_id,
      m.joined_at,
      u.user_name,
      u.display_name,
      u.first_name,
      u.last_name,
      u.avatar,
      row_number() over (partition by m.tribe_id order by m.joined_at desc, m.user_id) as preview_rank
    from public.people_tribe_members m
    join public.users u on u.id = m.user_id and coalesce(u.is_persona, false) = false
    join public.dna_profiles dp on dp.user_id = m.user_id
    left join accepted_friends af on af.friend_id = m.user_id
    where m.status = 'active'
      and m.tribe_id = any(coalesce(p_tribe_ids, '{}'::uuid[]))
      and not exists (select 1 from blocked_users bu where bu.blocked_id = m.user_id)
      and (m.user_id = p_user_id or af.friend_id is not null or coalesce(dp.is_private, false) = false)
  )
  select
    vm.tribe_id,
    count(*)::bigint as member_count,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', vm.user_id,
          'user_name', vm.user_name,
          'display_name', vm.display_name,
          'first_name', vm.first_name,
          'last_name', vm.last_name,
          'avatar_url', vm.avatar
        )
        order by vm.joined_at desc, vm.user_id
      ) filter (where vm.preview_rank <= 8),
      '[]'::jsonb
    ) as members
  from visible_members vm
  group by vm.tribe_id;
$$;

revoke all on function public.get_people_tribe_member_previews(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.get_people_tribe_member_previews(uuid, uuid[]) to service_role;