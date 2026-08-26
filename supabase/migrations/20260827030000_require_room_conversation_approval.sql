ALTER TABLE public.admin_room_conversation_runs
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE OR REPLACE FUNCTION public.prevent_approved_room_conversation_draft_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_run_id uuid := COALESCE(NEW.run_id, OLD.run_id);
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.admin_room_conversation_runs
    WHERE id = v_run_id AND approved_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Approved conversation drafts are immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS prevent_approved_room_conversation_draft_mutation
  ON public.admin_room_conversation_drafts;
CREATE TRIGGER prevent_approved_room_conversation_draft_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.admin_room_conversation_drafts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_approved_room_conversation_draft_mutation();

-- Preserve the tested publication implementation behind an approval-enforcing wrapper.
ALTER FUNCTION public.publish_admin_room_conversation(uuid, uuid)
  RENAME TO publish_approved_admin_room_conversation_internal;

CREATE FUNCTION public.publish_admin_room_conversation(p_run_id uuid, p_admin_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_approved_by uuid;
  v_approved_at timestamptz;
BEGIN
  SELECT approved_by, approved_at
  INTO v_approved_by, v_approved_at
  FROM public.admin_room_conversation_runs
  WHERE id = p_run_id;

  IF v_approved_at IS NULL OR v_approved_by IS DISTINCT FROM p_admin_id THEN
    RAISE EXCEPTION 'Conversation must be approved by the publishing admin';
  END IF;

  RETURN public.publish_approved_admin_room_conversation_internal(p_run_id, p_admin_id);
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_approved_room_conversation_draft_mutation()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_approved_admin_room_conversation_internal(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_admin_room_conversation(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_approved_admin_room_conversation_internal(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_admin_room_conversation(uuid, uuid)
  TO service_role;