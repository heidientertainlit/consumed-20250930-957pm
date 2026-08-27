ALTER TABLE public.dna_profiles
  ADD COLUMN IF NOT EXISTS requires_identity_customization boolean;

UPDATE public.dna_profiles
SET requires_identity_customization = false
WHERE requires_identity_customization IS NULL;

ALTER TABLE public.dna_profiles
  ALTER COLUMN requires_identity_customization SET DEFAULT true,
  ALTER COLUMN requires_identity_customization SET NOT NULL;

COMMENT ON COLUMN public.dna_profiles.requires_identity_customization IS
  'True for DNA profiles created after identity customization moved behind the DNA reveal.';