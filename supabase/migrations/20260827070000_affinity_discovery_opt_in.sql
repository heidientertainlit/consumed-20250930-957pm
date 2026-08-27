-- Discovery now requires an affirmative user choice. Existing accounts have
-- never seen an opt-in control, so none are treated as having consented.
alter table public.users
  alter column people_discoverable set default false;

update public.users
set people_discoverable = false
where people_discoverable is distinct from false;