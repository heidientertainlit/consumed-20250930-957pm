-- Conservative, database-enforced baseline for user-authored free text.
-- This is intentionally not a general profanity list or a complete moderation
-- system. Media/catalog fields (for example media_title, creator, and episode
-- title) are not inspected so quoted titles are not broadly blocked.
-- Reports and beta/support feedback are also excluded so users can describe
-- harmful text verbatim when asking for help.
--
-- The trigger runs for direct table writes as well as application writes. It
-- does not change RLS, table privileges, or any reporting/notification path.

-- translate's third argument above deliberately maps common leetspeak
-- substitutions only for matching. It never changes the value being stored.
-- Keep the mapping in a small, auditable helper rather than using an external
-- service or a mutable blocklist table.
create or replace function public.ugc_normalize_for_moderation(p_text text)
returns text
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select translate(
    lower(
      regexp_replace(
        normalize(p_text, NFKD),
        U&'[\0300-\036F\200B\200C\200D\2060\FEFF]',
        '',
        'g'
      )
    ),
    U&'@!$013457',
    'aisoieast'
  )
$$;

create function public.assert_ugc_text(
  p_text text,
  p_field text,
  p_max_characters integer
)
returns void
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  normalized text;
begin
  if p_text is null then
    return;
  end if;

  if char_length(p_text) > p_max_characters then
    raise exception using
      errcode = '22001',
      message = format('%s exceeds the maximum length of %s characters', p_field, p_max_characters);
  end if;

  normalized := public.ugc_normalize_for_moderation(p_text);

  -- These are high-confidence, whole-token patterns for severe slurs and
  -- direct self-harm threats. Separators are accepted between letters after
  -- Unicode/zero-width normalization, while token boundaries avoid matching
  -- innocent substrings (for example, "snigger").
  if normalized ~
       '(^|[^a-z0-9])n[^a-z0-9]*i[^a-z0-9]*g[^a-z0-9]*g[^a-z0-9]*e[^a-z0-9]*r([^a-z0-9]|$)'
     or normalized ~
       '(^|[^a-z0-9])f[^a-z0-9]*a[^a-z0-9]*g[^a-z0-9]*g[^a-z0-9]*o[^a-z0-9]*t([^a-z0-9]|$)'
     or normalized ~
       '(^|[^a-z0-9])k[^a-z0-9]*i[^a-z0-9]*k[^a-z0-9]*e([^a-z0-9]|$)'
     or normalized ~
       '(^|[^a-z0-9])w[^a-z0-9]*e[^a-z0-9]*t[^a-z0-9]*b[^a-z0-9]*a[^a-z0-9]*c[^a-z0-9]*k([^a-z0-9]|$)'
     or normalized ~
       '(^|[^a-z0-9])b[^a-z0-9]*e[^a-z0-9]*a[^a-z0-9]*n[^a-z0-9]*e[^a-z0-9]*r([^a-z0-9]|$)'
     or normalized ~
       '(^|[^a-z0-9])k[^a-z0-9]*i[^a-z0-9]*l[^a-z0-9]*l[^a-z0-9]*y[^a-z0-9]*o[^a-z0-9]*u[^a-z0-9]*r[^a-z0-9]*s[^a-z0-9]*e[^a-z0-9]*l[^a-z0-9]*f([^a-z0-9]|$)'
  then
    raise exception using
      errcode = '22023',
      message = 'Text was rejected by the objectionable-content safety filter';
  end if;
end;
$$;

create function public.assert_ugc_text_array(
  p_values text[],
  p_field text,
  p_max_characters integer,
  p_max_items integer default 32
)
returns void
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  item text;
begin
  if p_values is null then
    return;
  end if;

  if cardinality(p_values) > p_max_items then
    raise exception using
      errcode = '22001',
      message = format('%s has more than %s entries', p_field, p_max_items);
  end if;

  foreach item in array p_values loop
    perform public.assert_ugc_text(item, p_field, p_max_characters);
  end loop;
end;
$$;

create function public.assert_ugc_json_text_values(
  p_values jsonb,
  p_field text,
  p_max_characters integer,
  p_max_items integer default 32
)
returns void
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  item text;
  item_count integer := 0;
begin
  if p_values is null then
    return;
  end if;

  for item in
    select value #>> '{}'
    from jsonb_path_query(p_values, '$.** ? (@.type() == "string")') as values_found(value)
  loop
    item_count := item_count + 1;
    if item_count > p_max_items then
      raise exception using
        errcode = '22001',
        message = format('%s has more than %s text entries', p_field, p_max_items);
    end if;
    perform public.assert_ugc_text(item, p_field, p_max_characters);
  end loop;
end;
$$;

create function public.enforce_ugc_text_on_write()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  payload jsonb := to_jsonb(new);
  previous jsonb;
  field_names text[];
  field_limits integer[];
  field_index integer;
begin
  if tg_op = 'UPDATE' then
    previous := to_jsonb(old);
  end if;

  case tg_table_name
    when 'users' then
      field_names := array['user_name', 'display_name', 'first_name', 'last_name', 'bio'];
      field_limits := array[64, 120, 120, 120, 1000];
    when 'profiles' then
      field_names := array['username'];
      field_limits := array[64];
    when 'user_profiles' then
      field_names := array['display_name', 'bio'];
      field_limits := array[120, 1000];
    when 'social_posts' then
      field_names := array['content'];
      field_limits := array[5000];
    when 'social_post_comments' then
      field_names := array['content'];
      field_limits := array[5000];
    when 'prediction_comments' then
      field_names := array['content'];
      field_limits := array[5000];
    when 'rank_comments' then
      field_names := array['content'];
      field_limits := array[5000];
    when 'room_takes' then
      field_names := array['title', 'body', 'tag'];
      field_limits := array[280, 5000, 100];
    when 'room_take_replies' then
      field_names := array['content'];
      field_limits := array[5000];
    when 'reviews' then
      field_names := array['review_text'];
      field_limits := array[10000];
    when 'hot_take_passes' then
      field_names := array['response'];
      field_limits := array[5000];
    when 'bets' then
      field_names := array['prediction'];
      field_limits := array[1000];
    when 'user_predictions' then
      field_names := array['prediction'];
      field_limits := array[1000];
    when 'rec_requests' then
      field_names := array['context'];
      field_limits := array[2000];
    when 'lists' then
      field_names := array['title'];
      field_limits := array[280];
    when 'list_items' then
      field_names := array['notes'];
      field_limits := array[5000];
    when 'user_lists' then
      field_names := array['title', 'description'];
      field_limits := array[280, 5000];
    when 'user_media' then
      field_names := array['notes'];
      field_limits := array[5000];
    when 'ranks' then
      field_names := array['title', 'description'];
      field_limits := array[280, 5000];
    when 'rank_items' then
      field_names := array['notes'];
      field_limits := array[5000];
    when 'strands' then
      field_names := array['title', 'content'];
      field_limits := array[280, 5000];
    when 'strand_comments' then
      field_names := array['content'];
      field_limits := array[5000];
    when 'media_goals' then
      field_names := array['title', 'description', 'goal_description'];
      field_limits := array[280, 5000, 1000];
    when 'user_highlights' then
      field_names := array['description'];
      field_limits := array[5000];
    when 'pools' then
      field_names := array['name', 'description', 'examples', 'series_tag', 'partner_name'];
      field_limits := array[280, 5000, 5000, 280, 280];
    when 'pool_rounds' then
      field_names := array['title'];
      field_limits := array[280];
    when 'pool_prompts' then
      field_names := array['prompt_text', 'correct_answer'];
      field_limits := array[5000, 1000];
    when 'pool_answers' then
      field_names := array['answer'];
      field_limits := array[1000];
    when 'prediction_pools' then
      field_names := array['title'];
      field_limits := array[280];
    when 'friend_casts' then
      field_names := array['prompt', 'target_friend_name'];
      field_limits := array[1000, 120];
    when 'edna_responses' then
      field_names := array['answer_text'];
      field_limits := array[1000];
    else
      raise exception 'UGC text trigger attached to unsupported table %', tg_table_name;
  end case;

  for field_index in array_lower(field_names, 1)..array_upper(field_names, 1) loop
    if tg_op = 'INSERT'
       or payload->field_names[field_index] is distinct from previous->field_names[field_index]
    then
      perform public.assert_ugc_text(
        payload->>field_names[field_index],
        format('%s.%s', tg_table_name, field_names[field_index]),
        field_limits[field_index]
      );
    end if;
  end loop;

  if tg_table_name = 'pool_prompts'
     and (
       tg_op = 'INSERT'
       or payload->'options' is distinct from previous->'options'
     )
  then
    perform public.assert_ugc_text_array(
      array(select jsonb_array_elements_text(coalesce(payload->'options', '[]'::jsonb))),
      'pool_prompts.options',
      1000
    );
  elsif tg_table_name = 'prediction_pools'
     and (
       tg_op = 'INSERT'
       or payload->'options' is distinct from previous->'options'
     )
  then
    perform public.assert_ugc_json_text_values(payload->'options', 'prediction_pools.options', 1000);
  end if;

  return new;
end;
$$;

revoke all on function public.ugc_normalize_for_moderation(text) from public;
revoke all on function public.assert_ugc_text(text, text, integer) from public;
revoke all on function public.assert_ugc_text_array(text[], text, integer, integer) from public;
revoke all on function public.assert_ugc_json_text_values(jsonb, text, integer, integer) from public;
revoke all on function public.enforce_ugc_text_on_write() from public;

-- Trigger execution is invoker-context, so writers need these pure validators.
-- They expose no rows or mutation capability and do not bypass table RLS.
grant execute on function public.ugc_normalize_for_moderation(text)
to authenticated, service_role;
grant execute on function public.assert_ugc_text(text, text, integer)
to authenticated, service_role;
grant execute on function public.assert_ugc_text_array(text[], text, integer, integer)
to authenticated, service_role;
grant execute on function public.assert_ugc_json_text_values(jsonb, text, integer, integer)
to authenticated, service_role;

create trigger enforce_ugc_text_users
before insert or update on public.users
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_profiles
before insert or update on public.profiles
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_user_profiles
before insert or update on public.user_profiles
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_social_posts
before insert or update on public.social_posts
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_social_post_comments
before insert or update on public.social_post_comments
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_prediction_comments
before insert or update on public.prediction_comments
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_rank_comments
before insert or update on public.rank_comments
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_room_takes
before insert or update on public.room_takes
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_room_take_replies
before insert or update on public.room_take_replies
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_reviews
before insert or update on public.reviews
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_hot_take_passes
before insert or update on public.hot_take_passes
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_bets
before insert or update on public.bets
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_user_predictions
before insert or update on public.user_predictions
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_rec_requests
before insert or update on public.rec_requests
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_lists
before insert or update on public.lists
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_list_items
before insert or update on public.list_items
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_user_lists
before insert or update on public.user_lists
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_user_media
before insert or update on public.user_media
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_ranks
before insert or update on public.ranks
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_rank_items
before insert or update on public.rank_items
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_strands
before insert or update on public.strands
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_strand_comments
before insert or update on public.strand_comments
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_media_goals
before insert or update on public.media_goals
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_user_highlights
before insert or update on public.user_highlights
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_pools
before insert or update on public.pools
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_pool_rounds
before insert or update on public.pool_rounds
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_pool_prompts
before insert or update on public.pool_prompts
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_pool_answers
before insert or update on public.pool_answers
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_prediction_pools
before insert or update on public.prediction_pools
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_friend_casts
before insert or update on public.friend_casts
for each row execute function public.enforce_ugc_text_on_write();
create trigger enforce_ugc_text_edna_responses
before insert or update on public.edna_responses
for each row execute function public.enforce_ugc_text_on_write();