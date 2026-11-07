-- Local preparation only. Apply separately after production approval.
-- A server-owned list item is the anchor; never accept a caller-supplied user
-- or canonical ID, and never use a title match to decide what to erase.
begin;

create or replace function public.delete_own_library_media(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_item public.list_items%rowtype;
  v_canonical uuid;
  v_keys jsonb;
  v_item_ids uuid[];
  v_posts integer;
  v_ratings integer;
  v_progress integer;
  v_items integer;
begin
  if v_user is null then
    raise exception 'Sign in to delete media.' using errcode = '42501';
  end if;

  select * into v_item from public.list_items
    where id = p_item_id and user_id = v_user for update;
  if not found then
    raise exception 'Media item was not found in your library.' using errcode = 'P0002';
  end if;

  select canonical_media_id into v_canonical
    from public.media_provider_aliases
    where external_source = lower(btrim(v_item.external_source))
      and external_id = btrim(v_item.external_id);
  v_canonical := coalesce(v_canonical, v_item.canonical_media_id);

  if v_canonical is null and (
    nullif(btrim(v_item.external_source), '') is null
    or nullif(btrim(v_item.external_id), '') is null
  ) then
    raise exception 'This item is missing the identity needed for safe deletion.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_user::text || ':' || coalesce(v_canonical::text,
      v_item.external_source || ':' || v_item.external_id || ':' || v_item.media_type), 0));

  select coalesce(jsonb_agg(jsonb_build_array(lower(btrim(external_source)), btrim(external_id))), '[]'::jsonb)
    into v_keys from public.media_provider_aliases
    where v_canonical is not null and canonical_media_id = v_canonical;
  if nullif(btrim(v_item.external_source), '') is not null
    and nullif(btrim(v_item.external_id), '') is not null then
    v_keys := v_keys || jsonb_build_array(jsonb_build_array(
      lower(btrim(v_item.external_source)), btrim(v_item.external_id)));
  end if;

  -- Match all memberships, including cross-provider aliases already verified
  -- by the server. A same-title work is not sufficient evidence.
  select array_agg(i.id) into v_item_ids from public.list_items i
    where i.user_id = v_user and (
      i.canonical_media_id = v_canonical
      or (lower(i.media_type) = lower(v_item.media_type) and v_keys @>
        jsonb_build_array(jsonb_build_array(lower(btrim(i.external_source)), btrim(i.external_id))))
    );
  if v_item_ids is null or not (p_item_id = any(v_item_ids)) then
    raise exception 'Media identity changed. Refresh your library and try again.';
  end if;

  -- All statements share the caller's transaction. Any trigger/FK failure
  -- rolls back every deletion, including comments/reactions on removed posts.
  delete from public.social_posts p where p.user_id::text = v_user::text and (
    p.canonical_media_id = v_canonical
    or (lower(p.media_type) = lower(v_item.media_type) and v_keys @>
      jsonb_build_array(jsonb_build_array(lower(btrim(p.media_external_source)), btrim(p.media_external_id))))
  );
  get diagnostics v_posts = row_count;

  delete from public.media_ratings r where r.user_id::text = v_user::text and (
    r.canonical_media_id = v_canonical
    or (lower(r.media_type) = lower(v_item.media_type) and v_keys @>
      jsonb_build_array(jsonb_build_array(lower(btrim(r.media_external_source)), btrim(r.media_external_id))))
  );
  get diagnostics v_ratings = row_count;

  -- These otherwise survive list deletion with a null list_item_id.
  delete from public.media_progress_events e where e.user_id = v_user and (
    e.list_item_id = any(v_item_ids) or e.canonical_media_id = v_canonical
    or (lower(e.media_type) = lower(v_item.media_type) and v_keys @>
      jsonb_build_array(jsonb_build_array(lower(btrim(e.media_external_source)), btrim(e.media_external_id))))
  );
  get diagnostics v_progress = row_count;

  delete from public.list_items where user_id = v_user and id = any(v_item_ids);
  get diagnostics v_items = row_count;
  if v_items <> cardinality(v_item_ids) then
    raise exception 'Library changed during deletion. Refresh and try again.';
  end if;

  return jsonb_build_object(
    'deleted_list_item_ids', to_jsonb(v_item_ids),
    'deleted_items', v_items,
    'deleted_posts', v_posts,
    'deleted_ratings', v_ratings,
    'deleted_progress_events', v_progress
  );
end;
$$;

revoke all on function public.delete_own_library_media(uuid) from public, anon, authenticated;
grant execute on function public.delete_own_library_media(uuid) to authenticated;

commit;
