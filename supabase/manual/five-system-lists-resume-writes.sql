-- PREPARED ONLY. Run after the approved Edge rollout and release checks.
begin;
set local lock_timeout = '5s';
drop trigger pause_five_system_list_writes on public.lists;
drop trigger pause_five_system_item_writes on public.list_items;
drop function list_provisioning_private.pause_list_writes();
commit;
