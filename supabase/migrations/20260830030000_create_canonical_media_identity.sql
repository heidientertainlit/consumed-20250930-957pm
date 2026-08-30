-- Durable, server-owned work identities. Provider IDs remain on the calling
-- tables during rollout; these rows are deliberately not client-readable.
create table if not exists public.canonical_media (
  id uuid primary key default gen_random_uuid(),
  media_type text,
  title text not null,
  creator text,
  release_year integer check (release_year is null or release_year between 1000 and 9999),
  normalized_title text not null,
  normalized_creator text,
  story_key text,
  open_library_work_id text,
  isbn_identifier text,
  source_verified boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists canonical_media_story_key_unique
  on public.canonical_media (story_key) where story_key is not null;
create unique index if not exists canonical_media_open_library_work_unique
  on public.canonical_media (open_library_work_id) where open_library_work_id is not null;
create unique index if not exists canonical_media_isbn_unique
  on public.canonical_media (isbn_identifier) where isbn_identifier is not null;

create table if not exists public.media_provider_aliases (
  id uuid primary key default gen_random_uuid(),
  canonical_media_id uuid not null references public.canonical_media(id) on delete cascade,
  external_source text not null check (char_length(external_source) between 1 and 50),
  external_id text not null check (char_length(external_id) between 1 and 200),
  source_verified boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (external_source, external_id)
);
create index if not exists media_provider_aliases_canonical_media_id_idx
  on public.media_provider_aliases (canonical_media_id);

alter table public.canonical_media enable row level security;
alter table public.media_provider_aliases enable row level security;
revoke all on table public.canonical_media from anon, authenticated;
revoke all on table public.media_provider_aliases from anon, authenticated;
grant all on table public.canonical_media to service_role;
grant all on table public.media_provider_aliases to service_role;

-- Additive links preserve every legacy provider field and work with databases
-- that have a subset of the historical feature tables.
alter table if exists public.media_ratings add column if not exists canonical_media_id uuid;
alter table if exists public.list_items add column if not exists canonical_media_id uuid;
alter table if exists public.social_posts add column if not exists canonical_media_id uuid;
alter table if exists public.media_match_scores add column if not exists canonical_media_id uuid;
alter table if exists public.media_fingerprints add column if not exists canonical_media_id uuid;
alter table if exists public.media_progress_events add column if not exists canonical_media_id uuid;

do $$
declare
  table_name text;
  constraint_name text;
begin
  foreach table_name in array array[
    'media_ratings', 'list_items', 'social_posts', 'media_match_scores',
    'media_fingerprints', 'media_progress_events'
  ] loop
    constraint_name := table_name || '_canonical_media_id_fkey';
    if to_regclass('public.' || table_name) is not null
       and not exists (
         select 1 from pg_constraint
         where conname = constraint_name
           and conrelid = ('public.' || table_name)::regclass
       ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (canonical_media_id) references public.canonical_media(id) on delete set null',
        table_name, constraint_name
      );
    end if;
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'media_ratings', 'list_items', 'social_posts', 'media_match_scores',
    'media_fingerprints', 'media_progress_events'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format(
        'create index if not exists %I on public.%I (canonical_media_id)',
        table_name || '_canonical_media_id_idx', table_name
      );
    end if;
  end loop;
end $$;

comment on table public.canonical_media is
  'Service-role-only durable identity for a media work; title alone never establishes identity.';
comment on table public.media_provider_aliases is
  'Service-role-only mapping from provider identifiers to canonical media.';

-- Clients may resolve one exact legacy/provider route without being able to
-- enumerate the private server-owned catalog or alias graph.
create or replace function public.resolve_media_canonical_id(
  p_external_source text,
  p_external_id text
)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select alias.canonical_media_id
  from public.media_provider_aliases alias
  where alias.external_source = lower(trim(p_external_source))
    and alias.external_id = trim(p_external_id)
  limit 1
$$;

revoke all on function public.resolve_media_canonical_id(text, text) from public;
grant execute on function public.resolve_media_canonical_id(text, text) to anon, authenticated, service_role;

-- One bounded lookup lets search return already-persisted identity evidence
-- without waiting for any cold provider, model, or Wikidata requests.
create or replace function public.resolve_media_canonical_batch(p_items jsonb)
returns table (
  external_source text,
  external_id text,
  canonical_media_id uuid,
  source_verified boolean,
  verified_metadata jsonb,
  fingerprint jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    lower(trim(request.external_source)),
    trim(request.external_id),
    alias.canonical_media_id,
    alias.source_verified and canonical.source_verified,
    coalesce(
      cached.fingerprint -> 'source_metadata',
      alias.metadata -> 'provider_metadata',
      canonical.metadata
    ),
    cached.fingerprint
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb))
    as request(external_source text, external_id text)
  join public.media_provider_aliases alias
    on alias.external_source = lower(trim(request.external_source))
   and alias.external_id = trim(request.external_id)
  join public.canonical_media canonical on canonical.id = alias.canonical_media_id
  left join lateral (
    select fingerprints.fingerprint
    from public.media_fingerprints fingerprints
    where fingerprints.external_source = alias.external_source
      and fingerprints.external_id = alias.external_id
    order by fingerprints.resolved_at desc nulls last
    limit 1
  ) cached on true
$$;

revoke all on function public.resolve_media_canonical_batch(jsonb) from public;
grant execute on function public.resolve_media_canonical_batch(jsonb) to service_role;

-- Canonical IDs supplied by browser clients are hints only. These triggers
-- replace them with the server-owned exact alias mapping, or clear them when
-- the provider tuple is not known yet.
create or replace function public.validate_media_rating_canonical_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select alias.canonical_media_id into new.canonical_media_id
  from public.media_provider_aliases alias
  where alias.external_source = lower(trim(new.media_external_source))
    and alias.external_id = trim(new.media_external_id)
  limit 1;
  return new;
end
$$;

create or replace function public.validate_list_item_canonical_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select alias.canonical_media_id into new.canonical_media_id
  from public.media_provider_aliases alias
  where alias.external_source = lower(trim(new.external_source))
    and alias.external_id = trim(new.external_id)
  limit 1;
  return new;
end
$$;

create or replace function public.validate_social_post_canonical_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select alias.canonical_media_id into new.canonical_media_id
  from public.media_provider_aliases alias
  where alias.external_source = lower(trim(new.media_external_source))
    and alias.external_id = trim(new.media_external_id)
  limit 1;
  return new;
end
$$;

drop trigger if exists validate_media_rating_canonical_identity on public.media_ratings;
create trigger validate_media_rating_canonical_identity
before insert or update of media_external_source, media_external_id, canonical_media_id
on public.media_ratings
for each row execute function public.validate_media_rating_canonical_identity();

drop trigger if exists validate_list_item_canonical_identity on public.list_items;
create trigger validate_list_item_canonical_identity
before insert or update of external_source, external_id, canonical_media_id
on public.list_items
for each row execute function public.validate_list_item_canonical_identity();

drop trigger if exists validate_social_post_canonical_identity on public.social_posts;
create trigger validate_social_post_canonical_identity
before insert or update of media_external_source, media_external_id, canonical_media_id
on public.social_posts
for each row execute function public.validate_social_post_canonical_identity();

-- Targeted compatibility repair proving the cross-provider architecture on the
-- known Goodreads/Google Books split for Emily Henry's Funny Story. This is not
-- a global historical backfill.
do $$
declare
  funny_story_id uuid;
  loser_ids uuid[];
begin
  select canonical_media_id into funny_story_id
  from public.media_provider_aliases
  where (external_source, external_id) in (
    ('goodreads', '194802722'),
    ('googlebooks', 'wcHMEAAAQBAJ')
  )
  order by source_verified desc, created_at
  limit 1;

  if funny_story_id is null then
    insert into public.canonical_media (
      media_type,
      title,
      creator,
      release_year,
      normalized_title,
      normalized_creator,
      source_verified,
      metadata
    )
    values (
      'book',
      'Funny Story',
      'Emily Henry',
      2024,
      'funny story',
      'emily henry',
      true,
      '{"repair":"verified Goodreads and Google Books provider identity"}'::jsonb
    )
    returning id into funny_story_id;
  end if;

  select array_agg(distinct canonical_media_id)
  into loser_ids
  from public.media_provider_aliases
  where (external_source, external_id) in (
    ('goodreads', '194802722'),
    ('googlebooks', 'wcHMEAAAQBAJ')
  )
    and canonical_media_id <> funny_story_id;

  if loser_ids is not null then
    update public.media_provider_aliases
    set canonical_media_id = funny_story_id, updated_at = now()
    where canonical_media_id = any(loser_ids);

    update public.media_ratings set canonical_media_id = funny_story_id where canonical_media_id = any(loser_ids);
    update public.list_items set canonical_media_id = funny_story_id where canonical_media_id = any(loser_ids);
    update public.social_posts set canonical_media_id = funny_story_id where canonical_media_id = any(loser_ids);
    update public.media_match_scores set canonical_media_id = funny_story_id where canonical_media_id = any(loser_ids);
    update public.media_fingerprints set canonical_media_id = funny_story_id where canonical_media_id = any(loser_ids);
    update public.media_progress_events set canonical_media_id = funny_story_id where canonical_media_id = any(loser_ids);

    delete from public.canonical_media where id = any(loser_ids);
  end if;

  insert into public.media_provider_aliases (
    canonical_media_id,
    external_source,
    external_id,
    source_verified,
    metadata
  )
  values
    (funny_story_id, 'goodreads', '194802722', true, '{"repair":"targeted"}'::jsonb),
    (funny_story_id, 'googlebooks', 'wcHMEAAAQBAJ', true, '{"repair":"targeted"}'::jsonb)
  on conflict (external_source, external_id) do update
    set canonical_media_id = excluded.canonical_media_id,
        source_verified = true,
        metadata = public.media_provider_aliases.metadata || excluded.metadata,
        updated_at = now();

  update public.media_ratings
  set canonical_media_id = public.resolve_media_canonical_id(media_external_source, media_external_id)
  where (media_external_source, media_external_id) in (
    ('goodreads', '194802722'),
    ('googlebooks', 'wcHMEAAAQBAJ')
  );

  update public.list_items
  set canonical_media_id = public.resolve_media_canonical_id(external_source, external_id)
  where (external_source, external_id) in (
    ('goodreads', '194802722'),
    ('googlebooks', 'wcHMEAAAQBAJ')
  );

  update public.social_posts
  set canonical_media_id = public.resolve_media_canonical_id(media_external_source, media_external_id)
  where (media_external_source, media_external_id) in (
    ('goodreads', '194802722'),
    ('googlebooks', 'wcHMEAAAQBAJ')
  );
end
$$;

-- Canonical ratings are one current verdict per user/work. If historical
-- aliases already produced duplicates, retain the most recently updated row.
with ranked_ratings as (
  select
    id,
    row_number() over (
      partition by user_id, canonical_media_id
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as position
  from public.media_ratings
  where canonical_media_id is not null
)
delete from public.media_ratings ratings
using ranked_ratings ranked
where ratings.id = ranked.id
  and ranked.position > 1;

create unique index if not exists media_ratings_user_canonical_media_unique
  on public.media_ratings (user_id, canonical_media_id);

with ranked_list_items as (
  select
    id,
    row_number() over (
      partition by user_id, list_id, canonical_media_id
      order by created_at desc nulls last, id desc
    ) as position
  from public.list_items
  where canonical_media_id is not null
)
delete from public.list_items items
using ranked_list_items ranked
where items.id = ranked.id
  and ranked.position > 1;

create unique index if not exists list_items_user_list_canonical_media_unique
  on public.list_items (user_id, list_id, canonical_media_id);

-- Weak verified reconciliation is serialized by the database. Unknown-year
-- records intentionally remain isolated and authoritative keys have their own
-- stronger unique constraints above.
create unique index if not exists canonical_media_verified_title_creator_year_unique
  on public.canonical_media (normalized_title, normalized_creator, release_year)
  where source_verified
    and normalized_creator is not null
    and release_year is not null;