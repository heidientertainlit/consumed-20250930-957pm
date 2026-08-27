-- Replace fixed, genre-based groups with person-to-person affinity.
drop function if exists public.get_people_tribes_summary(integer);
drop function if exists public.refresh_people_tribe_memberships(uuid);
drop table if exists public.people_tribe_interests cascade;
drop table if exists public.people_tribe_members cascade;
drop table if exists public.people_tribes cascade;

-- This is intentionally separate from profile/list visibility: it controls whether
-- someone may be surfaced as a non-friend in People affinity discovery.
alter table public.users
  add column if not exists people_discoverable boolean not null default true;