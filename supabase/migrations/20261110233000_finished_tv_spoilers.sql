-- Preserve six-argument callers; new clients explicitly supply the spoiler flag.
alter table public.finished_tv_scopes
  add column if not exists contains_spoilers boolean not null default false;

create or replace function public.save_finished_tv_scope(
  p_list_item_id uuid, p_season integer, p_episode integer,
  p_episode_title text, p_rating numeric, p_reaction text, p_contains_spoilers boolean
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_spoilers boolean;
begin
  -- The original function validates the authenticated owner and writes the
  -- completion and feedback. Everything below commits in the same transaction.
  v_id := public.save_finished_tv_scope(p_list_item_id,p_season,p_episode,p_episode_title,p_rating,p_reaction);
  if p_rating is not null or nullif(trim(p_reaction),'') is not null then
    select case when nullif(trim(p_reaction),'') is not null then coalesce(p_contains_spoilers,false)
      else contains_spoilers or coalesce(p_contains_spoilers,false) end into v_spoilers
      from public.finished_tv_scopes where id=v_id and user_id=auth.uid();
    update public.finished_tv_scopes set contains_spoilers=v_spoilers where id=v_id and user_id=auth.uid();
    update public.social_posts set contains_spoilers=v_spoilers
      where id=(select post_id from public.finished_tv_scopes where id=v_id and user_id=auth.uid())
        and user_id=auth.uid();
  end if;
  return v_id;
end;
$$;
revoke all on function public.save_finished_tv_scope(uuid,integer,integer,text,numeric,text,boolean) from public,anon;
grant execute on function public.save_finished_tv_scope(uuid,integer,integer,text,numeric,text,boolean) to authenticated;
notify pgrst, 'reload schema';
