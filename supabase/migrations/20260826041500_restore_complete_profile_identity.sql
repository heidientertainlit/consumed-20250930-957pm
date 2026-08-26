-- Complete legacy profiles should not be interrupted by a redundant setup
-- screen. Established DNA users already completed onboarding, and email
-- signups explicitly supplied these fields. Other OAuth accounts remain
-- unconfirmed until they choose an app username through complete-profile.
UPDATE public.users AS app_user
SET identity_confirmed_at = COALESCE(app_user.identity_confirmed_at, app_user.created_at, now())
WHERE app_user.identity_confirmed_at IS NULL
  AND app_user.created_at < timestamptz '2026-08-26 04:15:00+00'
  AND NULLIF(btrim(app_user.first_name), '') IS NOT NULL
  AND NULLIF(btrim(app_user.last_name), '') IS NOT NULL
  AND lower(btrim(app_user.user_name)) ~ '^[a-z0-9_]{3,20}$'
  AND (
    EXISTS (
      SELECT 1
      FROM public.dna_profiles AS dna
      WHERE dna.user_id = app_user.id
    )
    OR EXISTS (
      SELECT 1
      FROM auth.users AS auth_user
      WHERE auth_user.id = app_user.id
        AND COALESCE(auth_user.raw_app_meta_data ->> 'provider', '') = 'email'
        AND NULLIF(btrim(auth_user.raw_user_meta_data ->> 'first_name'), '') IS NOT NULL
        AND NULLIF(btrim(auth_user.raw_user_meta_data ->> 'last_name'), '') IS NOT NULL
        AND lower(btrim(auth_user.raw_user_meta_data ->> 'user_name')) ~ '^[a-z0-9_]{3,20}$'
    )
  );