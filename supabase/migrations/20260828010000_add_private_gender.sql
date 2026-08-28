ALTER TABLE public.user_private_details
  ADD COLUMN IF NOT EXISTS gender text;

ALTER TABLE public.user_private_details
  DROP CONSTRAINT IF EXISTS user_private_details_gender_check;

ALTER TABLE public.user_private_details
  ADD CONSTRAINT user_private_details_gender_check
  CHECK (gender IS NULL OR gender IN ('male', 'female'));

COMMENT ON COLUMN public.user_private_details.gender IS
  'Private self-selected gender collected during profile setup.';