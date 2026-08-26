-- Preserve structured media selections on room conversations and replies.
-- All fields are nullable so existing content remains valid.

alter table public.room_takes
  add column if not exists media_subtype text,
  add column if not exists media_season_number integer,
  add column if not exists media_episode_number integer,
  add column if not exists media_episode_title text,
  add column if not exists media_url text;

alter table public.room_take_replies
  add column if not exists media_title text,
  add column if not exists media_type text,
  add column if not exists media_creator text,
  add column if not exists media_image_url text,
  add column if not exists media_external_id text,
  add column if not exists media_external_source text,
  add column if not exists media_subtype text,
  add column if not exists media_season_number integer,
  add column if not exists media_episode_number integer,
  add column if not exists media_episode_title text,
  add column if not exists media_url text;

alter table public.room_takes
  drop constraint if exists room_takes_media_url_http,
  add constraint room_takes_media_url_http
    check (media_url is null or media_url ~* '^https?://');

alter table public.room_take_replies
  drop constraint if exists room_take_replies_media_url_http,
  add constraint room_take_replies_media_url_http
    check (media_url is null or media_url ~* '^https?://');