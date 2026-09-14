-- Section 1 PostHog controlled ingestion.
--
-- This migration does not rotate a capture token, delete PostHog people or
-- events, create provider-cleanup jobs, or enable any cleanup flag.  It adds
-- only the controlled PostHog ingress and auth-delete tombstone trigger.  The
-- immutable deletion tombstone schema is authoritative in
-- `20260914000700_provider_deletion_queue.sql`; this migration must run after
-- that migration and does not duplicate or redefine its queue/schema controls.
-- It also replaces the legacy trigger envelope so newly created database
-- producers send `user_id`. During the Edge/function rollout,
-- track-analytics accepts the old trusted `distinct_id` envelope as a
-- transitional compatibility input and resolves either value through the live
-- public.users row; the old producer is not changed until that compatibility
-- path is tested.
--
-- Before installing:
--   * store the existing analytics webhook secret in Vault as
--     `analytics_webhook_secret`;
--   * keep the exact same value in the track-analytics
--     `ANALYTICS_WEBHOOK_SECRET` Edge secret;
--   * deploy the reviewed track-analytics bundle.
-- Missing Vault configuration intentionally stops the asynchronous producer
-- rather than sending an unauthenticated request.

do $$
begin
  if to_regclass('public.deleted_account_tombstones') is null then
    raise exception
      '20260914000700_provider_deletion_queue.sql must be applied before PostHog ingress';
  end if;
end;
$$;

-- The table, immutable trigger, RLS, and service-role grant are owned by 007.
-- Do not recreate them here: migration ordering is part of the release gate.

-- Auth deletion is already performed inside the existing transactional account
-- deletion RPC.  The trigger therefore commits/rolls back atomically with the
-- first-party deletion and records no provider payload or person identifier.
create or replace function public.record_deleted_account_tombstone()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.deleted_account_tombstones (user_id)
  values (old.id)
  on conflict (user_id) do nothing;
  return old;
end;
$$;

drop trigger if exists record_deleted_account_tombstone
  on auth.users;
create trigger record_deleted_account_tombstone
after delete on auth.users
for each row execute function public.record_deleted_account_tombstone();

revoke all on function public.record_deleted_account_tombstone()
from public, anon, authenticated;
grant execute on function public.record_deleted_account_tombstone()
to service_role;

-- Keep the existing table trigger inventory and event names. The new producer
-- contract is `user_id` in the trusted server envelope and Vault-backed
-- webhook authentication. The Edge function also temporarily accepts the old
-- trusted `distinct_id` field so migration ordering cannot drop events; either
-- field is resolved against the exact public.users row immediately before its
-- provider request.
create or replace function public.notify_posthog()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  event_name text := null;
  event_properties jsonb := '{}'::jsonb;
  user_id_val text := null;
  edge_url constant text :=
    'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/track-analytics';
  webhook_secret text;
begin
  select decrypted_secret
    into webhook_secret
  from vault.decrypted_secrets
  where name = 'analytics_webhook_secret'
  order by created_at desc
  limit 1;

  if webhook_secret is null or btrim(webhook_secret) = '' then
    raise warning 'PostHog analytics webhook is not configured in Vault';
    return new;
  end if;

  if TG_TABLE_NAME = 'list_items' then
    user_id_val := coalesce(NEW.user_id::text, '');
    if TG_OP = 'INSERT' then
      event_name := 'media_added';
      event_properties := jsonb_build_object(
        'media_type', coalesce(NEW.media_type, 'unknown'),
        'title', coalesce(NEW.title, ''),
        'external_source', coalesce(NEW.external_source, '')
      );
    elsif TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status then
      event_name := 'media_status_changed';
      event_properties := jsonb_build_object(
        'media_type', coalesce(NEW.media_type, 'unknown'),
        'title', coalesce(NEW.title, ''),
        'old_status', coalesce(OLD.status, ''),
        'new_status', coalesce(NEW.status, '')
      );
    end if;

  elsif TG_TABLE_NAME = 'user_predictions' and TG_OP = 'INSERT' then
    user_id_val := coalesce(NEW.user_id::text, '');
    event_name := 'prediction_made';
    event_properties := jsonb_build_object(
      'pool_id', coalesce(NEW.pool_id::text, '')
    );

  elsif TG_TABLE_NAME = 'dna_profiles' and TG_OP = 'INSERT' then
    user_id_val := coalesce(NEW.user_id::text, '');
    event_name := 'dna_profile_generated';
    event_properties := jsonb_build_object(
      'dna_type', coalesce(NEW.dna_type, '')
    );

  elsif TG_TABLE_NAME = 'dna_moment_responses' and TG_OP = 'INSERT' then
    user_id_val := coalesce(NEW.user_id::text, '');
    event_name := 'dna_moment_answered';
    event_properties := jsonb_build_object(
      'moment_id', coalesce(NEW.moment_id::text, '')
    );

  elsif TG_TABLE_NAME = 'lists' and TG_OP = 'INSERT' then
    user_id_val := coalesce(NEW.user_id::text, '');
    event_name := 'list_created';
    event_properties := jsonb_build_object(
      'list_name', coalesce(NEW.name, '')
    );

  elsif TG_TABLE_NAME = 'login_streaks' then
    user_id_val := coalesce(NEW.user_id::text, '');
    event_name := 'streak_updated';
    event_properties := jsonb_build_object(
      'current_streak', coalesce(NEW.current_streak, 0),
      'longest_streak', coalesce(NEW.longest_streak, 0)
    );

  elsif TG_TABLE_NAME = 'friendships' then
    user_id_val := coalesce(NEW.user_id::text, '');
    if TG_OP = 'INSERT' then
      event_name := 'friend_request_sent';
      event_properties := jsonb_build_object(
        'friend_id', coalesce(NEW.friend_id::text, '')
      );
    elsif TG_OP = 'UPDATE' and NEW.status = 'accepted' then
      event_name := 'friend_added';
      event_properties := jsonb_build_object(
        'friend_id', coalesce(NEW.friend_id::text, '')
      );
    end if;

  elsif TG_TABLE_NAME = 'users' and TG_OP = 'INSERT' then
    user_id_val := coalesce(NEW.id::text, '');
    event_name := 'user_signed_up';
    event_properties := '{}'::jsonb;
  end if;

  if event_name is not null and user_id_val is not null and user_id_val <> '' then
    perform net.http_post(
      url := edge_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-analytics-key', webhook_secret
      )::jsonb,
      body := jsonb_build_object(
        'event', event_name,
        'user_id', user_id_val,
        'properties', event_properties
      )::jsonb
    );
  end if;

  return new;
exception when others then
  -- A provider outage must not fail a first-party write.  The Edge function
  -- itself remains fail-closed and the webhook is still authenticated.
  raise warning 'PostHog tracking failed: %', SQLERRM;
  return new;
end;
$$;
