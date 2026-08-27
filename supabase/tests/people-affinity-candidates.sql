begin;

do $$
declare
  viewer_id uuid;
  target_id uuid;
  target_visible boolean;
begin
  select f.user_id, f.friend_id
  into viewer_id, target_id
  from public.friendships f
  join public.people_affinity_eligibility eligibility
    on eligibility.user_id = f.friend_id and eligibility.tracked_items >= 10
  join public.dna_profiles dp on dp.user_id = f.friend_id
  join public.users u on u.id = f.friend_id and coalesce(u.is_persona, false) = false
  where f.status = 'accepted'
    and not exists (
      select 1
      from public.user_blocks b
      where (b.blocker_id = f.user_id and b.blocked_id = f.friend_id)
         or (b.blocker_id = f.friend_id and b.blocked_id = f.user_id)
    )
  limit 1;

  if viewer_id is null or target_id is null then
    raise exception 'Test requires one eligible accepted friendship';
  end if;

  update public.users
  set people_discoverable = false
  where id = target_id;

  update public.dna_profiles
  set is_private = true
  where user_id = target_id;

  select exists (
    select 1
    from public.get_people_affinity_candidates(viewer_id, null, null, 51) candidate
    where candidate.id = target_id and candidate.is_friend
  )
  into target_visible;

  if not target_visible then
    raise exception 'Private, non-discoverable accepted friend was omitted from Match candidates';
  end if;
end;
$$;

rollback;