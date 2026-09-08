-- Friendship mutations are service-mediated so blocks and recipient consent
-- cannot be bypassed through a direct authenticated table write.

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'friendships'
      and cmd in ('INSERT', 'UPDATE', 'ALL')
  loop
    execute format('drop policy if exists %I on public.friendships', policy_record.policyname);
  end loop;
end;
$$;

-- Existing SELECT and DELETE policies intentionally remain available. Deletes
-- are used for relationship management; only creation/state changes are
-- service-mediated.
revoke insert, update on public.friendships from anon, authenticated;

create policy "friendships_no_direct_authenticated_inserts"
on public.friendships
as restrictive
for insert
to authenticated
with check (false);

create policy "friendships_no_direct_authenticated_updates"
on public.friendships
as restrictive
for update
to authenticated
using (false)
with check (false);

-- A block insertion shares the same pair lock as the friendship transition.
-- Whichever transaction wins, the final committed state has no friendship:
-- the transition observes the block, or this trigger removes its rows after it
-- commits. This also clears pre-existing pending requests.
create or replace function public.remove_friendships_on_user_block()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.blocker_id = new.blocked_id then
    raise exception 'Cannot block yourself' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      least(new.blocker_id::text, new.blocked_id::text)
        || ':' ||
      greatest(new.blocker_id::text, new.blocked_id::text),
      0
    )
  );

  delete from public.friendships
  where (user_id = new.blocker_id and friend_id = new.blocked_id)
     or (user_id = new.blocked_id and friend_id = new.blocker_id);

  return new;
end;
$$;

drop trigger if exists remove_friendships_on_user_block on public.user_blocks;
create trigger remove_friendships_on_user_block
before insert on public.user_blocks
for each row execute function public.remove_friendships_on_user_block();

revoke all on function public.remove_friendships_on_user_block() from public, anon, authenticated;

create or replace function public.search_friendship_users(
  p_actor_id uuid,
  p_query text,
  p_limit integer default 20
)
returns table (
  id uuid,
  user_name text,
  first_name text,
  last_name text,
  display_name text,
  avatar text,
  relationship_status text,
  relationship_direction text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_query text := btrim(p_query);
  v_pattern text;
begin
  if p_actor_id is null
    or v_query is null
    or char_length(v_query) not between 2 and 64
    or v_query ~ '[[:cntrl:]]' then
    raise exception 'Invalid search query' using errcode = '22023';
  end if;

  -- Parameters never become SQL syntax. Escape wildcard characters as an
  -- additional guard so a client cannot turn a short search into a broad scan.
  v_pattern := '%' || replace(replace(replace(v_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';

  return query
  with pair_relationships as (
    select
      f.user_id,
      f.friend_id,
       f.status,
       f.created_at
    from public.friendships f
    where f.user_id = p_actor_id or f.friend_id = p_actor_id
  ),
  candidates as (
    select
      u.id,
      u.user_name,
      u.first_name,
      u.last_name,
      u.display_name,
      u.avatar,
      (u.people_discoverable is true) as is_discoverable,
      (dp.user_id is null or dp.is_private is false) as dna_is_public_or_missing,
      exists (
        select 1
        from public.friendships accepted
        where accepted.status = 'accepted'
          and (
            (accepted.user_id = p_actor_id and accepted.friend_id = u.id)
            or (accepted.friend_id = p_actor_id and accepted.user_id = u.id)
          )
      ) as is_accepted_friend,
      (
        select pr.status
        from pair_relationships pr
        where (pr.user_id = p_actor_id and pr.friend_id = u.id)
           or (pr.friend_id = p_actor_id and pr.user_id = u.id)
        order by (pr.status = 'accepted') desc, pr.created_at desc
        limit 1
      ) as relationship_status,
      (
        select case when pr.user_id = p_actor_id then 'outgoing' else 'incoming' end
        from pair_relationships pr
        where (pr.user_id = p_actor_id and pr.friend_id = u.id)
           or (pr.friend_id = p_actor_id and pr.user_id = u.id)
        order by (pr.status = 'accepted') desc, pr.created_at desc
        limit 1
      ) as relationship_direction
    from public.users u
    left join public.dna_profiles dp on dp.user_id = u.id
    where u.id <> p_actor_id
      and coalesce(u.is_persona, false) = false
      and (
        u.user_name ilike v_pattern escape E'\\'
        or u.first_name ilike v_pattern escape E'\\'
        or u.last_name ilike v_pattern escape E'\\'
        or concat_ws(' ', u.first_name, u.last_name) ilike v_pattern escape E'\\'
      )
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_id = p_actor_id and b.blocked_id = u.id)
           or (b.blocker_id = u.id and b.blocked_id = p_actor_id)
      )
  )
  select
    c.id, c.user_name, c.first_name, c.last_name, c.display_name, c.avatar,
    c.relationship_status, c.relationship_direction
  from candidates c
  where c.is_accepted_friend
     or (c.is_discoverable and c.dna_is_public_or_missing)
  order by c.user_name nulls last, c.id
  limit least(greatest(coalesce(p_limit, 20), 1), 20);
end;
$$;

create or replace function public.transition_friendship(
  p_action text,
  p_actor_id uuid,
  p_target_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  v_target public.users%rowtype;
  v_pending public.friendships%rowtype;
  v_existing public.friendships%rowtype;
  v_inserted public.friendships%rowtype;
begin
  if p_action not in ('send', 'accept', 'reject')
    or p_actor_id is null
    or p_target_id is null
    or p_actor_id = p_target_id then
    raise exception 'Invalid friendship transition' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      least(p_actor_id::text, p_target_id::text)
        || ':' ||
      greatest(p_actor_id::text, p_target_id::text),
      0
    )
  );

  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = p_actor_id and b.blocked_id = p_target_id)
       or (b.blocker_id = p_target_id and b.blocked_id = p_actor_id)
  ) then
    raise exception 'Unable to manage friend request' using errcode = 'P0001';
  end if;

  if p_action = 'send' then
    select * into v_target from public.users where id = p_target_id;
    if not found
      or coalesce(v_target.is_persona, false)
      or v_target.people_discoverable is not true
      or exists (
        select 1 from public.dna_profiles dp
        where dp.user_id = p_target_id and dp.is_private is distinct from false
      ) then
      raise exception 'Unable to send friend request' using errcode = 'P0001';
    end if;

    select * into v_existing
    from public.friendships
    where (user_id = p_actor_id and friend_id = p_target_id)
       or (user_id = p_target_id and friend_id = p_actor_id)
    order by (status = 'accepted') desc, created_at desc
    limit 1;

    if found then
      if v_existing.status = 'accepted' then
        raise exception 'Already friends' using errcode = 'P0001';
      end if;
      raise exception 'Friend request already sent' using errcode = 'P0001';
    end if;

    insert into public.friendships(user_id, friend_id, status)
    values (p_actor_id, p_target_id, 'pending')
    returning * into v_inserted;
    return jsonb_build_object('outcome', 'sent', 'friendship', to_jsonb(v_inserted));
  end if;

  -- Only the request recipient can accept or reject their incoming request.
  select * into v_pending
  from public.friendships
  where user_id = p_target_id
    and friend_id = p_actor_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'Friend request not found or already processed' using errcode = 'P0001';
  end if;

  if p_action = 'reject' then
    delete from public.friendships where id = v_pending.id;
    return jsonb_build_object('outcome', 'rejected');
  end if;

  delete from public.friendships where id = v_pending.id;
  insert into public.friendships(user_id, friend_id, status)
  values (p_actor_id, p_target_id, 'accepted')
  on conflict (user_id, friend_id) do update set status = 'accepted'
  returning * into v_inserted;
  insert into public.friendships(user_id, friend_id, status)
  values (p_target_id, p_actor_id, 'accepted')
  on conflict (user_id, friend_id) do update set status = 'accepted';

  return jsonb_build_object('outcome', 'accepted', 'friendship', to_jsonb(v_inserted));
end;
$$;

revoke all on function public.search_friendship_users(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.transition_friendship(text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.search_friendship_users(uuid, text, integer) to service_role;
grant execute on function public.transition_friendship(text, uuid, uuid) to service_role;

notify pgrst, 'reload schema';