create table if not exists public.app_version_config (
  platform text primary key check (platform in ('ios', 'android')),
  latest_version text not null check (
    latest_version ~ '^v?[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z.-]+)?$'
  ),
  minimum_supported_version text not null check (
    minimum_supported_version ~ '^v?[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z.-]+)?$'
  ),
  app_store_url text not null check (app_store_url ~ '^https://apps\.apple\.com/'),
  updated_at timestamptz not null default now()
);

alter table public.app_version_config enable row level security;

drop policy if exists "app version config is publicly readable"
  on public.app_version_config;
create policy "app version config is publicly readable"
  on public.app_version_config
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.app_version_config from anon, authenticated;
grant select on public.app_version_config to anon, authenticated;

insert into public.app_version_config (
  platform,
  latest_version,
  minimum_supported_version,
  app_store_url
)
values (
  'ios',
  '1.0.7',
  '1.0.7',
  'https://apps.apple.com/us/app/consumed-track-play/id6759014223'
)
on conflict (platform) do update
set app_store_url = excluded.app_store_url,
    updated_at = now();