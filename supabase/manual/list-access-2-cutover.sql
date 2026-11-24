-- Apply only after compatible readers and supported clients pass hosted verification.
begin;
set local lock_timeout = '5s';
lock table public.lists, public.list_items in access exclusive mode;

do $$
begin
  if (select count(*) from pg_class where oid in ('public.lists'::regclass, 'public.list_items'::regclass) and relrowsecurity) <> 2 then
    raise exception 'Expected RLS on both list tables';
  end if;
  -- Unexpected policies may still permit reads after dropping the seven known
  -- rules. Verify owner predicates rather than assuming a name implies scope.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and cmd in ('SELECT', 'ALL') and (
      (tablename = 'lists' and policyname not in (
        'Allow public read lists', 'Users can view their own lists',
        'lists_select_user_or_public_or_system', 'friends_can_view_lists', 'final_lists_select',
        'final_lists_modify', 'lists_modify_owner', 'Users can access their own lists'
      ))
      or (tablename = 'list_items' and policyname not in (
        'Allow public read list items', 'Users can read own list items', 'friends_can_view_list_items',
        'final_items_select', 'final_items_modify'
      ))
    )
  ) then
    raise exception 'Unexpected list SELECT or ALL policy; review before cutover';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename in ('lists', 'list_items') and cmd = 'ALL'
      and coalesce(regexp_replace(qual, '[[:space:]()]', '', 'g'), '') not in (
        'auth.uid=user_id', 'user_id=auth.uid', 'selectauth.uid=user_id', 'user_id=selectauth.uid',
        'auth.uid::text=user_id::text', 'user_id::text=auth.uid::text'
      )
  ) then
    raise exception 'A retained list ALL policy is not recognizably owner-only';
  end if;
end;
$$;

alter policy final_lists_select on public.lists
  using (list_access_private.can_read_list(id, (select auth.uid())));
alter policy final_items_select on public.list_items
  using (user_id = (select auth.uid()) or list_access_private.can_read_list(list_id, (select auth.uid())));

drop policy "Allow public read lists" on public.lists;
drop policy "Allow public read list items" on public.list_items;
drop policy "Users can view their own lists" on public.lists;
drop policy "Users can read own list items" on public.list_items;
drop policy lists_select_user_or_public_or_system on public.lists;
drop policy friends_can_view_lists on public.lists;
drop policy friends_can_view_list_items on public.list_items;
commit;
