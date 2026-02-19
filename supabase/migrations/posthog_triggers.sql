-- ============================================================
-- PostHog Analytics Triggers for Consumed
-- ============================================================
-- Run this ENTIRE script in your Supabase SQL Editor.
-- 
-- BEFORE RUNNING: You must do these 2 things first:
--   1. Deploy the track-analytics edge function
--   2. Add POSTHOG_API_KEY as a secret in Supabase Edge Functions
--
-- This uses Supabase's built-in pg_net extension to make HTTP calls
-- from database triggers without blocking user operations.
-- ============================================================

-- Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================
-- The main trigger function
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
  edge_url text := 'https://mahpgcogwpawvviapqza.supabase.co/functions/v1/track-analytics';
  svc_key text;
BEGIN
  -- Get service role key from vault or env
  svc_key := current_setting('request.headers', true)::json->>'authorization';
  
  -- Fallback: use the service role key directly
  -- You'll set this below with ALTER DATABASE
  IF svc_key IS NULL THEN
    svc_key := current_setting('app.settings.service_role_key', true);
  END IF;

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
  ELSIF TG_TABLE_NAME = 'user_predictions' THEN
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

  -- Send to PostHog via edge function (non-blocking)
  IF event_name IS NOT NULL AND user_id_val IS NOT NULL AND user_id_val != '' THEN
    PERFORM net.http_post(
      url := edge_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || svc_key
      )::jsonb,
      body := jsonb_build_object(
        'event', event_name,
        'distinct_id', user_id_val,
        'properties', event_properties,
        'timestamp', extract(epoch from now())
      )::jsonb
    );
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- NEVER block the user's action if analytics fails
  RAISE WARNING 'PostHog tracking failed: %', SQLERRM;
  RETURN NEW;
END;
$$;


-- ============================================================
-- Create triggers on each table
-- All triggers fire AFTER so they never block the user's action
-- ============================================================

-- list_items → media_added, media_status_changed
DROP TRIGGER IF EXISTS posthog_list_items ON public.list_items;
CREATE TRIGGER posthog_list_items
  AFTER INSERT OR UPDATE ON public.list_items
  FOR EACH ROW EXECUTE FUNCTION public.notify_posthog();

-- user_predictions → prediction_made
DROP TRIGGER IF EXISTS posthog_user_predictions ON public.user_predictions;
CREATE TRIGGER posthog_user_predictions
  AFTER INSERT ON public.user_predictions
  FOR EACH ROW EXECUTE FUNCTION public.notify_posthog();

-- dna_profiles → dna_profile_generated
DROP TRIGGER IF EXISTS posthog_dna_profiles ON public.dna_profiles;
CREATE TRIGGER posthog_dna_profiles
  AFTER INSERT ON public.dna_profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_posthog();

-- dna_moment_responses → dna_moment_answered
DROP TRIGGER IF EXISTS posthog_dna_moment_responses ON public.dna_moment_responses;
CREATE TRIGGER posthog_dna_moment_responses
  AFTER INSERT ON public.dna_moment_responses
  FOR EACH ROW EXECUTE FUNCTION public.notify_posthog();

-- lists → list_created
DROP TRIGGER IF EXISTS posthog_lists ON public.lists;
CREATE TRIGGER posthog_lists
  AFTER INSERT ON public.lists
  FOR EACH ROW EXECUTE FUNCTION public.notify_posthog();

-- login_streaks → streak_updated
DROP TRIGGER IF EXISTS posthog_login_streaks ON public.login_streaks;
CREATE TRIGGER posthog_login_streaks
  AFTER INSERT OR UPDATE ON public.login_streaks
  FOR EACH ROW EXECUTE FUNCTION public.notify_posthog();

-- friendships → friend_request_sent, friend_added
DROP TRIGGER IF EXISTS posthog_friendships ON public.friendships;
CREATE TRIGGER posthog_friendships
  AFTER INSERT OR UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.notify_posthog();

-- posts → post_created
DROP TRIGGER IF EXISTS posthog_posts ON public.posts;
CREATE TRIGGER posthog_posts
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_posthog();

-- users → user_signed_up
DROP TRIGGER IF EXISTS posthog_users ON public.users;
CREATE TRIGGER posthog_users
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.notify_posthog();


-- ============================================================
-- IMPORTANT: Set your service role key
-- Replace YOUR_SERVICE_ROLE_KEY with your actual key from
-- Supabase Dashboard > Settings > API > service_role key
-- ============================================================
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
