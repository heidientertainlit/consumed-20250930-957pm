-- FUTURE MANUAL MIGRATION CHECKLIST -- DO NOT APPLY WITH CURRENT MIGRATIONS.
--
-- Apply only after the released app reads public identities from
-- public.public_user_profiles, account data from get_my_account_profile(), and
-- admin data from public.admin_user_profiles.
--
-- Before applying:
--   1. Confirm the new app release is fully rolled out.
--   2. Confirm no supported client reads public.users directly.
--   3. Use the project's isolated migration apply process and dry-run it.
--
-- Column grants currently enforce the safety boundary while the temporary RLS
-- policy permits legacy public-identity reads. Retire both together.

begin;

revoke all privileges on table public.users
from public, anon, authenticated;

drop policy if exists "Temporary legacy public identity read" on public.users;

commit;