-- Minimal local schema with the deployed identity-column types and relevant
-- FK actions. This is not a production-schema clone or a production test.
create role authenticated;
create role anon;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public, auth to authenticated;

create table public.media_provider_aliases (
  canonical_media_id uuid not null, external_source text, external_id text,
  unique(external_source, external_id)
);
create table public.list_items (
  id uuid primary key, user_id uuid not null, list_id uuid,
  canonical_media_id uuid, media_id uuid, external_source text,
  external_id text, media_type text, title text
);
create table public.social_posts (
  id uuid primary key, user_id varchar not null, canonical_media_id uuid,
  media_external_source text, media_external_id text, media_type text, content text
);
create table public.media_ratings (
  id integer generated always as identity primary key, user_id uuid not null,
  canonical_media_id uuid, media_external_source text, media_external_id text,
  media_type text, rating numeric
);
create table public.media_progress_events (
  id integer generated always as identity primary key, user_id uuid not null,
  list_item_id uuid references public.list_items(id) on delete set null,
  canonical_media_id uuid, media_external_source text, media_external_id text, media_type text
);
create table public.social_post_comments (
  id integer generated always as identity primary key, user_id uuid,
  post_id uuid references public.social_posts(id) on delete cascade
);
create table public.media_history_log (
  item_id uuid references public.list_items(id) on delete cascade
);
create table public.media_tag_links (
  item_id uuid references public.list_items(id) on delete cascade
);
create table public.media_import_rows (
  list_item_id uuid references public.list_items(id) on delete set null,
  media_rating_id integer references public.media_ratings(id) on delete set null
);
create function pg_temp.assert(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'ASSERTION FAILED: %', message; end if;
end;
$$;
