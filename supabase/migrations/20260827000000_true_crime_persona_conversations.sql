-- Admin-only, reviewable generation runs for official true-crime rooms.
ALTER TABLE public.pools ADD COLUMN IF NOT EXISTS series_tag text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.admin_room_conversation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.users(id),
  topic text NOT NULL CHECK (char_length(topic) BETWEEN 10 AND 280),
  source_attribution jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'failed')),
  published_take_id uuid REFERENCES public.room_takes(id),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_room_conversation_runs_published_once CHECK (
    (status <> 'published') OR (published_take_id IS NOT NULL AND published_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.admin_room_conversation_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.admin_room_conversation_runs(id) ON DELETE CASCADE,
  client_id text NOT NULL CHECK (client_id ~ '^[a-z0-9_-]{1,64}$'),
  participant_id uuid NOT NULL REFERENCES public.users(id),
  parent_client_id text,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1200),
  position integer NOT NULL CHECK (position BETWEEN 0 AND 19),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, client_id),
  UNIQUE (run_id, position),
  CHECK ((position = 0 AND parent_client_id IS NULL) OR (position > 0 AND parent_client_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS admin_room_conversation_runs_room_created_idx
  ON public.admin_room_conversation_runs(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_room_conversation_drafts_run_position_idx
  ON public.admin_room_conversation_drafts(run_id, position);

ALTER TABLE public.admin_room_conversation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_room_conversation_drafts ENABLE ROW LEVEL SECURITY;
-- No browser role receives draft access. The Edge Function uses service role.

CREATE OR REPLACE FUNCTION public.publish_admin_room_conversation(p_run_id uuid, p_admin_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.admin_room_conversation_runs%ROWTYPE;
  v_take_id uuid;
  v_root_client_id text;
  v_root public.admin_room_conversation_drafts%ROWTYPE;
  v_draft public.admin_room_conversation_drafts%ROWTYPE;
  v_reply_id uuid;
  v_reply_ids jsonb := '{}'::jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_admin_id AND is_admin) THEN
    RAISE EXCEPTION 'admin authorization required';
  END IF;
  SELECT * INTO v_run FROM public.admin_room_conversation_runs WHERE id = p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'run not found'; END IF;
  IF v_run.status = 'published' THEN RETURN v_run.published_take_id; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pools WHERE id = v_run.room_id AND is_official AND series_tag = 'true-crime') THEN
    RAISE EXCEPTION 'room is not an official true-crime room';
  END IF;
  IF (SELECT count(*) FROM public.admin_room_conversation_drafts WHERE run_id = p_run_id) <> 20
     OR (SELECT count(DISTINCT participant_id) FROM public.admin_room_conversation_drafts WHERE run_id = p_run_id) <> 20 THEN
    RAISE EXCEPTION 'run must contain exactly 20 distinct participants';
  END IF;
  SELECT * INTO v_root FROM public.admin_room_conversation_drafts
    WHERE run_id = p_run_id AND position = 0;
  INSERT INTO public.room_takes (room_id, user_id, title, body, tag, reply_count)
  VALUES (v_run.room_id, v_root.participant_id, left(v_run.topic, 280), v_root.body, 'discussion', 19)
  RETURNING id INTO v_take_id;
  FOR v_draft IN SELECT * FROM public.admin_room_conversation_drafts
    WHERE run_id = p_run_id AND position > 0 ORDER BY position LOOP
    IF NOT (v_reply_ids ? v_draft.parent_client_id) AND v_draft.parent_client_id <> v_root.client_id THEN
      RAISE EXCEPTION 'draft parent is missing';
    END IF;
    INSERT INTO public.room_take_replies (take_id, parent_reply_id, user_id, content)
    VALUES (v_take_id,
      CASE WHEN v_draft.parent_client_id = v_root.client_id THEN NULL
           ELSE (v_reply_ids ->> v_draft.parent_client_id)::uuid END,
      v_draft.participant_id, v_draft.body)
    RETURNING id INTO v_reply_id;
    v_reply_ids := v_reply_ids || jsonb_build_object(v_draft.client_id, v_reply_id);
  END LOOP;
  UPDATE public.admin_room_conversation_runs
  SET status = 'published', published_take_id = v_take_id, published_at = now()
  WHERE id = p_run_id;
  RETURN v_take_id;
END;
$$;

REVOKE ALL ON TABLE public.admin_room_conversation_runs, public.admin_room_conversation_drafts FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_admin_room_conversation(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_admin_room_conversation(uuid, uuid) TO service_role;