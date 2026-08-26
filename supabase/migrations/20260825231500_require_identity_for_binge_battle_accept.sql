CREATE OR REPLACE FUNCTION public.require_identity_for_binge_battle_accept()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.opponent_id IS DISTINCT FROM OLD.opponent_id
    AND NEW.opponent_id IS NOT NULL
    AND COALESCE(auth.role(), '') = 'authenticated'
    AND NOT EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND identity_confirmed_at IS NOT NULL
    )
  THEN
    RAISE EXCEPTION 'complete profile setup before accepting a binge battle'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_identity_before_binge_battle_accept ON public.binge_battles;
CREATE TRIGGER require_identity_before_binge_battle_accept
BEFORE UPDATE OF opponent_id ON public.binge_battles
FOR EACH ROW
EXECUTE FUNCTION public.require_identity_for_binge_battle_accept();