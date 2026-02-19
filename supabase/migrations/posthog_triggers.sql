-- ============================================================
-- PostHog Analytics Triggers for Consumed (v2 - fixed)
-- ============================================================
-- 
-- SETUP STEPS:
-- 1. Add POSTHOG_API_KEY and ANALYTICS_WEBHOOK_SECRET as 
--    Edge Function secrets in Supabase Dashboard
-- 2. Deploy: supabase functions deploy track-analytics --no-verify-jwt
-- 3. Run this SQL in Supabase SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_posthog()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  event_name text := NULL;
  event_properties jsonb := '{}'::jsonb;
  user_id_val text := NULL;
  edge_url text := 'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/track-analytics';
  webhook_secret text := 'hfbwpasjdd7927alskdfbabsldyha287103jduwoqkdndh19993716392628';
BEGIN

  IF TG_TABLE_NAME = 'list_items' THEN
    user_id_val := COALESCE(NEW.user_id::text, '');
    IF TG_OP = 'INSERT' THEN
      event_name := 'media_added';
      event_properties := jsonb_build_object(
        'media_type', COALESCE(NEW.media_type, 'unknown'),
        'title', COALESCE(NEW.title, ''),
        'external_source', COALESCE(NEW.external_source, '')
      );
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
      event_name := 'media_status_changed';
      event_properties := jsonb_build_object(
        'media_type', COALESCE(NEW.media_type, 'unknown'),
        'title', COALESCE(NEW.title, ''),
        'old_status', COALESCE(OLD.status, ''),
        'new_status', COALESCE(NEW.status, '')
      );
    END IF;

  ELSIF TG_TABLE_NAME = 'user_predictions' AND TG_OP = 'INSERT' THEN
    user_id_val := COALESCE(NEW.user_id::text, '');
    event_name := 'prediction_made';
    event_properties := jsonb_build_object(
      'pool_id', COALESCE(NEW.pool_id::text, '')
    );

  ELSIF TG_TABLE_NAME = 'dna_profiles' AND TG_OP = 'INSERT' THEN
    user_id_val := COALESCE(NEW.user_id::text, '');
    event_name := 'dna_profile_generated';
    event_properties := jsonb_build_object(
      'dna_type', COALESCE(NEW.dna_type, '')
    );

  ELSIF TG_TABLE_NAME = 'dna_moment_responses' AND TG_OP = 'INSERT' THEN
    user_id_val := COALESCE(NEW.user_id::text, '');
    event_name := 'dna_moment_answered';
    event_properties := jsonb_build_object(
      'moment_id', COALESCE(NEW.moment_id::text, '')
    );

  ELSIF TG_TABLE_NAME = 'lists' AND TG_OP = 'INSERT' THEN
    user_id_val := COALESCE(NEW.user_id::text, '');
    event_name := 'list_created';
    event_properties := jsonb_build_object(
      'list_name', COALESCE(NEW.name, '')
    );

  ELSIF TG_TABLE_NAME = 'login_streaks' THEN
    user_id_val := COALESCE(NEW.user_id::text, '');
    event_name := 'streak_updated';
    event_properties := jsonb_build_object(
      'current_streak', COALESCE(NEW.current_streak, 0),
      'longest_streak', COALESCE(NEW.longest_streak, 0)
    );

  ELSIF TG_TABLE_NAME = 'friendships' THEN
    user_id_val := COALESCE(NEW.user_id::text, '');
    IF TG_OP = 'INSERT' THEN
      event_name := 'friend_request_sent';
      event_properties := jsonb_build_object(
        'friend_id', COALESCE(NEW.friend_id::text, '')
      );
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' THEN
      event_name := 'friend_added';
      event_properties := jsonb_build_object(
        'friend_id', COALESCE(NEW.friend_id::text, '')
      );
    END IF;

  ELSIF TG_TABLE_NAME = 'users' AND TG_OP = 'INSERT' THEN
    user_id_val := COALESCE(NEW.id::text, '');
    event_name := 'user_signed_up';
    event_properties := '{}'::jsonb;

  END IF;

  IF event_name IS NOT NULL AND user_id_val IS NOT NULL AND user_id_val != '' THEN
    PERFORM net.http_post(
      url := edge_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-analytics-key', webhook_secret
      )::jsonb,
      body := jsonb_build_object(
        'event', event_name,
        'distinct_id', user_id_val,
        'properties', event_properties
      )::jsonb
    );
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'PostHog tracking failed: %', SQLERRM;
  RETURN NEW;
END;
$$;


-- Triggers (only on tables that exist)

DROP TRIGGER IF EXISTS posthog_list_items ON public.list_items;
CREATE TRIGGER posthog_list_items
  AFTER INSERT OR UPDATE ON public.list_items
  FOR EACH ROW EXECUTE FUNCTION public.notify_posthog();

DROP TRIGGER IF EXISTS posthog_user_predictions ON public.user_predictions;
CREATE TRIGGER posthog_user_predictions
  AFTER INSERT ON public.user_predictions
  FOR EACH ROW EXECUTE FUNCTION public.notify_posthog();

DROP TRIGGER IF EXISTS posthog_dna_profiles ON public.dna_profiles;
CREATE TRIGGER posthog_dna_profiles
  AFTER INSERT ON public.dna_profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_posthog();

DROP TRIGGER IF EXISTS posthog_dna_moment_responses ON public.dna_moment_responses;
CREATE TRIGGER posthog_dna_moment_responses
  AFTER INSERT ON public.dna_moment_responses
  FOR EACH ROW EXECUTE FUNCTION public.notify_posthog();

DROP TRIGGER IF EXISTS posthog_lists ON public.lists;
CREATE TRIGGER posthog_lists
  AFTER INSERT ON public.lists
  FOR EACH ROW EXECUTE FUNCTION public.notify_posthog();

DROP TRIGGER IF EXISTS posthog_login_streaks ON public.login_streaks;
CREATE TRIGGER posthog_login_streaks
  AFTER INSERT OR UPDATE ON public.login_streaks
  FOR EACH ROW EXECUTE FUNCTION public.notify_posthog();

DROP TRIGGER IF EXISTS posthog_friendships ON public.friendships;
CREATE TRIGGER posthog_friendships
  AFTER INSERT OR UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.notify_posthog();

DROP TRIGGER IF EXISTS posthog_users ON public.users;
CREATE TRIGGER posthog_users
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.notify_posthog();
