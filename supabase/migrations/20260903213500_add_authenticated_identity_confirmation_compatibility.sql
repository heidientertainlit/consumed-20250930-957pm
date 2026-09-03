-- Temporary published-client compatibility:
-- the current production frontend reads this owner state directly after login.
-- Keep anonymous access denied and remove this grant with the six-column bridge
-- after the RPC-based client is live.
revoke select (identity_confirmed_at) on table public.users
from public, anon;

grant select (identity_confirmed_at) on table public.users
to authenticated;

comment on column public.users.identity_confirmed_at is
  'Temporary authenticated-client compatibility grant for the published post-login identity query. Remove after the RPC-based client rollout.';

notify pgrst, 'reload schema';