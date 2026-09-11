-- Allow authenticated viewers to hydrate only the blocks they created.
-- Block mutations remain owned by the existing service-backed edge function.
create policy "user_blocks_authenticated_owner_select"
  on public.user_blocks
  for select
  to authenticated
  using (blocker_id = auth.uid());