-- Run only against an isolated/local database after the hardening migration.
-- This script always rolls back. Set these session settings to two disposable
-- UUIDs that exist in both auth.users and public.users before running it:
--   set app.friendship_test_sender = '<uuid>';
--   set app.friendship_test_recipient = '<uuid>';
begin;

do $$
declare
  sender_id uuid := nullif(current_setting('app.friendship_test_sender', true), '')::uuid;
  recipient_id uuid := nullif(current_setting('app.friendship_test_recipient', true), '')::uuid;
  accepted_rows integer;
  denied boolean := false;
begin
  if sender_id is null or recipient_id is null or sender_id = recipient_id then
    raise exception 'Set two distinct disposable app.friendship_test_* UUID settings';
  end if;

  if has_table_privilege('authenticated', 'public.friendships', 'INSERT')
     or has_table_privilege('authenticated', 'public.friendships', 'UPDATE') then
    raise exception 'authenticated still has friendship INSERT or UPDATE grant';
  end if;
  if not has_table_privilege('authenticated', 'public.friendships', 'SELECT')
     or not has_table_privilege('authenticated', 'public.friendships', 'DELETE') then
    raise exception 'friendship SELECT or DELETE grant was unexpectedly removed';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.transition_friendship(text,uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'authenticated can execute the friendship mutation RPC';
  end if;

  delete from public.user_blocks
  where (blocker_id = sender_id and blocked_id = recipient_id)
     or (blocker_id = recipient_id and blocked_id = sender_id);
  delete from public.friendships
  where (user_id = sender_id and friend_id = recipient_id)
     or (user_id = recipient_id and friend_id = sender_id);

  perform public.transition_friendship('send', sender_id, recipient_id);

  -- Sender cannot accept their own outgoing request.
  begin
    perform public.transition_friendship('accept', sender_id, recipient_id);
  exception when sqlstate 'P0001' then
    denied := true;
  end;
  if not denied then
    raise exception 'sender was allowed to accept an outgoing request';
  end if;

  perform public.transition_friendship('accept', recipient_id, sender_id);
  select count(*) into accepted_rows
  from public.friendships
  where status = 'accepted'
    and (
      (user_id = sender_id and friend_id = recipient_id)
      or (user_id = recipient_id and friend_id = sender_id)
    );
  if accepted_rows <> 2 then
    raise exception 'accept did not create exactly two reciprocal accepted rows';
  end if;

  -- The block trigger takes the same pair lock and removes both directions.
  insert into public.user_blocks(blocker_id, blocked_id)
  values (sender_id, recipient_id);
  if exists (
    select 1 from public.friendships
    where (user_id = sender_id and friend_id = recipient_id)
       or (user_id = recipient_id and friend_id = sender_id)
  ) then
    raise exception 'block left friendship rows behind';
  end if;

  denied := false;
  begin
    perform public.transition_friendship('send', recipient_id, sender_id);
  exception when sqlstate 'P0001' then
    denied := true;
  end;
  if not denied then
    raise exception 'a block did not prevent a new pending request';
  end if;
end;
$$;

rollback;