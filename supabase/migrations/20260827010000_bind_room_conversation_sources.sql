-- Server-issued topic records bind a generated preview to real source metadata.
CREATE TABLE IF NOT EXISTS public.admin_room_topic_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  topic text NOT NULL CHECK (char_length(topic) BETWEEN 10 AND 280),
  summary text NOT NULL DEFAULT '' CHECK (char_length(summary) <= 500),
  source_name text NOT NULL CHECK (char_length(source_name) BETWEEN 1 AND 120),
  source_url text NOT NULL CHECK (source_url ~ '^https?://'),
  published_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  safety text NOT NULL DEFAULT 'Safety-screened',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '6 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_room_topic_suggestions_room_expiry_idx
  ON public.admin_room_topic_suggestions(room_id, expires_at DESC);

ALTER TABLE public.admin_room_topic_suggestions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_room_topic_suggestions FROM anon, authenticated;

-- A short-lived service-only lock prevents concurrent exact-deficit provisioning.
CREATE TABLE IF NOT EXISTS public.admin_room_persona_provision_locks (
  room_id uuid PRIMARY KEY REFERENCES public.pools(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_room_persona_provision_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_room_persona_provision_locks FROM anon, authenticated;