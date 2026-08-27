-- Affinity discovery is automatic for eligible profiles. Private profiles and
-- blocked relationships remain excluded by the people-affinity function.
alter table public.users
  alter column people_discoverable set default true;

update public.users
set people_discoverable = true
where people_discoverable is distinct from true;