-- Disposable development fixture only; never applied to the application's DB.
create role anon;
create role authenticated;
create role service_role;
create table users (
  id uuid primary key, email text, user_name text, display_name text,
  first_name text, last_name text, referred_by uuid, referral_rewarded boolean default false
);
create table lists (
  id uuid primary key default gen_random_uuid(), user_id uuid references users(id),
  title text, is_default boolean default true, is_private boolean default false
);
create table list_items (
  id uuid primary key default gen_random_uuid(), user_id uuid references users(id),
  list_id uuid references lists(id), title text not null, media_type text, creator text,
  image_url text, external_source text, external_id text, total integer, progress_mode text,
  position integer, media_subtype text, series_name text,
  created_at timestamptz default now(), completed_at timestamptz,
  unique(user_id,list_id,external_id,external_source)
);
create table media_ratings (
  id uuid primary key default gen_random_uuid(), user_id uuid references users(id),
  media_external_id text not null, media_external_source text not null,
  media_title text not null, media_type text not null, rating numeric,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique(user_id,media_external_id,media_external_source)
);
create table social_posts (
  id uuid primary key default gen_random_uuid(), user_id uuid references users(id),
  content text, post_type text, visibility text, contains_spoilers boolean,
  media_title text, media_type text, media_creator text, media_external_id text, media_external_source text,
  image_url text, rating numeric, media_season_number integer, media_episode_number integer,
  media_episode_title text, media_volume_number numeric, list_id uuid, rec_category text, room_id uuid,
  likes_count integer default 0, comments_count integer default 0, created_at timestamptz default now()
);
create table media_fingerprints (
  external_source text not null, external_id text not null, media_type text,
  fingerprint_version integer, status text, source_metadata jsonb, fingerprint jsonb,
  error_message text, resolved_at timestamptz, updated_at timestamptz,
  primary key(external_source,external_id)
);
create table bets (
  id uuid primary key default gen_random_uuid(), user_id uuid, target_user_id uuid,
  media_external_id text, media_external_source text, external_id text,
  external_source text, status text, prediction text
);
create table list_collaborators (list_id uuid, user_id uuid);
create table media_match_scores (id uuid primary key default gen_random_uuid());
create table media_progress_events (id uuid primary key default gen_random_uuid());
create table notifications (
  id uuid default gen_random_uuid(), user_id uuid, type text, title text,
  message text, data jsonb
);
