-- dna_profiles contains a member's complete entertainment profile.  Keep the
-- pre-existing owner write policies intact, but make every direct read require
-- the caller to be that member or an unblocked accepted friend.

alter table public.dna_profiles enable row level security;

create or replace function public.can_read_dna_profile(
  p_profile_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with viewer as (
    select auth.uid() as id
  )
  select
    viewer.id is not null
    and (
      viewer.id = p_profile_user_id
      or (
        exists (
          select 1
          from public.friendships as friendship
          where friendship.status = 'accepted'
            and (
              (friendship.user_id = viewer.id and friendship.friend_id = p_profile_user_id)
              or (friendship.friend_id = viewer.id and friendship.user_id = p_profile_user_id)
            )
        )
        and not exists (
          select 1
          from public.user_blocks as block
          where (block.blocker_id = viewer.id and block.blocked_id = p_profile_user_id)
             or (block.blocker_id = p_profile_user_id and block.blocked_id = viewer.id)
        )
      )
    )
  from viewer;
$$;

-- Do not leave the default PUBLIC EXECUTE grant on a SECURITY DEFINER helper.
-- It has no caller-supplied viewer argument; the only allowed caller identity
-- is auth.uid().
revoke all on function public.can_read_dna_profile(uuid)
from public, anon, authenticated;
grant execute on function public.can_read_dna_profile(uuid) to authenticated;

-- The old permissive "Enable read access for all users" policy is intentionally
-- not assumed to have a particular name or owner.  Restrictive policies are
-- ANDed with it, so its USING (true) clause cannot expose a profile.
create policy "dna_profiles_authenticated_self_or_unblocked_friend"
on public.dna_profiles
as restrictive
for select
to authenticated
using (public.can_read_dna_profile(user_id));

-- Keep anonymous SELECT requests rowless rather than relying on a missing
-- table grant or on the authenticated policy not applying to anon.
create policy "dna_profiles_anonymous_reads_denied"
on public.dna_profiles
as restrictive
for select
to anon
using (false);

notify pgrst, 'reload schema';
