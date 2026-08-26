-- Supabase may grant new public functions directly to API roles.
-- Keep persona publication callable only from the service-role Edge Function.
REVOKE ALL ON FUNCTION public.publish_admin_room_conversation(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_admin_room_conversation(uuid, uuid)
  TO service_role;