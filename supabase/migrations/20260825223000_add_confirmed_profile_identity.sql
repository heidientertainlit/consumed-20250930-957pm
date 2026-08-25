ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS identity_confirmed_at timestamptz;

-- Existing DNA users have already completed the full onboarding flow.
UPDATE public.users AS app_user
SET identity_confirmed_at = COALESCE(app_user.identity_confirmed_at, app_user.created_at, now())
WHERE app_user.identity_confirmed_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.dna_profiles AS dna
    WHERE dna.user_id = app_user.id
  );

-- Preserve completed email signups that supplied every identity field.
UPDATE public.users AS app_user
SET identity_confirmed_at = COALESCE(app_user.identity_confirmed_at, app_user.created_at, now())
FROM auth.users AS auth_user
WHERE app_user.id = auth_user.id
  AND app_user.identity_confirmed_at IS NULL
  AND NULLIF(btrim(auth_user.raw_user_meta_data ->> 'first_name'), '') IS NOT NULL
  AND NULLIF(btrim(auth_user.raw_user_meta_data ->> 'last_name'), '') IS NOT NULL
  AND NULLIF(btrim(auth_user.raw_user_meta_data ->> 'user_name'), '') IS NOT NULL;

-- A normal UNIQUE(user_name) constraint is case-sensitive in Postgres.
-- This index makes availability checks race-safe and case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS users_user_name_lower_unique
  ON public.users (lower(user_name));

CREATE OR REPLACE FUNCTION public.protect_identity_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF (
    (TG_OP = 'INSERT' AND NEW.identity_confirmed_at IS NOT NULL)
    OR (
      TG_OP = 'UPDATE'
      AND NEW.identity_confirmed_at IS DISTINCT FROM OLD.identity_confirmed_at
    )
  )
  AND COALESCE(auth.role(), '') <> 'service_role'
  AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
  THEN
    RAISE EXCEPTION 'identity confirmation can only be changed by the profile completion service'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_users_identity_confirmation ON public.users;
CREATE TRIGGER protect_users_identity_confirmation
BEFORE INSERT OR UPDATE OF identity_confirmed_at ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.protect_identity_confirmation();