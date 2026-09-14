-- Raw DNA signals are evidence used to build a member's Entertainment DNA.
-- Keep owner access and the existing service-role write path, but do not let
-- authenticated callers read every member's underlying signals.

drop policy if exists "Authenticated users can view DNA signals"
on public.user_dna_signals;

-- Replace the old owner-only permissive policy with the helper-backed
-- owner-or-friend policy.  It remains permissive because PostgreSQL combines
-- permissive SELECT policies with OR; a restrictive policy alongside the old
-- owner policy would still hide accepted friends.
drop policy if exists "Users can view own DNA signals"
on public.user_dna_signals;

drop policy if exists "user_dna_signals_authenticated_self_or_unblocked_friend"
on public.user_dna_signals;

create policy "user_dna_signals_authenticated_self_or_unblocked_friend"
on public.user_dna_signals
as permissive
for select
to authenticated
using (public.can_read_dna_profile(user_id));

-- Keep direct REST reads anonymous-safe even though the table's legacy
-- grants/policies include PUBLIC.
drop policy if exists "user_dna_signals_anonymous_reads_denied"
on public.user_dna_signals;

create policy "user_dna_signals_anonymous_reads_denied"
on public.user_dna_signals
as restrictive
for select
to anon
using (false);

-- Do not change the INSERT/UPDATE policies or the existing service-role
-- policy: signal extraction and discovery scoring write through service_role.
notify pgrst, 'reload schema';