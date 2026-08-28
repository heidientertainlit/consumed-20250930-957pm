CREATE TABLE IF NOT EXISTS public.user_private_details (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  birth_date date NOT NULL CHECK (birth_date <= CURRENT_DATE),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_private_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their private details" ON public.user_private_details;
CREATE POLICY "Users can read their private details"
  ON public.user_private_details
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON public.user_private_details FROM anon;
REVOKE ALL ON public.user_private_details FROM authenticated;
GRANT SELECT ON public.user_private_details TO authenticated;

COMMENT ON TABLE public.user_private_details IS
  'Private account details that must not be exposed through the public users profile.';