-- Minimal local schema with the deployed identity-column types and relevant
-- FK actions. This is not a production-schema clone or a production test.
create role authenticated;
create role anon;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public, auth to authenticated;

create table auth.users (id uuid primary key);
create table public.users (id uuid primary key references auth.users(id));
create table public.lists (id uuid primary key, user_id uuid references public.users(id), title text);
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');
insert into public.users values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');
insert into public.lists values
  ('01000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Currently'),
  ('01000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Favorites'),
  ('01000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Want To'),
  ('01000000-0000-0000-0000-000000000004','22222222-2222-2222-2222-222222222222','Currently');

create table public.media_provider_aliases (
  canonical_media_id uuid not null, external_source text, external_id text,
  unique(external_source, external_id)
);
create table public.list_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, list_id uuid,
  canonical_media_id uuid, media_id uuid, external_source text,
  external_id text, media_type text, title text
);
create table public.social_posts (
  id uuid primary key default gen_random_uuid(), user_id varchar not null, canonical_media_id uuid,
  media_external_source text, media_external_id text, media_type text, media_title text,
  post_type text, content text
);
create table public.media_ratings (
  id integer generated always as identity primary key, user_id uuid not null,
  canonical_media_id uuid, media_external_source text, media_external_id text,
  media_type text, media_title text, rating numeric
);
create table public.media_progress_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  list_item_id uuid references public.list_items(id) on delete set null,
  canonical_media_id uuid, media_external_source text, media_external_id text, media_type text,
  event_type text not null, progress integer not null, progress_mode text not null
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
