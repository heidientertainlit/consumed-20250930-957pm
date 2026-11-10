-- Independent Finished season/episode saving.
-- A title remains one library entry. Each completed season/episode has its own
-- record, so completing another part never erases an earlier completion.
create table if not exists public.finished_tv_scopes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  list_item_id uuid not null references public.list_items(id) on delete cascade,
  work_key text not null,
  season_number integer not null check (season_number >= 0),
  -- Zero denotes all episodes of this season, never an invented provider ID.
  episode_number integer not null default 0 check (episode_number >= 0),
  episode_title text,
  rating numeric check (rating between 0.5 and 5 and rating * 2 = trunc(rating * 2)),
  reaction text check (length(reaction) <= 5000),
  post_id uuid references public.social_posts(id) on delete set null,
  completed_at timestamptz not null default now(),
  unique (user_id, work_key, season_number, episode_number)
);
alter table public.finished_tv_scopes enable row level security;
revoke all on public.finished_tv_scopes from anon, authenticated;
grant select on public.finished_tv_scopes to authenticated;
create policy "Read own completed TV parts" on public.finished_tv_scopes
  for select to authenticated using (user_id = auth.uid());

create or replace function public.save_finished_tv_scope(
  p_list_item_id uuid, p_season integer, p_episode integer default null,
  p_episode_title text default null, p_rating numeric default null, p_reaction text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_item public.list_items;
  v_scope public.finished_tv_scopes;
  v_key text;
  v_content text;
  v_post uuid;
begin
  if auth.uid() is null then raise exception 'Please sign in again.' using errcode = '42501'; end if;
  if p_season is null or p_season < 0 or p_episode < 1
    or p_rating not between 0.5 and 5 or p_rating * 2 <> trunc(p_rating * 2)
    or length(p_reaction) > 5000 then
    raise exception 'Invalid season, episode, rating, or reaction.' using errcode = '22023';
  end if;
  select li.* into v_item from public.list_items li join public.lists l on l.id = li.list_id
    where li.id = p_list_item_id and li.user_id = auth.uid() and l.user_id = auth.uid()
      and lower(trim(l.title)) = 'finished'
      and lower(replace(replace(li.media_type, ' ', '_'), '-', '_')) in ('tv','tv_show','tv_shows','tv_series','series','television')
    for update of li;
  if not found then raise exception 'Finished title not found.' using errcode = '42501'; end if;
  v_key := coalesce(v_item.canonical_media_id::text,
    case when v_item.external_id is not null then v_item.external_source || ':' || v_item.external_id end);
  if v_key is null then raise exception 'This title needs a linked media identity.'; end if;
  insert into public.finished_tv_scopes(user_id,list_item_id,work_key,season_number,episode_number,episode_title,rating,reaction)
    values(auth.uid(),v_item.id,v_key,p_season,coalesce(p_episode,0),p_episode_title,p_rating,nullif(trim(p_reaction),''))
    on conflict(user_id,work_key,season_number,episode_number) do update set
      list_item_id = excluded.list_item_id,
      episode_title = coalesce(excluded.episode_title,finished_tv_scopes.episode_title),
      rating = coalesce(excluded.rating,finished_tv_scopes.rating),
      reaction = coalesce(excluded.reaction,finished_tv_scopes.reaction)
    returning * into v_scope;
  -- Scope is also available to existing list readers. The history above, not
  -- this latest-scope summary, is authoritative for independently finished parts.
  update public.list_items set season_number = p_season, episode_number = p_episode where id = v_item.id;
  if p_rating is not null or nullif(trim(p_reaction),'') is not null then
    v_content := coalesce(v_scope.reaction, 'Finished season ' || p_season ||
      case when p_episode is not null then ', episode ' || p_episode else '' end || ' of ' || v_item.title);
    if v_scope.post_id is null then
      insert into public.social_posts(user_id,content,post_type,rating,media_title,media_type,media_creator,image_url,
        media_external_id,media_external_source,canonical_media_id,media_season_number,media_episode_number,media_episode_title,
        visibility,contains_spoilers)
      values(auth.uid(),v_content,case when v_scope.rating is not null then 'rate-review' else 'thought' end,
        v_scope.rating,v_item.title,v_item.media_type,v_item.creator,v_item.image_url,v_item.external_id,v_item.external_source,
        v_item.canonical_media_id,p_season,p_episode,p_episode_title,'public',false) returning id into v_post;
      update public.finished_tv_scopes set post_id = v_post where id = v_scope.id;
    else
      update public.social_posts set content = v_content, rating = v_scope.rating,
        post_type = case when v_scope.rating is not null then 'rate-review' else 'thought' end
        where id = v_scope.post_id and user_id = auth.uid();
    end if;
  end if;
  return v_scope.id;
end;
$$;
revoke all on function public.save_finished_tv_scope(uuid,integer,integer,text,numeric,text) from public, anon;
grant execute on function public.save_finished_tv_scope(uuid,integer,integer,text,numeric,text) to authenticated;
