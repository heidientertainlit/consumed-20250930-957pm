-- ============================================================
-- PostHog Analytics Triggers for Consumed
-- ============================================================
-- 
-- SETUP STEPS (do these in order):
--
-- 1. In Supabase Dashboard > Edge Functions, add these secrets:
--    - POSTHOG_API_KEY = your PostHog project API key
--    - ANALYTICS_WEBHOOK_SECRET = any random string you choose (e.g. "my-secret-key-123")
--
-- 2. Deploy the edge function (with no JWT verification):
--    supabase functions deploy track-analytics --no-verify-jwt
--
-- 3. Run this SQL in Supabase SQL Editor
--
-- 4. After running, execute this one line (replace the secret with 
--    the SAME value you used for ANALYTICS_WEBHOOK_SECRET above):
--    ALTER DATABASE postgres SET app.settings.analytics_webhook_secret = 'my-secret-key-123';
--
-- ============================================================

-- Enable pg_net for async HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================
-- Trigger function: sends events to PostHog via edge function
-- ============================================================
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
  edge_url text;
  webhook_secret text;
BEGIN
  -- Build edge function URL from Supabase project URL
  edge_url := 'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/track-analytics';
  
  -- Get the shared secret for authenticating with the edge function
  webhook_secret := current_setting('app.settings.analytics_webhook_secret', true);

  -- ======== TABLE: list_items ========
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

  -- ======== TABLE: user_predictions ========
  ELSIF TG_TABLE_NAME = 'user_predictions' AND TG_OP = 'INSERT' THEN
    user_id_val := COALESCE(NEW.user_id::text, '');
    event_name := 'prediction_made';
    event_properties := jsonb_build_object(
      'pool_id', COALESCE(NEW.pool_id::text, '')
    );

  -- ======== TABLE: dna_profiles ========
  ELSIF TG_TABLE_NAME = 'dna_profiles' AND TG_OP = 'INSERT' THEN
    user_id_val := COALESCE(NEW.user_id::text, '');
    event_name := 'dna_profile_generated';
    event_properties := jsonb_build_object(
      'dna_type', COALESCE(NEW.dna_type, '')
    );

  -- ======== TABLE: dna_moment_responses ========
  ELSIF TG_TABLE_NAME = 'dna_moment_responses' AND TG_OP = 'INSERT' THEN
    user_id_val := COALESCE(NEW.user_id::text, '');
    event_name := 'dna_moment_answered';
    event_properties := jsonb_build_object(
      'moment_id', COALESCE(NEW.moment_id::text, '')
    );

  -- ======== TABLE: lists ========
  ELSIF TG_TABLE_NAME = 'lists' AND TG_OP = 'INSERT' THEN
    user_id_val := COALESCE(NEW.user_id::text, '');
    event_name := 'list_created';
    event_properties := jsonb_build_object(
      'list_name', COALESCE(NEW.name, '')
    );

  -- ======== TABLE: login_streaks ========
  ELSIF TG_TABLE_NAME = 'login_streaks' THEN
    user_id_val := COALESCE(NEW.user_id::text, '');
    event_name := 'streak_updated';
    event_properties := jsonb_build_object(
      'current_streak', COALESCE(NEW.current_streak, 0),
      'longest_streak', COALESCE(NEW.longest_streak, 0)
    );

  -- ======== TABLE: friendships ========
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

  -- ======== TABLE: posts ========
  ELSIF TG_TABLE_NAME = 'posts' AND TG_OP = 'INSERT' THEN
    user_id_val := COALESCE(NEW.user_id::text, '');
    event_name := 'post_created';
    event_properties := jsonb_build_object(
      'post_type', COALESCE(NEW.type, 'text')
    );

  -- ======== TABLE: users (sign-ups) ========
  ELSIF TG_TABLE_NAME = 'users' AND TG_OP = 'INSERT' THEN
    user_id_val := COALESCE(NEW.id::text, '');
    event_name := 'user_signed_up';
    event_properties := '{}'::jsonb;

  END IF;

  -- Send to PostHog via edge function (non-blocking via pg_net)
  IF event_name IS NOT NULL AND user_id_val IS NOT NULL AND user_id_val != '' THEN
    PERFORM net.http_post(
      url := edge_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-analytics-key', COALESCE(webhook_secret, '')
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


-- ============================================================
-- Create triggers (AFTER = never blocks the user's action)
-- ============================================================

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

DROP TRIGGER IF EXISTS posthog_posts ON public.posts;
CREATE TRIGGER posthog_posts
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_posthog();

DROP TRIGGER IF EXISTS posthog_users ON public.users;
CREATE TRIGGER posthog_users
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.notify_posthog();
